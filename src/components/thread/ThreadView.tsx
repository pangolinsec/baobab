import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getPathToRoot } from '../../lib/tree';
import { ThreadMessage } from './ThreadMessage';

interface ThreadViewProps {
  searchMatchIds?: Set<string>;
}

export function ThreadView({ searchMatchIds }: ThreadViewProps) {
  const nodes = useTreeStore((s) => s.nodes);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const replyTargetNodeId = useTreeStore((s) => s.replyTargetNodeId);
  const streamingNodeId = useTreeStore((s) => s.streamingNodeId);
  const agentStreamingNodeId = useTreeStore((s) => s.agentStreamingNodeId);
  const isStreaming = useTreeStore((s) => s.isStreaming);

  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const defaultSystemPrompt = useSettingsStore((s) => s.defaultSystemPrompt);
  const defaultProvider = useSettingsStore((s) => s.defaultProvider);
  const providers = useSettingsStore((s) => s.providers);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Determine which path to show: selected node's path, or reply target's path
  const displayNodeId = selectedNodeId || replyTargetNodeId;

  const pathNodes = useMemo(() => {
    if (!displayNodeId || !currentConversation) return [];
    const path = getPathToRoot(displayNodeId, nodes);
    // Filter out the silent root node (empty content, no parent)
    return path.filter(n => !(n.parentId === null && !n.content));
  }, [displayNodeId, nodes, currentConversation]);

  // If streaming, also include the streaming node's path
  const activeStreamingId = streamingNodeId || agentStreamingNodeId;
  const streamingPath = useMemo(() => {
    if (!activeStreamingId) return null;
    return getPathToRoot(activeStreamingId, nodes);
  }, [activeStreamingId, nodes]);

  // Use the streaming path if available and extends beyond current path
  const displayPath = useMemo(() => {
    if (streamingPath && streamingPath.length > pathNodes.length) {
      return streamingPath;
    }
    return pathNodes;
  }, [pathNodes, streamingPath]);

  // Get siblings for each node in the path (for branch indicators)
  const siblingMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const node of displayPath) {
      if (node.parentId && nodes[node.parentId]) {
        map[node.id] = nodes[node.parentId].childIds;
      }
    }
    return map;
  }, [displayPath, nodes]);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if ((isStreaming || agentStreamingNodeId) && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isStreaming, activeStreamingId, nodes[activeStreamingId || '']?.content]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!displayPath.length) return;

    const currentIndex = displayPath.findIndex(n => n.id === selectedNodeId);

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      useTreeStore.getState().selectNode(displayPath[prevIndex].id, e.shiftKey);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < displayPath.length - 1 ? currentIndex + 1 : displayPath.length - 1;
      useTreeStore.getState().selectNode(displayPath[nextIndex].id, e.shiftKey);
    } else if (e.key === 'Enter' && selectedNodeId) {
      e.preventDefault();
      const node = useTreeStore.getState().nodes[selectedNodeId];
      if (node && node.role === 'assistant') {
        useTreeStore.getState().setReplyTarget(selectedNodeId);
      }
    }
  }, [displayPath, selectedNodeId]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!currentConversation || displayPath.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Select a node to view the thread
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
        {displayPath.map((node) => {
          const siblingIds = siblingMap[node.id] || [];
          const siblings = siblingIds.map(id => nodes[id]).filter(Boolean);

          return (
            <div
              key={node.id}
              onClick={(e) => useTreeStore.getState().selectNode(node.id, e.shiftKey)}
              className={`cursor-pointer transition-all ${
                selectedNodeId === node.id ? 'ring-2 ring-[var(--color-accent)] rounded-2xl' : ''
              }`}
            >
              <ThreadMessage
                node={node}
                siblings={siblings}
                isStreaming={node.id === streamingNodeId || node.id === agentStreamingNodeId}
                isReplyTarget={node.id === replyTargetNodeId}
                searchMatch={searchMatchIds?.has(node.id)}
                nodes={nodes}
                conversationModel={currentConversation?.model || ''}
                defaultModel={defaultModel}
                availableModels={availableModels}
                conversationSystemPrompt={currentConversation?.systemPrompt}
                defaultSystemPrompt={defaultSystemPrompt}
                defaultProvider={defaultProvider}
                providers={providers}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
