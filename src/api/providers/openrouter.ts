import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import { filterResponseHeaders } from './types';
import type { TokenUsage } from '../../types';
import type { LivePricingEntry } from '../../lib/pricing';
import { readSSEStream } from './sse';

export class OpenRouterProvider implements LLMProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  requiresApiKey = true;
  supportsStreaming = true;
  supportsThinking = false;
  supportsToolUse = false;

  private baseUrl = 'https://openrouter.ai/api/v1';

  async validateKey(config: ProviderConfig): Promise<boolean> {
    try {
      const models = await this.fetchModels(config);
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) throw new Error('Failed to fetch OpenRouter models');

    const data = await response.json() as { data: { id: string; name: string }[] };
    return data.data
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
      .slice(0, 500)
      .map((m) => ({
        id: m.id,
        displayName: m.name || m.id,
        providerId: this.id,
      }));
  }

  async fetchPricing(config: ProviderConfig): Promise<LivePricingEntry[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) throw new Error('Failed to fetch OpenRouter pricing');

    const data = await response.json() as {
      data: { id: string; pricing?: { prompt?: string; completion?: string } }[];
    };

    const entries: LivePricingEntry[] = [];
    for (const model of data.data) {
      const promptStr = model.pricing?.prompt;
      const completionStr = model.pricing?.completion;
      if (!promptStr || !completionStr) continue;

      const inputPerToken = parseFloat(promptStr);
      const outputPerToken = parseFloat(completionStr);
      if (isNaN(inputPerToken) || isNaN(outputPerToken)) continue;

      entries.push({
        modelId: model.id,
        providerId: 'openrouter',
        inputPricePerMillion: inputPerToken * 1_000_000,
        outputPricePerMillion: outputPerToken * 1_000_000,
      });
    }

    return entries;
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    try {
      let fullText = '';

      const messages: { role: string; content: string }[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push(...params.messages);

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

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Baobab',
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });

      const capturedStatus = params.captureRawApiData ? response.status : undefined;
      const capturedHeaders = params.captureRawApiData ? filterResponseHeaders(response.headers) : undefined;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter error: ${response.status} - ${errorBody}`);
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
              request: { url: `${this.baseUrl}/chat/completions`, method: 'POST', body: capturedRequestBody },
              response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: fullText, usage: usageData } },
            });
          }
          params.onComplete(fullText, usageData);
        },
      });

      if (!doneSignaled) {
        if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
          params.onRawApiData({
            request: { url: `${this.baseUrl}/chat/completions`, method: 'POST', body: capturedRequestBody },
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
