import type { ProviderSendParams, ToolCallRecord, ProviderToolUseBlock } from './types';
import { filterResponseHeaders } from './types';
import type { TokenUsage } from '../../types';
import { formatMessagesForChatCompletions } from './openai-chat-completions';

export interface ResponsesApiConnection {
  baseUrl: string;
  apiKey: string;
  endpoint: string;  // model name or Azure deployment name
}

// --- Responses API input item types ---

export interface ResponsesApiInputItem {
  type: string;
  [key: string]: unknown;
}

/**
 * Build Responses API input items from ProviderSendParams messages.
 * Converts the internal message format to Responses API typed items.
 */
export function buildResponsesApiInput(
  params: ProviderSendParams,
): ResponsesApiInputItem[] {
  const items: ResponsesApiInputItem[] = [];
  const endItems: ResponsesApiInputItem[] = [];  // injectAtEnd reasoning blocks

  // Find the last assistant message index — injectAtEnd only applies there
  let lastAssistantIdx = -1;
  for (let i = params.messages.length - 1; i >= 0; i--) {
    if (params.messages[i].role === 'assistant' && !params.messages[i].messageType) {
      lastAssistantIdx = i;
      break;
    }
  }

  // System prompt → developer message
  if (params.systemPrompt) {
    items.push({
      type: 'message',
      role: 'developer',
      content: [{ type: 'input_text', text: params.systemPrompt }],
    });
  }

  for (let mi = 0; mi < params.messages.length; mi++) {
    const m = params.messages[mi];
    // Tool invocations → function_call items
    if (m.messageType === 'tool_invocations' && m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        items.push({
          type: 'function_call',
          call_id: `call_${tc.id.replace(/-/g, '').slice(0, 24)}`,
          name: tc.toolName,
          arguments: JSON.stringify(tc.input),
        });
      }
      continue;
    }

    // Tool results → function_call_output items
    if (m.messageType === 'tool_results' && m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        items.push({
          type: 'function_call_output',
          call_id: `call_${tc.id.replace(/-/g, '').slice(0, 24)}`,
          output: tc.result ?? '',
        });
      }
      continue;
    }

    if (m.role === 'user') {
      items.push({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: m.content }],
      });
    } else {
      // Assistant message — inject reasoning items before the message
      if (m.thinkingBlocks?.length) {
        for (const block of m.thinkingBlocks) {
          if (block.encryptedContent) {
            // Use stored API summary (opaque roundtrip), or build from display text
            const summary = block.apiSummary
              ?? (block.text && !block.text.startsWith('[Encrypted reasoning')
                ? [{ type: 'summary_text', text: block.text }]
                : []);
            const reasoningItem: ResponsesApiInputItem = {
              type: 'reasoning',
              id: block.apiItemId || `rs_${block.id.replace(/-/g, '').slice(0, 24)}`,
              encrypted_content: block.encryptedContent,
              summary,
            };
            if (block.injectAtEnd && mi === lastAssistantIdx) {
              endItems.push(reasoningItem);
            } else if (!block.injectAtEnd) {
              items.push(reasoningItem);
            }
          }
        }
      }

      items.push({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: m.content }],
      });
    }
  }

  // Append injectAtEnd reasoning blocks after all messages
  for (const item of endItems) {
    items.push(item);
  }

  return items;
}

// --- Responses API SSE parser ---

interface ResponsesSSEEvent {
  event: string;
  data: unknown;
}

interface ResponsesSSECallbacks {
  onEvent: (event: ResponsesSSEEvent) => void;
}

/**
 * Read SSE stream with event type support.
 * Unlike the Chat Completions parser, this captures the `event:` line
 * and pairs it with the subsequent `data:` line.
 */
async function readResponsesSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: ResponsesSSECallbacks,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event: ')) {
        currentEvent = trimmed.slice(7);
      } else if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') return;
        try {
          const data = JSON.parse(dataStr);
          callbacks.onEvent({ event: currentEvent || 'message', data });
        } catch {
          // Skip malformed JSON
        }
        currentEvent = '';
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim().startsWith('data: ')) {
    const dataStr = buffer.trim().slice(6);
    if (dataStr !== '[DONE]') {
      try {
        callbacks.onEvent({ event: currentEvent || 'message', data: JSON.parse(dataStr) });
      } catch {
        // Skip
      }
    }
  }
}

