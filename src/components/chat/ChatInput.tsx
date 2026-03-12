import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, X, CornerDownRight, AlertCircle, MessageSquare, GitBranch, Globe, AlertTriangle } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { ModelSelector } from '../shared/ModelSelector';
import { abbreviateModelName } from '../../lib/models';
import { resolveModel, resolveSystemPrompt, getPathToRoot } from '../../lib/tree';
import { estimateContextTokens, formatTokenCount } from '../../lib/pricing';
import { chatInputState } from '../../store/chatInputState';
import { getProvider } from '../../api/providers/registry';
import { FileMentionDropdown, getFilteredFiles } from './FileMentionDropdown';
import { extractFileReferences } from '../../lib/fileReferences';
import type { ProjectFile } from '../../types';

const EMPTY_FILES: ProjectFile[] = [];

interface ChatInputProps {
  isMidThreadReply?: boolean;
}

export function ChatInput({ isMidThreadReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [messageModelOverride, setMessageModelOverride] = useState<string | undefined>(undefined);
  const [messageSystemPromptOverride, setMessageSystemPromptOverride] = useState<string | undefined>(undefined);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [modelThisMessageOnly, setModelThisMessageOnly] = useState(true);
  const [systemPromptThisMessageOnly, setSystemPromptThisMessageOnly] = useState(true);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = dropdown closed
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionAtPos, setMentionAtPos] = useState(0); // cursor offset of the '@'
  const [largeSizeWarning, setLargeSizeWarning] = useState<{ totalChars: number; filenames: string[] } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { send, cancel } = useStreamingResponse();
  const isStreaming = useTreeStore((s) => s.isStreaming);
  const replyTargetNodeId = useTreeStore((s) => s.replyTargetNodeId);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const prefillContent = useTreeStore((s) => s.prefillContent);
  const clearPrefill = useTreeStore((s) => s.clearPrefill);
  const setWebSearchEnabled = useTreeStore((s) => s.setWebSearchEnabled);
  const setSearchProvider = useTreeStore((s) => s.setSearchProvider);

  const apiKey = useSettingsStore((s) => s.apiKey);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const availableModels = useSettingsStore((s) => s.availableModels);
  const allProviderModels = useSettingsStore((s) => s.allProviderModels);
  const defaultSystemPrompt = useSettingsStore((s) => s.defaultSystemPrompt);
  const defaultProvider = useSettingsStore((s) => s.defaultProvider);
  const tavilyApiKey = useSettingsStore((s) => s.tavilyApiKey);
  const bingApiKey = useSettingsStore((s) => s.bingApiKey);
  const defaultSearchProvider = useSettingsStore((s) => s.defaultSearchProvider);

  const projectId = currentConversation?.projectId;
  const projectFiles = useProjectStore((s) => projectId ? (s.filesByProject[projectId] ?? EMPTY_FILES) : EMPTY_FILES);
  const fetchFiles = useProjectStore((s) => s.fetchFiles);

  // Ensure files are loaded for the current project
  useEffect(() => {
    if (projectId) fetchFiles(projectId);
  }, [projectId, fetchFiles]);

  const project = useProjectStore((s) =>
    projectId ? s.projects.find(p => p.id === projectId) : undefined
  );
  const knowledgeMode = project?.knowledgeMode ?? 'off';
  const webSearchEnabled = currentConversation?.webSearchEnabled ?? false;
  const conversationSearchProvider = currentConversation?.searchProvider || defaultSearchProvider || 'duckduckgo';

  // Check if current provider supports tool use
  const currentProviderId = currentConversation?.providerId || defaultProvider || 'anthropic';
  const currentProvider = getProvider(currentProviderId);
  const providerSupportsTools = currentProvider?.supportsToolUse ?? false;

  const effectiveModel = useMemo(() => {
    if (!replyTargetNodeId || !currentConversation) return defaultModel;
    return resolveModel(
      replyTargetNodeId,
      useTreeStore.getState().nodes,
      currentConversation.model,
      defaultModel,
      availableModels
    ).model;
  }, [replyTargetNodeId, currentConversation, defaultModel, availableModels]);
  // Compute effective system prompt for display context
  const effectiveSystemPrompt = useMemo(() => {
    if (!replyTargetNodeId || !currentConversation) return defaultSystemPrompt || undefined;
    return resolveSystemPrompt(
      replyTargetNodeId,
      useTreeStore.getState().nodes,
      currentConversation.systemPrompt,
      defaultSystemPrompt
    );
  }, [replyTargetNodeId, currentConversation, defaultSystemPrompt]);

  // Auto-resolve provider from model selection
  const resolvedProviderId = useMemo(() => {
    if (!messageModelOverride) return undefined;
    const providerModel = allProviderModels.find(m => m.id === messageModelOverride);
    if (providerModel && providerModel.providerId !== defaultProvider) {
      return providerModel.providerId;
    }
    return undefined;
  }, [messageModelOverride, allProviderModels, defaultProvider]);

  const contextEstimate = useMemo(() => {
    if (!replyTargetNodeId) return 0;
    const path = getPathToRoot(replyTargetNodeId, useTreeStore.getState().nodes);
    const totalChars = path.reduce((sum, n) => sum + n.content.length, 0)
      + (effectiveSystemPrompt?.length ?? 0);
    return estimateContextTokens(totalChars);
  }, [replyTargetNodeId, effectiveSystemPrompt]);

  const filteredMentionFiles = useMemo(
    () => mentionQuery !== null ? getFilteredFiles(mentionQuery, projectFiles) : [],
    [mentionQuery, projectFiles]
  );

  const showModelPersistToggle = messageModelOverride !== undefined;
  const showSystemPromptPersistToggle = messageSystemPromptOverride !== undefined;

  const replyTarget = useTreeStore((s) =>
    s.replyTargetNodeId ? s.nodes[s.replyTargetNodeId] ?? null : null
  );
  const isMismatch = replyTargetNodeId !== null && selectedNodeId !== null && replyTargetNodeId !== selectedNodeId;

  // Sync overrides to module-level state so NodeDetailPanel can read them for resend
  useEffect(() => {
    chatInputState.modelOverride = messageModelOverride;
    chatInputState.systemPromptOverride = messageSystemPromptOverride;
    chatInputState.modelThisMessageOnly = modelThisMessageOnly;
    chatInputState.systemPromptThisMessageOnly = systemPromptThisMessageOnly;
    chatInputState.resolvedProviderId = resolvedProviderId;
  }, [messageModelOverride, messageSystemPromptOverride, modelThisMessageOnly, systemPromptThisMessageOnly, resolvedProviderId]);

  // Handle prefill from duplicate user action
  useEffect(() => {
    if (prefillContent !== null) {
      setMessage(prefillContent);
      clearPrefill();
      // Focus textarea after prefill
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [prefillContent, clearPrefill]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
    // Clear large file warning when message changes
    setLargeSizeWarning(null);
  }, [message]);

  // Detect @ mention in textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    if (projectFiles.length === 0 || knowledgeMode === 'off') {
      setMentionQuery(null);
      return;
    }

    const cursorPos = e.target.selectionStart ?? value.length;
    // Walk backward from cursor to find an unmatched '@'
    const beforeCursor = value.slice(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }

    // '@' must be at start or preceded by whitespace
    if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) {
      setMentionQuery(null);
      return;
    }

    // Text after '@' must not contain spaces (it's a single token query)
    const queryText = beforeCursor.slice(atIndex + 1);
    if (/\s/.test(queryText)) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery(queryText);
    setMentionAtPos(atIndex);
    setMentionIndex(0);
  }, [projectFiles.length, knowledgeMode]);

  const insertMention = useCallback((filename: string) => {
    const before = message.slice(0, mentionAtPos);
    const afterCursor = mentionAtPos + 1 + (mentionQuery?.length ?? 0);
    const after = message.slice(afterCursor);
    const inserted = `${before}@${filename}${after ? '' : ' '}${after}`;
    setMessage(inserted);
    setMentionQuery(null);

    // Restore cursor after the inserted filename
    const newPos = mentionAtPos + 1 + filename.length + (after ? 0 : 1);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [message, mentionAtPos, mentionQuery]);

  const doSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming || !currentConversation) return;
    setMessage('');
    setLargeSizeWarning(null);
    send(trimmed, {
      modelOverride: messageModelOverride,
      systemPromptOverride: messageSystemPromptOverride,
      providerOverride: resolvedProviderId,
      persistModelOverride: messageModelOverride !== undefined && !modelThisMessageOnly,
      persistSystemPromptOverride: messageSystemPromptOverride !== undefined && !systemPromptThisMessageOnly,
    });
    // Reset per-message overrides and toggles
    setMessageModelOverride(undefined);
    setMessageSystemPromptOverride(undefined);
    setShowPromptEditor(false);
    setModelThisMessageOnly(true);
    setSystemPromptThisMessageOnly(true);
    // Navigate to conversation URL on first message
    if (!location.pathname.startsWith(`/c/${currentConversation.id}`)) {
      navigate(`/c/${currentConversation.id}`, { replace: true });
    }
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming || !currentConversation) return;

    // Large file injection warning for direct mode
    if (knowledgeMode === 'direct' && projectFiles.length > 0) {
      const refs = extractFileReferences(trimmed);
      if (refs.length > 0) {
        const matchedFiles = refs.map(ref =>
          projectFiles.find(f => f.filename.toLowerCase() === ref.toLowerCase())
        ).filter(Boolean) as typeof projectFiles;
        const totalChars = matchedFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
        if (totalChars > 200_000) {
          setLargeSizeWarning({ totalChars, filenames: matchedFiles.map(f => f.filename) });
          return;
        }
      }
    }

    doSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention dropdown keyboard navigation
    if (mentionQuery !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => Math.min(i + 1, filteredMentionFiles.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filteredMentionFiles.length > 0) {
        e.preventDefault();
        insertMention(filteredMentionFiles[mentionIndex].filename);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentConversation) return null;

  return (
    <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-bg)] p-4">
      {/* Mid-thread branch notice */}
      {isMidThreadReply && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 text-xs text-[var(--color-accent)]">
          <GitBranch size={14} />
          <span>Replying mid-thread — this will create a branch</span>
        </div>
      )}

      {/* No API key warning */}
      {!apiKey && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-[var(--color-accent)]/10 text-xs text-[var(--color-accent)]">
          <AlertCircle size={14} />
          <span>Set your API key in Settings to start chatting</span>
        </div>
      )}

      {/* Reply target indicator — hide for empty root node */}
      {replyTarget && replyTarget.content && (
        <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
          isMismatch
            ? 'bg-[var(--color-warning-bg)] border border-[var(--color-warning)] text-[var(--color-warning)]'
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
        }`}>
          <CornerDownRight size={12} className={isMismatch ? 'text-[var(--color-warning)]' : 'text-[var(--color-accent)]'} />
          <span className="truncate">
            Replying to: {replyTarget.content.slice(0, 60)}
            {replyTarget.content.length > 60 ? '…' : ''}
          </span>
        </div>
      )}

      {/* Model & system prompt indicators */}
      <div className="flex items-center gap-2 mb-2 text-xs text-[var(--color-text-muted)]">
        <ModelSelector
          value={messageModelOverride}
          onChange={setMessageModelOverride}
          inheritLabel={`Default (${abbreviateModelName(effectiveModel)})`}
          className="text-xs py-1 px-2 max-w-48"
        />

        {showModelPersistToggle && (
          <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={modelThisMessageOnly}
              onChange={(e) => setModelThisMessageOnly(e.target.checked)}
              className="w-3 h-3 rounded accent-[var(--color-accent)]"
            />
            This message only
          </label>
        )}

        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors ${
            messageSystemPromptOverride !== undefined ? 'text-[var(--color-accent)]' : ''
          }`}
        >
          <MessageSquare size={12} />
          <span>{messageSystemPromptOverride !== undefined ? 'Custom prompt' : 'System prompt'}</span>
        </button>
      </div>

      {showPromptEditor && (
        <div className="mb-2">
          <textarea
            value={messageSystemPromptOverride ?? ''}
            onChange={(e) => setMessageSystemPromptOverride(e.target.value || undefined)}
            placeholder={effectiveSystemPrompt ? `Current: ${effectiveSystemPrompt.slice(0, 100)}${effectiveSystemPrompt.length > 100 ? '…' : ''}` : 'Override system prompt for this message...'}
            rows={2}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 resize-y"
          />
          {showSystemPromptPersistToggle && (
            <label className="flex items-center gap-1 mt-1 text-[10px] text-[var(--color-text-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={systemPromptThisMessageOnly}
                onChange={(e) => setSystemPromptThisMessageOnly(e.target.checked)}
                className="w-3 h-3 rounded accent-[var(--color-accent)]"
              />
              This message only
            </label>
          )}
        </div>
      )}

      {contextEstimate > 100 && (
        <div className="mb-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span
            title="Rough estimate using ~4 characters per token. English prose averages ~3.5 chars/token, code averages ~5. Actual token count comes from the API response."
            className="cursor-help border-b border-dotted border-[var(--color-text-muted)]/40"
          >
            ~{formatTokenCount(contextEstimate)} tokens in context
          </span>
        </div>
      )}

      {/* Web search toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => {
            if (!currentConversation) return;
            setWebSearchEnabled(currentConversation.id, !webSearchEnabled);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            webSearchEnabled
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)]'
          }`}
          title={webSearchEnabled ? 'Disable web search' : 'Enable web search'}
        >
          <Globe size={12} />
          Web search
        </button>

        {webSearchEnabled && currentConversation && (
          <select
            value={conversationSearchProvider}
            onChange={(e) => setSearchProvider(currentConversation.id, e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
          >
            <option value="duckduckgo">DuckDuckGo</option>
            {tavilyApiKey && <option value="tavily">Tavily</option>}
            {bingApiKey && <option value="bing">Bing</option>}
          </select>
        )}

        {webSearchEnabled && !providerSupportsTools && (
          <span className="flex items-center gap-1 text-[10px] text-amber-500">
            <AlertTriangle size={10} />
            {currentProvider?.name || currentProviderId} doesn't support tools
          </span>
        )}
      </div>

      {/* Large file injection warning */}
      {largeSizeWarning && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-[var(--color-warning-bg)] border border-[var(--color-warning)] text-xs">
          <div className="flex items-center gap-2 text-[var(--color-warning)]">
            <AlertTriangle size={14} />
            <span>
              Referenced files total ~{Math.round(largeSizeWarning.totalChars / 4000)}K tokens
              ({largeSizeWarning.filenames.join(', ')}). This may consume significant context.
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={doSend}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--color-warning)] text-white hover:opacity-90 transition-opacity"
            >
              Send anyway
            </button>
            <button
              onClick={() => setLargeSizeWarning(null)}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* @ mention autocomplete dropdown */}
        {mentionQuery !== null && knowledgeMode !== 'off' && projectFiles.length > 0 && (
          <FileMentionDropdown
            filteredFiles={filteredMentionFiles}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
          />
        )}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Send a message…"
          rows={1}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-all disabled:opacity-50"
        />

        {isStreaming ? (
          <button
            onClick={cancel}
            className="shrink-0 w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
            title="Cancel"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message.trim() || !currentConversation}
            className="shrink-0 w-10 h-10 rounded-2xl bg-[var(--color-accent)] text-white flex items-center justify-center hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
