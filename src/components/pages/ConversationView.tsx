import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { GitBranch, List, Search, X, ChevronUp, ChevronDown, FlaskConical } from 'lucide-react';
import { TreeView } from '../tree/TreeView';
import { NodeDetailPanel } from '../tree/NodeDetailPanel';
import { MultiSelectPanel } from '../tree/MultiSelectPanel';
import { WelcomeScreen } from '../tree/WelcomeScreen';
import { ThreadView } from '../thread/ThreadView';
import { ResearchView } from '../research/ResearchView';
import { ResearchConfigModal } from '../research/ResearchConfigModal';
import { ChatInput } from '../chat/ChatInput';
import { DuplicateEditModal } from '../tree/DuplicateEditModal';
import { ManualNodeModal } from '../tree/ManualNodeModal';
import { TagInput } from '../shared/TagInput';
import { ProjectAssignDropdown } from '../shared/ProjectAssignDropdown';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSearchStore } from '../../store/useSearchStore';
import { useResearchStore } from '../../store/useResearchStore';
import { recoverOrphanedResearchRuns } from '../../agents/research/researchRunner';
import { getConversationCost, formatCost, formatTokenCount } from '../../lib/pricing';
import { abbreviateModelName } from '../../lib/models';

export function ConversationView() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [duplicateModalNodeId, setDuplicateModalNodeId] = useState<string | null>(null);
  const [createChildParentId, setCreateChildParentId] = useState<string | null>(null);
  const [researchModalNodeId, setResearchModalNodeId] = useState<string | null>(null);
  const chatSearchRef = useRef<HTMLInputElement>(null);

  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const conversations = useTreeStore((s) => s.conversations);
  const viewMode = useTreeStore((s) => s.viewMode);
  const setViewMode = useTreeStore((s) => s.setViewMode);
  const addTag = useTreeStore((s) => s.addTag);
  const removeTag = useTreeStore((s) => s.removeTag);
  const replyTargetNodeId = useTreeStore((s) => s.replyTargetNodeId);
  const nodes = useTreeStore((s) => s.nodes);
  const selectNode = useTreeStore((s) => s.selectNode);
  const multiSelectIds = useTreeStore((s) => s.multiSelectIds);

  const customPricing = useSettingsStore((s) => s.customPricing);

  const researchRuns = useResearchStore((s) => s.runs);
  const hasActiveResearchRun = useResearchStore((s) =>
    s.runs.some(r => r.status === 'planning' || r.status === 'researching' || r.status === 'synthesizing')
  );

  const chatQuery = useSearchStore((s) => s.chatQuery);
  const chatResults = useSearchStore((s) => s.chatResults);
  const currentResultIndex = useSearchStore((s) => s.currentResultIndex);

  const allTags = useMemo(() => useTreeStore.getState().getAllTags(), [conversations]);

  const searchMatchIds = useMemo(() => useSearchStore.getState().getMatchingNodeIds(), [chatResults]);

  // Check if conversation has any user messages (for welcome screen)
  const hasUserMessages = useTreeStore((s) =>
    Object.values(s.nodes).some(n => n.role === 'user')
  );

  // Check if replying mid-thread would create a branch
  const replyTargetHasChildren = useTreeStore((s) =>
    s.replyTargetNodeId ? (s.nodes[s.replyTargetNodeId]?.childIds.length ?? 0) > 0 : false
  );
  const isMidThreadReply = viewMode === 'thread' && replyTargetHasChildren;

  // Stable fingerprint: only changes when token usage data changes, not during streaming
  const tokenUsageFingerprint = useTreeStore((s) => {
    let hash = 0;
    for (const node of Object.values(s.nodes)) {
      if (node.tokenUsage) {
        hash += node.tokenUsage.inputTokens + node.tokenUsage.outputTokens;
      }
    }
    return hash;
  });

  const conversationCost = useMemo(() => {
    const currentNodes = useTreeStore.getState().nodes;
    return getConversationCost(currentNodes, customPricing);
  }, [tokenUsageFingerprint, customPricing]);

  // Ctrl+F to open per-chat search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowChatSearch(true);
        setTimeout(() => chatSearchRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for duplicate-edit-modal events (from TreeView, ThreadView, NodeDetailPanel)
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) setDuplicateModalNodeId(nodeId);
    };
    window.addEventListener('duplicate-edit-modal', handler);
    return () => window.removeEventListener('duplicate-edit-modal', handler);
  }, []);

  // Listen for create-child-modal events
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) setCreateChildParentId(nodeId);
    };
    window.addEventListener('create-child-modal', handler);
    return () => window.removeEventListener('create-child-modal', handler);
  }, []);

  // Listen for research-config-modal events
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) setResearchModalNodeId(nodeId);
    };
    window.addEventListener('research-config-modal', handler);
    return () => window.removeEventListener('research-config-modal', handler);
  }, []);

  // Navigate to current result
  useEffect(() => {
    if (chatResults.length > 0 && chatResults[currentResultIndex]) {
      selectNode(chatResults[currentResultIndex].node.id);
    }
  }, [currentResultIndex, chatResults, selectNode]);

  const handleChatSearchChange = useCallback((value: string) => {
    useSearchStore.getState().setChatQuery(value);
    if (value.trim()) {
      useSearchStore.getState().executeChatSearch(nodes);
    }
  }, [nodes]);

  const closeChatSearch = useCallback(() => {
    setShowChatSearch(false);
    useSearchStore.getState().clearChatSearch();
  }, []);

  useEffect(() => {
    if (!conversationId) {
      navigate('/', { replace: true });
      return;
    }

    const init = async () => {
      const state = useTreeStore.getState();
      if (state.currentConversation?.id !== conversationId) {
        setLoading(true);
        await useTreeStore.getState().loadConversation(conversationId);
        const newState = useTreeStore.getState();
        if (!newState.currentConversation || newState.currentConversation.id !== conversationId) {
          navigate('/', { replace: true });
          return;
        }
      }

      // Load research runs
      await useResearchStore.getState().loadRuns(conversationId);
      await recoverOrphanedResearchRuns();

      setLoading(false);
    };
    init();
  }, [conversationId, navigate]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Conversation header with tags and view toggle */}
        {currentConversation && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]">
            <ProjectAssignDropdown
              conversationId={currentConversation.id}
              currentProjectId={currentConversation.projectId}
            />
            <TagInput
              tags={currentConversation.tags || []}
              allTags={allTags}
              onAdd={(tag) => addTag(currentConversation.id, tag)}
              onRemove={(tag) => removeTag(currentConversation.id, tag)}
            />

            <div className="ml-auto flex items-center gap-2">
              {conversationCost.nodeCount > 0 && (
                <div className="relative group">
                  <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums cursor-default">
                    {conversationCost.isAllOllama
                      ? `Free · ${formatTokenCount(conversationCost.totalInputTokens + conversationCost.totalOutputTokens)} tokens`
                      : conversationCost.totalCost !== null
                        ? `${conversationCost.hasApproximatePricing ? '~' : ''}${formatCost(conversationCost.totalCost)}${conversationCost.hasPricingGaps ? '+' : ''} · ${formatTokenCount(conversationCost.totalInputTokens + conversationCost.totalOutputTokens)} tokens`
                        : `${formatTokenCount(conversationCost.totalInputTokens + conversationCost.totalOutputTokens)} tokens`
                    }
                  </span>
                  {Object.keys(conversationCost.costByModel).length > 1 && (
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg p-2">
                      {Object.entries(conversationCost.costByModel)
                        .sort(([, a], [, b]) => b.cost - a.cost)
                        .map(([modelId, entry]) => (
                          <div key={modelId} className="flex items-center justify-between gap-4 py-0.5 text-[11px] tabular-nums">
                            <span className="text-[var(--color-text-muted)] truncate">{abbreviateModelName(modelId)}</span>
                            <span className="text-[var(--color-text)] whitespace-nowrap">
                              {entry.hasApproximatePricing ? '~' : ''}{formatCost(entry.cost)} · {entry.messageCount} msg{entry.messageCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setShowChatSearch(!showChatSearch);
                  if (!showChatSearch) {
                    setTimeout(() => chatSearchRef.current?.focus(), 0);
                  } else {
                    closeChatSearch();
                  }
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  showChatSearch
                    ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                title="Search in conversation (Ctrl+F)"
              >
                <Search size={14} />
              </button>

              <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'tree'
                      ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                  title="Tree view"
                >
                  <GitBranch size={12} />
                  Tree
                </button>
                <button
                  onClick={() => setViewMode('thread')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'thread'
                      ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                  title="Thread view"
                >
                  <List size={12} />
                  Thread
                </button>
                <button
                  onClick={() => setViewMode('research')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'research'
                      ? 'bg-[var(--color-card)] text-[var(--color-text)] shadow-sm'
                      : hasActiveResearchRun
                        ? 'text-emerald-500 hover:text-[var(--color-text)]'
                        : researchRuns.length > 0
                          ? 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                          : 'text-[var(--color-text-muted)] opacity-50 hover:text-[var(--color-text)] hover:opacity-100'
                  }`}
                  title="Research"
                >
                  <FlaskConical size={12} className={hasActiveResearchRun ? 'animate-pulse' : ''} />
                  Research
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Per-chat search bar */}
        {showChatSearch && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-soft)] bg-[var(--color-bg-secondary)]">
            <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
            <input
              ref={chatSearchRef}
              value={chatQuery}
              onChange={(e) => handleChatSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.shiftKey) useSearchStore.getState().prevResult();
                  else useSearchStore.getState().nextResult();
                } else if (e.key === 'Escape') {
                  closeChatSearch();
                }
              }}
              placeholder="Search in this conversation…"
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none"
            />
            {chatResults.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {currentResultIndex + 1} of {chatResults.length}
                </span>
                <button onClick={() => useSearchStore.getState().prevResult()} className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => useSearchStore.getState().nextResult()} className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors">
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
            <button
              onClick={closeChatSearch}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {!hasUserMessages ? (
            <WelcomeScreen />
          ) : viewMode === 'tree' ? (
            <>
              <TreeView searchMatchIds={searchMatchIds} />
              {multiSelectIds.length === 2 ? (
                <MultiSelectPanel />
              ) : selectedNodeId ? (
                <NodeDetailPanel />
              ) : null}
            </>
          ) : viewMode === 'research' ? (
            <ResearchView />
          ) : (
            <ThreadView searchMatchIds={searchMatchIds} />
          )}
        </div>
      </div>
      {viewMode !== 'research' && <ChatInput isMidThreadReply={isMidThreadReply} />}

      {duplicateModalNodeId && (
        <DuplicateEditModal
          nodeId={duplicateModalNodeId}
          onClose={() => setDuplicateModalNodeId(null)}
        />
      )}

      {createChildParentId && (
        <ManualNodeModal
          parentNodeId={createChildParentId}
          onClose={() => setCreateChildParentId(null)}
        />
      )}

      {researchModalNodeId && (
        <ResearchConfigModal
          triggerNodeId={researchModalNodeId}
          initialMode="tree-search"
          onClose={() => setResearchModalNodeId(null)}
        />
      )}
    </ReactFlowProvider>
  );
}
