import { useState, useMemo } from 'react';
import { X, Search, ListFilter } from 'lucide-react';
import type { ProviderModelInfo } from '../../api/providers/types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { findPricing, formatCost } from '../../lib/pricing';

interface ManageModelsDialogProps {
  providerId: string;
  providerName: string;
  allModels: ProviderModelInfo[];
  currentEnabledModels: string[] | undefined;
  onSave: (enabledModels: string[] | undefined) => void;
  onClose: () => void;
}

export function ManageModelsDialog({
  providerId,
  providerName,
  allModels,
  currentEnabledModels,
  onSave,
  onClose,
}: ManageModelsDialogProps) {
  const customPricing = useSettingsStore(s => s.customPricing);
  const [search, setSearch] = useState('');

  // Initialize checked set: if allowlist exists, use it (filtering stale IDs); otherwise all checked
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => {
    const validIds = new Set(allModels.map(m => m.id));
    if (currentEnabledModels && currentEnabledModels.length > 0) {
      return new Set(currentEnabledModels.filter(id => validIds.has(id)));
    }
    return new Set(validIds);
  });

  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const q = search.toLowerCase();
    return allModels.filter(
      m => m.displayName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [allModels, search]);

  // Build pricing lookup for all models (once)
  const pricingMap = useMemo(() => {
    const map = new Map<string, { input: number; output: number }>();
    for (const m of allModels) {
      const p = findPricing(m.id, providerId, customPricing);
      if (p) map.set(m.id, { input: p.inputPricePerMillion, output: p.outputPricePerMillion });
    }
    return map;
  }, [allModels, providerId, customPricing]);

  const toggleModel = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      for (const m of filteredModels) next.add(m.id);
      return next;
    });
  };

  const clearAllVisible = () => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      const visibleIds = new Set(filteredModels.map(m => m.id));
      for (const id of visibleIds) next.delete(id);
      return next;
    });
  };

  const handleSave = () => {
    // All checked or none checked → save undefined (show all)
    if (checkedIds.size === allModels.length || checkedIds.size === 0) {
      onSave(undefined);
    } else {
      onSave(Array.from(checkedIds));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-card)] rounded-2xl shadow-xl w-[520px] max-h-[80vh] flex flex-col border border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-soft)]">
          <div className="flex items-center gap-2">
            <ListFilter size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Manage Models — {providerName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] space-y-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] pl-8 pr-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              autoFocus
            />
          </div>
          {/* Select All / Clear All + counter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllVisible}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearAllVisible}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Clear All
              </button>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              {checkedIds.size} of {allModels.length} selected
            </span>
          </div>
        </div>

        {/* Column header */}
        {pricingMap.size > 0 && (
          <div className="flex items-center justify-end px-5 pt-1.5 pb-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">$/M in / out</span>
          </div>
        )}

        {/* Model list */}
        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ maxHeight: '400px' }}>
          {filteredModels.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              No models match "{search}"
            </div>
          ) : (
            filteredModels.map(m => {
              const pricing = pricingMap.get(m.id);
              return (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-secondary)] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(m.id)}
                    onChange={() => toggleModel(m.id)}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] accent-[var(--color-accent)] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--color-text)] truncate">
                      {m.displayName}
                    </div>
                    {m.id !== m.displayName && (
                      <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                        {m.id}
                      </div>
                    )}
                  </div>
                  {pricing && (
                    <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap shrink-0">
                      {formatCost(pricing.input)}/{formatCost(pricing.output)}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-soft)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
