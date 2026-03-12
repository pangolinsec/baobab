import { useState } from 'react';
import { GitBranch, Eye } from 'lucide-react';
import type { TreeNode } from '../../types';
import { useTreeStore } from '../../store/useTreeStore';

interface BranchIndicatorProps {
  node: TreeNode;
  siblings: TreeNode[];
}

export function BranchIndicator({ node, siblings }: BranchIndicatorProps) {
  const [showPreviews, setShowPreviews] = useState(false);

  const otherBranches = siblings.filter(s => s.id !== node.id);
  if (otherBranches.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPreviews(!showPreviews)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <GitBranch size={12} />
        <span>{otherBranches.length} other branch{otherBranches.length !== 1 ? 'es' : ''} from here</span>
      </button>

      {showPreviews && (
        <div className="mt-1 ml-4 space-y-1 border-l-2 border-[var(--color-border-soft)] pl-3">
          {otherBranches.map(sibling => (
            <div
              key={sibling.id}
              className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer group"
              onClick={(e) => {
                useTreeStore.getState().selectNode(sibling.id, e.shiftKey);
              }}
            >
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {sibling.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {sibling.content.slice(0, 100)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  useTreeStore.getState().selectNode(sibling.id, e.shiftKey);
                  useTreeStore.getState().setViewMode('tree');
                }}
                className="opacity-0 group-hover:opacity-100 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-all"
                title="View in tree"
              >
                <Eye size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