// --- Main send function ---

/**
 * Send a message via the OpenAI Responses API.
 * Used for reasoning models (o-series) by both OpenAI and Azure providers.
 */
export async function sendViaResponsesApi(
  connection: ResponsesApiConnection,
  params: ProviderSendParams,
): Promise<void> {
  try {
    const { baseUrl, apiKey, endpoint } = connection;
    let cumulativeText = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const allToolCalls: ToolCallRecord[] = [];
    let pendingToolUseBlocks: ProviderToolUseBlock[] | undefined;
    let toolRound = 0;

    // Raw capture state
    let capturedRequestBody: Record<string, unknown> | undefined;
    let capturedStatus: number | undefined;
    let capturedHeaders: Record<string, string> | undefined;

    // Build the initial input items
    let inputItems = buildResponsesApiInput(params);

    // Tool use loop
    while (true) {
      const body: Record<string, unknown> = {
        model: endpoint,
        input: inputItems,
        stream: true,
        store: false,
        include: ['reasoning.encrypted_content'],
      };

      // Reasoning effort (default medium)
      body.reasoning = { effort: params.reasoningEffort || 'medium' };

      if (params.maxOutputTokens) {
        body.max_output_tokens = params.maxOutputTokens;
      }

      // Add tools if provided
      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools.map(t => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        }));
      }

      // Capture initial request body (first round only)
      if (params.captureRawApiData && !capturedRequestBody) {
        capturedRequestBody = JSON.parse(JSON.stringify(body));
      }

      const response = await fetch(`${baseUrl}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });

      if (params.captureRawApiData) {
        capturedStatus = response.status;
        capturedHeaders = filterResponseHeaders(response.headers);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI Responses API error: ${response.status} - ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let roundText = '';
      let reasoningEncrypted = '';
      let reasoningSummary = '';
      let reasoningItemId = '';
      let reasoningSummaryRaw: unknown = undefined;
      let hasReasoning = false;
      let usageData: { input_tokens: number; output_tokens: number } | undefined;

      // Buffer for tool call items
      const pendingFunctionCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let hasToolCalls = false;

      // Active function call being streamed
      let activeFnCallId = '';
      let activeFnCallName = '';
      let activeFnCallArgs = '';

      await readResponsesSSEStream(reader, {
        onEvent: ({ event, data }) => {
          const obj = data as Record<string, unknown>;
          switch (event) {
            // Reasoning item events
            case 'response.reasoning_summary_part.added':
            case 'response.reasoning_summary_text.delta': {
              const delta = (obj.delta as string) ?? '';
              if (delta) reasoningSummary += delta;
              break;
            }

            case 'response.output_item.added': {
              const item = (obj.item as Record<string, unknown>) ?? obj;
              const itemType = item.type as string;
              if (itemType === 'reasoning') {
                hasReasoning = true;
              } else if (itemType === 'function_call') {
                activeFnCallId = (item.call_id as string) ?? (item.id as string) ?? '';
                activeFnCallName = (item.name as string) ?? '';
                activeFnCallArgs = '';
                hasToolCalls = true;
              }
              break;
            }

            case 'response.output_item.done': {
              const item = (obj.item as Record<string, unknown>) ?? obj;
              const itemType = item.type as string;
              if (itemType === 'reasoning') {
                reasoningEncrypted = (item.encrypted_content as string) ?? '';
                reasoningItemId = (item.id as string) ?? '';
                // Capture summary from done event (array of {type, text} parts or string)
                if (item.summary != null) {
                  reasoningSummaryRaw = item.summary;
                  if (Array.isArray(item.summary)) {
                    const parts = item.summary as Array<{ type?: string; text?: string }>;
                    reasoningSummary = parts
                      .filter(p => p.type === 'summary_text' && p.text)
                      .map(p => p.text)
                      .join('');
                  } else if (typeof item.summary === 'string') {
                    reasoningSummary = item.summary;
                  }
                }
              } else if (itemType === 'function_call') {
                // Finalize function call
                const fnId = (item.call_id as string) ?? (item.id as string) ?? activeFnCallId;
                const fnName = (item.name as string) ?? activeFnCallName;
                const fnArgs = (item.arguments as string) ?? activeFnCallArgs;
                pendingFunctionCalls.push({ id: fnId, name: fnName, arguments: fnArgs });
                activeFnCallId = '';
                activeFnCallName = '';
                activeFnCallArgs = '';
              }
              break;
            }

            // Text content delta
            case 'response.output_text.delta': {
              const delta = (obj.delta as string) ?? '';
              if (delta) {
                roundText += delta;
                params.onToken(cumulativeText + roundText);
              }
              break;
            }

            // Function call argument delta
            case 'response.function_call_arguments.delta': {
              const delta = (obj.delta as string) ?? '';
              if (delta) activeFnCallArgs += delta;
              break;
            }

            // Response completed — usage data
            case 'response.completed': {
              const resp = obj.response as Record<string, unknown> | undefined;
              const usage = resp?.usage as Record<string, unknown> | undefined;
              if (usage) {
                usageData = {
                  input_tokens: (usage.input_tokens as number) ?? 0,
                  output_tokens: (usage.output_tokens as number) ?? 0,
                };
              }
              break;
            }
          }
        },
      });

      // Report reasoning if captured (only from first round)
      if (hasReasoning && params.onThinkingComplete && totalInputTokens === 0) {
        const text = reasoningSummary || (reasoningEncrypted
          ? `[Encrypted reasoning (${reasoningEncrypted.length} chars)]`
          : '');
        params.onThinkingComplete({
          text,
          encryptedContent: reasoningEncrypted || undefined,
          apiItemId: reasoningItemId || undefined,
          apiSummary: reasoningSummaryRaw,
        });
      }

      // Accumulate tokens
      if (usageData) {
        totalInputTokens += usageData.input_tokens;
        totalOutputTokens += usageData.output_tokens;
      }

      cumulativeText += roundText;

      // Check if we have tool calls to execute
      if (hasToolCalls && !params.onToolCall && params.tools) {
        // Manual tool loop mode
        pendingToolUseBlocks = pendingFunctionCalls.map(fc => {
          let input: Record<string, unknown>;
          try { input = JSON.parse(fc.arguments); }
          catch { input = { raw: fc.arguments }; }
          return { id: fc.id, name: fc.name, input };
        });
        break;
      }
      if (hasToolCalls && params.onToolCall) {
        // Append the function calls and their results to input items for next round
        for (const fc of pendingFunctionCalls) {
          let input: Record<string, unknown>;
          try { input = JSON.parse(fc.arguments); }
          catch { input = { raw: fc.arguments }; }

          let result: string;
          try {
            result = await params.onToolCall(fc.name, input);
          } catch (err) {
            result = `Error executing tool: ${err instanceof Error ? err.message : String(err)}`;
          }

          allToolCalls.push({ id: crypto.randomUUID(), toolName: fc.name, input, result, round: toolRound });

          // Append function_call and function_call_output to input
          inputItems.push({
            type: 'function_call',
            call_id: fc.id,
            name: fc.name,
            arguments: fc.arguments,
          });
          inputItems.push({
            type: 'function_call_output',
            call_id: fc.id,
            output: result,
          });
        }

        toolRound++;

        if (params.signal?.aborted) return;
        continue;
      }

      // No tool calls — done
      break;
    }

    // Report tool calls if any
    if (allToolCalls.length > 0 && params.onToolCallsComplete) {
      params.onToolCallsComplete(allToolCalls);
    }

    const tokenUsage: TokenUsage | undefined = (totalInputTokens > 0 || totalOutputTokens > 0)
      ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
      : undefined;

    // Report raw API data if capture is enabled
    if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
      params.onRawApiData({
        request: { url: `${baseUrl}/responses`, method: 'POST', body: capturedRequestBody },
        response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: cumulativeText, usage: tokenUsage } },
      });
    }

    params.onComplete(cumulativeText, tokenUsage,
      pendingToolUseBlocks ? { toolUseBlocks: pendingToolUseBlocks } : undefined);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    if (params.signal?.aborted) return;
    params.onError(error instanceof Error ? error : new Error(String(error)));
  }
}
