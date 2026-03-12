import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  ListFilter,
  Pencil,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getAllProviders, getProvider } from '../../api/providers/registry';
import { DEFAULT_PRICING, formatCost } from '../../lib/pricing';
import { ManageModelsDialog } from '../settings/ManageModelsDialog';
import type { ProviderConfigData, CustomPricingEntry, AzureModelEntry } from '../../types';
import type { AzureModelValidationResult } from '../../api/providers/azure';
import { AzureProvider } from '../../api/providers/azure';

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'Providers' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'search', label: 'Search' },
  { id: 'pricing', label: 'Pricing' },
];

function GeneralSection() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const autoGenerateTitles = useSettingsStore((s) => s.autoGenerateTitles);
  const setAutoGenerateTitles = useSettingsStore((s) => s.setAutoGenerateTitles);
  const titleGenerationModel = useSettingsStore((s) => s.titleGenerationModel);
  const setTitleGenerationModel = useSettingsStore((s) => s.setTitleGenerationModel);
  const allProviderModels = useSettingsStore((s) => s.allProviderModels);

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Theme
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              theme === 'light'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Dark
          </button>
        </div>
      </div>

      {/* Auto-generate Titles */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Auto-generate Titles
          </label>
          <button
            onClick={() => setAutoGenerateTitles(!autoGenerateTitles)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              autoGenerateTitles ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                autoGenerateTitles ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Use an LLM to generate a short conversation title after the first response completes.
        </p>

        {autoGenerateTitles && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Title Generation Model
            </label>
            <select
              value={titleGenerationModel || ''}
              onChange={(e) => setTitleGenerationModel(e.target.value || undefined)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            >
              <option value="">Same as chat</option>
              {allProviderModels.map(m => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Pick a small, fast model to minimize cost and latency.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedSection() {
  const {
    thinkingEnabled,
    thinkingBudget,
    temperature,
    maxOutputTokens,
    topP,
    topK,
    captureRawApiData,
    reasoningEffort,
    setThinkingEnabled,
    setThinkingBudget,
    setTemperature,
    setMaxOutputTokens,
    setTopP,
    setTopK,
    setCaptureRawApiData,
    setReasoningEffort,
  } = useSettingsStore();

  const [localTopP, setLocalTopP] = useState(topP !== null ? String(topP) : '');
  const [localTopK, setLocalTopK] = useState(topK !== null ? String(topK) : '');

  useEffect(() => {
    setLocalTopP(topP !== null ? String(topP) : '');
  }, [topP]);

  useEffect(() => {
    setLocalTopK(topK !== null ? String(topK) : '');
  }, [topK]);

  const handleTopPBlur = () => {
    const val = localTopP.trim();
    if (!val) {
      setTopP(null);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        setTopP(num);
      } else {
        setLocalTopP(topP !== null ? String(topP) : '');
      }
    }
  };

  const handleTopKBlur = () => {
    const val = localTopK.trim();
    if (!val) {
      setTopK(null);
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) {
        setTopK(num);
      } else {
        setLocalTopK(topK !== null ? String(topK) : '');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Extended Thinking */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Extended Thinking
          </label>
          <button
            onClick={() => setThinkingEnabled(!thinkingEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              thinkingEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                thinkingEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Allow Claude to think through problems before responding. Incompatible with temperature and top-k settings.
        </p>

        {/* Thinking Budget — only visible when thinking enabled */}
        {thinkingEnabled && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                Thinking Budget
              </label>
              <span className="text-xs text-[var(--color-text-muted)]">
                {thinkingBudget.toLocaleString()} tokens
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={thinkingBudget}
              onChange={(e) => setThinkingBudget(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
              <span>1,000</span>
              <span>100,000</span>
            </div>
          </div>
        )}
      </div>

      {/* Reasoning Effort (OpenAI/Azure) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Reasoning Effort (OpenAI/Azure)
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Controls how much reasoning effort OpenAI/Azure reasoning models (o-series) use. Only applies to models using the Responses API.
        </p>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as const).map(level => (
            <button
              key={level}
              onClick={() => setReasoningEffort(level)}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                (reasoningEffort || 'medium') === level
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Temperature
          </label>
          <span className="text-xs text-[var(--color-text-muted)]">
            {temperature.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Controls randomness. Lower values (0.0) make responses more focused and deterministic. Higher values (1.0) make responses more creative and varied.
        </p>
        {thinkingEnabled && (
          <p className="text-xs text-[var(--color-accent)] mb-1.5">
            Disabled when thinking is enabled (must be 1.0)
          </p>
        )}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          disabled={thinkingEnabled}
          className="w-full accent-[var(--color-accent)] disabled:opacity-40"
        />
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
          <span>0.0 (precise)</span>
          <span>1.0 (creative)</span>
        </div>
      </div>

      {/* Max Output Tokens */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Max Output Tokens
          </label>
          <span className="text-xs text-[var(--color-text-muted)]">
            {maxOutputTokens.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Maximum number of tokens (roughly words) the model can generate in a single response. Higher values allow longer responses but may increase latency and cost.
        </p>
        <input
          type="range"
          min={256}
          max={128000}
          step={256}
          value={maxOutputTokens}
          onChange={(e) => setMaxOutputTokens(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
          <span>256</span>
          <span>128,000</span>
        </div>
      </div>

      {/* Top P */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Top P <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Nucleus sampling — only considers tokens whose cumulative probability is within this threshold. For example, 0.9 means the model picks from the smallest set of tokens whose probabilities add up to 90%. Lower values narrow the choices; leave blank to let the API decide.
        </p>
        <input
          type="text"
          value={localTopP}
          onChange={(e) => setLocalTopP(e.target.value)}
          onBlur={handleTopPBlur}
          placeholder="Leave blank to omit"
          disabled={thinkingEnabled}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] disabled:opacity-40"
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
          Value between 0 and 1. Blank = default (API decides).
        </p>
      </div>

      {/* Top K */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Top K <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Limits the model to choosing from only the top K most likely next tokens. For example, top-k of 40 means only the 40 highest-probability words are considered at each step. Lower values make output more predictable; leave blank to let the API decide.
        </p>
        <input
          type="text"
          value={localTopK}
          onChange={(e) => setLocalTopK(e.target.value)}
          onBlur={handleTopKBlur}
          placeholder="Leave blank to omit"
          disabled={thinkingEnabled}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] disabled:opacity-40"
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
          Integer value. Blank = default (API decides). Disabled when thinking is enabled.
        </p>
      </div>

      {/* Capture Raw API Data */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Capture Raw API Data
          </label>
          <button
            onClick={() => setCaptureRawApiData(!captureRawApiData)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              captureRawApiData ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                captureRawApiData ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          Store the actual request body and response headers for each API call. Useful for debugging. Increases storage usage.
        </p>
      </div>
    </div>
  );
}

function PromptsSection() {
  const {
    defaultSystemPrompt, setDefaultSystemPrompt,
    summarizationPrompt, setSummarizationPrompt,
    mergePrompt, setMergePrompt,
    defaultMergeMode, setDefaultMergeMode,
  } = useSettingsStore();
  const [localPrompt, setLocalPrompt] = useState(defaultSystemPrompt);
  const [localSumPrompt, setLocalSumPrompt] = useState(summarizationPrompt);
  const [localMergePrompt, setLocalMergePrompt] = useState(mergePrompt || '');

  useEffect(() => {
    setLocalPrompt(defaultSystemPrompt);
  }, [defaultSystemPrompt]);

  useEffect(() => {
    setLocalSumPrompt(summarizationPrompt);
  }, [summarizationPrompt]);

  useEffect(() => {
    setLocalMergePrompt(mergePrompt || '');
  }, [mergePrompt]);

  const handleBlur = () => {
    if (localPrompt !== defaultSystemPrompt) {
      setDefaultSystemPrompt(localPrompt);
    }
  };

  const handleSumBlur = () => {
    if (localSumPrompt !== summarizationPrompt) {
      setSummarizationPrompt(localSumPrompt);
    }
  };

  const handleMergeBlur = () => {
    if (localMergePrompt !== (mergePrompt || '')) {
      setMergePrompt(localMergePrompt);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Default System Prompt
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Applied to all new conversations unless overridden at the conversation or node level.
        </p>
        <textarea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          onBlur={handleBlur}
          placeholder="Enter a default system prompt (optional)"
          rows={6}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Summarization Prompt
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Used when summarizing a conversation branch. The branch content is prepended automatically.
        </p>
        <textarea
          value={localSumPrompt}
          onChange={(e) => setLocalSumPrompt(e.target.value)}
          onBlur={handleSumBlur}
          placeholder="Enter a summarization prompt"
          rows={4}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </div>

      {/* Merge settings */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Default Merge Mode
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Controls how branch content is included when merging. Summarize uses shorter references; Full Context embeds complete transcripts.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setDefaultMergeMode('summarize')}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              (defaultMergeMode || 'summarize') === 'summarize'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Summarize
          </button>
          <button
            onClick={() => setDefaultMergeMode('full-context')}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              defaultMergeMode === 'full-context'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Full Context
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Merge Prompt
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Used when merging two conversation branches. Both branch contents are prepended automatically.
        </p>
        <textarea
          value={localMergePrompt}
          onChange={(e) => setLocalMergePrompt(e.target.value)}
          onBlur={handleMergeBlur}
          placeholder="Enter a merge prompt"
          rows={4}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] resize-y"
        />
      </div>
    </div>
  );
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface ProviderTestState {
  status: TestStatus;
  modelCount: number;
  error: string;
}

// --- Azure Model Edit Dialog ---

interface AzureModelEditDialogProps {
  entry?: AzureModelEntry;  // undefined = add new
  existingEntries: AzureModelEntry[];
  onSave: (entry: AzureModelEntry) => void;
  onClose: () => void;
}

function AzureModelEditDialog({ entry, existingEntries, onSave, onClose }: AzureModelEditDialogProps) {
  const [endpoint, setEndpoint] = useState(entry?.endpoint ?? '');
  const [baseUrl, setBaseUrl] = useState(entry?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(entry?.apiKey ?? '');
  const [nickname, setNickname] = useState(entry?.nickname ?? '');
  const [isReasoningModel, setIsReasoningModel] = useState(entry?.isReasoningModel ?? false);

  // Validation
  const otherEntries = existingEntries.filter(e => e.id !== entry?.id);
  const endpointDuplicate = otherEntries.some(e => e.endpoint === endpoint);
  const nicknameRequired = endpointDuplicate && !nickname.trim();
  const nicknameDuplicate = nickname.trim() && otherEntries.some(e => e.nickname === nickname.trim());

  let baseUrlError = '';
  if (baseUrl.trim()) {
    try { new URL(baseUrl); } catch { baseUrlError = 'Invalid URL'; }
  }

  const canSave = endpoint.trim() && baseUrl.trim() && !baseUrlError && apiKey.trim()
    && !nicknameRequired && !nicknameDuplicate;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: entry?.id ?? crypto.randomUUID(),
      endpoint: endpoint.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      nickname: nickname.trim() || undefined,
      isReasoningModel,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--color-bg)] rounded-2xl shadow-xl border border-[var(--color-border)] w-full max-w-md p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {entry ? 'Edit Azure Model Endpoint' : 'Add Azure Model Endpoint'}
        </h3>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Deployment Name (endpoint)
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="o4-mini"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://resource.openai.azure.com/openai/v1"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          {baseUrlError && (
            <p className="mt-1 text-[10px] text-red-500">{baseUrlError}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter Azure API key"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Nickname (optional)
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. o4-mini East US"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          {nicknameRequired && (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
              Required — another entry uses the same endpoint name
            </p>
          )}
          {nicknameDuplicate && (
            <p className="mt-1 text-[10px] text-red-500">
              Nickname already in use by another entry
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReasoningModel(!isReasoningModel)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isReasoningModel ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                isReasoningModel ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            Reasoning model (uses Responses API)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Azure Provider Expanded Section ---

interface AzureProviderSectionProps {
  provider: ProviderConfigData;
  updateProvider: (id: string, updates: Partial<ProviderConfigData>) => void;
}

function AzureProviderExpandedSection({ provider, updateProvider }: AzureProviderSectionProps) {
  const [editingEntry, setEditingEntry] = useState<AzureModelEntry | undefined>(undefined);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [validationResults, setValidationResults] = useState<AzureModelValidationResult[]>([]);
  const [validating, setValidating] = useState(false);

  const entries = provider.azureModels ?? [];

  const handleSaveEntry = (entry: AzureModelEntry) => {
    const existing = entries.find(e => e.id === entry.id);
    const updated = existing
      ? entries.map(e => e.id === entry.id ? entry : e)
      : [...entries, entry];
    updateProvider(provider.id, { azureModels: updated });
    setEditingEntry(undefined);
    setShowAddDialog(false);
  };

  const handleRemoveEntry = (entryId: string) => {
    updateProvider(provider.id, {
      azureModels: entries.filter(e => e.id !== entryId),
    });
  };

  const handleTestConnection = async () => {
    setValidating(true);
    setValidationResults([]);
    try {
      const azureProvider = getProvider('azure') as AzureProvider;
      const results = await azureProvider.validateKeyPerModel(provider as any);
      setValidationResults(results);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border-soft)]">
      {/* Enable toggle */}
      <div className="flex items-center justify-between pt-3">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          Enabled
        </label>
        <button
          onClick={() => updateProvider(provider.id, { enabled: !provider.enabled })}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            provider.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              provider.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Model Endpoints list */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
          Model Endpoints
        </label>
        {entries.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-2">
            No model endpoints configured. Add one to get started.
          </p>
        ) : (
          <div className="space-y-1.5">
            {entries.map(entry => {
              const validationResult = validationResults.find(r => r.modelId === `azure::${entry.id}`);
              return (
                <div key={entry.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-soft)]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-[var(--color-text)] truncate">
                        {entry.nickname || entry.endpoint}
                      </span>
                      {entry.isReasoningModel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-400/15 text-violet-600 dark:text-violet-400 font-medium shrink-0">
                          Reasoning
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                      {entry.baseUrl}
                    </div>
                  </div>

                  {/* Validation status */}
                  {validationResult && (
                    validationResult.success ? (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    ) : (
                      <span className="flex items-center gap-1 shrink-0" title={validationResult.error}>
                        <AlertCircle size={14} className="text-red-500" />
                      </span>
                    )
                  )}

                  <button
                    onClick={() => setEditingEntry(entry)}
                    className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] transition-colors shrink-0"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Model button */}
      <button
        onClick={() => { setEditingEntry(undefined); setShowAddDialog(true); }}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
      >
        <Plus size={12} />
        Add Model Endpoint
      </button>

      {/* Test Connection */}
      {provider.enabled && entries.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={validating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
          >
            {validating ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Testing…
              </span>
            ) : (
              'Test Connection'
            )}
          </button>
          {validationResults.length > 0 && !validating && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {validationResults.filter(r => r.success).length}/{validationResults.length} endpoints OK
            </span>
          )}
        </div>
      )}

      {/* Edit/Add Dialog */}
      {(showAddDialog || editingEntry) && (
        <AzureModelEditDialog
          entry={editingEntry}
          existingEntries={entries}
          onSave={handleSaveEntry}
          onClose={() => { setEditingEntry(undefined); setShowAddDialog(false); }}
        />
      )}
    </div>
  );
}

function ProvidersSection() {
  const { providers, defaultProvider, defaultModel, allProviderModels, fullModelCatalog, setProviders, setDefaultProvider, setDefaultModel, setProviderEnabledModels } = useSettingsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, ProviderTestState>>({});
  const [manageModelsProviderId, setManageModelsProviderId] = useState<string | null>(null);
  const allProviderDefs = getAllProviders();

  const updateProvider = (id: string, updates: Partial<ProviderConfigData>) => {
    const newProviders = providers.map(p =>
      p.id === id ? { ...p, ...updates } : p
    );
    setProviders(newProviders);
  };

  const addProvider = (providerId: string) => {
    const def = allProviderDefs.find(p => p.id === providerId);
    if (!def) return;
    if (providers.some(p => p.id === providerId)) return;

    const newProvider: ProviderConfigData = {
      id: providerId,
      name: def.name,
      apiKey: '',
      enabled: false,
    };

    // Add base URL for Ollama
    if (providerId === 'ollama') {
      newProvider.baseUrl = 'http://localhost:11434';
    }

    // Initialize empty azureModels for Azure
    if (providerId === 'azure') {
      newProvider.azureModels = [];
    }

    setProviders([...providers, newProvider]);
    setExpandedId(providerId);
  };

  const testConnection = async (providerId: string) => {
    const config = providers.find(p => p.id === providerId);
    const providerImpl = getProvider(providerId);
    if (!config || !providerImpl) return;

    setTestStates(prev => ({
      ...prev,
      [providerId]: { status: 'testing', modelCount: 0, error: '' },
    }));

    try {
      await providerImpl.validateKey(config);
      const models = await providerImpl.fetchModels(config);
      setTestStates(prev => ({
        ...prev,
        [providerId]: { status: 'success', modelCount: models.length, error: '' },
      }));
    } catch (err: any) {
      setTestStates(prev => ({
        ...prev,
        [providerId]: { status: 'error', modelCount: 0, error: err?.message || 'Connection failed' },
      }));
    }
  };

  const unconfiguredProviders = allProviderDefs.filter(
    def => !providers.some(p => p.id === def.id)
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        Configure inference providers. The default provider is used for new conversations.
      </p>

      {/* Default provider selector */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Default Provider
        </label>
        <select
          value={defaultProvider}
          onChange={(e) => setDefaultProvider(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
        >
          {providers.filter(p => p.enabled).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Default model selector */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Default Model
        </label>
        {(() => {
          const providerModels = allProviderModels.filter(m => m.providerId === defaultProvider);
          if (providerModels.length > 0) {
            return (
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
              >
                {providerModels.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
            );
          }
          return (
            <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-placeholder)]">
              Enable a provider and test its connection to load models
            </div>
          );
        })()}
      </div>

      {/* Provider accordion */}
      <div className="space-y-2">
        {providers.map(provider => {
          const isExpanded = expandedId === provider.id;
          const def = allProviderDefs.find(d => d.id === provider.id);

          return (
            <div key={provider.id} className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${provider.enabled ? 'bg-emerald-500' : 'bg-[var(--color-border)]'}`} />
                  <span className="text-sm font-medium text-[var(--color-text)]">{provider.name}</span>
                  {provider.id === defaultProvider && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                      default
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isExpanded && provider.id === 'azure' && (
                <AzureProviderExpandedSection provider={provider} updateProvider={updateProvider} />
              )}
              {isExpanded && provider.id !== 'azure' && (
                <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border-soft)]">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between pt-3">
                    <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Enabled
                    </label>
                    <button
                      onClick={() => updateProvider(provider.id, { enabled: !provider.enabled })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        provider.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          provider.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* API Key (if required) */}
                  {def?.requiresApiKey && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={provider.apiKey}
                        onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                        placeholder={`Enter ${provider.name} API key`}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                      />
                    </div>
                  )}

                  {/* Base URL (for Ollama, custom endpoints) */}
                  {(provider.id === 'ollama' || provider.baseUrl !== undefined) && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={provider.baseUrl || ''}
                        onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value || undefined })}
                        placeholder="http://localhost:11434"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                      />
                    </div>
                  )}

                  {/* Test Connection */}
                  {provider.enabled && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testConnection(provider.id)}
                        disabled={testStates[provider.id]?.status === 'testing'}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50"
                      >
                        {testStates[provider.id]?.status === 'testing' ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" />
                            Testing…
                          </span>
                        ) : (
                          'Test Connection'
                        )}
                      </button>
                      {testStates[provider.id]?.status === 'success' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={12} />
                          {testStates[provider.id].modelCount} model{testStates[provider.id].modelCount !== 1 ? 's' : ''} available
                        </span>
                      )}
                      {testStates[provider.id]?.status === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle size={12} />
                          {testStates[provider.id].error}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Manage Models — only for providers with many models */}
                  {provider.enabled && (() => {
                    const catalogModels = fullModelCatalog.filter(m => m.providerId === provider.id);
                    const filteredCount = allProviderModels.filter(m => m.providerId === provider.id).length;
                    if (catalogModels.length <= 20) return null;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            Showing {filteredCount} of {catalogModels.length} models
                          </span>
                          <button
                            onClick={() => setManageModelsProviderId(provider.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                          >
                            <ListFilter size={12} />
                            Manage Models
                          </button>
                        </div>
                        {!provider.enabledModels && (
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            All models visible in picker. Select a subset for faster access.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add provider */}
      {unconfiguredProviders.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            Add Provider
          </label>
          <div className="flex flex-wrap gap-2">
            {unconfiguredProviders.map(def => (
              <button
                key={def.id}
                onClick={() => addProvider(def.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
              >
                <Plus size={12} />
                {def.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manage Models Dialog */}
      {manageModelsProviderId && (() => {
        const provConfig = providers.find(p => p.id === manageModelsProviderId);
        if (!provConfig) return null;
        const catalogModels = fullModelCatalog.filter(m => m.providerId === manageModelsProviderId);
        return (
          <ManageModelsDialog
            providerId={manageModelsProviderId}
            providerName={provConfig.name}
            allModels={catalogModels}
            currentEnabledModels={provConfig.enabledModels}
            onSave={(models) => {
              setProviderEnabledModels(manageModelsProviderId, models);
              setManageModelsProviderId(null);
            }}
            onClose={() => setManageModelsProviderId(null)}
          />
        );
      })()}
    </div>
  );
}

const PROVIDER_OPTIONS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'huggingface', label: 'HuggingFace' },
];

function PricingSection() {
  const { customPricing, setCustomPricing, livePricingStatus, livePricingCount, refreshLivePricing, clearLivePricingCache, providers } = useSettingsStore();
  const hasOpenRouter = providers.some(p => p.id === 'openrouter' && p.enabled && p.apiKey);
  const entries = customPricing || [];

  const [newPattern, setNewPattern] = useState('');
  const [newProvider, setNewProvider] = useState('openrouter');
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');

  const handleAdd = () => {
    const inputPrice = parseFloat(newInput);
    const outputPrice = parseFloat(newOutput);
    if (!newPattern.trim() || isNaN(inputPrice) || isNaN(outputPrice)) return;
    const entry: CustomPricingEntry = {
      modelPattern: newPattern.trim(),
      providerId: newProvider,
      inputPricePerMillion: inputPrice,
      outputPricePerMillion: outputPrice,
    };
    setCustomPricing([...entries, entry]);
    setNewPattern('');
    setNewInput('');
    setNewOutput('');
  };

  const handleDelete = (index: number) => {
    setCustomPricing(entries.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updates: Partial<CustomPricingEntry>) => {
    const updated = entries.map((e, i) => i === index ? { ...e, ...updates } : e);
    setCustomPricing(updated);
  };

  // Group default pricing by provider
  const groupedDefaults = PROVIDER_OPTIONS
    .map(p => ({
      ...p,
      entries: DEFAULT_PRICING.filter(e => e.providerId === p.id),
    }))
    .filter(g => g.entries.length > 0);

  return (
    <div className="space-y-6">
      {/* Custom Pricing */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Custom Pricing
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          Add pricing for models not in the default table (e.g. OpenRouter, HuggingFace). Custom entries override defaults for matching models.
        </p>

        {entries.length > 0 && (
          <div className="space-y-2 mb-4">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <input
                  value={entry.modelPattern}
                  onChange={(e) => handleUpdate(i, { modelPattern: e.target.value })}
                  className="flex-1 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                  placeholder="Model pattern"
                />
                <select
                  value={entry.providerId}
                  onChange={(e) => handleUpdate(i, { providerId: e.target.value })}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                >
                  {PROVIDER_OPTIONS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={entry.inputPricePerMillion}
                  onChange={(e) => handleUpdate(i, { inputPricePerMillion: parseFloat(e.target.value) || 0 })}
                  className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                  title="Input $/M"
                />
                <input
                  type="number"
                  step="0.01"
                  value={entry.outputPricePerMillion}
                  onChange={(e) => handleUpdate(i, { outputPricePerMillion: parseFloat(e.target.value) || 0 })}
                  className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                  title="Output $/M"
                />
                <button
                  onClick={() => handleDelete(i)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div className="flex items-center gap-2 text-xs">
          <input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            placeholder="Model pattern (e.g. mistral-large)"
            className="flex-1 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <select
            value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          >
            {PROVIDER_OPTIONS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            placeholder="In $/M"
            className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <input
            type="number"
            step="0.01"
            value={newOutput}
            onChange={(e) => setNewOutput(e.target.value)}
            placeholder="Out $/M"
            className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <button
            onClick={handleAdd}
            disabled={!newPattern.trim() || !newInput || !newOutput}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-30 shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      {/* Live Pricing */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Live Pricing
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          Fetched from OpenRouter's API. Provides exact pricing for OpenRouter models.
        </p>
        <div className="flex items-center gap-2">
          {!hasOpenRouter ? (
            <span className="text-xs text-[var(--color-text-muted)]">
              OpenRouter not configured
            </span>
          ) : livePricingStatus === 'loading' ? (
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Loader2 size={12} className="animate-spin" />
              Fetching...
            </span>
          ) : livePricingStatus === 'loaded' ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} />
              {livePricingCount} model{livePricingCount !== 1 ? 's' : ''} with live pricing
            </span>
          ) : livePricingStatus === 'error' ? (
            <span className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={12} />
              Failed to fetch
            </span>
          ) : null}
          {hasOpenRouter && livePricingStatus !== 'loading' && (
            <button
              onClick={() => {
                clearLivePricingCache();
                refreshLivePricing();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Static Pricing Reference */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Static Pricing Reference
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          Built-in pricing table. Ollama models are always free. Add custom entries above for OpenRouter/HuggingFace models.
        </p>

        <div className="space-y-4">
          {groupedDefaults.map(group => (
            <div key={group.id}>
              <h4 className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">{group.label}</h4>
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--color-bg-secondary)]">
                      <th className="text-left px-3 py-1.5 font-medium text-[var(--color-text-muted)]">Model</th>
                      <th className="text-right px-3 py-1.5 font-medium text-[var(--color-text-muted)]">Input/M</th>
                      <th className="text-right px-3 py-1.5 font-medium text-[var(--color-text-muted)]">Output/M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map(entry => (
                      <tr key={entry.modelPattern} className="border-t border-[var(--color-border-soft)]">
                        <td className="px-3 py-1.5 text-[var(--color-text)]">{entry.displayName}</td>
                        <td className="text-right px-3 py-1.5 text-[var(--color-text-muted)] tabular-nums">{formatCost(entry.inputPricePerMillion)}</td>
                        <td className="text-right px-3 py-1.5 text-[var(--color-text-muted)] tabular-nums">{formatCost(entry.outputPricePerMillion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      {entries.length > 0 && (
        <button
          onClick={() => setCustomPricing([])}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
        >
          Reset to Defaults
        </button>
      )}
    </div>
  );
}

function SearchSection() {
  const {
    defaultSearchProvider,
    tavilyApiKey,
    bingApiKey,
    setDefaultSearchProvider,
    setTavilyApiKey,
    setBingApiKey,
  } = useSettingsStore();

  return (
    <div className="space-y-5">
      {/* Default search provider */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Default Search Provider
        </label>
        <select
          value={defaultSearchProvider || 'duckduckgo'}
          onChange={(e) => setDefaultSearchProvider(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        >
          <option value="duckduckgo">DuckDuckGo (no API key required)</option>
          <option value="tavily">Tavily</option>
          <option value="bing">Bing</option>
        </select>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          DuckDuckGo works without an API key. Tavily and Bing require keys below.
        </p>
      </div>

      {/* Tavily API Key */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Tavily API Key
        </label>
        <input
          type="password"
          value={tavilyApiKey || ''}
          onChange={(e) => setTavilyApiKey(e.target.value)}
          onBlur={(e) => setTavilyApiKey(e.target.value)}
          placeholder="tvly-..."
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Get a key at tavily.com. Provides high-quality search results optimized for AI.
        </p>
      </div>

      {/* Bing API Key */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          Bing API Key
        </label>
        <input
          type="password"
          value={bingApiKey || ''}
          onChange={(e) => setBingApiKey(e.target.value)}
          onBlur={(e) => setBingApiKey(e.target.value)}
          placeholder="Ocp-Apim-Subscription-Key"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Get a key from the Azure portal (Bing Search v7 resource).
        </p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  const activeSection = section || 'general';
  const validSection = SECTIONS.find((s) => s.id === activeSection);

  useEffect(() => {
    if (section && !validSection) {
      navigate('/settings', { replace: true });
    }
  }, [section, validSection, navigate]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border-soft)]">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] hover:text-[var(--color-text)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          Settings
        </h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tab sidebar — only shown when multiple sections exist */}
        {SECTIONS.length > 1 && (
          <nav className="w-48 border-r border-[var(--color-border-soft)] py-4 px-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/settings/${s.id}`, { replace: true })}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === s.id
                    ? 'bg-[var(--color-border-soft)] text-[var(--color-text)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
          {activeSection === 'general' && <GeneralSection />}
          {activeSection === 'providers' && <ProvidersSection />}
          {activeSection === 'advanced' && <AdvancedSection />}
          {activeSection === 'prompts' && <PromptsSection />}
          {activeSection === 'search' && <SearchSection />}
          {activeSection === 'pricing' && <PricingSection />}
        </div>
      </div>
    </div>
  );
}
