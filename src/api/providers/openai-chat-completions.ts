import type { ProviderSendParams, ToolCallRecord, ProviderToolUseBlock } from './types';
import { filterResponseHeaders } from './types';
import type { TokenUsage } from '../../types';
import { readSSEStream } from './sse';

export interface ChatCompletionsConnection {
  baseUrl: string;
  apiKey: string;
  endpoint: string;  // model name or Azure deployment name
}

/**
 * Format annotated messages (tool_invocations/tool_results) into
 * OpenAI Chat Completions native format.
 */
export function formatMessagesForChatCompletions(msgs: ProviderSendParams['messages']): any[] {
  const result: any[] = [];
  for (const m of msgs) {
    if (m.messageType === 'tool_invocations' && m.toolCalls?.length) {
      result.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map(tc => ({
          id: `call_${tc.id.replace(/-/g, '').slice(0, 24)}`,
          type: 'function',
          function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
        })),
      });
    } else if (m.messageType === 'tool_results' && m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        result.push({
          role: 'tool',
          tool_call_id: `call_${tc.id.replace(/-/g, '').slice(0, 24)}`,
          content: tc.result ?? '',
        });
      }
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }
  return result;
}

/**
 * Send a message via the OpenAI Chat Completions API.
 * Used by both the OpenAI and Azure providers for non-reasoning models.
 */
export async function sendViaChatCompletions(
  connection: ChatCompletionsConnection,
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

    const isReasoningModel = endpoint.startsWith('o1-') || endpoint.startsWith('o3-') || endpoint.startsWith('o4-');

    // Raw capture state
    let capturedRequestBody: Record<string, unknown> | undefined;
    let capturedStatus: number | undefined;
    let capturedHeaders: Record<string, string> | undefined;

    const messages: any[] = [];

    if (isReasoningModel && params.systemPrompt) {
      const formatted = formatMessagesForChatCompletions(params.messages);
      messages.push(...formatted);
      const firstUserIdx = messages.findIndex(m => m.role === 'user');
      if (firstUserIdx !== -1) {
        messages[firstUserIdx] = {
          ...messages[firstUserIdx],
          content: `${params.systemPrompt}\n\n${messages[firstUserIdx].content}`,
        };
      }
    } else {
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push(...formatMessagesForChatCompletions(params.messages));
    }

    // Tool use loop
    while (true) {
      const body: Record<string, unknown> = {
        model: endpoint,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      };

      if (isReasoningModel) {
        if (params.maxOutputTokens) {
          body.max_completion_tokens = params.maxOutputTokens;
        }
      } else {
        if (params.temperature !== undefined) body.temperature = params.temperature;
        if (params.maxOutputTokens) body.max_tokens = params.maxOutputTokens;
        if (params.topP !== null && params.topP !== undefined) body.top_p = params.topP;
      }

      // Add tools if provided
      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          },
        }));
      }

      // Capture initial request body (first round only)
      if (params.captureRawApiData && !capturedRequestBody) {
        capturedRequestBody = JSON.parse(JSON.stringify(body));
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
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
        throw new Error(`OpenAI error: ${response.status} - ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let roundText = '';
      let usageData: { prompt_tokens: number; completion_tokens: number } | undefined;
      const pendingToolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};
      let hasToolCalls = false;

      await readSSEStream(reader, {
        onData: (parsed: unknown) => {
          const obj = parsed as {
            choices?: {
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
              finish_reason?: string;
            }[];
            usage?: { prompt_tokens: number; completion_tokens: number };
          };

          // Handle text content
          const delta = obj.choices?.[0]?.delta?.content;
          if (delta) {
            roundText += delta;
            params.onToken(cumulativeText + roundText);
          }

          // Handle streamed tool calls
          const toolCallDeltas = obj.choices?.[0]?.delta?.tool_calls;
          if (toolCallDeltas) {
            hasToolCalls = true;
            for (const tc of toolCallDeltas) {
              if (!pendingToolCallsMap[tc.index]) {
                pendingToolCallsMap[tc.index] = { id: tc.id || '', name: '', arguments: '' };
              }
              if (tc.id) pendingToolCallsMap[tc.index].id = tc.id;
              if (tc.function?.name) pendingToolCallsMap[tc.index].name = tc.function.name;
              if (tc.function?.arguments) pendingToolCallsMap[tc.index].arguments += tc.function.arguments;
            }
          }

          if (obj.usage) {
            usageData = obj.usage;
          }
        },
        onDone: () => { /* handled below */ },
      });

      // Accumulate tokens
      if (usageData) {
        totalInputTokens += usageData.prompt_tokens ?? 0;
        totalOutputTokens += usageData.completion_tokens ?? 0;
      }

      cumulativeText += roundText;

      // Check if we have tool calls to execute
      if (hasToolCalls && !params.onToolCall && params.tools) {
        // Manual tool loop mode: return tool_use blocks to caller
        pendingToolUseBlocks = Object.values(pendingToolCallsMap).map(tc => {
          let input: Record<string, unknown>;
          try { input = JSON.parse(tc.arguments); }
          catch { input = { raw: tc.arguments }; }
          return { id: tc.id, name: tc.name, input };
        });
        break;
      }
      if (hasToolCalls && params.onToolCall) {
        // Build assistant message with tool calls
        const assistantToolCalls = Object.values(pendingToolCallsMap).map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));

        messages.push({
          role: 'assistant',
          content: roundText || null,
          tool_calls: assistantToolCalls,
        });

        // Execute each tool call
        for (const tc of Object.values(pendingToolCallsMap)) {
          let input: Record<string, unknown>;
          try {
            input = JSON.parse(tc.arguments);
          } catch {
            input = { raw: tc.arguments };
          }

          let result: string;
          try {
            result = await params.onToolCall(tc.name, input);
          } catch (err) {
            result = `Error executing tool: ${err instanceof Error ? err.message : String(err)}`;
          }

          allToolCalls.push({ id: crypto.randomUUID(), toolName: tc.name, input, result, round: toolRound });

          // Append tool result message
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }

        toolRound++;

        // Check abort before looping
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
        request: { url: `${baseUrl}/chat/completions`, method: 'POST', body: capturedRequestBody },
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
