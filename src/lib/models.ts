import type { ModelInfo } from '../api/claude';

/**
 * Abbreviate a model ID for compact display in chips/badges.
 * e.g. "claude-sonnet-4-20250514" → "Sonnet 4"
 *      "claude-3-5-haiku-20241022" → "Haiku 3.5"
 *      "claude-opus-4-6"           → "Opus 4.6"
 */
export function abbreviateModelName(modelId: string): string {
  const lower = modelId.toLowerCase();

  const tiers = ['opus', 'sonnet', 'haiku'];
  let tier = '';
  for (const t of tiers) {
    if (lower.includes(t)) {
      tier = t.charAt(0).toUpperCase() + t.slice(1);
      break;
    }
  }
  if (!tier) return modelId;

  // Strip date suffix (YYYYMMDD) before extracting version
  const withoutDate = lower.replace(/-\d{8}$/, '');

  // New naming: claude-TIER-VERSION (e.g. claude-sonnet-4, claude-opus-4-6)
  const afterTier = withoutDate.match(new RegExp(`${tier.toLowerCase()}-(\\d+(?:-\\d+)?)`));
  if (afterTier) {
    return `${tier} ${afterTier[1].replace('-', '.')}`;
  }

  // Old naming: claude-VERSION-TIER (e.g. claude-3-5-haiku)
  const beforeTier = withoutDate.match(/claude-(\d+(?:-\d+)?)-/);
  if (beforeTier) {
    return `${tier} ${beforeTier[1].replace('-', '.')}`;
  }

  return tier;
}

/**
 * Find a ModelInfo by ID from the available models list.
 */
export function findModelById(modelId: string, models: ModelInfo[]): ModelInfo | undefined {
  return models.find(m => m.id === modelId);
}

/**
 * Get the best display label for a model — abbreviation for chips, full name for dropdowns.
 */
export function getModelDisplayLabel(modelId: string, models: ModelInfo[]): string {
  const model = findModelById(modelId, models);
  return model ? model.displayName : abbreviateModelName(modelId);
}
