import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import { sendViaChatCompletions } from './openai-chat-completions';
import { sendViaResponsesApi } from './openai-responses-api';

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
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!response.ok) throw new Error('Failed to fetch OpenAI models');

    const data = await response.json() as { data: { id: string; owned_by: string }[] };
    return data.data
      .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1-') || m.id.startsWith('o3-') || m.id.startsWith('o4-'))
      .map((m) => ({
        id: m.id,
        displayName: m.id,
        providerId: this.id,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private static isReasoningModel(model: string): boolean {
    return model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-');
  }

  supportsThinkingForModel(_config: ProviderConfig, modelId: string): boolean {
    return OpenAIProvider.isReasoningModel(modelId);
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const connection = { baseUrl, apiKey: config.apiKey, endpoint: params.model };

    if (OpenAIProvider.isReasoningModel(params.model)) {
      return sendViaResponsesApi(connection, params);
    }

    return sendViaChatCompletions(connection, params);
  }
}
