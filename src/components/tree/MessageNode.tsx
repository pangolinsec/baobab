import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles, User, ChevronDown, ChevronRight, GitBranch, GitMerge, CornerDownRight, Brain, Pencil, AlertTriangle, Star, Flag, Globe, Plus } from 'lucide-react';
import type { TreeNode } from '../../types';
import type { NodeIndicators } from '../../lib/indicators';
import { renderTextWithPills } from '../shared/MarkdownWithFilePills';

export interface MessageNodeData {
  node: TreeNode;
  isSelected: boolean;
  isStreaming: boolean;
  isReplyTarget: boolean;
  childCount: number;
  indicators: NodeIndicators | undefined;
  isDeadEnd: boolean;
  isSearchMatch: boolean;
  isMultiSelected: boolean;
  [key: string]: unknown;
}

function MessageNodeComponent({ data }: NodeProps) {
  const { node, isSelected, isStreaming, isReplyTarget, childCount, indicators, isDeadEnd, isSearchMatch, isMultiSelected } = data as unknown as MessageNodeData;
  const isUser = node.role === 'user';
  const isError = node.content.startsWith('Error: ');
  const hasAnyOverride = indicators?.hasAnyOverride ?? false;
  const isSummary = node.nodeType === 'summary';
  const isMerge = node.nodeType === 'merge';

  const truncated =
    node.content.length > 180
      ? node.content.slice(0, 180) + '…'
      : node.content;

  return (
    <div
      className={`
        relative w-[300px] rounded-2xl px-4 py-3 cursor-pointer
        transition-all duration-200 ease-out
        hover:-translate-y-[1px]
        ${isUser
          ? 'bg-[var(--color-user-card)]'
          : 'bg-[var(--color-card)] shadow-sm'
        }
        ${isMerge && isUser
          ? 'border-dashed border-2 border-[#7C9AB5]'
          : isMerge && !isUser
            ? 'border-2 border-blue-400/50'
            : isSummary
              ? 'border-l-[3px] border-l-blue-400/50'
              : isError
                ? 'border-2 border-red-500'
                : isUser && hasAnyOverride
                  ? 'border-2 border-[var(--color-accent)]'
                  : ''
        }
        ${isMultiSelected
          ? 'ring-2 ring-blue-500 shadow-md'
          : isSelected && isReplyTarget
            ? 'ring-2 ring-[var(--color-accent)] outline outline-2 outline-offset-2 outline-[var(--color-reply-target)] shadow-md'
            : isSelected
              ? 'ring-2 ring-[var(--color-accent)] shadow-md'
              : isReplyTarget
                ? 'ring-2 ring-[var(--color-reply-target)] ring-offset-1 ring-offset-[var(--color-bg)] shadow-md'
                : 'shadow-sm hover:shadow-md'
        }
        ${isStreaming ? 'animate-pulse' : ''}
        ${isDeadEnd ? 'opacity-40' : ''}
        ${isSearchMatch ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-[var(--color-bg)]' : ''}
      `}
    >
      {/* Hidden handles for React Flow edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {isMerge && isUser ? (
          <div className="w-5 h-5 rounded-full bg-[#7C9AB5] flex items-center justify-center">
            <GitMerge size={12} className="text-white" />
          </div>
        ) : isUser ? (
          <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
            <User size={12} className="text-white" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
            <Sparkles size={12} className="text-[var(--color-accent)]" />
          </div>
        )}
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          {isUser ? 'You' : 'Assistant'}
        </span>

        {/* Error icon for error nodes */}
        {isError && !isUser && (
          <AlertTriangle size={12} className="text-red-500" />
        )}

        {/* Thinking indicator */}
        {!isUser && node.thinkingBlocks && node.thinkingBlocks.length > 0 && (
          <span title="Has thinking content"><Brain size={12} className="text-[var(--color-accent)]" /></span>
        )}

        {/* Tool call badge */}
        {!isUser && node.toolCalls && node.toolCalls.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" title={`${node.toolCalls.length} tool call${node.toolCalls.length > 1 ? 's' : ''}`}>
            <Globe size={9} />
            {node.toolCalls.length > 1 && node.toolCalls.length}
          </span>
        )}

        {/* userModified badge */}
        {!isUser && node.userModified && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-amber-400/15 text-amber-600 dark:text-amber-400">
            <Pencil size={9} />
            edited
          </span>
        )}

        {/* Manually created badge */}
        {node.source === 'manual' && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-violet-400/15 text-violet-600 dark:text-violet-400">
            <Plus size={9} />
            created
          </span>
        )}

        {/* Summary badge */}
        {isSummary && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-blue-400/15 text-blue-500">
            summary
          </span>
        )}

        {/* Merge badge */}
        {isMerge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#7C9AB5]/15 text-[#7C9AB5]">
            merge
          </span>
        )}

        {/* Star indicator */}
        {node.starred && (
          <Star size={12} className="text-amber-500 fill-amber-500" />
        )}

        {/* Dead-end flag */}
        {node.deadEnd && (
          <Flag size={12} className="text-[var(--color-text-muted)]" />
        )}

        {isReplyTarget && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-reply-target)]">
            <CornerDownRight size={10} />
            reply target
          </span>
        )}

        {childCount > 1 && (
          <span className={`${isReplyTarget ? '' : 'ml-auto '}flex items-center gap-1 text-xs text-[var(--color-text-muted)]`}>
            <GitBranch size={10} />
            {childCount}
          </span>
        )}

        {childCount > 0 && (
          <span className="text-[var(--color-text-muted)]">
            {node.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {/* Indicator chips row */}
      {indicators && isUser && indicators.hasAnyOverride && (
        <div className="flex items-center gap-1 mt-1 mb-1.5">
          {indicators.modelOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              {indicators.modelName}
            </span>
          )}
          {indicators.systemOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              system
            </span>
          )}
        </div>
      )}
      {indicators && !isUser && (
        <div className="flex items-center gap-1 mt-1 mb-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
            {indicators.modelName}
          </span>
        </div>
      )}

      {/* Content preview */}
      <div
        className={`
          text-sm leading-relaxed
          ${isUser
            ? 'text-[var(--color-text)]'
            : 'text-[var(--color-text)]'
          }
        `}
      >
        {isStreaming && !node.content ? (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{renderTextWithPills(truncated)}</p>
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
  );
}

export const MessageNode = memo(MessageNodeComponent);
