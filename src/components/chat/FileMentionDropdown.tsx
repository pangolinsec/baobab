import { useEffect, useRef } from 'react';
import { FileText, FileImage, FileCode, File } from 'lucide-react';
import type { ProjectFile } from '../../types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType, filename }: { mimeType: string; filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/')) return <FileImage size={14} />;
  if (mimeType === 'application/pdf') return <FileText size={14} />;
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'rb'].includes(ext)) {
    return <FileCode size={14} />;
  }
  if (mimeType.startsWith('text/') || ['md', 'txt', 'csv', 'json', 'yaml', 'yml'].includes(ext)) {
    return <FileText size={14} />;
  }
  return <File size={14} />;
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

interface FileMentionDropdownProps {
  filteredFiles: ProjectFile[];
  selectedIndex: number;
  onSelect: (filename: string) => void;
}

export function FileMentionDropdown({ filteredFiles: filtered, selectedIndex, onSelect }: FileMentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-2 px-3 z-50">
        <span className="text-xs text-[var(--color-text-muted)]">No matching files</span>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto"
    >
      {filtered.map((file, i) => (
        <button
          key={file.id}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
            i === selectedIndex
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
          }`}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea blur
            onSelect(file.filename);
          }}
        >
          <span className="text-[var(--color-text-muted)]">
            <FileIcon mimeType={file.mimeType} filename={file.filename} />
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{file.filename}</span>
            {file.extractedTextPreview && (
              <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                {file.extractedTextPreview.slice(0, 60).replace(/\n/g, ' ')}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{formatSize(file.sizeBytes)}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Get the filtered files for a given query. Exported so ChatInput
 * can compute the count for keyboard navigation bounds.
 */
export function getFilteredFiles(query: string, files: ProjectFile[]): ProjectFile[] {
  return files.filter(f => fuzzyMatch(query, f.filename));
}
