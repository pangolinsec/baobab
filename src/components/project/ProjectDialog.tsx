import { useState, useEffect } from 'react';
import { X, FolderOpen } from 'lucide-react';

interface ProjectDialogProps {
  mode: 'create' | 'rename';
  initialName?: string;
  initialDescription?: string;
  onSubmit: (name: string, description: string) => void;
  onClose: () => void;
}

export function ProjectDialog({
  mode,
  initialName = '',
  initialDescription = '',
  onSubmit,
  onClose,
}: ProjectDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
  }, [initialName, initialDescription]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, description.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-[var(--color-card)] rounded-2xl shadow-xl w-[400px] flex flex-col border border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-soft)]">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {mode === 'create' ? 'New Project' : 'Rename Project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Project name"
              className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Description <span className="text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Brief description"
              className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-soft)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
