import type { CustomPricingEntry, TreeNode } from '../types';
import staticPricingData from '../data/pricing.json';

export interface PricingEntry {
  providerId: string;
  modelPattern: string;
  displayName: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export const DEFAULT_PRICING: PricingEntry[] = staticPricingData as PricingEntry[];

export type MatchType = 'exact' | 'prefix';

export interface LivePricingEntry {
  modelId: string;
  providerId: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

// Module-level live pricing cache keyed by "providerId:modelId"
let livePricingMap: Map<string, LivePricingEntry> = new Map();

export function setLivePricing(entries: LivePricingEntry[]): void {
  livePricingMap = new Map();
  for (const entry of entries) {
    livePricingMap.set(`${entry.providerId}:${entry.modelId}`.toLowerCase(), entry);
  }
}

export function getLivePricingCount(): number {
  return livePricingMap.size;
}

interface PricingMatch {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  matchType: MatchType;
}

/**
 * Search an array of entries for the best match.
 * Pass 1: case-insensitive exact match → 'exact'
 * Pass 2: case-insensitive prefix match, longest wins → 'prefix'
 */
function matchFromEntries(
  modelId: string,
  providerId: string,
  entries: { modelPattern: string; providerId: string; inputPricePerMillion: number; outputPricePerMillion: number }[]
): PricingMatch | null {
  const modelLower = modelId.toLowerCase();

  // Pass 1: exact match
  for (const entry of entries) {
    if (entry.providerId === providerId && modelLower === entry.modelPattern.toLowerCase()) {
      return {
        inputPricePerMillion: entry.inputPricePerMillion,
        outputPricePerMillion: entry.outputPricePerMillion,
        matchType: 'exact',
      };
    }
  }

  // Pass 2: prefix match (longest wins)
  let best: (PricingMatch & { patternLength: number }) | null = null;
  for (const entry of entries) {
    if (entry.providerId === providerId && modelLower.startsWith(entry.modelPattern.toLowerCase())) {
      if (!best || entry.modelPattern.length > best.patternLength) {
        best = {
          inputPricePerMillion: entry.inputPricePerMillion,
          outputPricePerMillion: entry.outputPricePerMillion,
          matchType: 'prefix',
          patternLength: entry.modelPattern.length,
        };
      }
    }
  }

  return best;
}

/**
 * Find pricing for a model.
 * Priority: custom entries → live pricing (exact key) → static table.
 */
export function findPricing(
  modelId: string,
  providerId: string,
  customPricing?: CustomPricingEntry[]
): PricingMatch | null {
  // Ollama is always free
  if (providerId === 'ollama') {
    return { inputPricePerMillion: 0, outputPricePerMillion: 0, matchType: 'exact' };
  }

  // 1. Check custom entries first
  if (customPricing && customPricing.length > 0) {
    const match = matchFromEntries(modelId, providerId, customPricing);
    if (match) return match;
  }

  // 2. Check live pricing (exact key match only, case-insensitive)
  const liveKey = `${providerId}:${modelId}`.toLowerCase();
  const liveEntry = livePricingMap.get(liveKey);
  if (liveEntry) {
    return {
      inputPricePerMillion: liveEntry.inputPricePerMillion,
      outputPricePerMillion: liveEntry.outputPricePerMillion,
      matchType: 'exact',
    };
  }

  // 3. Check static table
  return matchFromEntries(modelId, providerId, DEFAULT_PRICING);
}

export interface EstimateCostResult {
  cost: number;
  matchType: MatchType;
}

/**
 * Estimate cost for a single node's token usage.
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string,
  providerId: string,
  customPricing?: CustomPricingEntry[]
): EstimateCostResult | null {
  if (!modelId) return null;
  const pricing = findPricing(modelId, providerId, customPricing);
  if (!pricing) return null;
  const cost = (inputTokens * pricing.inputPricePerMillion + outputTokens * pricing.outputPricePerMillion) / 1_000_000;
  return { cost, matchType: pricing.matchType };
}

export interface ModelCostEntry {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  hasApproximatePricing: boolean;
}

export interface ConversationCostResult {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number | null;
  nodeCount: number;
  hasPricingGaps: boolean;
  hasApproximatePricing: boolean;
  isAllOllama: boolean;
  costByModel: Record<string, ModelCostEntry>;
}

/**
 * Compute aggregate cost across all nodes in a conversation.
 */
export function getConversationCost(
  nodes: Record<string, TreeNode>,
  customPricing?: CustomPricingEntry[]
): ConversationCostResult {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  let nodeCount = 0;
  let gapCount = 0;
  let hasPricingGaps = false;
  let hasApproximatePricing = false;
  let hasNonOllama = false;
  let hasAnyNode = false;
  const costByModel: Record<string, ModelCostEntry> = {};

  for (const node of Object.values(nodes)) {
    if (!node.tokenUsage) continue;
    hasAnyNode = true;
    nodeCount++;
    totalInputTokens += node.tokenUsage.inputTokens;
    totalOutputTokens += node.tokenUsage.outputTokens;

    const providerId = node.providerId || 'anthropic';
    if (providerId !== 'ollama') hasNonOllama = true;

    const result = estimateCost(
      node.tokenUsage.inputTokens,
      node.tokenUsage.outputTokens,
      node.model,
      providerId,
      customPricing
    );

    const modelKey = node.model || 'unknown';
    if (!costByModel[modelKey]) {
      costByModel[modelKey] = { cost: 0, inputTokens: 0, outputTokens: 0, messageCount: 0, hasApproximatePricing: false };
    }
    const entry = costByModel[modelKey];
    entry.inputTokens += node.tokenUsage.inputTokens;
    entry.outputTokens += node.tokenUsage.outputTokens;
    entry.messageCount++;

    if (result !== null) {
      totalCost += result.cost;
      entry.cost += result.cost;
      if (result.matchType === 'prefix') {
        hasApproximatePricing = true;
        entry.hasApproximatePricing = true;
      }
    } else {
      hasPricingGaps = true;
      gapCount++;
    }
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCost: nodeCount > 0 && nodeCount === gapCount ? null : totalCost,
    nodeCount,
    hasPricingGaps,
    hasApproximatePricing,
    isAllOllama: hasAnyNode && !hasNonOllama,
    costByModel,
  };
}

/**
 * Rough token estimate from character count (~4 chars/token).
 */
export function estimateContextTokens(charCount: number): number {
  return Math.round(charCount / 4);
}

/**
 * Format a dollar cost with adaptive decimal places.
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    const formatted = cost.toFixed(6);
    if (formatted === '0.000000') return '< $0.000001';
    return `$${formatted}`;
  }
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format a token count with K/M suffixes.
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 10_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}
