import type { TreeNode, CoverageScore } from '../types';

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check if text contains the term as a whole word (case-insensitive). */
function containsTermWordBoundary(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(text);
}

/** BFS to collect all node IDs in the subtree rooted at rootNodeId. */
export function getSubtreeNodeIds(
  rootNodeId: string,
  nodes: Record<string, TreeNode>
): string[] {
  const result: string[] = [];
  const queue = [rootNodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes[id];
    if (!node) continue;
    result.push(id);
    for (const childId of node.childIds) {
      queue.push(childId);
    }
  }
  return result;
}

/** BFS to collect node IDs, pruning dead-end branches (for coverage scoring). */
function getLiveSubtreeNodeIds(
  rootNodeId: string,
  nodes: Record<string, TreeNode>
): string[] {
  const result: string[] = [];
  const queue = [rootNodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes[id];
    if (!node) continue;
    if (node.deadEnd) continue;
    result.push(id);
    for (const childId of node.childIds) {
      queue.push(childId);
    }
  }
  return result;
}

/** Compute coverage score by scanning assistant nodes in the subtree for target terms. */
export function computeCoverageScore(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  targetTerms: string[]
): CoverageScore {
  if (targetTerms.length === 0) {
    return {
      totalTerms: 0,
      coveredTerms: [],
      uncoveredTerms: [],
      coveragePercent: 0,
      termLocations: {},
    };
  }

  const subtreeIds = getLiveSubtreeNodeIds(rootNodeId, nodes);
  const assistantNodes = subtreeIds
    .map(id => nodes[id])
    .filter(n => n && n.role === 'assistant' && n.content);

  const termLocations: Record<string, number> = {};
  const coveredTerms: string[] = [];
  const uncoveredTerms: string[] = [];

  for (const term of targetTerms) {
    let foundCount = 0;

    for (const node of assistantNodes) {
      if (containsTermWordBoundary(node.content, term)) {
        foundCount++;
      }
    }

    termLocations[term] = foundCount;
    if (foundCount > 0) {
      coveredTerms.push(term);
    } else {
      uncoveredTerms.push(term);
    }
  }

  const coveragePercent = Math.round((coveredTerms.length / targetTerms.length) * 100);

  return {
    totalTerms: targetTerms.length,
    coveredTerms,
    uncoveredTerms,
    coveragePercent,
    termLocations,
  };
}

/** Incrementally update a coverage score by scanning only a single new node against uncovered terms. */
export function updateCoverageScoreIncremental(
  previousScore: CoverageScore,
  newNode: TreeNode,
  targetTerms: string[]
): CoverageScore {
  // Skip nodes that shouldn't contribute to coverage
  if (newNode.role !== 'assistant' || !newNode.content || newNode.deadEnd) {
    return previousScore;
  }

  if (previousScore.uncoveredTerms.length === 0) {
    return previousScore;
  }

  const newlyCovered: string[] = [];
  const stillUncovered: string[] = [];

  for (const term of previousScore.uncoveredTerms) {
    if (containsTermWordBoundary(newNode.content, term)) {
      newlyCovered.push(term);
    } else {
      stillUncovered.push(term);
    }
  }

  // Also count new node matches for already-covered terms
  const updatedLocations = { ...previousScore.termLocations };
  for (const term of previousScore.coveredTerms) {
    if (containsTermWordBoundary(newNode.content, term)) {
      updatedLocations[term] = (updatedLocations[term] ?? 0) + 1;
    }
  }
  for (const term of newlyCovered) {
    updatedLocations[term] = 1;
  }

  // No change — return same object for referential equality
  if (newlyCovered.length === 0) {
    return previousScore;
  }

  const coveredTerms = [...previousScore.coveredTerms, ...newlyCovered];
  const coveragePercent = Math.round((coveredTerms.length / targetTerms.length) * 100);

  return {
    totalTerms: targetTerms.length,
    coveredTerms,
    uncoveredTerms: stillUncovered,
    coveragePercent,
    termLocations: updatedLocations,
  };
}
