import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { ThinkingEditor } from '../shared/ThinkingEditor';
import { ToolCallListEditor } from '../shared/ToolCallListEditor';
import type { ToolCallRecord } from '../../api/providers/types';
import type { ThinkingBlock } from '../../types';

interface DuplicateEditModalProps {
  nodeId: string;
  onClose: () => void;
}

export function DuplicateEditModal({ nodeId, onClose }: DuplicateEditModalProps) {
  const nodes = useTreeStore((s) => s.nodes);
  const duplicateAndModifyAssistant = useTreeStore((s) => s.duplicateAndModifyAssistant);
  const node = nodes[nodeId];
  const [content, setContent] = useState(node?.content || '');
  // For editing: extract text from unsigned/plaintext blocks; signed blocks are preserved as-is
  const existingBlocks = node?.thinkingBlocks || [];
  const signedBlocks = existingBlocks.filter(b => b.signature);
  const editableBlock = existingBlocks.find(b => !b.signature);
  const [thinking, setThinking] = useState(editableBlock?.text || '');
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>(
    node?.toolCalls ? structuredClone(node.toolCalls) : []
  );
  const [rawInputs, setRawInputs] = useState<string[]>(
    node?.toolCalls?.map(tc => JSON.stringify(tc.input, null, 2)) || []
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  if (!node) return null;

  const hasJsonErrors = rawInputs.some(raw => {
    try { JSON.parse(raw); return false; } catch { return true; }
  });

  const handleToolCallsChange = (newToolCalls: ToolCallRecord[], newRawInputs: string[]) => {
    setToolCalls(newToolCalls);
    setRawInputs(newRawInputs);
  };

  const handleSave = () => {
    if (hasJsonErrors) return;

    const trimmedContent = content.trim();
    const trimmedThinking = thinking.trim();

    // Filter out tool calls with empty toolName
    const validToolCalls = toolCalls.filter(tc => tc.toolName.trim());

    // Check if anything changed
    const contentChanged = trimmedContent !== (node.content || '');
    const thinkingChanged = trimmedThinking !== (editableBlock?.text || '');
    const toolCallsChanged = JSON.stringify(validToolCalls) !== JSON.stringify(node.toolCalls || []);

    if (!trimmedContent || (!contentChanged && !thinkingChanged && !toolCallsChanged)) {
      onClose();
      return;
    }

    // Build combined thinkingBlocks: keep signed blocks + updated editable block
    const newBlocks: ThinkingBlock[] = [...signedBlocks];
    if (trimmedThinking) {
      newBlocks.push({
        id: editableBlock?.id || crypto.randomUUID(),
        text: trimmedThinking,
        providerId: editableBlock?.providerId || 'plaintext',
        isOriginal: editableBlock?.isOriginal ?? true,
        plaintextEnabled: editableBlock?.plaintextEnabled ?? true,
        active: editableBlock?.active ?? true,
        sourceNodeId: editableBlock?.sourceNodeId,
        sourceConversationId: editableBlock?.sourceConversationId,
      });
    }

    duplicateAndModifyAssistant(
      nodeId,
      trimmedContent,
      newBlocks.length > 0 ? newBlocks : undefined,
      validToolCalls,
    );
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
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
          <h3 className="text-sm font-medium text-[var(--color-text)]">Duplicate & Edit</h3>
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
            <p className="text-xs text-red-500 mb-2">Fix JSON errors in tool call inputs before saving</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasJsonErrors}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
