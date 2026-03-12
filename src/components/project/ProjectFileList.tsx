import { useState } from 'react';
import { FileText, FileImage, FileCode, File, Trash2, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import type { ProjectFile } from '../../types';
import { useProjectStore } from '../../store/useProjectStore';
import { fetchFileTextUnified } from '../../lib/fileStorage';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType, filename }: { mimeType: string; filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('image/')) return <FileImage size={12} />;
  if (mimeType === 'application/pdf') return <FileText size={12} />;
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'rb'].includes(ext)) {
    return <FileCode size={12} />;
  }
  if (mimeType.startsWith('text/') || ['md', 'txt', 'csv', 'json', 'yaml', 'yml'].includes(ext)) {
    return <FileText size={12} />;
  }
  return <File size={12} />;
}

const MAX_DISPLAY_CHARS = 10000;

interface ProjectFileListProps {
  projectId: string;
  files: ProjectFile[];
  showPreview?: boolean;
}

export function ProjectFileList({ projectId, files, showPreview }: ProjectFileListProps) {
  const deleteFile = useProjectStore((s) => s.deleteFile);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [fullTexts, setFullTexts] = useState<Record<string, string>>({});
  const [loadingFullText, setLoadingFullText] = useState<string | null>(null);

  if (files.length === 0) return null;

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      await deleteFile(projectId, fileId);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = (fileId: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const loadFullText = async (fileId: string) => {
    setLoadingFullText(fileId);
    try {
      const data = await fetchFileTextUnified(fileId);
      const text = data.extractedText || '(No text content)';
      setFullTexts(prev => ({ ...prev, [fileId]: text.length > MAX_DISPLAY_CHARS ? text.slice(0, MAX_DISPLAY_CHARS) : text }));
    } catch {
      setFullTexts(prev => ({ ...prev, [fileId]: '(Failed to load file text)' }));
    } finally {
      setLoadingFullText(null);
    }
  };

  return (
    <div className="pl-6 pr-2">
      {files.map((file) => {
        const isExpanded = showPreview && expandedFiles.has(file.id);
        const hasPreview = !!file.extractedTextPreview;
        const hasFullText = file.id in fullTexts;

        return (
          <div key={file.id}>
            <div
              className="group flex items-center gap-1.5 py-1 px-2 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {showPreview && hasPreview ? (
                <button
                  onClick={() => toggleExpand(file.id)}
                  className="shrink-0 p-0.5 rounded hover:bg-[var(--color-border-soft)] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={11} className="text-[var(--color-text-muted)]" />
                  ) : (
                    <ChevronRight size={11} className="text-[var(--color-text-muted)]" />
                  )}
                </button>
              ) : showPreview ? (
                <span className="shrink-0 w-[19px]" />
              ) : null}
              <FileIcon mimeType={file.mimeType} filename={file.filename} />
              <span className="flex-1 text-xs truncate" title={file.filename}>
                {file.filename}
              </span>
              <span className="text-[10px] opacity-60 shrink-0">
                {formatSize(file.sizeBytes)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(file.id);
                }}
                disabled={deletingId === file.id}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-muted)] hover:text-red-500 transition-all"
                title="Delete file"
              >
                {deletingId === file.id ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Trash2 size={11} />
                )}
              </button>
            </div>

            {/* Expanded text preview */}
            {isExpanded && (
              <div className="ml-8 mr-2 mb-1">
                <pre className="max-h-64 overflow-y-auto text-xs font-mono p-3 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
                  {hasFullText ? fullTexts[file.id] : file.extractedTextPreview}
                  {hasFullText && fullTexts[file.id].length >= MAX_DISPLAY_CHARS && (
                    <span className="block mt-2 text-[var(--color-text-muted)] italic">
                      (Truncated at {MAX_DISPLAY_CHARS.toLocaleString()} characters)
                    </span>
                  )}
                </pre>
                {!hasFullText && (
                  <button
                    onClick={() => loadFullText(file.id)}
                    disabled={loadingFullText === file.id}
                    className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline disabled:opacity-50"
                  >
                    {loadingFullText === file.id ? (
                      <>
                        <Loader2 size={10} className="animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Show full text'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
