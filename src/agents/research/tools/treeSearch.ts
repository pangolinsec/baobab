import type { ToolDefinition } from '../../../api/providers/types';
import type { TreeNode } from '../../../types';
import { useTreeStore } from '../../../store/useTreeStore';
import { getPathToRoot } from '../../../lib/tree';

/** Check if nodeId is a descendant of (or equal to) subtreeRootId by walking parent links. */
function isInSubtree(nodeId: string, subtreeRootId: string, nodes: Record<string, TreeNode>): boolean {
  let cur = nodeId;
  while (cur) {
    if (cur === subtreeRootId) return true;
    const node = nodes[cur];
    if (!node?.parentId) break;
    cur = node.parentId;
  }
  return false;
}
import { getSubtreeNodeIds } from '../../scorer';

export const TREE_SEARCH_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_tree_overview',
    description: 'Get a high-level overview of the conversation tree structure.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_nodes',
    description: 'Search for nodes containing specific text or matching a pattern.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (substring match, case-insensitive)' },
        role: { type: 'string', enum: ['user', 'assistant'], description: 'Filter by role (optional)' },
        maxResults: { type: 'number', description: 'Max results to return (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_node',
    description: 'Read the full content of a specific node.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The node ID to read' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'list_branches',
    description: 'List all branch points in the tree (nodes with multiple children).',
    input_schema: {
      type: 'object',
      properties: {
        fromNodeId: { type: 'string', description: 'Start from this node (default: trigger node)' },
      },
      required: [],
    },
  },
  {
    name: 'get_conversation_path',
    description: 'Get the full conversation path from root to a specific node.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The leaf node ID' },
        summarize: { type: 'boolean', description: 'If true, return summaries instead of full content (default: false)' },
      },
      required: ['nodeId'],
    },
  },
];

function depthFromRoot(nodeId: string, rootId: string, nodes: Record<string, TreeNode>): number {
  let depth = 0;
  let current = nodes[nodeId];
  while (current && current.id !== rootId) {
    depth++;
    if (!current.parentId) break;
    current = nodes[current.parentId];
  }
  return depth;
}

export function createTreeSearchExecutor(conversationId: string, triggerNodeId: string) {
  return async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    const nodes = useTreeStore.getState().nodes;

    switch (toolName) {
      case 'get_tree_overview': {
        const subtreeIds = getSubtreeNodeIds(triggerNodeId, nodes);
        let branchCount = 0;
        let maxDepth = 0;

        for (const id of subtreeIds) {
          const node = nodes[id];
          if (!node) continue;
          if (node.childIds.length === 0) branchCount++;
          const d = depthFromRoot(id, triggerNodeId, nodes);
          if (d > maxDepth) maxDepth = d;
        }

        const rootNode = nodes[triggerNodeId];
        return JSON.stringify({
          totalNodes: subtreeIds.length,
          branchCount,
          maxDepth,
          rootContent: rootNode?.content.slice(0, 200) ?? '',
        });
      }

      case 'search_nodes': {
        const query = (input.query as string || '').toLowerCase();
        const roleFilter = input.role as string | undefined;
        const maxResults = Math.min(input.maxResults as number || 10, 20);

        if (!query) return JSON.stringify({ error: 'query is required' });

        const subtreeIds = getSubtreeNodeIds(triggerNodeId, nodes);
        const results: Array<{ nodeId: string; role: string; snippet: string; depth: number }> = [];

        for (const id of subtreeIds) {
          if (results.length >= maxResults) break;
          const node = nodes[id];
          if (!node) continue;
          if (roleFilter && node.role !== roleFilter) continue;

          const lowerContent = node.content.toLowerCase();
          const idx = lowerContent.indexOf(query);
          if (idx === -1) continue;

          const start = Math.max(0, idx - 100);
          const end = Math.min(node.content.length, idx + query.length + 100);
          const snippet = (start > 0 ? '...' : '') +
            node.content.slice(start, end) +
            (end < node.content.length ? '...' : '');

          results.push({
            nodeId: id,
            role: node.role,
            snippet,
            depth: depthFromRoot(id, triggerNodeId, nodes),
          });
        }

        return JSON.stringify(results);
      }

      case 'read_node': {
        const nodeId = input.nodeId as string;
        if (!nodeId) return JSON.stringify({ error: 'nodeId is required' });

        const node = nodes[nodeId];
        if (!node) return JSON.stringify({ error: `Node ${nodeId} not found` });
        if (!isInSubtree(nodeId, triggerNodeId, nodes)) {
          return JSON.stringify({ error: `Node ${nodeId} is not in the research subtree` });
        }

        return JSON.stringify({
          nodeId: node.id,
          role: node.role,
          content: node.content,
          parentId: node.parentId,
          childCount: node.childIds.length,
          depth: depthFromRoot(nodeId, triggerNodeId, nodes),
          model: node.model,
          createdAt: node.createdAt,
        });
      }

      case 'list_branches': {
        const fromId = (input.fromNodeId as string) || triggerNodeId;
        if (!isInSubtree(fromId, triggerNodeId, nodes)) {
          return JSON.stringify({ error: `Node ${fromId} is not in the research subtree` });
        }

        const subtreeIds = getSubtreeNodeIds(fromId, nodes);
        const branches: Array<{ nodeId: string; childCount: number; snippet: string; depth: number }> = [];

        for (const id of subtreeIds) {
          const node = nodes[id];
          if (!node || node.childIds.length < 2) continue;
          branches.push({
            nodeId: id,
            childCount: node.childIds.length,
            snippet: node.content.slice(0, 200),
            depth: depthFromRoot(id, triggerNodeId, nodes),
          });
        }

        return JSON.stringify(branches);
      }

      case 'get_conversation_path': {
        const nodeId = input.nodeId as string;
        const summarize = input.summarize as boolean || false;

        if (!nodeId) return JSON.stringify({ error: 'nodeId is required' });
        if (!isInSubtree(nodeId, triggerNodeId, nodes)) {
          return JSON.stringify({ error: `Node ${nodeId} is not in the research subtree` });
        }

        const path = getPathToRoot(nodeId, nodes);
        // Filter to only nodes within the subtree (from trigger node downward)
        const triggerIdx = path.findIndex(n => n.id === triggerNodeId);
        const relevantPath = triggerIdx >= 0 ? path.slice(triggerIdx) : path;

        const result = relevantPath.map(node => ({
          nodeId: node.id,
          role: node.role,
          content: summarize ? node.content.slice(0, 200) : node.content,
          depth: depthFromRoot(node.id, triggerNodeId, nodes),
        }));

        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  };
}
