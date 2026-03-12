import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FolderOpen, FolderPlus, Check, Search } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useTreeStore } from '../../store/useTreeStore';

interface ProjectAssignDropdownProps {
  conversationId: string;
  currentProjectId?: string;
}

export function ProjectAssignDropdown({ conversationId, currentProjectId }: ProjectAssignDropdownProps) {
  const projects = useProjectStore((s) => s.projects);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const currentProject = useMemo(
    () => currentProjectId ? projects.find(p => p.id === currentProjectId) : undefined,
    [currentProjectId, projects],
  );

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const showSearch = projects.length > 5;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus search when opening
  useEffect(() => {
    if (isOpen && showSearch) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen, showSearch]);

  const handleSelect = useCallback((projectId: string | undefined) => {
    if (projectId !== currentProjectId) {
      useTreeStore.getState().setConversationProject(conversationId, projectId);
    }
    setIsOpen(false);
    setSearch('');
  }, [conversationId, currentProjectId]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
          currentProject
            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
        }`}
        title={currentProject ? `Project: ${currentProject.name}` : 'Assign to project'}
      >
        {currentProject ? (
          <>
            <FolderOpen size={12} />
            <span className="max-w-[120px] truncate">{currentProject.name}</span>
          </>
        ) : (
          <>
            <FolderPlus size={12} />
            <span>No project</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-w-[280px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg py-1">
          {showSearch && (
            <div className="px-2 pb-1 pt-1">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="w-full pl-7 pr-2 py-1.5 rounded-md text-xs border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
                />
              </div>
            </div>
          )}

          <div className="max-h-[200px] overflow-y-auto">
            {filteredProjects.map(project => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                {currentProjectId === project.id ? (
                  <Check size={12} className="text-[var(--color-accent)] shrink-0" />
                ) : (
                  <FolderOpen size={12} className="text-[var(--color-text-muted)] shrink-0" />
                )}
                <span className="truncate">{project.name}</span>
              </button>
            ))}
            {filteredProjects.length === 0 && search.trim() && (
              <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No matching projects</p>
            )}
          </div>

          {/* No project option */}
          <div className="border-t border-[var(--color-border-soft)] mt-1 pt-1">
            <button
              onClick={() => handleSelect(undefined)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {!currentProjectId ? (
                <Check size={12} className="text-[var(--color-accent)] shrink-0" />
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span>No project</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
