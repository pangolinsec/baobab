import type { LLMProvider, ProviderConfig, ProviderModelInfo, ProviderSendParams } from './types';
import type { AzureModelEntry } from '../../types';
import { sendViaChatCompletions } from './openai-chat-completions';
import { sendViaResponsesApi } from './openai-responses-api';

export interface AzureModelValidationResult {
  modelId: string;
  displayName: string;
  success: boolean;
  error?: string;
}

export class AzureProvider implements LLMProvider {
  id = 'azure';
  name = 'Azure Foundry';
  requiresApiKey = false;    // keys are per-model, not per-provider
  supportsStreaming = true;
  supportsThinking = false;  // overridden per-model via supportsThinkingForModel
  supportsToolUse = true;

  private getEntries(config: ProviderConfig): AzureModelEntry[] {
    return config.azureModels ?? [];
  }

  private resolveEntry(config: ProviderConfig, modelId: string): AzureModelEntry | undefined {
    // modelId format: "azure::uuid"
    const uuid = modelId.startsWith('azure::') ? modelId.slice(7) : modelId;
    return this.getEntries(config).find(e => e.id === uuid);
  }

  supportsThinkingForModel(config: ProviderConfig, modelId: string): boolean {
    const entry = this.resolveEntry(config, modelId);
    return entry?.isReasoningModel ?? false;
  }

  async validateKey(config: ProviderConfig): Promise<boolean> {
    const entries = this.getEntries(config);
    if (entries.length === 0) return false;
    // Check if at least one entry connects successfully
    const results = await this.validateKeyPerModel(config);
    return results.some(r => r.success);
  }

  async validateKeyPerModel(config: ProviderConfig): Promise<AzureModelValidationResult[]> {
    const entries = this.getEntries(config);
    if (entries.length === 0) return [];

    const results = await Promise.all(
      entries.map(async (entry): Promise<AzureModelValidationResult> => {
        const displayName = entry.nickname || entry.endpoint;
        try {
          // Send a minimal request to verify the endpoint is reachable and the key is valid
          const response = await fetch(`${entry.baseUrl}/models`, {
            headers: { Authorization: `Bearer ${entry.apiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) {
            return { modelId: `azure::${entry.id}`, displayName, success: true };
          }
          return {
            modelId: `azure::${entry.id}`,
            displayName,
            success: false,
            error: `HTTP ${response.status}`,
          };
        } catch (err) {
          return {
            modelId: `azure::${entry.id}`,
            displayName,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    return results;
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const entries = this.getEntries(config);
    return entries.map(entry => ({
      id: `azure::${entry.id}`,
      displayName: entry.nickname || entry.endpoint,
      providerId: this.id,
    }));
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    const entry = this.resolveEntry(config, params.model);
    if (!entry) {
      params.onError(new Error(`Azure model entry not found: ${params.model}`));
      return;
    }

    const connection = { baseUrl: entry.baseUrl, apiKey: entry.apiKey, endpoint: entry.endpoint };

    if (entry.isReasoningModel) {
      return sendViaResponsesApi(connection, params);
    }

    return sendViaChatCompletions(connection, params);
  }
}
