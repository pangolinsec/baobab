import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams, ToolCallRecord, ProviderToolUseBlock } from './types';
import type { TokenUsage } from '../../types';

let client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!client || (client as any).apiKey !== apiKey) {
    client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
  return client;
}

export class AnthropicProvider implements LLMProvider {
  id = 'anthropic';
  name = 'Anthropic';
  requiresApiKey = true;
  supportsStreaming = true;
  supportsThinking = true;
  supportsToolUse = true;

  async validateKey(config: ProviderConfig): Promise<boolean> {
    try {
      const models = await this.fetchModels(config);
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const anthropic = getClient(config.apiKey);
    const response = await anthropic.models.list({ limit: 100 });
    const models: ProviderModelInfo[] = [];

    for (const model of response.data) {
      if (model.id.startsWith('claude-')) {
        models.push({
          id: model.id,
          displayName: model.display_name,
          providerId: this.id,
        });
      }
    }

    // Sort: haiku first, then sonnet, then opus
    const tierOrder = (id: string) => {
      if (id.includes('haiku')) return 0;
      if (id.includes('sonnet')) return 1;
      if (id.includes('opus')) return 2;
      return 3;
    };
    models.sort((a, b) => tierOrder(a.id) - tierOrder(b.id) || b.id.localeCompare(a.id));

    return models;
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    try {
      const anthropic = getClient(config.apiKey);
      let cumulativeText = '';

      const requestParams: Record<string, unknown> = {
        model: params.model,
        max_tokens: params.maxOutputTokens || 8192,
        system: params.systemPrompt || undefined,
        messages: params.messages.map(m => {
          // Tool invocation messages → assistant content array with tool_use blocks
          if (m.messageType === 'tool_invocations' && m.toolCalls?.length) {
            const content: any[] = [];
            if (m.content) content.push({ type: 'text', text: m.content });
            for (const tc of m.toolCalls) {
              content.push({
                type: 'tool_use',
                id: `toolu_${tc.id.replace(/-/g, '').slice(0, 24)}`,
                name: tc.toolName,
                input: tc.input,
              });
            }
            return { role: 'assistant', content };
          }

          // Tool result messages → user message with tool_result blocks
          if (m.messageType === 'tool_results' && m.toolCalls?.length) {
            return {
              role: 'user',
              content: m.toolCalls.map(tc => ({
                type: 'tool_result',
                tool_use_id: `toolu_${tc.id.replace(/-/g, '').slice(0, 24)}`,
                content: tc.result ?? '',
              })),
            };
          }

          // If assistant message has thinking blocks with Anthropic signatures, use content array format
          if (m.role === 'assistant' && m.thinkingBlocks?.length) {
            const nativeBlocks = m.thinkingBlocks.filter(
              b => b.providerId === 'anthropic' && b.signature
            );
            if (nativeBlocks.length > 0) {
              const contentParts: any[] = nativeBlocks.map(b => ({
                type: 'thinking',
                thinking: b.text,
                signature: b.signature,
              }));
              if (m.content) {
                contentParts.push({ type: 'text', text: m.content });
              }
              return { role: m.role, content: contentParts };
            }
          }
          return { role: m.role, content: m.content };
        }),
      };

      // Capture initial request body if raw capture is enabled
      const capturedRequestBody = params.captureRawApiData
        ? JSON.parse(JSON.stringify(requestParams)) as Record<string, unknown>
        : undefined;

      if (params.thinkingEnabled) {
        requestParams.thinking = { type: 'enabled', budget_tokens: params.thinkingBudget || 10000 };
        if (params.topP !== null && params.topP !== undefined) {
          requestParams.top_p = params.topP;
        }
      } else {
        if (params.temperature !== undefined && params.temperature !== 1.0) {
          requestParams.temperature = params.temperature;
        }
        if (params.topP !== null && params.topP !== undefined) {
          requestParams.top_p = params.topP;
        }
        if (params.topK !== null && params.topK !== undefined) {
          requestParams.top_k = params.topK;
        }
      }

      // Add tools if provided
      if (params.tools && params.tools.length > 0) {
        requestParams.tools = params.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        }));
      }

      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const allToolCalls: ToolCallRecord[] = [];
      let pendingToolUseBlocks: ProviderToolUseBlock[] | undefined;

