import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import { sendViaChatCompletions } from './openai-chat-completions';
import { sendViaResponsesApi } from './openai-responses-api';
import { mergeCustomModels, findCustomModel } from './customModels';

export class OpenAIProvider implements LLMProvider {
  id = 'openai';
  name = 'OpenAI';
  requiresApiKey = true;
  supportsStreaming = true;
  supportsThinking = false;
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
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    let fetched: ProviderModelInfo[] = [];
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      if (response.ok) {
        const data = await response.json() as { data: { id: string; owned_by: string }[] };
        fetched = data.data
          .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1-') || m.id.startsWith('o3-') || m.id.startsWith('o4-'))
          .map((m) => ({ id: m.id, displayName: m.id, providerId: this.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
      } else if ((config.customModels?.length ?? 0) === 0) {
        throw new Error('Failed to fetch OpenAI models');
      }
    } catch (err) {
      // If no custom models are configured, surface the fetch error.
      // Otherwise, fall through with an empty fetched list so custom slugs still work
      // (e.g., OpenAI-compatible gateways that don't expose /v1/models).
      if ((config.customModels?.length ?? 0) === 0) throw err;
    }
    return mergeCustomModels(fetched, config, this.id);
  }

  private static isReasoningSlug(model: string): boolean {
    return model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-');
  }

  private static isReasoningModel(config: ProviderConfig, model: string): boolean {
    const custom = findCustomModel(config, model);
    if (custom) return custom.isReasoningModel === true;
    return OpenAIProvider.isReasoningSlug(model);
  }

  supportsThinkingForModel(config: ProviderConfig, modelId: string): boolean {
    return OpenAIProvider.isReasoningModel(config, modelId);
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const connection = { baseUrl, apiKey: config.apiKey, endpoint: params.model };

    if (OpenAIProvider.isReasoningModel(config, params.model)) {
      return sendViaResponsesApi(connection, params);
    }

    return sendViaChatCompletions(connection, params);
  }
}
