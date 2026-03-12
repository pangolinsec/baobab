import type { TreeNode } from '../types';
import { getPathToRoot } from './tree';
import { formatBranchForSummary, type BranchContent } from './summarize';

/**
 * Find the lowest common ancestor of two nodes in the tree.
 * Walks both paths to root and finds the first shared node.
 */
export function findCommonAncestor(
  nodeIdA: string,
  nodeIdB: string,
  nodes: Record<string, TreeNode>
): string | null {
  const pathA = getPathToRoot(nodeIdA, nodes); // root → nodeA
  const pathB = getPathToRoot(nodeIdB, nodes); // root → nodeB

  const setB = new Set(pathB.map(n => n.id));

  // Walk pathA from leaf to root to find the deepest common ancestor
  for (let i = pathA.length - 1; i >= 0; i--) {
    if (setB.has(pathA[i].id)) {
      return pathA[i].id;
    }
  }

  return null;
}

/**
 * Collect the branch segment from ancestor to the target node (exclusive of ancestor).
 */
export function collectBranchFromAncestor(
  nodeId: string,
  ancestorId: string,
  nodes: Record<string, TreeNode>
): BranchContent {
  const fullPath = getPathToRoot(nodeId, nodes); // root → nodeId

  // Find ancestor index and take the segment after it
  const ancestorIdx = fullPath.findIndex(n => n.id === ancestorId);
  const segment = ancestorIdx >= 0 ? fullPath.slice(ancestorIdx + 1) : fullPath;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const node of segment) {
    if (node.content && !node.content.startsWith('Error: ')) {
      messages.push({ role: node.role, content: node.content });
    }
  }

  return {
    messages,
    nodeCount: segment.length,
    depth: segment.length,
  };
}

/**
 * Build the user-facing content for the synthetic merge user node.
 */
export function buildMergeUserContent(
  branchA: BranchContent,
  branchB: BranchContent,
  mode: 'summarize' | 'full-context'
): string {
  if (mode === 'full-context') {
    const textA = formatBranchForSummary(branchA);
    const textB = formatBranchForSummary(branchB);
    return `[Merge request — full context]\n\n--- Branch 1 (${branchA.nodeCount} messages) ---\n${textA}\n\n--- Branch 2 (${branchB.nodeCount} messages) ---\n${textB}`;
  }

  return `[Merge request] Merging two branches (${branchA.nodeCount} + ${branchB.nodeCount} messages)`;
}

/**
 * Build the messages array to send to the API for the merge operation.
 */
export function buildMergePromptMessages(
  prompt: string,
  branchA: BranchContent,
  branchB: BranchContent
): { role: 'user' | 'assistant'; content: string }[] {
  const textA = formatBranchForSummary(branchA);
  const textB = formatBranchForSummary(branchB);

  return [
    {
      role: 'user' as const,
      content: `Here are two conversation branches that diverged from a common point:\n\n--- Branch 1 (${branchA.nodeCount} messages) ---\n${textA}\n\n--- Branch 2 (${branchB.nodeCount} messages) ---\n${textB}\n\n${prompt}`,
    },
  ];
}
