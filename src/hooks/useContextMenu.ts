import { useState, useCallback, useEffect } from 'react';
import type { NodeMouseHandler } from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcutHint?: string;
  danger?: boolean;
}

export interface MenuGroup {
  id: string;
  items: MenuItem[];
}

export interface MenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  nodeId: string | null;
  groups: MenuGroup[];
}

const closedState: MenuState = {
  isOpen: false,
  position: { x: 0, y: 0 },
  nodeId: null,
  groups: [],
};

function buildMenuGroups(nodeId: string): MenuGroup[] {
  const { nodes, isStreaming } = useTreeStore.getState();
  const node = nodes[nodeId];
  if (!node) return [];

  const isRoot = node.parentId === null;
  const isError = node.content.startsWith('Error: ');
  const isUser = node.role === 'user';

  if (isError) {
    const groups: MenuGroup[] = [
      {
        id: 'error-actions',
        items: [
          ...(!isStreaming ? [{ id: 'retry', label: 'Retry', icon: 'refresh-cw' }] : []),
        ],
      },
      {
        id: 'error-copy',
        items: [
          { id: 'copy-error', label: 'Copy error', icon: 'clipboard-copy' },
        ],
      },
      {
        id: 'error-delete',
        items: [
          { id: 'delete', label: 'Delete', icon: 'trash-2', danger: true },
        ],
      },
    ];
    return groups.filter(g => g.items.length > 0);
  }

  const groups: MenuGroup[] = [];

  // Actions group
  const actions: MenuItem[] = [];
  if (!isUser) {
    actions.push({ id: 'reply', label: 'Reply here', icon: 'corner-down-right' });
  }
  if (isUser && !isStreaming) {
    actions.push({ id: 'resend', label: 'Resend', icon: 'send' });
  }
  if (!isRoot && !isStreaming) {
    actions.push({ id: 'duplicate-edit', label: 'Duplicate & Edit', icon: 'copy-plus' });
  }
  if (!isStreaming) {
    actions.push({ id: 'create-child', label: 'Create Child', icon: 'plus' });
  }
  if (actions.length > 0) {
    groups.push({ id: 'actions', items: actions });
  }

  // Annotations group
  const annotations: MenuItem[] = [];
  annotations.push({
    id: 'toggle-star',
    label: node.starred ? 'Unstar' : 'Star',
    icon: 'star',
  });
  if (!isRoot) {
    annotations.push({
      id: 'toggle-dead-end',
      label: node.deadEnd ? 'Unflag dead end' : 'Flag as dead end',
      icon: 'flag',
    });
  }
  // Summarize branch — available on any node (collects path-to-root + descendants)
  if (!isRoot || node.childIds.length > 0) {
    annotations.push({
      id: 'summarize-branch',
      label: 'Summarize branch',
      icon: 'file-text',
    });
  }
  groups.push({ id: 'annotations', items: annotations });

  // Research group — available on any non-streaming, non-error node
  if (!isStreaming && !isError) {
    groups.push({
      id: 'research',
      items: [{
        id: 'start-research',
        label: 'Research this subtree',
        icon: 'flask-conical',
      }],
    });
  }

  // Clone group
  if (!isRoot && !isStreaming) {
    groups.push({
      id: 'clone',
      items: [{ id: 'clone-branch', label: 'Clone Branch', icon: 'git-branch' }],
    });
  }

  // Reasoning clipboard group
  const { reasoningClipboard } = useTreeStore.getState();
  const reasoningItems: MenuItem[] = [];
  if (!isUser && node.thinkingBlocks && node.thinkingBlocks.length > 0) {
    reasoningItems.push({ id: 'copy-reasoning', label: 'Copy Reasoning', icon: 'brain' });
  }
  if (!isUser && reasoningClipboard) {
    reasoningItems.push({ id: 'paste-reasoning', label: 'Paste Reasoning', icon: 'clipboard-paste' });
  }
  if (reasoningItems.length > 0) {
    groups.push({ id: 'reasoning', items: reasoningItems });
  }

  // Copy group
  groups.push({
    id: 'copy',
    items: [{ id: 'copy', label: 'Copy', icon: 'copy' }],
  });

  // Delete group
  if (!isRoot) {
    groups.push({
      id: 'delete',
      items: [{ id: 'delete', label: 'Delete', icon: 'trash-2', danger: true }],
    });
  }

  return groups;
}

export function useContextMenu() {
  const [menuState, setMenuState] = useState<MenuState>(closedState);

  const closeMenu = useCallback(() => {
    setMenuState(closedState);
  }, []);

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      setMenuState({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        nodeId: node.id,
        groups: buildMenuGroups(node.id),
      });
    },
    []
  );

  // Dismiss on Escape, scroll, or click outside
  useEffect(() => {
    if (!menuState.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    const handleScroll = () => closeMenu();
    const handleClick = () => closeMenu();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('click', handleClick);
    };
  }, [menuState.isOpen, closeMenu]);

  return { menuState, onNodeContextMenu, closeMenu };
}
