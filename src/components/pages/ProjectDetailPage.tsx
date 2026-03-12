import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, AlertTriangle, MessageSquarePlus } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useTreeStore } from '../../store/useTreeStore';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { FileUploadButton } from '../project/FileUploadButton';
import { ProjectFileList } from '../project/ProjectFileList';
import type { ProjectFile } from '../../types';

const EMPTY_FILES: ProjectFile[] = [];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find(p => p.id === projectId));
  const files = useProjectStore((s) => s.filesByProject[projectId || ''] ?? EMPTY_FILES);

  const { isAvailable: backendAvailable } = useBackendStatus();

  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [injectDescription, setInjectDescription] = useState(false);
  const [knowledgeMode, setKnowledgeMode] = useState<'off' | 'direct' | 'agentic'>('off');

  // Sync local state when project loads or when navigating to a different project
  // Using projectId (not project object) to avoid re-syncing on every updateProject call
  useEffect(() => {
    if (project) {
      setDescription(project.description || '');
      setSystemPrompt(project.systemPrompt || '');
      setInjectDescription(project.injectDescription ?? false);
      setKnowledgeMode(project.knowledgeMode ?? 'off');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch files on mount
  useEffect(() => {
    if (projectId) {
      useProjectStore.getState().fetchFiles(projectId);
    }
  }, [projectId]);

  const saveDescription = useCallback(() => {
    if (!projectId || !project) return;
    if (description !== (project.description || '')) {
      useProjectStore.getState().updateProject(projectId, { description });
    }
  }, [projectId, project, description]);

  const saveSystemPrompt = useCallback(() => {
    if (!projectId || !project) return;
    if (systemPrompt !== (project.systemPrompt || '')) {
      useProjectStore.getState().updateProject(projectId, { systemPrompt });
    }
  }, [projectId, project, systemPrompt]);

  const toggleInjectDescription = useCallback(() => {
    if (!projectId || !project) return;
    const newValue = !injectDescription;
    setInjectDescription(newValue);
    useProjectStore.getState().updateProject(projectId, { injectDescription: newValue });
  }, [projectId, project, injectDescription]);

  const handleKnowledgeModeChange = useCallback((mode: 'off' | 'direct' | 'agentic') => {
    if (!projectId || !project) return;
    setKnowledgeMode(mode);
    useProjectStore.getState().updateProject(projectId, { knowledgeMode: mode });
  }, [projectId, project]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        Project not found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)] transition-colors"
            title="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <FolderOpen size={20} className="text-[var(--color-accent)]" />
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            {project.name}
          </h1>
          <button
            onClick={async () => {
              const conv = await useTreeStore.getState().createConversation(undefined, project.systemPrompt);
              await useTreeStore.getState().setConversationProject(conv.id, projectId!);
              navigate(`/c/${conv.id}`);
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
            title="Start a new conversation in this project"
          >
            <MessageSquarePlus size={16} />
            Start Chat
          </button>
        </div>

        {/* Description */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Describe this project..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
          />

          {/* Inject description toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Inject description into system prompt
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Prepends the project description to every API call in this project
              </p>
            </div>
            <button
              onClick={toggleInjectDescription}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-4 ${
                injectDescription ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  injectDescription ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* System Prompt */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
            System Prompt
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">
            Applied to conversations in this project unless overridden at conversation or node level.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            onBlur={saveSystemPrompt}
            placeholder="Enter a project-level system prompt..."
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-mono text-[var(--color-text)] placeholder-[var(--color-placeholder)] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
          />
        </section>

        {/* Knowledge Access */}
        <section className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Knowledge Access
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">
            Controls how conversations in this project can access uploaded files.
          </p>
          <div className="flex items-center gap-2">
            {(['off', 'direct', 'agentic'] as const).map((mode) => {
              const needsBackend = mode === 'agentic';
              const isDisabled = needsBackend && !backendAvailable;
              return (
                <button
                  key={mode}
                  onClick={() => !isDisabled && handleKnowledgeModeChange(mode)}
                  disabled={isDisabled}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    knowledgeMode === mode
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-soft)]'
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={
                    isDisabled ? 'Backend required' :
                    mode === 'off' ? 'No file injection' :
                    mode === 'direct' ? 'Use @filename to inject file content' :
                    'Model can read files via tool use'
                  }
                >
                  {mode === 'off' ? 'Off' : mode === 'direct' ? '@ Direct' : 'Agentic'}
                </button>
              );
            })}
            {knowledgeMode === 'agentic' && !backendAvailable && (
              <span className="flex items-center gap-1 text-[10px] text-amber-500">
                <AlertTriangle size={10} />
                Backend required
              </span>
            )}
          </div>
        </section>

        {/* Files */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Files
              <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">
                ({files.length})
              </span>
            </label>
            <FileUploadButton projectId={project.id} />
          </div>
          {files.length > 0 ? (
            <div className="border border-[var(--color-border-soft)] rounded-lg overflow-hidden">
              <ProjectFileList projectId={project.id} files={files} showPreview />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center border border-dashed border-[var(--color-border)] rounded-lg">
              No files uploaded
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
