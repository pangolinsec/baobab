import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { ThinkingEditor } from '../shared/ThinkingEditor';
import { ToolCallListEditor } from '../shared/ToolCallListEditor';
import type { ToolCallRecord } from '../../api/providers/types';
import type { ThinkingBlock } from '../../types';

interface ManualNodeModalProps {
  parentNodeId: string;
  onClose: () => void;
}

export function ManualNodeModal({ parentNodeId, onClose }: ManualNodeModalProps) {
  const nodes = useTreeStore((s) => s.nodes);
  const [currentParentId, setCurrentParentId] = useState(parentNodeId);
  const [content, setContent] = useState('');
  const [thinking, setThinking] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [rawInputs, setRawInputs] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const parentNode = nodes[currentParentId];
  if (!parentNode) return null;

  const childRole = parentNode.role === 'assistant' ? 'user' : 'assistant';
  const roleLabel = childRole === 'user' ? 'User Message' : 'Assistant Message';

  const hasJsonErrors = rawInputs.some(raw => {
    try { JSON.parse(raw); return false; } catch { return true; }
  });

  const canCreate = content.trim().length > 0 && !hasJsonErrors;

  const handleToolCallsChange = (newToolCalls: ToolCallRecord[], newRawInputs: string[]) => {
    setToolCalls(newToolCalls);
    setRawInputs(newRawInputs);
  };

  const resetForm = () => {
    setContent('');
    setThinking('');
    setToolCalls([]);
    setRawInputs([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const buildThinkingBlocks = (text: string): ThinkingBlock[] | undefined => {
    if (!text) return undefined;
    return [{
      id: crypto.randomUUID(),
      text,
      providerId: 'plaintext',
      isOriginal: true,
      plaintextEnabled: true,
      active: true,
    }];
  };

  const handleCreate = async () => {
    if (!canCreate) return;

    const trimmedContent = content.trim();
    const trimmedThinking = thinking.trim();
    const validToolCalls = toolCalls.filter(tc => tc.toolName.trim());

    await useTreeStore.getState().createManualNode(
      currentParentId,
      trimmedContent,
      buildThinkingBlocks(trimmedThinking),
      validToolCalls.length > 0 ? validToolCalls : undefined
    );
    onClose();
  };

  const handleCreateAndAddAnother = async () => {
    if (!canCreate) return;

    const trimmedContent = content.trim();
    const trimmedThinking = thinking.trim();
    const validToolCalls = toolCalls.filter(tc => tc.toolName.trim());

    const newId = await useTreeStore.getState().createManualNode(
      currentParentId,
      trimmedContent,
      buildThinkingBlocks(trimmedThinking),
      validToolCalls.length > 0 ? validToolCalls : undefined
    );

    if (newId) {
      setCurrentParentId(newId);
      resetForm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-soft)]">
          <h3 className="text-sm font-medium text-[var(--color-text)]">Create {roleLabel}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-4">
          <div>
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Content</label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={`Enter ${childRole} message content…`}
              className="w-full mt-1 resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-all"
            />
          </div>

          <ThinkingEditor value={thinking} onChange={setThinking} />

          <ToolCallListEditor
            toolCalls={toolCalls}
            rawInputs={rawInputs}
            onChange={handleToolCallsChange}
          />
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-[var(--color-border-soft)]">
          {hasJsonErrors && (
            <p className="text-xs text-red-500 mb-2">Fix JSON errors in tool call inputs before creating</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAndAddAnother}
              disabled={!canCreate}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create & Add Another
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
