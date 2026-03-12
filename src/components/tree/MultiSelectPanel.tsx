import { useMemo, useState } from 'react';
import { X, GitMerge, GitBranch, AlertTriangle } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { findCommonAncestor } from '../../lib/merge';
import { MergeDialog } from './MergeDialog';
import { useResizablePanel } from '../../hooks/useResizablePanel';

export function MultiSelectPanel() {
  const nodes = useTreeStore((s) => s.nodes);
  const multiSelectIds = useTreeStore((s) => s.multiSelectIds);
  const clearMultiSelect = useTreeStore((s) => s.clearMultiSelect);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const { width: panelWidth, onMouseDown: onResizeMouseDown, onDoubleClick: onResizeDoubleClick } = useResizablePanel();

  const nodeA = nodes[multiSelectIds[0]];
  const nodeB = nodes[multiSelectIds[1]];

  const analysis = useMemo(() => {
    if (!nodeA || !nodeB) return null;

    // Check if same conversation
    if (nodeA.conversationId !== nodeB.conversationId) {
      return { error: 'Selected nodes are from different conversations', ancestorId: null, isLinearPath: false };
    }

    // Check if same node
    if (nodeA.id === nodeB.id) {
      return { error: 'Cannot merge a node with itself', ancestorId: null, isLinearPath: false };
    }

    const ancestorId = findCommonAncestor(nodeA.id, nodeB.id, nodes);

    // Check if one is ancestor of the other (linear path)
    const isLinearPath = ancestorId === nodeA.id || ancestorId === nodeB.id;

    if (isLinearPath) {
      return { warning: 'One node is an ancestor of the other. The merge will cover only the divergent portion.', ancestorId, isLinearPath };
    }

    return { ancestorId, isLinearPath };
  }, [nodeA, nodeB, nodes]);

  if (!nodeA || !nodeB) return null;

  const truncate = (text: string, len: number) =>
    text.length > len ? text.slice(0, len) + '...' : text;

  const ancestor = analysis?.ancestorId ? nodes[analysis.ancestorId] : null;

  return (
    <>
      <div className="h-full flex shrink-0" style={{ width: panelWidth }}>
        <div
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResizeDoubleClick}
          className="w-1.5 shrink-0 cursor-col-resize hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors"
        />
        <div className="flex-1 h-full border-l border-[var(--color-border-soft)] bg-[var(--color-bg)] flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-soft)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
              <GitMerge size={14} className="text-blue-500" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text)]">
              Multi-Select
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-medium">
              2 nodes
            </span>
          </div>
          <button
            onClick={clearMultiSelect}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Node A */}
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                1
              </span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {nodeA.role === 'user' ? 'User' : 'Assistant'}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words">
              {truncate(nodeA.content || '(empty)', 200)}
            </p>
          </div>

          {/* Node B */}
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                2
              </span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {nodeB.role === 'user' ? 'User' : 'Assistant'}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words">
              {truncate(nodeB.content || '(empty)', 200)}
            </p>
          </div>

          {/* Common Ancestor */}
          {ancestor && (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  Common Ancestor
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap break-words">
                {truncate(ancestor.content || '(root)', 120)}
              </p>
            </div>
          )}

          {/* Errors/Warnings */}
          {analysis?.error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-xs text-red-500">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {analysis.error}
            </div>
          )}
          {analysis?.warning && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {analysis.warning}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border-soft)]">
          <button
            onClick={() => setShowMergeDialog(true)}
            disabled={!!analysis?.error}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GitMerge size={12} />
            Merge
          </button>
          <button
            onClick={() => {
              if (analysis?.isLinearPath) {
                useTreeStore.getState().clonePath(multiSelectIds[0], multiSelectIds[1]);
              }
            }}
            disabled={!analysis?.isLinearPath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={analysis?.isLinearPath ? 'Clone the path between these nodes' : 'Selected nodes must be on the same path'}
          >
            <GitBranch size={12} />
            Clone Path
          </button>
          <button
            onClick={clearMultiSelect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors ml-auto"
          >
            Cancel
          </button>
        </div>
        </div>
      </div>

      {showMergeDialog && (
        <MergeDialog
          nodeIdA={multiSelectIds[0]}
          nodeIdB={multiSelectIds[1]}
          onClose={() => setShowMergeDialog(false)}
        />
      )}
    </>
  );
}
