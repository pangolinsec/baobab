import { create } from 'zustand';
import type { AppSettings, CustomPricingEntry, ProviderConfigData } from '../types';
import { db } from '../db/database';
import { fetchModels, type ModelInfo } from '../api/claude';
import { getProvider } from '../api/providers/registry';
import type { ProviderModelInfo } from '../api/providers/types';
import { setLivePricing, getLivePricingCount } from '../lib/pricing';

type KeyStatus = 'idle' | 'validating' | 'valid' | 'invalid';

interface SettingsState extends AppSettings {
  loaded: boolean;
  availableModels: ModelInfo[];
  allProviderModels: ProviderModelInfo[];
  fullModelCatalog: ProviderModelInfo[];
  keyStatus: KeyStatus;
  keyError: string;
  loadSettings: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  validateKey: (key: string) => Promise<boolean>;
  setDefaultModel: (model: string) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  setThinkingEnabled: (enabled: boolean) => Promise<void>;
  setThinkingBudget: (budget: number) => Promise<void>;
  setTemperature: (temp: number) => Promise<void>;
  setMaxOutputTokens: (tokens: number) => Promise<void>;
  setTopP: (value: number | null) => Promise<void>;
  setTopK: (value: number | null) => Promise<void>;
  setDefaultSystemPrompt: (prompt: string) => Promise<void>;
  setSummarizationPrompt: (prompt: string) => Promise<void>;
  setMergePrompt: (prompt: string) => Promise<void>;
  setDefaultMergeMode: (mode: 'summarize' | 'full-context') => Promise<void>;
  setProviders: (providers: ProviderConfigData[]) => Promise<void>;
  setDefaultProvider: (providerId: string) => Promise<void>;
  setCustomPricing: (pricing: CustomPricingEntry[]) => Promise<void>;
  setTavilyApiKey: (key: string) => Promise<void>;
  setBingApiKey: (key: string) => Promise<void>;
  setDefaultSearchProvider: (provider: string) => Promise<void>;
  setCaptureRawApiData: (enabled: boolean) => Promise<void>;
  setAutoGenerateTitles: (enabled: boolean) => Promise<void>;
  setTitleGenerationModel: (modelId: string | undefined) => Promise<void>;
  refreshProviderModels: () => Promise<void>;
  setProviderEnabledModels: (providerId: string, enabledModels: string[] | undefined) => Promise<void>;
  setReasoningEffort: (effort: 'low' | 'medium' | 'high') => Promise<void>;
  livePricingStatus: 'idle' | 'loading' | 'loaded' | 'error';
  livePricingCount: number;
  livePricingLastFetched: number | null;
  refreshLivePricing: () => Promise<void>;
  clearLivePricingCache: () => void;
}

