import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import type { Conversation } from '../../types';

interface SidebarConvItemProps {
  conv: Conversation;
  isActive: boolean;
  isDraggable: boolean;
  isDragging: boolean;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onContextMenu: (e: React.MouseEvent, convId: string) => void;
  onDragStart?: (e: React.DragEvent, convId: string) => void;
  onDragEnd?: () => void;
}

export function SidebarConvItem({
  conv,
  isActive,
  isDraggable,
  isDragging,
  isEditing,
  onStartEditing,
  onStopEditing,
  onContextMenu,
  onDragStart,
  onDragEnd,
}: SidebarConvItemProps) {
  const navigate = useNavigate();
  const [editValue, setEditValue] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select all text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      setEditValue(conv.title);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, conv.title]);

  const saveTitle = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conv.title) {
      useTreeStore.getState().updateConversationTitle(conv.id, trimmed);
    }
    // If empty, revert to previous title (no empty titles allowed)
    onStopEditing();
  }, [editValue, conv.id, conv.title, onStopEditing]);

  const cancelEdit = useCallback(() => {
    setEditValue(conv.title);
    onStopEditing();
  }, [conv.title, onStopEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [saveTitle, cancelEdit]);

  return (
    <div
      draggable={isDraggable && !isEditing}
      onDragStart={isDraggable && onDragStart ? (e) => onDragStart(e, conv.id) : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      className={`
        group flex items-center gap-2 px-4 py-2.5 mx-2 rounded-lg cursor-pointer
        transition-colors duration-150
        ${
          isActive
            ? 'bg-[var(--color-border-soft)] text-[var(--color-text)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
        }
        ${isDragging ? 'opacity-40' : ''}
      `}
      onClick={() => {
        if (!isEditing) navigate(`/c/${conv.id}`);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEditing();
      }}
      onContextMenu={(e) => onContextMenu(e, conv.id)}
    >
      <MessageSquare size={14} className="shrink-0 opacity-60" />
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm bg-[var(--color-bg)] border border-[var(--color-accent)] rounded px-1.5 py-0.5 text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
          />
        ) : (
          <>
            <span className="text-sm truncate block">{conv.title}</span>
            {conv.tags && conv.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                {conv.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                    {tag}
                  </span>
                ))}
                {conv.tags.length > 3 && (
                  <span className="text-[9px] text-[var(--color-text-muted)]">
                    +{conv.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {!isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            useTreeStore.getState().deleteConversation(conv.id);
            if (isActive) {
              navigate('/');
            }
          }}
          className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-red-500 transition-all"
          title="Delete conversation"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
