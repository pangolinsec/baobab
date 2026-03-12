import { useRef, useEffect } from 'react';
import { CornerDownRight, Send, RefreshCw, CopyPlus, ClipboardCopy, Copy, Trash2, Star, Flag, FileText, Search, Plus, FlaskConical, GitBranch, Brain, ClipboardPaste } from 'lucide-react';
import type { MenuState } from '../../hooks/useContextMenu';

const iconMap: Record<string, typeof CornerDownRight> = {
  'corner-down-right': CornerDownRight,
  'send': Send,
  'refresh-cw': RefreshCw,
  'copy-plus': CopyPlus,
  'clipboard-copy': ClipboardCopy,
  'copy': Copy,
  'trash-2': Trash2,
  'star': Star,
  'flag': Flag,
  'file-text': FileText,
  'search': Search,
  'plus': Plus,
  'flask-conical': FlaskConical,
  'git-branch': GitBranch,
  'brain': Brain,
  'clipboard-paste': ClipboardPaste,
};

interface ContextMenuProps {
  menuState: MenuState;
  onAction: (actionId: string, nodeId: string) => void;
}

export function ContextMenu({ menuState, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp position to viewport
  useEffect(() => {
    if (!menuState.isOpen || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = menuState.position.x;
    let y = menuState.position.y;

    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x < 0) x = 8;
    if (y < 0) y = 8;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [menuState.isOpen, menuState.position]);

  if (!menuState.isOpen || !menuState.nodeId) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg py-1"
      style={{ left: menuState.position.x, top: menuState.position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuState.groups.map((group, gi) => (
        <div key={group.id}>
          {gi > 0 && <div className="my-1 border-t border-[var(--color-border)]" />}
          {group.items.map((item) => {
            const Icon = item.icon ? iconMap[item.icon] : null;
            const isDanger = 'danger' in item && item.danger;
            return (
              <button
                key={item.id}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-bg-hover)] transition-colors text-left ${
                  isDanger ? 'text-red-500' : 'text-[var(--color-text)]'
                }`}
                onClick={() => onAction(item.id, menuState.nodeId!)}
              >
                {Icon && <Icon size={14} className={isDanger ? 'text-red-500' : 'text-[var(--color-text-muted)]'} />}
                <span>{item.label}</span>
                {item.shortcutHint && (
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{item.shortcutHint}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
