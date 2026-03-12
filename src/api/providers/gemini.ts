import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import { filterResponseHeaders } from './types';
import type { TokenUsage } from '../../types';
import { readSSEStream } from './sse';

export class GeminiProvider implements LLMProvider {
  id = 'gemini';
  name = 'Google Gemini';
  requiresApiKey = true;
  supportsStreaming = true;
  supportsThinking = false;
  supportsToolUse = false;

  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async validateKey(config: ProviderConfig): Promise<boolean> {
    try {
      const models = await this.fetchModels(config);
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const response = await fetch(
      `${this.baseUrl}/models?key=${config.apiKey}`
    );
    if (!response.ok) throw new Error('Failed to fetch Gemini models');

    const data = await response.json() as { models: { name: string; displayName: string; supportedGenerationMethods: string[] }[] };
    return data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .filter((m) => m.name.includes('gemini'))
      .map((m) => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName,
        providerId: this.id,
      }));
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    try {
      let fullText = '';

      // Convert messages to Gemini format
      const contents = params.messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
          ...(params.topP !== null && params.topP !== undefined ? { topP: params.topP } : {}),
          ...(params.topK !== null && params.topK !== undefined ? { topK: params.topK } : {}),
        },
      };

      if (params.systemPrompt) {
        body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
      }

      const capturedRequestBody = params.captureRawApiData ? JSON.parse(JSON.stringify(body)) as Record<string, unknown> : undefined;
      // Capture URL without API key for security
      const capturedUrl = `${this.baseUrl}/models/${params.model}:streamGenerateContent`;

      const response = await fetch(
        `${this.baseUrl}/models/${params.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: params.signal,
        }
      );

      const capturedStatus = params.captureRawApiData ? response.status : undefined;
      const capturedHeaders = params.captureRawApiData ? filterResponseHeaders(response.headers) : undefined;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini error: ${response.status} - ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      // Gemini doesn't use [DONE] sentinel — onDone won't fire
      let usageData: TokenUsage | undefined;

      await readSSEStream(reader, {
        onData: (parsed: unknown) => {
          const obj = parsed as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
          };
          const text = obj.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            params.onToken(fullText);
          }
          if (obj.usageMetadata?.promptTokenCount !== undefined) {
            usageData = {
              inputTokens: obj.usageMetadata.promptTokenCount,
              outputTokens: obj.usageMetadata.candidatesTokenCount ?? 0,
            };
          }
        },
      });

      if (params.captureRawApiData && params.onRawApiData && capturedRequestBody) {
        params.onRawApiData({
          request: { url: capturedUrl, method: 'POST', body: capturedRequestBody },
          response: { statusCode: capturedStatus, headers: capturedHeaders, body: { content: fullText, usage: usageData } },
        });
      }

      params.onComplete(fullText, usageData);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (params.signal?.aborted) return;
      params.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
