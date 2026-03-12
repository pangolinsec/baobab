import type { LLMProvider, ProviderConfig } from './types';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';
import { GeminiProvider } from './gemini';
import { HuggingFaceProvider } from './huggingface';
import { AzureProvider } from './azure';

const providers: Record<string, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
  openai: new OpenAIProvider(),
  openrouter: new OpenRouterProvider(),
  gemini: new GeminiProvider(),
  huggingface: new HuggingFaceProvider(),
  azure: new AzureProvider(),
};

export function getProvider(providerId: string): LLMProvider | undefined {
  return providers[providerId];
}

export function getAllProviders(): LLMProvider[] {
  return Object.values(providers);
}

export function getProviderIds(): string[] {
  return Object.keys(providers);
}

/**
 * Find which provider a model belongs to, given the configured providers.
 */
export function findProviderForModel(
  modelId: string,
  configs: ProviderConfig[]
): string | undefined {
  // Direct prefix heuristics
  if (modelId.startsWith('azure::')) return 'azure';
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.startsWith('o3-') || modelId.startsWith('o4-')) return 'openai';
  if (modelId.startsWith('gemini-')) return 'gemini';

  // Ollama models use name:tag format (e.g. llama3:latest)
  if (modelId.includes(':')) return 'ollama';

  // org/model format — could be HuggingFace or OpenRouter
  if (modelId.includes('/')) {
    const hfEnabled = configs.find(c => c.id === 'huggingface' && c.enabled);
    const orEnabled = configs.find(c => c.id === 'openrouter' && c.enabled);
    if (hfEnabled && !orEnabled) return 'huggingface';
    if (orEnabled && !hfEnabled) return 'openrouter';
    // Both enabled — ambiguous, fall through to enabled-provider scan
  }

  // Fall back to checking enabled providers
  for (const config of configs) {
    if (config.enabled && providers[config.id]) {
      return config.id;
    }
  }

  return undefined;
}
