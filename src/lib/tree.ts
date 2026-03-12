import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { TreeNode } from '../types';
import { getNodeIndicators } from './indicators';

export function getPathToRoot(
  nodeId: string,
  nodes: Record<string, TreeNode>
): TreeNode[] {
  const path: TreeNode[] = [];
  let current: TreeNode | undefined = nodes[nodeId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return path;
}

export function resolveCascade<T>(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  extractor: (node: TreeNode) => T | undefined,
  fallback: T
): T {
  const path = getPathToRoot(nodeId, nodes);
  let resolved = fallback;
  for (const node of path) {
    const value = extractor(node);
    if (value !== undefined) {
      resolved = value;
    }
  }
  return resolved;
}

export interface ResolvedModel {
  model: string;
  providerId: string;
}

export function resolveProviderCascade(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversationProviderId: string | undefined,
  settingsDefaultProvider: string
): string {
  const baseline = conversationProviderId || settingsDefaultProvider;
  return resolveCascade(
    nodeId,
    nodes,
    (n) => n.providerOverride,
    baseline
  );
}

export function resolveModel(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversationModel: string,
  settingsDefaultModel: string,
  availableModels: { id: string }[],
  conversationProviderId?: string,
  settingsDefaultProvider?: string
): ResolvedModel {
  const isConvModelValid = conversationModel && (
    availableModels.length === 0 || availableModels.some(m => m.id === conversationModel)
  );
  const baseline = isConvModelValid ? conversationModel : settingsDefaultModel;

  const model = resolveCascade(
    nodeId,
    nodes,
    (n) => n.modelOverride,
    baseline
  );

  const providerId = resolveProviderCascade(
    nodeId,
    nodes,
    conversationProviderId,
    settingsDefaultProvider || 'anthropic'
  );

  return { model, providerId };
}

export function resolveSystemPrompt(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversationSystemPrompt: string | undefined,
  settingsDefaultSystemPrompt: string,
  projectSystemPrompt?: string
): string | undefined {
  const baseline = conversationSystemPrompt ?? projectSystemPrompt ?? settingsDefaultSystemPrompt;

  const resolved = resolveCascade(
    nodeId,
    nodes,
    (n) => n.systemPromptOverride,
    baseline
  );

  // Empty string means "explicitly no system prompt"
  return resolved || undefined;
}

/**
 * Check if a node is effectively dead-end.
 * A node is dead-end if:
 *   - it's explicitly flagged, OR
 *   - all paths from it lead to dead-end flags (upward bubble), OR
 *   - its parent is effectively dead-end (downward inheritance)
 *
 * This standalone helper walks ancestors (for downward inheritance) and
 * descendants (for upward bubble). For batch computation across the whole
 * tree, use computeDeadEndMap() instead.
 */
export function isDeadEnd(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  // Check upward bubble: are all paths from this node dead?
  const allPathsDead = computeAllPathsDead(nodeId, nodes);
  if (allPathsDead) return true;

  // Check downward inheritance: is any ancestor effectively dead?
  let parent: TreeNode | undefined = nodes[nodeId]?.parentId
    ? nodes[nodes[nodeId].parentId!]
    : undefined;
  while (parent) {
    if (computeAllPathsDead(parent.id, nodes)) return true;
    parent = parent.parentId ? nodes[parent.parentId] : undefined;
  }
  return false;
}

/**
 * Bottom-up pass: true if a node is explicitly flagged or all its
 * children's paths are dead.
 */
function computeAllPathsDead(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  const node = nodes[nodeId];
  if (!node) return false;
  if (node.deadEnd) return true;
  if (node.childIds.length === 0) return false;
  return node.childIds.every(childId => computeAllPathsDead(childId, nodes));
}

/**
 * Compute dead-end status for all nodes in the tree rooted at rootNodeId.
 * Two-pass: bottom-up (all paths dead?) then top-down (inherit from parent).
 */
function computeDeadEndMap(rootNodeId: string, nodes: Record<string, TreeNode>): Set<string> {
  const allPathsDeadCache = new Map<string, boolean>();
  const deadEndIds = new Set<string>();

  // Pass 1: bottom-up — is every path from this node dead?
  function bottomUp(id: string): boolean {
    if (allPathsDeadCache.has(id)) return allPathsDeadCache.get(id)!;
    const node = nodes[id];
    if (!node) { allPathsDeadCache.set(id, false); return false; }
    if (node.deadEnd) { allPathsDeadCache.set(id, true); return true; }
    if (node.childIds.length === 0) { allPathsDeadCache.set(id, false); return false; }
    // Must visit ALL children to populate cache — cannot short-circuit with every()
    const childResults = node.childIds.map(childId => bottomUp(childId));
    const result = childResults.every(Boolean);
    allPathsDeadCache.set(id, result);
    return result;
  }

  // Pass 2: top-down — inherit dead status from parent
  function topDown(id: string, parentIsDead: boolean) {
    const isDead = parentIsDead || (allPathsDeadCache.get(id) ?? false);
    if (isDead) deadEndIds.add(id);
    const node = nodes[id];
    if (!node || node.collapsed) return;
    for (const childId of node.childIds) {
      topDown(childId, isDead);
    }
  }

  bottomUp(rootNodeId);
  topDown(rootNodeId, false);
  return deadEndIds;
}

export function buildReactFlowGraph(
  nodes: Record<string, TreeNode>,
  rootNodeId: string | null,
  selectedNodeId: string | null,
  streamingNodeId: string | null,
  replyTargetNodeId: string | null,
  indicatorContext?: {
    conversationModel: string;
    settingsDefaultModel: string;
    availableModels: { id: string }[];
  },
  searchMatchIds?: Set<string>,
  multiSelectIds?: string[],
  agentStreamingNodeId?: string | null,
): { nodes: Node[]; treeEdges: Edge[]; overlayEdges: Edge[] } {
  const flowNodes: Node[] = [];
  const treeEdges: Edge[] = [];
  const overlayEdges: Edge[] = [];

  if (!rootNodeId || !nodes[rootNodeId]) return { nodes: flowNodes, treeEdges, overlayEdges };

  // Compute active path from root to selected node (UI Fix 15)
  const activePathNodeIds = new Set<string>();
  if (selectedNodeId && nodes[selectedNodeId]) {
    let cur: TreeNode | undefined = nodes[selectedNodeId];
    while (cur) {
      activePathNodeIds.add(cur.id);
      cur = cur.parentId ? nodes[cur.parentId] : undefined;
    }
  }

  // Pre-compute which merge overlay edges should be highlighted.
  // Highlight when: the selected node is on a merge branch (active path passes
  // through a merge node), or the selected node is a merge source.
  const activeMergeOverlayIds = new Set<string>();
  if (selectedNodeId) {
    // Case 1: active path contains a merge node → highlight its source links
    for (const pathNodeId of activePathNodeIds) {
      const pathNode = nodes[pathNodeId];
      if (pathNode?.nodeType === 'merge' && pathNode.mergeSourceIds) {
        for (const srcId of pathNode.mergeSourceIds) {
          activeMergeOverlayIds.add(`merge-${pathNode.id}-${srcId}`);
        }
      }
    }
    // Case 2: selected node is a source of a merge → highlight those links
    for (const n of Object.values(nodes)) {
      if (n.nodeType === 'merge' && n.mergeSourceIds?.includes(selectedNodeId)) {
        for (const srcId of n.mergeSourceIds) {
          activeMergeOverlayIds.add(`merge-${n.id}-${srcId}`);
        }
      }
    }
  }

  // Pre-compute dead-end status: bottom-up bubble + top-down inheritance
  const deadEndNodeIds = computeDeadEndMap(rootNodeId, nodes);

  // Skip empty root node (silent anchor) from rendering
  const isEmptyRoot = (id: string) => id === rootNodeId && !nodes[rootNodeId]?.content;

  const queue: string[] = [rootNodeId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes[id];
    if (!node) continue;

    // Don't render the empty root node as a visible card
    if (!isEmptyRoot(id)) {
      const indicators = indicatorContext
        ? getNodeIndicators(
            node,
            nodes,
            indicatorContext.conversationModel,
            indicatorContext.settingsDefaultModel,
            indicatorContext.availableModels
          )
        : undefined;

      const nodeIsDead = deadEndNodeIds.has(node.id);

      flowNodes.push({
        id: node.id,
        type: 'messageNode',
        position: { x: 0, y: 0 },
        data: {
          node,
          isSelected: node.id === selectedNodeId,
          isStreaming: node.id === streamingNodeId || node.id === agentStreamingNodeId,
          isReplyTarget: node.id === replyTargetNodeId,
          childCount: node.childIds.length,
          indicators,
          isDeadEnd: nodeIsDead,
          isSearchMatch: searchMatchIds?.has(node.id) ?? false,
          isMultiSelected: multiSelectIds?.includes(node.id) ?? false,
        },
      });

      // Only add edge if parent is also rendered (not the empty root)
      if (node.parentId && nodes[node.parentId] && !isEmptyRoot(node.parentId)) {
        const isActivePath = activePathNodeIds.has(node.parentId) && activePathNodeIds.has(node.id);
        const edgeIsDead = deadEndNodeIds.has(node.id);
        treeEdges.push({
          id: `${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'smoothstep',
          animated: node.id === streamingNodeId || node.id === agentStreamingNodeId,
          className: [
            isActivePath ? 'active-path' : undefined,
            edgeIsDead ? 'dead-end-edge' : undefined,
          ].filter(Boolean).join(' ') || undefined,
        });
      }

      // Overlay edges for merge source links
      if (node.nodeType === 'merge' && node.mergeSourceIds) {
        for (const sourceId of node.mergeSourceIds) {
          if (nodes[sourceId]) {
            const edgeId = `merge-${node.id}-${sourceId}`;
            const isActive = activeMergeOverlayIds.has(edgeId);
            overlayEdges.push({
              id: edgeId,
              source: sourceId,
              target: node.id,
              type: 'smoothstep',
              animated: false,
              className: isActive ? 'merge-overlay-active' : 'merge-overlay',
              style: { strokeDasharray: '6 3' },
            });
          }
        }
      }
    }

    if (!node.collapsed) {
      for (const childId of node.childIds) {
        queue.push(childId);
      }
    }
  }

  return { nodes: flowNodes, treeEdges, overlayEdges };
}

export function computeDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 140,
    marginx: 40,
    marginy: 40,
  });

  const nodeWidth = 320;
  const nodeHeight = 140;

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2,
      },
    };
  });
}
