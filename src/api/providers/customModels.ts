import type { ProviderConfig, ProviderModelInfo } from './types';
import type { CustomModelEntry } from '../../types';

export function customModelsAsInfo(config: ProviderConfig, providerId: string): ProviderModelInfo[] {
  return (config.customModels ?? []).map(c => ({
    id: c.slug,
    displayName: c.displayName?.trim() || c.slug,
    providerId,
    isCustom: true,
  }));
}

export function mergeCustomModels(
  fetched: ProviderModelInfo[],
  config: ProviderConfig,
  providerId: string
): ProviderModelInfo[] {
  const custom = customModelsAsInfo(config, providerId);
  if (custom.length === 0) return fetched;
  const customSlugs = new Set(custom.map(c => c.id));
  const deduped = fetched.filter(m => !customSlugs.has(m.id));
  return [...custom, ...deduped];
}

export function findCustomModel(config: ProviderConfig, slug: string): CustomModelEntry | undefined {
  return (config.customModels ?? []).find(c => c.slug === slug);
}
