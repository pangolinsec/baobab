import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import { filterResponseHeaders } from './types';
import type { TokenUsage } from '../../types';

export class OllamaProvider implements LLMProvider {
  id = 'ollama';
  name = 'Ollama';
  requiresApiKey = false;
  supportsStreaming = true;
  supportsThinking = false;
  supportsToolUse = false;

  async validateKey(config: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch Ollama models');

    const data = await response.json() as { models: { name: string; modified_at: string }[] };
    return data.models.map((m) => ({
      id: m.name,
      displayName: m.name,
      providerId: this.id,
    }));
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    try {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      let fullText = '';

      const messages = params.systemPrompt
        ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
        : params.messages;

      const fetchUrl = `${baseUrl}/api/chat`;
      const body = {
        model: params.model,
        messages,
        stream: true,
        options: {
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(params.topP !== null && params.topP !== undefined ? { top_p: params.topP } : {}),
          ...(params.topK !== null && params.topK !== undefined ? { top_k: params.topK } : {}),
        },
      };

      const capturedRequestBody = params.captureRawApiData ? JSON.parse(JSON.stringify(body)) as Record<string, unknown> : undefined;

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: params.signal,
      });

      const capturedStatus = params.captureRawApiData ? response.status : undefined;
      const capturedHeaders = params.captureRawApiData ? filterResponseHeaders(response.headers) : undefined;

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullText += data.message.content;
              params.onToken(fullText);
            }
            if (data.done) {
              let usageData: TokenUsage | undefined;
              if (data.prompt_eval_count !== undefined || data.eval_count !== undefined) {
                usageData = {
                  inputTokens: data.prompt_eval_count ?? 0,
                  outputTokens: data.eval_count ?? 0,
                };
              }
              if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
                params.onRawApiData({
                  request: { url: fetchUrl, method: 'POST', body: capturedRequestBody },
                  response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: fullText, usage: usageData } },
                });
              }
              params.onComplete(fullText, usageData);
              return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
        params.onRawApiData({
          request: { url: fetchUrl, method: 'POST', body: capturedRequestBody },
          response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: fullText } },
        });
      }
      params.onComplete(fullText);
    } catch (error: any) {
      if (error?.name === 'AbortError' || params.signal?.aborted) return;
      params.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
