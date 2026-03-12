import { useSettingsStore } from '../../store/useSettingsStore';
import { abbreviateModelName } from '../../lib/models';
import type { ProviderModelInfo } from '../../api/providers/types';

interface ModelSelectorProps {
  value: string | undefined;          // undefined = inherit
  onChange: (model: string | undefined) => void;
  showInherit?: boolean;              // show "Inherit" option (default true)
  inheritLabel?: string;              // e.g., "Default (Haiku 3.5)"
  className?: string;
}

function groupByProvider(models: ProviderModelInfo[]): Record<string, ProviderModelInfo[]> {
  const groups: Record<string, ProviderModelInfo[]> = {};
  for (const m of models) {
    const key = m.providerId;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
}

export function ModelSelector({
  value,
  onChange,
  showInherit = true,
  inheritLabel,
  className = '',
}: ModelSelectorProps) {
  const availableModels = useSettingsStore((s) => s.availableModels);
  const allProviderModels = useSettingsStore((s) => s.allProviderModels);
  const providers = useSettingsStore((s) => s.providers);
  const defaultModel = useSettingsStore((s) => s.defaultModel);

  const effectiveInheritLabel = inheritLabel || `Inherit (${abbreviateModelName(defaultModel)})`;

  const defaultProvider = useSettingsStore((s) => s.defaultProvider);

  // Use allProviderModels if any are available; fall back to Anthropic-only availableModels
  const hasProviderModels = allProviderModels.length > 0;

  if (hasProviderModels) {
    const grouped = groupByProvider(allProviderModels);
    const providerOrder = providers
      .filter(p => p.enabled)
      .sort((a, b) => {
        if (a.id === defaultProvider) return -1;
        if (b.id === defaultProvider) return 1;
        return a.name.localeCompare(b.name);
      })
      .map(p => p.id);

    return (
      <select
        value={value ?? '__inherit__'}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '__inherit__' ? undefined : val);
        }}
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] ${className}`}
      >
        {showInherit && (
          <option value="__inherit__">{effectiveInheritLabel}</option>
        )}
        {providerOrder.map(pid => {
          const models = grouped[pid];
          if (!models || models.length === 0) return null;
          const providerConfig = providers.find(p => p.id === pid);
          const label = providerConfig?.name || pid;
          return (
            <optgroup key={pid} label={label}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    );
  }

  // Fallback: flat list from Anthropic-only availableModels
  return (
    <select
      value={value ?? '__inherit__'}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === '__inherit__' ? undefined : val);
      }}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] ${className}`}
    >
      {showInherit && (
        <option value="__inherit__">{effectiveInheritLabel}</option>
      )}
      {availableModels.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName}
        </option>
      ))}
    </select>
  );
}
