import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Trash2, Settings, Download, Upload, Star, Tag, X, Search, PanelLeftClose, PanelLeftOpen, FolderOpen, ChevronDown, ChevronRight, FolderPlus, Pencil, ArrowRightLeft } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSearchStore } from '../../store/useSearchStore';
import { useProjectStore } from '../../store/useProjectStore';
import { SearchResults } from '../search/SearchResults';
import { SearchFilters } from '../search/SearchFilters';
import { ProjectDialog } from '../project/ProjectDialog';
import { FileUploadButton } from '../project/FileUploadButton';
import { ProjectFileList } from '../project/ProjectFileList';
import { SidebarConvItem } from './SidebarConvItem';
import type { Conversation } from '../../types';

type SidebarTab = 'all' | 'starred';
type GroupBy = 'none' | 'projects';

interface ContextMenuState {
  type: 'project' | 'conversation';
  id: string;
  x: number;
  y: number;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const conversations = useTreeStore((s) => s.conversations);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const nodes = useTreeStore((s) => s.nodes);

  const projects = useProjectStore((s) => s.projects);
  const filesByProject = useProjectStore((s) => s.filesByProject);

  const [tab, setTab] = useState<SidebarTab>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('projects');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [projectDialog, setProjectDialog] = useState<{ mode: 'create' | 'rename'; projectId?: string; name?: string; description?: string } | null>(null);
  const [moveToProjectMenu, setMoveToProjectMenu] = useState<{ convId: string; x: number; y: number } | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null); // null = none, 'ungrouped' = ungrouped section, else project id
  const searchInputRef = useRef<HTMLInputElement>(null);

  const globalQuery = useSearchStore((s) => s.globalQuery);
  const globalResults = useSearchStore((s) => s.globalResults);
  const isSearching = useSearchStore((s) => s.isSearching);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const debouncedSearch = useMemo(() => {
    return () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => useSearchStore.getState().executeGlobalSearch(), 250);
    };
  }, []);

  const activeConvId = location.pathname.match(/^\/c\/(.+)/)?.[1];

  useEffect(() => {
    useTreeStore.getState().loadConversations();
    useProjectStore.getState().loadProjects();
  }, []);

  // Fetch files for expanded projects
  useEffect(() => {
    if (groupBy !== 'projects') return;
    for (const p of projects) {
      if (!collapsedProjects[p.id] && !filesByProject[p.id]) {
        useProjectStore.getState().fetchFiles(p.id);
      }
    }
  }, [groupBy, projects, collapsedProjects, filesByProject]);

  // Close context menus on outside click
  useEffect(() => {
    const handler = () => {
      setContextMenu(null);
      setMoveToProjectMenu(null);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const allTags = useMemo(() => useTreeStore.getState().getAllTags(), [conversations]);

  const starredNodes = useMemo(() => {
    return Object.values(nodes).filter(n => n.starred);
  }, [nodes]);

  const filteredConversations = useMemo(() => {
    if (selectedTag) {
      return conversations.filter(c => c.tags?.includes(selectedTag));
    }
    return conversations;
  }, [conversations, selectedTag]);

  // Group conversations by project
  const groupedConversations = useMemo(() => {
    if (groupBy !== 'projects') return null;
    const groups: Record<string, Conversation[]> = {};
    const ungrouped: Conversation[] = [];

    for (const conv of filteredConversations) {
      if (conv.projectId) {
        if (!groups[conv.projectId]) groups[conv.projectId] = [];
        groups[conv.projectId].push(conv);
      } else {
        ungrouped.push(conv);
      }
    }

    return { groups, ungrouped };
  }, [groupBy, filteredConversations]);

  const toggleProjectCollapse = useCallback((projectId: string) => {
    setCollapsedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  }, []);

  const handleProjectContextMenu = useCallback((e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: 'project', id: projectId, x: e.clientX, y: e.clientY });
    setMoveToProjectMenu(null);
  }, []);

  const handleConvContextMenu = useCallback((e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: 'conversation', id: convId, x: e.clientX, y: e.clientY });
    setMoveToProjectMenu(null);
  }, []);

  // Drag handlers for conversations
  const handleConvDragStart = useCallback((e: React.DragEvent, convId: string) => {
    e.dataTransfer.setData('text/plain', convId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingConvId(convId);
  }, []);

  const handleConvDragEnd = useCallback(() => {
    setDraggingConvId(null);
    setDropTargetProjectId(null);
  }, []);

  // Drop handlers for project sections
  const handleProjectDragOver = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetProjectId(projectId);
  }, []);

  const handleProjectDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if actually leaving the drop target (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetProjectId(null);
    }
  }, []);

  const handleProjectDrop = useCallback((e: React.DragEvent, projectId: string | undefined) => {
    e.preventDefault();
    const convId = e.dataTransfer.getData('text/plain');
    if (convId) {
      // Skip no-op: conversation already in this project
      const conv = conversations.find(c => c.id === convId);
      if (conv?.projectId !== projectId) {
        useTreeStore.getState().setConversationProject(convId, projectId);
      }
    }
    setDraggingConvId(null);
    setDropTargetProjectId(null);
  }, [conversations]);

  // Render a conversation item
  const isDraggable = groupBy === 'projects';
  const renderConvItem = (conv: Conversation) => (
    <SidebarConvItem
      key={conv.id}
      conv={conv}
      isActive={activeConvId === conv.id}
      isDraggable={isDraggable}
      isDragging={draggingConvId === conv.id}
      isEditing={editingConvId === conv.id}
      onStartEditing={() => setEditingConvId(conv.id)}
      onStopEditing={() => setEditingConvId(null)}
      onContextMenu={handleConvContextMenu}
      onDragStart={handleConvDragStart}
      onDragEnd={handleConvDragEnd}
    />
  );

  // Render project-grouped view
  const renderProjectGrouped = () => {
    if (!groupedConversations) return null;
    const { groups, ungrouped } = groupedConversations;

    return (
      <>
        {projects.map(project => {
          const convs = groups[project.id] || [];
          const isCollapsed = collapsedProjects[project.id];
          const files = filesByProject[project.id] || [];

          return (
            <div
              key={project.id}
              onDragOver={(e) => handleProjectDragOver(e, project.id)}
              onDragLeave={handleProjectDragLeave}
              onDrop={(e) => handleProjectDrop(e, project.id)}
            >
              {/* Project header */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-lg hover:bg-[var(--color-bg-hover)] transition-all group/proj ${
                  dropTargetProjectId === project.id ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-accent)]/5' : ''
                }`}
                onContextMenu={(e) => handleProjectContextMenu(e, project.id)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleProjectCollapse(project.id); }}
                  className="shrink-0 p-0.5 rounded hover:bg-[var(--color-border-soft)] transition-colors"
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                  ) : (
                    <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
                  )}
                </button>
                <FolderOpen size={14} className="text-[var(--color-accent)] shrink-0" />
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/project/${project.id}`); }}
                  className="text-xs font-medium text-[var(--color-text)] truncate flex-1 text-left hover:text-[var(--color-accent)] transition-colors"
                  title={project.name}
                >
                  {project.name}
                </button>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {convs.length}
                </span>
                <div className="opacity-0 group-hover/proj:opacity-100 flex items-center">
                  <FileUploadButton projectId={project.id} />
                </div>
              </div>

              {/* Project contents (files + conversations) */}
              {!isCollapsed && (
                <>
                  <ProjectFileList projectId={project.id} files={files} />
                  {convs.map(renderConvItem)}
                </>
              )}
            </div>
          );
        })}

        {/* Ungrouped conversations */}
        {(ungrouped.length > 0 || draggingConvId) && (
          <div
            onDragOver={(e) => handleProjectDragOver(e, 'ungrouped')}
            onDragLeave={handleProjectDragLeave}
            onDrop={(e) => handleProjectDrop(e, undefined)}
          >
            <div className={`flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-lg text-xs font-medium text-[var(--color-text-muted)] transition-all ${
              dropTargetProjectId === 'ungrouped' ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-accent)]/5' : ''
            }`}>
              Ungrouped
            </div>
            {ungrouped.map(renderConvItem)}
          </div>
        )}

        {/* New Project button */}
        <button
          onClick={() => setProjectDialog({ mode: 'create' })}
          className="flex items-center gap-1.5 px-3 py-1.5 mx-1 mt-1 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-accent)] transition-colors w-[calc(100%-0.5rem)]"
        >
          <FolderPlus size={14} />
          New Project
        </button>
      </>
    );
  };

  if (collapsed) {
    return (
      <div className="w-12 h-full flex flex-col items-center bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border-soft)] py-3 gap-2 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] hover:text-[var(--color-text)] transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          onClick={async () => {
            const conv = await useTreeStore.getState().createConversation();
            navigate(`/c/${conv.id}`);
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] hover:text-[var(--color-accent)] transition-colors"
          title="New conversation"
        >
          <Plus size={18} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] hover:text-[var(--color-text)] transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border-soft)] shrink-0">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--color-border-soft)]">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          Baobab
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              const conv = await useTreeStore.getState().createConversation();
              navigate(`/c/${conv.id}`);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] hover:text-[var(--color-accent)] transition-colors"
            title="New conversation"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)] hover:text-[var(--color-text)] transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
      </div>

      {/* Global search bar */}
      <div className="px-3 py-2 border-b border-[var(--color-border-soft)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            ref={searchInputRef}
            value={globalQuery}
            onChange={(e) => {
              useSearchStore.getState().setGlobalQuery(e.target.value);
              if (e.target.value.trim()) {
                debouncedSearch();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                clearTimeout(debounceRef.current);
                useSearchStore.getState().executeGlobalSearch();
              } else if (e.key === 'Escape') {
                clearTimeout(debounceRef.current);
                useSearchStore.getState().clearGlobalSearch();
                searchInputRef.current?.blur();
              }
            }}
            placeholder="Search messages…"
            className="w-full pl-8 pr-8 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
          />
          {globalQuery && (
            <button
              onClick={() => useSearchStore.getState().clearGlobalSearch()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Search results replace conversation list when query is active */}
      {globalQuery.trim() ? (
        <>
          <SearchFilters />
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-muted)]">
              {isSearching ? 'Searching…' : `${globalResults.length} result${globalResults.length !== 1 ? 's' : ''}`}
            </div>
            <SearchResults results={globalResults} />
          </div>
        </>
      ) : (
      <>

      {/* Tab switcher */}
      <div className="flex items-center border-b border-[var(--color-border-soft)]">
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            tab === 'all'
              ? 'text-[var(--color-text)] border-b-2 border-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          All Chats
        </button>
        <button
          onClick={() => setTab('starred')}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors flex items-center justify-center gap-1 ${
            tab === 'starred'
              ? 'text-[var(--color-text)] border-b-2 border-[var(--color-accent)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Star size={12} />
          Starred
        </button>
      </div>

      {/* Grouping selector (only in All Chats tab) */}
      {tab === 'all' && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--color-border-soft)]">
          <span className="text-[10px] text-[var(--color-text-muted)] mr-1">Group:</span>
          <button
            onClick={() => setGroupBy('none')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              groupBy === 'none'
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            None
          </button>
          <button
            onClick={() => setGroupBy('projects')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              groupBy === 'projects'
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            Projects
          </button>
        </div>
      )}

      {/* Tag filter (only in All Chats tab, hidden when grouping by projects) */}
      {tab === 'all' && groupBy === 'none' && allTags.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--color-border-soft)]">
          <div className="flex items-center gap-1 flex-wrap">
            <Tag size={12} className="text-[var(--color-text-muted)] shrink-0" />
            {selectedTag ? (
              <button
                onClick={() => setSelectedTag(null)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
              >
                {selectedTag}
                <X size={10} />
              </button>
            ) : (
              allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors"
                >
                  {tag}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {tab === 'all' ? (
          groupBy === 'projects' ? (
            renderProjectGrouped()
          ) : (
            // Flat conversations list
            filteredConversations.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] px-4 py-8 text-center">
                {selectedTag ? 'No conversations with this tag' : 'No conversations yet'}
              </p>
            ) : (
              filteredConversations.map(renderConvItem)
            )
          )
        ) : (
          // Starred messages list
          starredNodes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] px-4 py-8 text-center">
              No starred messages
            </p>
          ) : (
            starredNodes.map((node) => (
              <div
                key={node.id}
                className={`
                  group flex items-start gap-2 px-4 py-2.5 mx-2 rounded-lg cursor-pointer
                  transition-colors duration-150
                  text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]
                `}
                onClick={() => {
                  useTreeStore.getState().selectNode(node.id);
                }}
              >
                <Star size={12} className="shrink-0 mt-1 text-amber-500 fill-amber-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {node.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <p className="text-xs truncate">{node.content.slice(0, 80)}</p>
                </div>
              </div>
            ))
          )
        )}
      </div>

      </>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-[var(--color-border-soft)] space-y-1">
        {currentConversation && (
          <button
            onClick={() => {
              const allNodes = useTreeStore.getState().nodes;
              // Filter out the silent root node from exports
              const exportNodes: Record<string, typeof allNodes[string]> = {};
              for (const [id, node] of Object.entries(allNodes)) {
                if (node.parentId === null && !node.content) continue;
                exportNodes[id] = node;
              }
              const data = {
                conversation: currentConversation,
                nodes: exportNodes,
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${currentConversation.title.replace(/[^a-z0-9]/gi, '_')}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-soft)] transition-colors"
          >
            <Download size={16} />
            Export conversation
          </button>
        )}
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (!data.conversation || !data.nodes) {
                  alert('Invalid file format. Expected a Baobab export with "conversation" and "nodes" fields.');
                  return;
                }
                const imported = await useTreeStore.getState().importConversation(data);
                navigate(`/c/${imported.id}`);
              } catch {
                alert('Failed to import conversation. The file may be corrupted or in an unsupported format.');
              }
            };
            input.click();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-soft)] transition-colors"
        >
          <Upload size={16} />
          Import conversation
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-soft)] transition-colors"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Context menu for projects */}
      {contextMenu?.type === 'project' && (
        <div
          className="fixed z-50 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
            onClick={() => {
              const project = projects.find(p => p.id === contextMenu.id);
              if (project) {
                setProjectDialog({ mode: 'rename', projectId: project.id, name: project.name, description: project.description });
              }
              setContextMenu(null);
            }}
          >
            <Pencil size={12} />
            Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-[var(--color-bg-hover)] transition-colors"
            onClick={() => {
              useProjectStore.getState().deleteProject(contextMenu.id);
              // Also reload conversations since projectId was unset
              useTreeStore.getState().loadConversations();
              setContextMenu(null);
            }}
          >
            <Trash2 size={12} />
            Delete Project
          </button>
        </div>
      )}

      {/* Context menu for conversations */}
      {contextMenu?.type === 'conversation' && (
        <div
          className="fixed z-50 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setMoveToProjectMenu({ convId: contextMenu.id, x: contextMenu.x + 150, y: contextMenu.y });
              setContextMenu(null);
            }}
          >
            <ArrowRightLeft size={12} />
            Move to project
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
            onClick={() => {
              setEditingConvId(contextMenu.id);
              setContextMenu(null);
            }}
          >
            <Pencil size={12} />
            Rename
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-[var(--color-bg-hover)] transition-colors"
            onClick={() => {
              useTreeStore.getState().deleteConversation(contextMenu.id);
              if (activeConvId === contextMenu.id) navigate('/');
              setContextMenu(null);
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}

      {/* Move to project submenu */}
      {moveToProjectMenu && (
        <div
          className="fixed z-50 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{ left: moveToProjectMenu.x, top: moveToProjectMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
            onClick={() => {
              useTreeStore.getState().setConversationProject(moveToProjectMenu.convId, undefined);
              setMoveToProjectMenu(null);
            }}
          >
            None (ungrouped)
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
              onClick={() => {
                useTreeStore.getState().setConversationProject(moveToProjectMenu.convId, p.id);
                setMoveToProjectMenu(null);
              }}
            >
              <FolderOpen size={12} className="text-[var(--color-accent)]" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Project create/rename dialog */}
      {projectDialog && (
        <ProjectDialog
          mode={projectDialog.mode}
          initialName={projectDialog.name}
          initialDescription={projectDialog.description}
          onSubmit={(name, description) => {
            if (projectDialog.mode === 'create') {
              useProjectStore.getState().createProject(name, description);
            } else if (projectDialog.projectId) {
              useProjectStore.getState().updateProject(projectDialog.projectId, { name, description });
            }
          }}
          onClose={() => setProjectDialog(null)}
        />
      )}
    </div>
  );
}
