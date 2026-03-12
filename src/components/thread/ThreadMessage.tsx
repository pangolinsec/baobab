import { useState } from 'react';
import {
  Sparkles, User, Star, CornerDownRight, Copy, Check, Flag, Pencil, Brain,
  ChevronRight, ChevronDown, Send, CopyPlus, Trash2, RefreshCw, MessageSquare, Globe, Plus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { MarkdownWithFilePills } from '../shared/MarkdownWithFilePills';
import type { TreeNode } from '../../types';
import { useTreeStore } from '../../store/useTreeStore';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { getNodeIndicators } from '../../lib/indicators';
import { resolveSystemPrompt } from '../../lib/tree';
import { abbreviateModelName } from '../../lib/models';
import { chatInputState } from '../../store/chatInputState';
import { BranchIndicator } from './BranchIndicator';

function searchProviderLabel(provider?: string): string | undefined {
  if (!provider) return undefined;
  const map: Record<string, string> = { duckduckgo: 'DuckDuckGo', tavily: 'Tavily', bing: 'Bing' };
  return map[provider] || provider;
}

interface ThreadMessageProps {
  node: TreeNode;
  siblings: TreeNode[];
  isStreaming: boolean;
  isReplyTarget: boolean;
  searchMatch?: boolean;
  nodes: Record<string, TreeNode>;
  conversationModel: string;
  defaultModel: string;
  availableModels: { id: string }[];
  conversationSystemPrompt: string | undefined;
  defaultSystemPrompt: string;
  defaultProvider: string;
  providers: { id: string; name: string }[];
}

export function ThreadMessage({
  node, siblings, isStreaming, isReplyTarget, searchMatch,
  nodes, conversationModel, defaultModel, availableModels,
  conversationSystemPrompt, defaultSystemPrompt, defaultProvider, providers,
}: ThreadMessageProps) {
  const { toggleStar, setReplyTarget, deleteSubtree, toggleDeadEnd, prefillDuplicateUser } = useTreeStore.getState();
  const { resend, retry } = useStreamingResponse();
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);

  const globalIsStreaming = useTreeStore((s) => s.isStreaming);

  const isUser = node.role === 'user';
  const isRoot = node.parentId === null;
  const isError = node.content.startsWith('Error: ');
  const isSummary = node.nodeType === 'summary';
  const isDeadEnd = node.deadEnd;

  const indicators = getNodeIndicators(node, nodes, conversationModel, defaultModel, availableModels);
  const effectiveSystemPrompt = node.parentId
    ? resolveSystemPrompt(node.id, nodes, conversationSystemPrompt, defaultSystemPrompt)
    : undefined;
  // Show usedSystemPrompt (one-shot override) if available.
  // usedSystemPrompt takes priority when defined (even if empty — "" means "explicitly cleared").
  const displaySystemPrompt = node.usedSystemPrompt !== undefined ? node.usedSystemPrompt : effectiveSystemPrompt;
  const isSystemOverridden = node.systemPromptOverride !== undefined || node.usedSystemPrompt !== undefined;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(node.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = () => {
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
  };

  return (
    <div className={`group ${isDeadEnd ? 'opacity-40' : ''}`}>
      {/* Branch indicator — show if this message has siblings */}
      {!isRoot && siblings.length > 1 && (
        <BranchIndicator node={node} siblings={siblings} />
      )}

      <div
        className={`
          rounded-2xl px-5 py-4 transition-all
          ${isError
            ? 'border-l-[3px] border-l-red-500'
            : searchMatch
              ? 'border-l-[3px] border-l-amber-500'
              : isSummary
                ? 'border-l-[3px] border-l-blue-400/50'
                : ''
          }
          ${isUser
            ? 'bg-[var(--color-user-card)]'
            : 'bg-[var(--color-card)]'
          }
          ${isReplyTarget ? 'ring-1 ring-[var(--color-reply-target)]' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
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

          {/* Model chip */}
          {isUser && indicators.hasAnyOverride && indicators.modelOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              {indicators.modelName}
            </span>
          )}
          {isUser && indicators.hasAnyOverride && indicators.systemOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              system
            </span>
          )}
          {!isUser && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
              {indicators.modelName}
            </span>
          )}

          {/* Provider indicator */}
          {node.providerId && node.providerId !== defaultProvider && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              via {providers.find(p => p.id === node.providerId)?.name || node.providerId}
            </span>
          )}

          {!isUser && node.userModified && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium bg-amber-400/15 text-amber-600 dark:text-amber-400">
              <Pencil size={10} />
              edited
            </span>
          )}

          {node.source === 'manual' && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium bg-violet-400/15 text-violet-600 dark:text-violet-400">
              <Plus size={10} />
              created
            </span>
          )}

          {isSummary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-blue-400/15 text-blue-500">
              summary
            </span>
          )}

          {node.starred && (
            <Star size={14} className="text-amber-500 fill-amber-500" />
          )}

          {isDeadEnd && (
            <Flag size={14} className="text-[var(--color-text-muted)]" />
          )}

          {isReplyTarget && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-reply-target)]">
              <CornerDownRight size={10} />
              reply target
            </span>
          )}

          {/* Timestamp */}
          <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
            {new Date(node.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>

          {/* Hover actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isError ? (
              <>
                <button
                  onClick={() => retry(node.id)}
                  disabled={globalIsStreaming}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                  title="Retry"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={handleCopy}
                  disabled={globalIsStreaming}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                  title="Copy"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  onClick={() => deleteSubtree(node.id)}
                  disabled={globalIsStreaming}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : isUser ? (
              <>
                <button
                  onClick={handleResend}
                  disabled={globalIsStreaming}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                  title={chatInputState.modelOverride ? `Resend with ${abbreviateModelName(chatInputState.modelOverride)}` : 'Resend'}
                >
                  <Send size={14} />
                </button>
                {!isRoot && (
                  <button
                    onClick={() => prefillDuplicateUser(node.id)}
                    disabled={globalIsStreaming}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                    title="Duplicate & Edit"
                  >
                    <CopyPlus size={14} />
                  </button>
                )}
                {!isRoot && (
                  <button
                    onClick={() => toggleDeadEnd(node.id)}
                    disabled={globalIsStreaming}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                      node.deadEnd
                        ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                    title={node.deadEnd ? 'Unflag dead end' : 'Flag as dead end'}
                  >
                    <Flag size={14} />
                  </button>
                )}
                <button
                  onClick={() => toggleStar(node.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    node.starred
                      ? 'text-amber-500 hover:bg-amber-500/10'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                  title={node.starred ? 'Unstar' : 'Star'}
                >
                  <Star size={14} className={node.starred ? 'fill-amber-500' : ''} />
                </button>
                <button
                  onClick={handleCopy}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  title="Copy"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                {!isRoot && (
                  <button
                    onClick={() => deleteSubtree(node.id)}
                    disabled={globalIsStreaming}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setReplyTarget(node.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  title="Reply here"
                >
                  <CornerDownRight size={14} />
                </button>
                {!isRoot && (
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('duplicate-edit-modal', { detail: { nodeId: node.id } }));
                    }}
                    disabled={globalIsStreaming}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                    title="Duplicate & Edit"
                  >
                    <CopyPlus size={14} />
                  </button>
                )}
                {!isRoot && (
                  <button
                    onClick={() => toggleDeadEnd(node.id)}
                    disabled={globalIsStreaming}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                      node.deadEnd
                        ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                    title={node.deadEnd ? 'Unflag dead end' : 'Flag as dead end'}
                  >
                    <Flag size={14} />
                  </button>
                )}
                <button
                  onClick={() => toggleStar(node.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    node.starred
                      ? 'text-amber-500 hover:bg-amber-500/10'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                  title={node.starred ? 'Unstar' : 'Star'}
                >
                  <Star size={14} className={node.starred ? 'fill-amber-500' : ''} />
                </button>
                <button
                  onClick={handleCopy}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  title="Copy"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                {!isRoot && (
                  <button
                    onClick={() => deleteSubtree(node.id)}
                    disabled={globalIsStreaming}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* System prompt collapsible */}
        {displaySystemPrompt && (
          <div className="mb-3">
            <button
              onClick={() => setPromptExpanded(!promptExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-1"
            >
              {promptExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <MessageSquare size={14} />
              <span>System prompt</span>
              {isSystemOverridden && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  overridden
                </span>
              )}
            </button>
            {promptExpanded && (
              <div className="border-l-2 border-[var(--color-accent)]/30 pl-3 max-h-48 overflow-y-auto">
                <div className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">
                  {displaySystemPrompt}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thinking blocks */}
        {node.thinkingBlocks && node.thinkingBlocks.length > 0 && (
          <div className="mb-3">
            {node.thinkingBlocks.map((block) => {
              const isBlockActive = block.active !== false;
              const isExpanded = isBlockActive ? thinkingExpanded : false;
              return (
                <div key={block.id} className={`mb-1 ${!isBlockActive ? 'opacity-50' : ''}`}>
                  <button
                    onClick={() => isBlockActive && setThinkingExpanded(!thinkingExpanded)}
                    className={`flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-1 ${!isBlockActive ? 'cursor-default' : ''}`}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Brain size={14} />
                    <span>Thinking</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[10px]">
                      {block.text.length.toLocaleString()} chars
                    </span>
                    {!block.isOriginal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-400/15 text-violet-600 dark:text-violet-400 font-medium">
                        injected
                      </span>
                    )}
                    {!isBlockActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] font-medium">
                        inactive
                      </span>
                    )}
                    {block.signature && (
                      <span className="text-emerald-500" title="Signed">&#x1F512;</span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-l-2 border-[var(--color-accent)]/30 pl-3">
                      <div className="prose prose-sm dark:prose-invert prose-stone max-w-none text-[var(--color-text-muted)] italic text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                          {block.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tool calls */}
        {node.toolCalls && node.toolCalls.length > 0 && (() => {
          const providerLabel = searchProviderLabel(node.toolCalls[0].searchProvider);
          return (
          <div className="mb-3">
            <button
              onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors mb-1"
            >
              {toolCallsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Globe size={14} />
              <span>
                {node.toolCalls.length === 1
                  ? `Searched${providerLabel ? ` ${providerLabel}` : ''}: "${(node.toolCalls[0].input as any).query}"`
                  : `${node.toolCalls.length}${providerLabel ? ` ${providerLabel}` : ''} web searches`
                }
              </span>
            </button>
            {toolCallsExpanded && (
              <div className="border-l-2 border-emerald-500/30 pl-3 space-y-3">
                {node.toolCalls.map((tc, i) => {
                  const tcProvider = searchProviderLabel(tc.searchProvider);
                  return (
                  <div key={i} className="text-xs">
                    <div className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                      Search{tcProvider ? ` (${tcProvider})` : ''}: "{(tc.input as any).query}"
                    </div>
                    {tc.result && (
                      <div className="text-[var(--color-text-muted)] whitespace-pre-wrap text-[11px] max-h-48 overflow-y-auto">
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

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert prose-stone max-w-none text-[var(--color-text)]">
          {isStreaming && !node.content ? (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <MarkdownWithFilePills content={node.content} />
          )}
        </div>

        {/* Streaming indicator */}
        {isStreaming && node.content && (
          <div className="mt-2 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span className="text-[10px] text-[var(--color-accent)]">streaming…</span>
          </div>
        )}
      </div>
    </div>
  );
}
