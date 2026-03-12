import { useState } from 'react';
import {
  Brain,
  ChevronRight,
  ChevronDown,
  Copy,
  Trash2,
  Lock,
  ClipboardPaste,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  FilterX,
  ShieldCheck,
  ArrowDownToLine,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { ThinkingBlock } from '../../types';
import { useTreeStore } from '../../store/useTreeStore';

interface ReasoningBlocksSectionProps {
  nodeId: string;
  blocks: ThinkingBlock[];
  compact?: boolean;
  lastAssistantNodeId?: string;  // for last-turn filtering visualization
}

function providerLabel(providerId: string): string {
  switch (providerId) {
    case 'anthropic': return 'Anthropic';
    case 'openai': return 'OpenAI';
    case 'plaintext': return 'Plaintext';
    default: return providerId;
  }
}

export function ReasoningBlocksSection({ nodeId, blocks, compact, lastAssistantNodeId }: ReasoningBlocksSectionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const reasoningClipboard = useTreeStore((s) => s.reasoningClipboard);

  const toggleExpand = (blockId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const handleCopy = (blockId: string) => {
    useTreeStore.getState().copyReasoningBlock(nodeId, blockId);
  };

  const handleRemove = (blockId: string, isOriginal: boolean) => {
    if (isOriginal && confirmRemoveId !== blockId) {
      setConfirmRemoveId(blockId);
      return;
    }
    useTreeStore.getState().removeReasoningBlock(nodeId, blockId);
    setConfirmRemoveId(null);
  };

  const handlePaste = () => {
    useTreeStore.getState().pasteReasoningBlock(nodeId);
  };

  const handleTogglePlaintext = (blockId: string) => {
    useTreeStore.getState().toggleReasoningPlaintext(nodeId, blockId);
  };

  const handleToggleActive = (blockId: string) => {
    useTreeStore.getState().toggleReasoningActive(nodeId, blockId);
  };

  const handleToggleInjectAtEnd = (blockId: string) => {
    useTreeStore.getState().toggleReasoningInjectAtEnd(nodeId, blockId);
  };

  if (blocks.length === 0 && !reasoningClipboard) return null;

  return (
    <div className={compact ? 'mb-3' : 'mb-4'}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] mb-2">
        <Brain size={14} />
        <span>Reasoning Blocks</span>
        <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[10px]">
          {blocks.length}
        </span>
      </div>

      <div className="space-y-2">
        {blocks.map((block) => {
          const isExpanded = expandedIds.has(block.id);
          const hasSig = !!block.signature;
          const hasEncrypted = !!block.encryptedContent;
          const isActive = block.active !== false;
          // OpenAI/Azure encrypted blocks are filtered when not on the last assistant turn
          const isFiltered = hasEncrypted && lastAssistantNodeId !== undefined && nodeId !== lastAssistantNodeId;

          return (
            <div
              key={block.id}
              className={`border border-[var(--color-border-soft)] rounded-lg overflow-hidden ${!isActive || isFiltered ? 'opacity-50' : ''}`}
            >
              {/* Block header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)]">
                <button
                  onClick={() => toggleExpand(block.id)}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex-1 text-left"
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Brain size={12} />
                  <span>
                    {block.encryptedContent
                      ? block.text && !block.text.startsWith('[Encrypted reasoning')
                        ? (block.text.length > 80 ? block.text.slice(0, 80) + '…' : block.text)
                        : `Encrypted (${block.encryptedContent.length.toLocaleString()} chars)`
                      : block.text
                        ? `${block.text.length.toLocaleString()} chars`
                        : '0 chars'}
                  </span>
                </button>

                {/* Provider badge */}
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  {providerLabel(block.providerId)}
                </span>

                {/* Origin label */}
                {block.isOriginal ? (
                  <span className="text-[10px] text-[var(--color-text-muted)]">original</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-400/15 text-violet-600 dark:text-violet-400 font-medium">
                    injected
                  </span>
                )}

                {/* Inactive badge */}
                {!isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] font-medium">
                    inactive
                  </span>
                )}

                {/* Signature lock */}
                {hasSig && (
                  <Lock size={12} className="text-emerald-500" title="Has cryptographic signature" />
                )}

                {/* Encrypted content indicator */}
                {hasEncrypted && !isFiltered && (
                  <ShieldCheck size={12} className="text-blue-500" title="Has encrypted reasoning content" />
                )}

                {/* Last-turn filter warning */}
                {isFiltered && (
                  <span title="This reasoning block will be filtered by OpenAI's server — only reasoning from the last assistant turn is included in the model's context">
                    <FilterX size={12} className="text-amber-500" />
                  </span>
                )}

                {/* Active toggle */}
                <button
                  onClick={() => handleToggleActive(block.id)}
                  className={`flex items-center gap-0.5 text-[10px] transition-colors ${
                    isActive
                      ? 'text-emerald-500'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                  title={isActive ? 'Active — included in API calls (click to deactivate)' : 'Inactive — excluded from API calls (click to activate)'}
                >
                  {isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>

                {/* Inject at end toggle (encrypted blocks only) */}
                {hasEncrypted && (
                  <button
                    onClick={() => handleToggleInjectAtEnd(block.id)}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      block.injectAtEnd
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                    title={block.injectAtEnd
                      ? 'Inject at end — reasoning appended after last user message to steer the next response'
                      : 'Normal position — reasoning included with this turn\'s history'}
                  >
                    <ArrowDownToLine size={14} />
                  </button>
                )}

                {/* Plaintext toggle */}
                <button
                  onClick={() => handleTogglePlaintext(block.id)}
                  className={`flex items-center gap-0.5 text-[10px] transition-colors ${
                    block.plaintextEnabled
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                  title={block.plaintextEnabled ? 'Plaintext injection enabled' : 'Plaintext injection disabled'}
                >
                  {block.plaintextEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(block.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] transition-colors"
                  title="Copy reasoning block"
                >
                  <Copy size={12} />
                </button>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(block.id, block.isOriginal)}
                  className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Remove reasoning block"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Confirm remove for originals */}
              {confirmRemoveId === block.id && (
                <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 flex items-center gap-2 text-xs">
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="text-red-600 dark:text-red-400">Remove original reasoning? This cannot be undone.</span>
                  <button
                    onClick={() => { useTreeStore.getState().removeReasoningBlock(nodeId, block.id); setConfirmRemoveId(null); }}
                    className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-medium hover:bg-red-600"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmRemoveId(null)}
                    className="px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-[10px] font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* No signature warning */}
              {!hasSig && !block.plaintextEnabled && isExpanded && (
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={10} />
                  No signature — can only be sent as plaintext
                </div>
              )}

              {/* Block content */}
              {isExpanded && (
                <div className="px-3 py-2 max-h-64 overflow-y-auto">
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

      {/* Paste button */}
      {reasoningClipboard && (
        <button
          onClick={handlePaste}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors w-full justify-center"
        >
          <ClipboardPaste size={12} />
          Paste Reasoning Block
          {reasoningClipboard.sourceNodeId && (
            <span className="text-[10px] opacity-70">(from {reasoningClipboard.sourceNodeId.slice(0, 8)}…)</span>
          )}
        </button>
      )}
    </div>
  );
}
