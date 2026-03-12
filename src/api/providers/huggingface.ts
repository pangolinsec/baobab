import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import { filterResponseHeaders } from './types';
import type { TokenUsage } from '../../types';
import { readSSEStream } from './sse';

export class HuggingFaceProvider implements LLMProvider {
  id = 'huggingface';
  name = 'HuggingFace';
  requiresApiKey = true;
  supportsStreaming = true;
  supportsThinking = false;
  supportsToolUse = false;

  async validateKey(config: ProviderConfig): Promise<boolean> {
    try {
      const baseUrl = config.baseUrl || 'https://api-inference.huggingface.co';
      // Validate against the actual Inference API, not the Hub whoami endpoint
      const response = await fetch(`${baseUrl}/models/gpt2`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test', parameters: { max_new_tokens: 1 } }),
        signal: AbortSignal.timeout(10000),
      });
      // 200 = success, 503 = model loading (still means auth worked)
      return response.ok || response.status === 503;
    } catch {
      return false;
    }
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const baseUrl = config.baseUrl || 'https://api-inference.huggingface.co';

    const curatedModels = [
      'meta-llama/Llama-3.3-70B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
      'microsoft/Phi-3-mini-4k-instruct',
      'HuggingFaceH4/zephyr-7b-beta',
      'google/gemma-2-9b-it',
      'Qwen/Qwen2.5-72B-Instruct',
    ];

    // Probe each model individually — return only those that are available
    const available: ProviderModelInfo[] = [];

    await Promise.allSettled(
      curatedModels.map(async (id) => {
        try {
          const resp = await fetch(`${baseUrl}/models/${id}`, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          if (resp.ok) {
            available.push({
              id,
              displayName: id.split('/').pop() || id,
              providerId: this.id,
            });
          }
        } catch {
          // Skip unavailable model
        }
      })
    );

    return available;
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    try {
      const baseUrl = config.baseUrl || 'https://api-inference.huggingface.co';
      let fullText = '';

      const messages: { role: string; content: string }[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push(...params.messages);

      const fetchUrl = `${baseUrl}/models/${params.model}/v1/chat/completions`;
      const body = {
        model: params.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.maxOutputTokens ? { max_tokens: params.maxOutputTokens } : {}),
        ...(params.topP !== null && params.topP !== undefined ? { top_p: params.topP } : {}),
      };

      const capturedRequestBody = params.captureRawApiData ? JSON.parse(JSON.stringify(body)) as Record<string, unknown> : undefined;

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });

      const capturedStatus = params.captureRawApiData ? response.status : undefined;
      const capturedHeaders = params.captureRawApiData ? filterResponseHeaders(response.headers) : undefined;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HuggingFace error: ${response.status} - ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let doneSignaled = false;
      let usageData: TokenUsage | undefined;

      await readSSEStream(reader, {
        onData: (parsed: unknown) => {
          const obj = parsed as { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
          const delta = obj.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            params.onToken(fullText);
          }
          if (obj.usage?.prompt_tokens !== undefined) {
            usageData = {
              inputTokens: obj.usage.prompt_tokens ?? 0,
              outputTokens: obj.usage.completion_tokens ?? 0,
            };
          }
        },
        onDone: () => {
          doneSignaled = true;
          if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
            params.onRawApiData({
              request: { url: fetchUrl, method: 'POST', body: capturedRequestBody },
              response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: fullText, usage: usageData } },
            });
          }
          params.onComplete(fullText, usageData);
        },
      });

      if (!doneSignaled) {
        if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
          params.onRawApiData({
            request: { url: fetchUrl, method: 'POST', body: capturedRequestBody },
            response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: fullText, usage: usageData } },
          });
        }
        params.onComplete(fullText, usageData);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (params.signal?.aborted) return;
      params.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
