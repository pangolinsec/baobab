import { useState, useEffect, useMemo } from 'react';
import { X, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { collectBranchContent, type SummarizeDirection } from '../../lib/summarize';
import { ModelSelector } from '../shared/ModelSelector';
import { abbreviateModelName } from '../../lib/models';

interface SummarizeDialogProps {
  nodeId: string;
  onClose: () => void;
}

export function SummarizeDialog({ nodeId, onClose }: SummarizeDialogProps) {
  const nodes = useTreeStore((s) => s.nodes);
  const summarizeBranch = useTreeStore((s) => s.summarizeBranch);
  const summarizationPrompt = useSettingsStore((s) => s.summarizationPrompt);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const [prompt, setPrompt] = useState(summarizationPrompt);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [direction, setDirection] = useState<SummarizeDirection>('up');

  const node = nodes[nodeId];
  const hasChildren = node?.childIds.length > 0;

  const branchStats = useMemo(() => {
    return collectBranchContent(nodeId, nodes, direction);
  }, [nodeId, nodes, direction]);

  useEffect(() => {
    setPrompt(summarizationPrompt);
  }, [summarizationPrompt]);

  const handleSummarize = async () => {
    onClose();
    await summarizeBranch(nodeId, {
      prompt,
      model: model || defaultModel,
      direction,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-card)] rounded-2xl shadow-xl w-[480px] max-h-[80vh] flex flex-col border border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-soft)]">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Summarize Branch
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Direction toggle + stats */}
        <div className="px-5 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-soft)] space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Scope</span>
            <div className="flex items-center gap-1 bg-[var(--color-bg)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setDirection('up')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  direction === 'up'
                    ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
                title="Summarize the conversation path from root to this node"
              >
                <ArrowUp size={12} />
                Path to here
              </button>
              <button
                onClick={() => setDirection('down')}
                disabled={!hasChildren}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  direction === 'down'
                    ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                } ${!hasChildren ? 'opacity-30 cursor-not-allowed' : ''}`}
                title={hasChildren ? 'Summarize all descendants below this node' : 'No children to summarize'}
              >
                <ArrowDown size={12} />
                Subtree below
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span>{branchStats.nodeCount} messages</span>
            <span>{branchStats.depth} levels deep</span>
            <span>{branchStats.messages.length} with content</span>
          </div>
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
              Summarization prompt
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
            onClick={handleSummarize}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Summarize
          </button>
        </div>
      </div>
    </div>
  );
}
