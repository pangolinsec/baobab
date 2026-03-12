import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
  type NodeDragHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, Lock, Unlock, RotateCcw } from 'lucide-react';
import { MessageNode } from './MessageNode';
import { ContextMenu } from './ContextMenu';
import { SummarizeDialog } from './SummarizeDialog';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { chatInputState } from '../../store/chatInputState';
import { useTreeLayout } from '../../hooks/useTreeLayout';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';

const nodeTypes = { messageNode: MessageNode };

interface TreeViewProps {
  searchMatchIds?: Set<string>;
}

export function TreeView({ searchMatchIds }: TreeViewProps) {
  const treeNodes = useTreeStore((s) => s.nodes);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);

  const [isLocked, setIsLocked] = useState(true);
  const [summarizeNodeId, setSummarizeNodeId] = useState<string | null>(null);

  const theme = useSettingsStore((s) => s.theme);
  const { flowNodes, flowEdges } = useTreeLayout(searchMatchIds);
  const { menuState, onNodeContextMenu, closeMenu } = useContextMenu();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { resend, retry } = useStreamingResponse();

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync layout changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Auto fit when nodes change
  useEffect(() => {
    if (flowNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    }
  }, [flowNodes.length, fitView]);

  // Escape to clear multi-select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useTreeStore.getState().clearMultiSelect();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for summarize-branch events
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) setSummarizeNodeId(nodeId);
    };
    window.addEventListener('summarize-branch', handler);
    return () => window.removeEventListener('summarize-branch', handler);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node: Node) => {
      const treeNode = treeNodes[node.id];
      if (!treeNode) return;

      const mouseEvent = event as unknown as React.MouseEvent;

      // Ctrl/Cmd+Click for multi-select
      if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
        useTreeStore.getState().toggleMultiSelect(node.id);
        return;
      }

      if (selectedNodeId === node.id && treeNode.childIds.length > 0) {
        useTreeStore.getState().toggleCollapse(node.id);
      } else {
        useTreeStore.getState().selectNode(node.id, mouseEvent.shiftKey);
      }
    },
    [treeNodes, selectedNodeId]
  );

  const handleContextMenuAction = useCallback(
    (actionId: string, nodeId: string) => {
      const node = treeNodes[nodeId];
      closeMenu();
      if (!node) return;

      const store = useTreeStore.getState();
      switch (actionId) {
        case 'reply':
          store.setReplyTarget(nodeId);
          break;
        case 'resend': {
          const opts = chatInputState.modelOverride
            ? {
                modelOverride: chatInputState.modelOverride,
                systemPromptOverride: chatInputState.systemPromptOverride,
                providerOverride: chatInputState.resolvedProviderId,
                persistModelOverride: chatInputState.modelOverride !== undefined && !chatInputState.modelThisMessageOnly,
                persistSystemPromptOverride: chatInputState.systemPromptOverride !== undefined && !chatInputState.systemPromptThisMessageOnly,
              }
            : undefined;
          resend(nodeId, opts);
          break;
        }
        case 'retry':
          retry(nodeId);
          break;
        case 'duplicate-edit':
          if (node.role === 'user') {
            store.prefillDuplicateUser(nodeId);
          } else {
            window.dispatchEvent(new CustomEvent('duplicate-edit-modal', { detail: { nodeId } }));
          }
          break;
        case 'copy':
          navigator.clipboard.writeText(node.content);
          break;
        case 'copy-error':
          navigator.clipboard.writeText(node.content);
          break;
        case 'toggle-star':
          store.toggleStar(nodeId);
          break;
        case 'toggle-dead-end':
          store.toggleDeadEnd(nodeId);
          break;
        case 'summarize-branch':
          window.dispatchEvent(new CustomEvent('summarize-branch', { detail: { nodeId } }));
          break;
        case 'create-child':
          window.dispatchEvent(new CustomEvent('create-child-modal', { detail: { nodeId } }));
          break;
        case 'start-research':
          window.dispatchEvent(new CustomEvent('research-config-modal', { detail: { nodeId } }));
          break;
        case 'copy-reasoning': {
          // Copy first reasoning block to clipboard
          const blocks = node.thinkingBlocks;
          if (blocks && blocks.length > 0) {
            store.copyReasoningBlock(nodeId, blocks[0].id);
          }
          break;
        }
        case 'paste-reasoning':
          store.pasteReasoningBlock(nodeId);
          break;
        case 'clone-branch':
          store.cloneBranch(nodeId);
          break;
        case 'delete':
          store.deleteSubtree(nodeId);
          break;
      }
    },
    [treeNodes, closeMenu, resend, retry]
  );

  const handleNodeDragStop: NodeDragHandler = useCallback(
    (_event, node) => {
      useTreeStore.getState().setNodePosition(node.id, node.position);
    },
    []
  );

  const handleResetLayout = useCallback(() => {
    if (window.confirm('Reset all nodes to automatic layout? Manual positions will be lost.')) {
      useTreeStore.getState().clearAllManualPositions();
    }
  }, []);

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        nodesDraggable={!isLocked}
        nodeDragThreshold={5}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-[var(--color-bg)]"
      >
        <Background
          gap={0}
          color="transparent"
          className="bg-[var(--color-bg)]"
        />
        <MiniMap
          className="!bg-[var(--color-bg-secondary)] !border-[var(--color-border)] rounded-lg"
          nodeColor={(node) =>
            node.data?.node?.role === 'user' ? '#D97757' : '#C4B5A6'
          }
          maskColor={theme === 'dark' ? 'rgba(28, 25, 23, 0.7)' : 'rgba(250, 249, 246, 0.7)'}
        />
      </ReactFlow>

      <ContextMenu menuState={menuState} onAction={handleContextMenuAction} />

      {summarizeNodeId && (
        <SummarizeDialog
          nodeId={summarizeNodeId}
          onClose={() => setSummarizeNodeId(null)}
        />
      )}

      {/* Custom zoom controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <button
          className="w-8 h-8 rounded-lg bg-[var(--color-card)]/80 backdrop-blur border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          onClick={() => setIsLocked((v) => !v)}
          title={isLocked ? 'Unlock nodes (enable dragging)' : 'Lock nodes (disable dragging)'}
        >
          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-[var(--color-card)]/80 backdrop-blur border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          onClick={handleResetLayout}
          title="Reset layout"
        >
          <RotateCcw size={16} />
        </button>
        <div className="h-1" />
        <button
          className="w-8 h-8 rounded-lg bg-[var(--color-card)]/80 backdrop-blur border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          onClick={() => zoomIn({ duration: 200 })}
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-[var(--color-card)]/80 backdrop-blur border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          onClick={() => zoomOut({ duration: 200 })}
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-[var(--color-card)]/80 backdrop-blur border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          onClick={() => fitView({ padding: 0.3, duration: 300 })}
          title="Fit to view"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