      // Tool use loop — keep going until no tool_use blocks
      const messages = [...(requestParams.messages as any[])];
      let toolRound = 0;

      while (true) {
        const currentParams = { ...requestParams, messages };
        const stream = anthropic.messages.stream(currentParams as any);

        if (params.signal) {
          params.signal.addEventListener('abort', () => {
            stream.abort();
          }, { once: true });
        }

        let roundText = '';
        stream.on('text', (text) => {
          roundText += text;
          // cumulativeText preserved from prior rounds
          params.onToken(cumulativeText + roundText);
        });

        const finalMessage = await stream.finalMessage();

        // Extract thinking and text from content blocks
        let thinkingText = '';
        let thinkingSignature: string | undefined;
        roundText = '';

        for (const block of finalMessage.content) {
          if (block.type === 'thinking') {
            thinkingText += (block as any).thinking;
            if ((block as any).signature) {
              thinkingSignature = (block as any).signature;
            }
          } else if (block.type === 'text') {
            roundText += (block as Anthropic.TextBlock).text;
          }
        }

        // Report thinking (only from first round)
        if (thinkingText && params.onThinkingComplete && totalInputTokens === 0) {
          params.onThinkingComplete(
            thinkingSignature
              ? { text: thinkingText, signature: thinkingSignature }
              : thinkingText
          );
        }

        // Accumulate tokens
        totalInputTokens += finalMessage.usage.input_tokens;
        totalOutputTokens += finalMessage.usage.output_tokens;

        // Check for tool_use blocks
        const toolUseBlocks = finalMessage.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          cumulativeText += roundText;
          break;
        }
        if (!params.onToolCall) {
          // Manual tool loop mode: return tool_use blocks to caller
          cumulativeText += roundText;
          pendingToolUseBlocks = toolUseBlocks.map(b => ({
            id: b.id,
            name: b.name,
            input: b.input as Record<string, unknown>,
          }));
          break;
        }

        // Execute tool calls
        cumulativeText += roundText;

        // Append the assistant response (with tool_use blocks) to messages
        messages.push({ role: 'assistant', content: finalMessage.content });

        // Execute each tool call and build tool_result messages
        const toolResults: any[] = [];
        for (const block of toolUseBlocks) {
          const input = block.input as Record<string, unknown>;
          let result: string;
          try {
            result = await params.onToolCall(block.name, input);
          } catch (err) {
            result = `Error executing tool: ${err instanceof Error ? err.message : String(err)}`;
          }
          allToolCalls.push({ id: crypto.randomUUID(), toolName: block.name, input, result, round: toolRound });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
        toolRound++;

        // Append tool results as a user message
        messages.push({ role: 'user', content: toolResults });

        // Check abort before looping
        if (params.signal?.aborted) return;
      }

      // Report tool calls if any
      if (allToolCalls.length > 0 && params.onToolCallsComplete) {
        params.onToolCallsComplete(allToolCalls);
      }

      const tokenUsage: TokenUsage = {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };

      // Report raw API data if capture is enabled
      if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
        const baseUrl = (anthropic as any).baseURL || 'https://api.anthropic.com';
        params.onRawApiData({
          request: {
            url: `${baseUrl}/v1/messages`,
            method: 'POST',
            body: capturedRequestBody,
          },
          response: {
            body: { content: cumulativeText, usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens } },
          },
        });
      }

      params.onComplete(cumulativeText, tokenUsage,
        pendingToolUseBlocks ? { toolUseBlocks: pendingToolUseBlocks } : undefined);
    } catch (error: any) {
      if (error?.name === 'AbortError' || params.signal?.aborted) return;
      params.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
