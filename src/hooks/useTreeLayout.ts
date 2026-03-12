import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { buildReactFlowGraph, computeDagreLayout } from '../lib/tree';

export function useTreeLayout(searchMatchIds?: Set<string>): { flowNodes: Node[]; flowEdges: Edge[] } {
  const nodes = useTreeStore((s) => s.nodes);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const streamingNodeId = useTreeStore((s) => s.streamingNodeId);
  const replyTargetNodeId = useTreeStore((s) => s.replyTargetNodeId);
  const multiSelectIds = useTreeStore((s) => s.multiSelectIds);
  const agentStreamingNodeId = useTreeStore((s) => s.agentStreamingNodeId);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const availableModels = useSettingsStore((s) => s.availableModels);

  return useMemo(() => {
    if (!currentConversation) return { flowNodes: [], flowEdges: [] };

    const { nodes: flowNodes, treeEdges, overlayEdges } = buildReactFlowGraph(
      nodes,
      currentConversation.rootNodeId,
      selectedNodeId,
      streamingNodeId,
      replyTargetNodeId,
      {
        conversationModel: currentConversation.model,
        settingsDefaultModel: defaultModel,
        availableModels,
      },
      searchMatchIds,
      multiSelectIds,
      agentStreamingNodeId,
    );

    const layoutNodes = computeDagreLayout(flowNodes, treeEdges);

    // Apply manual position overrides
    const finalNodes = layoutNodes.map((flowNode) => {
      const treeNode = nodes[flowNode.id];
      if (treeNode?.manualPosition) {
        return { ...flowNode, position: treeNode.manualPosition };
      }
      return flowNode;
    });

    const flowEdges = [...treeEdges, ...overlayEdges];

    return { flowNodes: finalNodes, flowEdges };
  }, [nodes, currentConversation, selectedNodeId, streamingNodeId, agentStreamingNodeId, replyTargetNodeId, multiSelectIds, defaultModel, availableModels, searchMatchIds]);
}
