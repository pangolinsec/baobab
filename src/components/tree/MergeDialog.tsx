import { useState, useEffect, useMemo } from 'react';
import { X, GitMerge, AlertTriangle } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { collectBranchFromAncestor, findCommonAncestor } from '../../lib/merge';
import { ModelSelector } from '../shared/ModelSelector';
import { abbreviateModelName } from '../../lib/models';

interface MergeDialogProps {
  nodeIdA: string;
  nodeIdB: string;
  onClose: () => void;
}

export function MergeDialog({ nodeIdA, nodeIdB, onClose }: MergeDialogProps) {
  const nodes = useTreeStore((s) => s.nodes);
  const mergeBranches = useTreeStore((s) => s.mergeBranches);
  const mergePrompt = useSettingsStore((s) => s.mergePrompt);
  const defaultMergeMode = useSettingsStore((s) => s.defaultMergeMode);
  const defaultModel = useSettingsStore((s) => s.defaultModel);

  const [prompt, setPrompt] = useState(mergePrompt || '');
  const [model, setModel] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'summarize' | 'full-context'>(defaultMergeMode || 'summarize');

  useEffect(() => {
    setPrompt(mergePrompt || '');
  }, [mergePrompt]);

  const branchStats = useMemo(() => {
    const ancestorId = findCommonAncestor(nodeIdA, nodeIdB, nodes);
    if (!ancestorId) return null;

    const branchA = collectBranchFromAncestor(nodeIdA, ancestorId, nodes);
    const branchB = collectBranchFromAncestor(nodeIdB, ancestorId, nodes);

    return { branchA, branchB };
  }, [nodeIdA, nodeIdB, nodes]);

  const handleMerge = async () => {
    onClose();
    await mergeBranches(nodeIdA, nodeIdB, {
      prompt,
      model: model || defaultModel,
      mode,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-card)] rounded-2xl shadow-xl w-[480px] max-h-[80vh] flex flex-col border border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-soft)]">
          <div className="flex items-center gap-2">
            <GitMerge size={18} className="text-[#7C9AB5]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Merge Branches
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Branch stats + mode */}
        <div className="px-5 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-soft)] space-y-2">
          {branchStats && (
            <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              <span>Branch 1: {branchStats.branchA.nodeCount} messages</span>
              <span>Branch 2: {branchStats.branchB.nodeCount} messages</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Mode</span>
            <div className="flex items-center gap-1 bg-[var(--color-bg)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setMode('summarize')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'summarize'
                    ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Summarize
              </button>
              <button
                onClick={() => setMode('full-context')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === 'full-context'
                    ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Full Context
              </button>
            </div>
          </div>

          {mode === 'full-context' && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              Full context embeds both branch transcripts in the merge user node. This may use more tokens.
            </div>
          )}
        </div>

        {/* Model picker + prompt editor */}
        <div className="px-5 py-4 flex-1 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Model
            </label>
            <ModelSelector
              value={model}
              onChange={setModel}
              showInherit={true}
              inheritLabel={`Default (${abbreviateModelName(defaultModel)})`}
              className="w-full text-xs py-1.5 px-2"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Merge prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 resize-y"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-soft)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}
