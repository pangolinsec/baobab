import {
  X,
  Sparkles,
  User,
  CornerDownRight,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Send,
  CopyPlus,
  Pencil,
  Brain,
  MessageSquare,
  Star,
  Flag,
  Globe,
  Code,
  Plus,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { MarkdownWithFilePills } from '../shared/MarkdownWithFilePills';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { fetchFileTextUnified } from '../../lib/fileStorage';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { abbreviateModelName } from '../../lib/models';
import { resolveSystemPrompt, getPathToRoot } from '../../lib/tree';
import { estimateCost, formatCost, formatTokenCount } from '../../lib/pricing';
import { chatInputState } from '../../store/chatInputState';
import { RawContextTab } from './RawContextTab';
import { ReasoningBlocksSection } from '../shared/ReasoningBlocksSection';

function searchProviderLabel(provider?: string): string | undefined {
  if (!provider) return undefined;
  const map: Record<string, string> = { duckduckgo: 'DuckDuckGo', tavily: 'Tavily', bing: 'Bing' };
  return map[provider] || provider;
}

export function NodeDetailPanel() {
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const node = useTreeStore((s) => s.selectedNodeId ? s.nodes[s.selectedNodeId] ?? null : null);
  const isStreaming = useTreeStore((s) => s.isStreaming);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const setReplyTarget = useTreeStore((s) => s.setReplyTarget);
  const deleteSubtree = useTreeStore((s) => s.deleteSubtree);
  const prefillDuplicateUser = useTreeStore((s) => s.prefillDuplicateUser);
  const toggleStar = useTreeStore((s) => s.toggleStar);
  const toggleDeadEnd = useTreeStore((s) => s.toggleDeadEnd);
  const defaultSystemPrompt = useSettingsStore((s) => s.defaultSystemPrompt);
  const customPricing = useSettingsStore((s) => s.customPricing);
  const [detailPanelTab, setDetailPanelTab] = useState<'node' | 'raw'>('node');
  const { resend, retry } = useStreamingResponse();
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);
  const [viewedFile, setViewedFile] = useState<{ filename: string; text: string | null; loading: boolean } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const { width: panelWidth, onMouseDown: onResizeMouseDown, onDoubleClick: onResizeDoubleClick } = useResizablePanel();

  // Auto-switch to node tab when selected node changes (S3)
  useEffect(() => {
    if (selectedNodeId) {
      setDetailPanelTab('node');
      setViewedFile(null);
      setIsEditing(false);
    }
  }, [selectedNodeId, setDetailPanelTab]);

  if (!node) return null;
  // Don't show panel for the silent root node
  if (node.parentId === null && !node.content) return null;

  const isUser = node.role === 'user';
  const isRoot = node.parentId === null;
  const isError = node.content.startsWith('Error: ');

  // Compute last assistant node in the path for OpenAI last-turn filtering visualization
  const nodes = useTreeStore((s) => s.nodes);
  const replyTargetNodeId = useTreeStore((s) => s.replyTargetNodeId);
  const lastAssistantNodeId = useMemo(() => {
    const pathRoot = replyTargetNodeId || node.id;
    const path = getPathToRoot(pathRoot, nodes);
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].role === 'assistant') return path[i].id;
    }
    return undefined;
  }, [replyTargetNodeId, node.id, nodes]);

  const hasRawIndicator = !!(
    node.toolCalls?.length ||
    node.thinkingBlocks?.length ||
    node.usedSystemPrompt ||
    node.systemPromptOverride !== undefined
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(node.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFilePillClick = async (filename: string) => {
    setViewedFile({ filename, text: null, loading: true });
    const projectId = currentConversation?.projectId;
    if (!projectId) {
      setViewedFile({ filename, text: null, loading: false });
      return;
    }
    const files = useProjectStore.getState().getProjectFiles(projectId);
    const file = files.find(f => f.filename.toLowerCase() === filename.toLowerCase());
    if (!file) {
      setViewedFile({ filename, text: null, loading: false });
      return;
    }
    try {
      const data = await fetchFileTextUnified(file.id);
      setViewedFile({ filename, text: data.extractedText || '(No text content)', loading: false });
    } catch {
      setViewedFile({ filename, text: null, loading: false });
    }
  };

  return (
    <div className="h-full flex shrink-0" style={{ width: panelWidth }}>
      <div
        onMouseDown={onResizeMouseDown}
        onDoubleClick={onResizeDoubleClick}
        className="w-1.5 shrink-0 cursor-col-resize hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors"
      />
      <div className="flex-1 h-full border-l border-[var(--color-border-soft)] bg-[var(--color-bg)] flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-soft)]">
        <div className="flex items-center gap-2">
          {isUser ? (
            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
            </div>
          )}
          <span className="text-sm font-medium text-[var(--color-text)]">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {node.model && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {abbreviateModelName(node.model)}
            </span>
          )}
          {!isUser && node.userModified && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Pencil size={10} />
              (edited)
            </span>
          )}
          {node.source === 'manual' && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Plus size={10} />
              (created)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Edit button — visible on non-root, non-streaming nodes */}
          {!isRoot && !isStreaming && !isEditing && (
            <button
              onClick={() => { setIsEditing(true); setEditContent(node.content); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              title="Edit content"
            >
              <Pencil size={16} />
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={() => {
                  useTreeStore.getState().editNodeContent(node.id, editContent);
                  setIsEditing(false);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                title="Save"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </>
          )}
          {/* Star toggle */}
          <button
            onClick={() => toggleStar(node.id)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              node.starred
                ? 'text-amber-500 hover:bg-amber-500/10'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
            }`}
            title={node.starred ? 'Unstar' : 'Star'}
          >
            <Star size={16} className={node.starred ? 'fill-amber-500' : ''} />
          </button>
          {!isEditing && (
            <button
              onClick={() => useTreeStore.getState().selectNode(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tab bar — always visible */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--color-border-soft)]">
        <button
          onClick={() => setDetailPanelTab('node')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            detailPanelTab === 'node'
              ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Node Details
        </button>
        <button
          onClick={() => setDetailPanelTab('raw')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            detailPanelTab === 'raw'
              ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Code size={12} />
          Raw
          {hasRawIndicator && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
          )}
        </button>
      </div>

      {/* Tab content routing */}
      {detailPanelTab === 'raw' ? (
        <RawContextTab node={node} />
      ) : (
      <>
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* userModified banner */}
        {!isUser && node.userModified && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--color-accent)]/5 text-xs text-[var(--color-text-muted)]">
            <Pencil size={12} />
            This message was edited by you
          </div>
        )}

        {/* Manually created banner */}
        {node.source === 'manual' && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-violet-500/5 text-xs text-[var(--color-text-muted)]">
            <Plus size={12} />
            This message was manually created
          </div>
        )}

        {/* Dead-end banner */}
        {node.deadEnd && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
            <Flag size={12} />
            This branch is flagged as a dead end
          </div>
        )}

        {/* Read-only system prompt */}
        {(() => {
          const nodes = useTreeStore.getState().nodes;
          const effectiveSystemPrompt = node.parentId
            ? resolveSystemPrompt(
                node.id,
                nodes,
                currentConversation?.systemPrompt,
                defaultSystemPrompt
              )
            : undefined;
          // Show usedSystemPrompt (one-shot override) if available.
          // usedSystemPrompt takes priority when defined (even if empty — "" means "explicitly cleared").
          const displayPrompt = node.usedSystemPrompt !== undefined ? node.usedSystemPrompt : effectiveSystemPrompt;
          if (!displayPrompt) return null;
          const isOverridden = node.systemPromptOverride !== undefined || node.usedSystemPrompt !== undefined;
          return (
            <div className="mb-4">
              <button
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-2"
              >
                {promptExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <MessageSquare size={14} />
                <span>System prompt</span>
                {isOverridden && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    overridden
                  </span>
                )}
              </button>
              {promptExpanded && (
                <div className="border-l-2 border-[var(--color-accent)]/30 pl-3">
                  <div className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">
                    {displayPrompt}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Reasoning blocks */}
        {node.thinkingBlocks && node.thinkingBlocks.length > 0 && (
          <ReasoningBlocksSection nodeId={node.id} blocks={node.thinkingBlocks} lastAssistantNodeId={lastAssistantNodeId} />
        )}

        {/* Tool calls */}
        {node.toolCalls && node.toolCalls.length > 0 && (() => {
          const providerLabel = searchProviderLabel(node.toolCalls[0].searchProvider);
          return (
          <div className="mb-4">
            <button
              onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors mb-2"
            >
              {toolCallsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Globe size={14} />
              <span>Tool Calls{providerLabel ? ` via ${providerLabel}` : ''}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[10px]">
                {node.toolCalls.length}
              </span>
            </button>
            {toolCallsExpanded && (
              <div className="border-l-2 border-emerald-500/30 pl-3 space-y-3 mb-3">
                {node.toolCalls.map((tc, i) => {
                  const tcProvider = searchProviderLabel(tc.searchProvider);
                  return (
                  <div key={i} className="text-xs">
                    <div className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                      {tc.toolName}{tcProvider ? ` (${tcProvider})` : ''}: {JSON.stringify(tc.input)}
                    </div>
                    {tc.result && (
                      <div className="text-[var(--color-text-muted)] whitespace-pre-wrap text-[11px] max-h-48 overflow-y-auto bg-[var(--color-bg-secondary)] rounded-lg p-2">
                        {tc.result}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {/* Main content */}
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[200px] p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            autoFocus
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert prose-stone max-w-none text-[var(--color-text)]">
            <MarkdownWithFilePills content={node.content} onMentionClick={handleFilePillClick} />
          </div>
        )}

        {/* Viewed file content */}
        {viewedFile && (
          <div className="mt-4 border border-[var(--color-border-soft)] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)]">
              <span className="text-xs font-medium text-[var(--color-text)]">{viewedFile.filename}</span>
              <button
                onClick={() => setViewedFile(null)}
                className="w-5 h-5 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-3 py-2">
              {viewedFile.loading ? (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <div className="w-3 h-3 border border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : viewedFile.text !== null ? (
                <pre className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap break-words">{viewedFile.text}</pre>
              ) : (
                <div className="text-xs text-[var(--color-text-muted)]">File not found or could not be loaded.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Token usage & cost */}
      {!isUser && (
        <div className="px-4 py-2 border-t border-[var(--color-border-soft)] text-xs text-[var(--color-text-muted)]">
          {node.tokenUsage ? (
            <>
              {formatTokenCount(node.tokenUsage.inputTokens)} in / {formatTokenCount(node.tokenUsage.outputTokens)} out tokens
              {(() => {
                const providerId = node.providerId || 'anthropic';
                if (providerId === 'ollama') return <span> · Free (local)</span>;
                const result = estimateCost(
                  node.tokenUsage!.inputTokens,
                  node.tokenUsage!.outputTokens,
                  node.model,
                  providerId,
                  customPricing
                );
                if (result !== null) {
                  const prefix = result.matchType === 'prefix' ? '~' : '';
                  return <span> · {prefix}Est. {formatCost(result.cost)}</span>;
                }
                return null;
              })()}
            </>
          ) : (
            <span>— in / — out tokens</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border-soft)]">
        {isError ? (
          <>
            <button
              onClick={() => retry(node.id)}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Retry
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy error'}
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('create-child-modal', { detail: { nodeId: node.id } }))}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              Create Child
            </button>
            <button
              onClick={() => deleteSubtree(node.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </>
        ) : isUser ? (
          <>
            <button
              onClick={() => {
                const opts = chatInputState.modelOverride
                  ? {
                      modelOverride: chatInputState.modelOverride,
                      systemPromptOverride: chatInputState.systemPromptOverride,
                      providerOverride: chatInputState.resolvedProviderId,
                      persistModelOverride: chatInputState.modelOverride !== undefined && !chatInputState.modelThisMessageOnly,
                      persistSystemPromptOverride: chatInputState.systemPromptOverride !== undefined && !chatInputState.systemPromptThisMessageOnly,
                    }
                  : undefined;
                resend(node.id, opts);
              }}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              title={chatInputState.modelOverride ? `Resend with ${abbreviateModelName(chatInputState.modelOverride)}` : 'Resend with current model'}
            >
              <Send size={12} />
              Resend
            </button>
            {!isRoot && (
              <button
                onClick={() => prefillDuplicateUser(node.id)}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
              >
                <CopyPlus size={12} />
                Duplicate & Edit
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('create-child-modal', { detail: { nodeId: node.id } }))}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              Create Child
            </button>
            {!isRoot && (
              <>
                <button
                  onClick={() => toggleDeadEnd(node.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    node.deadEnd
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                  title={node.deadEnd ? 'Unflag dead end' : 'Flag as dead end'}
                >
                  <Flag size={12} />
                  {node.deadEnd ? 'Unflag' : 'Dead end'}
                </button>
                <button
                  onClick={() => deleteSubtree(node.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setReplyTarget(node.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              <CornerDownRight size={12} />
              Reply here
            </button>
            {!isRoot && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('duplicate-edit-modal', { detail: { nodeId: node.id } }));
                }}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
              >
                <CopyPlus size={12} />
                Duplicate & Edit
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('create-child-modal', { detail: { nodeId: node.id } }))}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              Create Child
            </button>
            {!isRoot && (
              <>
                <button
                  onClick={() => toggleDeadEnd(node.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    node.deadEnd
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                  title={node.deadEnd ? 'Unflag dead end' : 'Flag as dead end'}
                >
                  <Flag size={12} />
                  {node.deadEnd ? 'Unflag' : 'Dead end'}
                </button>
                <button
                  onClick={() => deleteSubtree(node.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </>
            )}
          </>
        )}
      </div>
      </>
      )}
      </div>
    </div>
  );
}