const defaults: AppSettings = {
  apiKey: '',
  defaultModel: 'claude-3-5-haiku-20241022',
  theme: 'light',
  thinkingEnabled: false,
  thinkingBudget: 10000,
  temperature: 1.0,
  maxOutputTokens: 8192,
  topP: null,
  topK: null,
  defaultSystemPrompt: '',
  summarizationPrompt: 'Please provide a concise summary of this conversation branch, highlighting the key points, decisions made, and any conclusions reached.',
  mergePrompt: 'You are given two conversation branches that diverged from a common point. Synthesize the key insights, conclusions, and useful information from both branches into a single coherent response. Highlight areas of agreement, note any contradictions, and combine complementary information.',
  defaultMergeMode: 'summarize' as const,
  captureRawApiData: false,
  autoGenerateTitles: false,
  reasoningInjectionPlaintextPrefix: '[Prior reasoning: ',
  reasoningInjectionPlaintextSuffix: ']',
  toolCallPlaintextPrefix: '[Tool use: ',
  toolCallPlaintextSuffix: ']',
  toolCallResultMaxLength: 500,
  reasoningEffort: 'medium' as const,
  customPricing: [],
  providers: [
    { id: 'anthropic', name: 'Anthropic', apiKey: '', enabled: true },
  ],
  defaultProvider: 'anthropic',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaults,
  loaded: false,
  availableModels: [],
  allProviderModels: [],
  fullModelCatalog: [],
  keyStatus: 'idle',
  keyError: '',
  livePricingStatus: 'idle',
  livePricingCount: 0,
  livePricingLastFetched: null,

  loadSettings: async () => {
    const stored = await db.settings.toCollection().first();
    if (stored) {
      // Ensure new fields have defaults for upgrades
      const merged = { ...defaults, ...stored };
      if (!merged.providers || merged.providers.length === 0) {
        merged.providers = defaults.providers;
      }
      if (!merged.defaultProvider) {
        merged.defaultProvider = defaults.defaultProvider;
      }
      set({ ...merged, loaded: true });
      // Sync legacy apiKey to anthropic provider
      if (stored.apiKey) {
        const providers = [...merged.providers];
        const anthIdx = providers.findIndex(p => p.id === 'anthropic');
        if (anthIdx >= 0 && !providers[anthIdx].apiKey) {
          providers[anthIdx] = { ...providers[anthIdx], apiKey: stored.apiKey };
          set({ providers });
        }
        get().validateKey(stored.apiKey);
      }
      // Populate allProviderModels from all enabled providers on startup
      get().refreshProviderModels();
      // Fetch live pricing from OpenRouter (fire-and-forget)
      get().refreshLivePricing();
    } else {
      const id = await db.settings.add({ ...defaults });
      set({ ...defaults, id, loaded: true });
    }
  },

  setApiKey: async (apiKey: string) => {
    set({ apiKey });
    // Also sync to anthropic provider
    const providers = [...get().providers];
    const anthIdx = providers.findIndex(p => p.id === 'anthropic');
    if (anthIdx >= 0) {
      providers[anthIdx] = { ...providers[anthIdx], apiKey };
      set({ providers });
    }
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { apiKey, providers });
  },

  validateKey: async (key: string) => {
    if (!key.trim()) {
      set({ keyStatus: 'idle', availableModels: [], keyError: '' });
      return false;
    }

    set({ keyStatus: 'validating', keyError: '' });

    try {
      const models = await fetchModels(key);
      set({ keyStatus: 'valid', availableModels: models, keyError: '' });

      // If current default model isn't in the list, pick the first one
      const { defaultModel } = get();
      if (models.length > 0 && !models.some((m) => m.id === defaultModel)) {
        const haiku = models.find((m) => m.id.includes('haiku'));
        const newDefault = haiku?.id || models[0].id;
        get().setDefaultModel(newDefault);
      }

      return true;
    } catch (error: any) {
      const message =
        error?.status === 401
          ? 'Invalid API key'
          : error?.message || 'Failed to validate key';
      set({ keyStatus: 'invalid', availableModels: [], keyError: message });
      return false;
    }
  },

  setDefaultModel: async (defaultModel: string) => {
    set({ defaultModel });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { defaultModel });
  },

  setTheme: async (theme: 'light' | 'dark') => {
    set({ theme });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { theme });
  },

  setThinkingEnabled: async (thinkingEnabled: boolean) => {
    const updates: Partial<AppSettings> = { thinkingEnabled };
    if (thinkingEnabled) {
      updates.temperature = 1.0;
    }
    set(updates);
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, updates);
  },

  setThinkingBudget: async (thinkingBudget: number) => {
    set({ thinkingBudget });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { thinkingBudget });
  },

  setTemperature: async (temperature: number) => {
    set({ temperature });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { temperature });
  },

  setMaxOutputTokens: async (maxOutputTokens: number) => {
    set({ maxOutputTokens });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { maxOutputTokens });
  },

  setTopP: async (topP: number | null) => {
    set({ topP });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { topP });
  },

  setTopK: async (topK: number | null) => {
    set({ topK });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { topK });
  },

  setDefaultSystemPrompt: async (defaultSystemPrompt: string) => {
    set({ defaultSystemPrompt });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { defaultSystemPrompt });
  },

  setSummarizationPrompt: async (summarizationPrompt: string) => {
    set({ summarizationPrompt });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { summarizationPrompt });
  },

  setMergePrompt: async (mergePrompt: string) => {
    set({ mergePrompt });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { mergePrompt });
  },

  setTavilyApiKey: async (tavilyApiKey: string) => {
    set({ tavilyApiKey });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { tavilyApiKey });
  },

  setBingApiKey: async (bingApiKey: string) => {
    set({ bingApiKey });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { bingApiKey });
  },

  setDefaultSearchProvider: async (defaultSearchProvider: string) => {
    set({ defaultSearchProvider });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { defaultSearchProvider });
  },

  setDefaultMergeMode: async (defaultMergeMode: 'summarize' | 'full-context') => {
    set({ defaultMergeMode });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { defaultMergeMode });
  },

  setCustomPricing: async (customPricing: CustomPricingEntry[]) => {
    set({ customPricing });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { customPricing });
  },

  setCaptureRawApiData: async (captureRawApiData: boolean) => {
    set({ captureRawApiData });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { captureRawApiData });
  },

  setAutoGenerateTitles: async (autoGenerateTitles: boolean) => {
    set({ autoGenerateTitles });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { autoGenerateTitles });
  },

  setTitleGenerationModel: async (titleGenerationModel: string | undefined) => {
    set({ titleGenerationModel });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { titleGenerationModel });
  },

  setReasoningEffort: async (reasoningEffort: 'low' | 'medium' | 'high') => {
    set({ reasoningEffort });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { reasoningEffort });
  },

  setProviders: async (providers: ProviderConfigData[]) => {
    set({ providers });
    // Reverse-sync: Anthropic provider key → legacy top-level apiKey
    const anthConfig = providers.find(p => p.id === 'anthropic');
    if (anthConfig && anthConfig.apiKey !== get().apiKey) {
      set({ apiKey: anthConfig.apiKey });
      const current = await db.settings.toCollection().first();
      if (current?.id) await db.settings.update(current.id, { providers, apiKey: anthConfig.apiKey });
    } else {
      const current = await db.settings.toCollection().first();
      if (current?.id) await db.settings.update(current.id, { providers });
    }
    // Refresh models from all enabled providers
    get().refreshProviderModels();
    // Refresh live pricing (fire-and-forget)
    get().refreshLivePricing();
  },

  setDefaultProvider: async (defaultProvider: string) => {
    set({ defaultProvider });
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { defaultProvider });
    // Auto-switch default model if current model isn't from the new provider
    const { allProviderModels, defaultModel } = get();
    const providerModels = allProviderModels.filter(m => m.providerId === defaultProvider);
    if (providerModels.length > 0 && !providerModels.some(m => m.id === defaultModel)) {
      get().setDefaultModel(providerModels[0].id);
    }
  },

  refreshProviderModels: async () => {
    const { providers } = get();
    const allModels: ProviderModelInfo[] = [];

    for (const config of providers) {
      if (!config.enabled) continue;
      const provider = getProvider(config.id);
      if (!provider) continue;
      if (provider.requiresApiKey && !config.apiKey) continue;

      try {
        const models = await provider.fetchModels(config);
        allModels.push(...models);
      } catch {
        // Silently skip failing providers
      }
    }

    // Store full unfiltered catalog, then apply per-provider allowlists
    const filtered = allModels.filter(m => {
      const provConfig = providers.find(p => p.id === m.providerId);
      const allowed = provConfig?.enabledModels;
      if (!allowed || allowed.length === 0) return true;
      return allowed.includes(m.id);
    });

    set({ fullModelCatalog: allModels, allProviderModels: filtered });
  },

  setProviderEnabledModels: async (providerId: string, enabledModels: string[] | undefined) => {
    // Normalize: empty array → undefined (show all)
    const normalized = enabledModels && enabledModels.length > 0 ? enabledModels : undefined;
    const providers = get().providers.map(p =>
      p.id === providerId ? { ...p, enabledModels: normalized } : p
    );
    set({ providers });

    // Persist to Dexie
    const current = await db.settings.toCollection().first();
    if (current?.id) await db.settings.update(current.id, { providers });

    // Re-filter locally without re-fetching from APIs
    const { fullModelCatalog } = get();
    const filtered = fullModelCatalog.filter(m => {
      const provConfig = providers.find(p => p.id === m.providerId);
      const allowed = provConfig?.enabledModels;
      if (!allowed || allowed.length === 0) return true;
      return allowed.includes(m.id);
    });
    set({ allProviderModels: filtered });
  },

  refreshLivePricing: async () => {
    const { providers, livePricingLastFetched } = get();

    // TTL: skip if fetched within the last hour
    const ONE_HOUR = 60 * 60 * 1000;
    if (livePricingLastFetched && Date.now() - livePricingLastFetched < ONE_HOUR) return;

    // Find enabled OpenRouter provider with API key
    const orConfig = providers.find(p => p.id === 'openrouter' && p.enabled && p.apiKey);
    if (!orConfig) return;

    const provider = getProvider('openrouter');
    if (!provider?.fetchPricing) return;

    set({ livePricingStatus: 'loading' });

    try {
      const entries = await provider.fetchPricing(orConfig);
      setLivePricing(entries);
      set({
        livePricingStatus: 'loaded',
        livePricingCount: getLivePricingCount(),
        livePricingLastFetched: Date.now(),
      });
    } catch {
      set({ livePricingStatus: 'error' });
    }
  },

  clearLivePricingCache: () => {
    set({ livePricingLastFetched: null });
  },
}));
