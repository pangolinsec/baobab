import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { ResearchRun } from '../../types';
import { useTreeStore } from '../../store/useTreeStore';

interface ResearchReportProps {
  run: ResearchRun;
}

export function ResearchReport({ run }: ResearchReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!run.report) return;
    navigator.clipboard.writeText(run.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [run.report]);

  const handleCitationClick = useCallback((nodeId: string) => {
    const nodes = useTreeStore.getState().nodes;
    if (nodes[nodeId]) {
      useTreeStore.getState().selectNode(nodeId);
      useTreeStore.getState().setViewMode('tree');
    }
  }, []);

  if (!run.report) {
    if (run.status === 'synthesizing') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
          <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Synthesizing report...</span>
        </div>
      );
    }
    if (run.status === 'planning' || run.status === 'researching') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
          <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">
            {run.status === 'planning' ? 'Planning research...' : 'Researching...'}
          </span>
          {run.plan && (
            <div className="text-xs mt-2 space-y-1 max-w-sm">
              {run.plan.subTasks.map(st => (
                <div key={st.id} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    st.status === 'complete' ? 'bg-emerald-500' :
                    st.status === 'running' ? 'bg-[var(--color-accent)] animate-pulse' :
                    st.status === 'error' ? 'bg-red-500' :
                    'bg-[var(--color-text-muted)]/30'
                  }`} />
                  <span className="truncate">{st.title}</span>
                  {st.findingsCount > 0 && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">({st.findingsCount})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (run.status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2 px-4">
          <span className="text-sm font-medium">Research failed</span>
          {run.error && <span className="text-xs text-center">{run.error}</span>}
          {run.processNodes.filter(pn => pn.type === 'finding').length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {run.processNodes.filter(pn => pn.type === 'finding').length} findings collected before error
            </span>
          )}
        </div>
      );
    }
    if (run.status === 'cancelled') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-2">
          <span className="text-sm">Research cancelled</span>
          {run.processNodes.filter(pn => pn.type === 'finding').length > 0 && (
            <span className="text-xs">
              {run.processNodes.filter(pn => pn.type === 'finding').length} findings collected
            </span>
          )}
        </div>
      );
    }
    return null;
  }

  // Process report to make tree-search citations clickable
  const processedReport = run.mode === 'tree-search'
    ? run.report
    : run.report;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-[var(--color-border-soft)]">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy markdown'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="prose prose-sm max-w-none text-[var(--color-text)] prose-headings:text-[var(--color-text)] prose-a:text-[var(--color-accent)] prose-strong:text-[var(--color-text)] prose-code:text-[var(--color-text)]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // Make citation references clickable for tree-search mode
              a: ({ href, children, ...props }) => {
                if (href) {
                  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                }
                return <a {...props}>{children}</a>;
              },
              // Handle [N] references in paragraphs for tree-search
              p: ({ children, ...props }) => {
                if (run.mode !== 'tree-search') {
                  return <p {...props}>{children}</p>;
                }
                return <p {...props}>{processCitations(children, handleCitationClick, run)}</p>;
              },
            }}
          >
            {processedReport}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

/** Parse [N] references in text children and make them clickable for tree-search. */
function processCitations(
  children: React.ReactNode,
  onCitationClick: (nodeId: string) => void,
  run: ResearchRun,
): React.ReactNode {
  if (!children) return children;

  // Build a reference map from the report's references section
  const referenceMap = buildReferenceMap(run);

  const processChild = (child: React.ReactNode): React.ReactNode => {
    if (typeof child !== 'string') return child;

    const parts: React.ReactNode[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(child)) !== null) {
      if (match.index > lastIndex) {
        parts.push(child.slice(lastIndex, match.index));
      }

      const refNum = match[1];
      const nodeId = referenceMap.get(refNum);

      if (nodeId) {
        parts.push(
          <button
            key={`ref-${refNum}-${match.index}`}
            onClick={() => onCitationClick(nodeId)}
            className="inline text-[var(--color-accent)] hover:underline cursor-pointer font-medium"
            title={`Navigate to node ${nodeId}`}
          >
            [{refNum}]
          </button>
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < child.length) {
      parts.push(child.slice(lastIndex));
    }

    return parts.length > 0 ? parts : child;
  };

  if (Array.isArray(children)) {
    return children.map((child, i) => <span key={i}>{processChild(child)}</span>);
  }
  return processChild(children);
}

/** Extract node IDs from the references section of a tree-search report. */
function buildReferenceMap(run: ResearchRun): Map<string, string> {
  const map = new Map<string, string>();
  if (!run.report || run.mode !== 'tree-search') return map;

  // Match patterns like "[1] Node abc123"
  const refRegex = /\[(\d+)\]\s*Node\s+([a-f0-9-]+)/gi;
  let match;
  while ((match = refRegex.exec(run.report)) !== null) {
    map.set(match[1], match[2]);
  }

  return map;
}
