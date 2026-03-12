import type { TreeNode } from '../types';
import { getPathToRoot } from './tree';

export type SummarizeDirection = 'up' | 'down';

export interface BranchContent {
  messages: { role: 'user' | 'assistant'; content: string }[];
  nodeCount: number;
  depth: number;
}

/**
 * Collects content for summarization.
 *
 * - `'up'`   — path from root to the target node (the linear thread)
 * - `'down'` — all descendants below the target node (the subtree)
 */
export function collectBranchContent(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  direction: SummarizeDirection = 'up'
): BranchContent {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  let nodeCount = 0;
  let maxDepth = 0;

  if (direction === 'up') {
    // Collect path from root to target node
    const path = getPathToRoot(nodeId, nodes);
    for (const node of path) {
      nodeCount++;
      if (shouldInclude(node)) {
        messages.push({ role: node.role, content: node.content });
      }
    }
    maxDepth = path.length - 1;
  } else {
    // Collect all descendants below target node (depth-first)
    function walk(id: string, depth: number) {
      const node = nodes[id];
      if (!node) return;

      nodeCount++;
      if (depth > maxDepth) maxDepth = depth;

      if (shouldInclude(node)) {
        messages.push({ role: node.role, content: node.content });
      }

      for (const childId of node.childIds) {
        walk(childId, depth + 1);
      }
    }

    walk(nodeId, 0);
  }

  return { messages, nodeCount, depth: maxDepth };
}

/** Include a node's content if it's non-empty and non-error. */
function shouldInclude(node: TreeNode): boolean {
  if (!node.content) return false;
  if (node.content.startsWith('Error: ')) return false;
  return true;
}

/**
 * Format branch content into a prompt-friendly string.
 */
export function formatBranchForSummary(branch: BranchContent): string {
  return branch.messages
    .map(m => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
    .join('\n\n');
}
