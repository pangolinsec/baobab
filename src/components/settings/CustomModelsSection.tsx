import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CustomModelEntry } from '../../types';

interface Props {
  entries: CustomModelEntry[];
  showReasoningFlag?: boolean;
  onChange: (entries: CustomModelEntry[]) => void;
}

export function CustomModelsSection({ entries, showReasoningFlag, onChange }: Props) {
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isReasoning, setIsReasoning] = useState(false);

  const add = () => {
    const trimmed = slug.trim();
    if (!trimmed) return;
    if (entries.some(e => e.slug === trimmed)) return;
    const entry: CustomModelEntry = {
      id: crypto.randomUUID(),
      slug: trimmed,
      displayName: displayName.trim() || undefined,
      isReasoningModel: showReasoningFlag ? isReasoning : undefined,
    };
    onChange([...entries, entry]);
    setSlug('');
    setDisplayName('');
    setIsReasoning(false);
  };

  const remove = (id: string) => {
    onChange(entries.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        Custom Model Slugs
      </label>
      <p className="text-[11px] text-[var(--color-text-muted)] -mt-1">
        Add arbitrary model identifiers (fine-tunes, gateway slugs, new models not yet in the catalog). The slug is sent verbatim as the <code className="font-mono">model</code> parameter.
      </p>

      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map(e => (
            <div
              key={e.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-soft)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[var(--color-text)] truncate">
                    {e.displayName || e.slug}
                  </span>
                  {e.isReasoningModel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-400/15 text-violet-600 dark:text-violet-400 font-medium shrink-0">
                      Reasoning
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-border)] text-[var(--color-text-muted)] font-medium shrink-0">
                    Custom
                  </span>
                </div>
                {e.displayName && (
                  <div className="text-[10px] text-[var(--color-text-muted)] truncate font-mono">
                    {e.slug}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(e.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                title="Remove"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center pt-1">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="model-slug"
          className="flex-1 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Display name (optional)"
          className="flex-1 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
        />
        {showReasoningFlag && (
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={isReasoning}
              onChange={(e) => setIsReasoning(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
            />
            Reasoning
          </label>
        )}
        <button
          onClick={add}
          disabled={!slug.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}
