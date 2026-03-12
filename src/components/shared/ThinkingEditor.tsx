import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface ThinkingEditorProps {
  value: string;
  onChange: (v: string) => void;
  defaultExpanded?: boolean;
}

export function ThinkingEditor({ value, onChange, defaultExpanded }: ThinkingEditorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? value.length > 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-2"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Brain size={14} />
        <span>Thinking</span>
        {value.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[10px]">
            {value.length.toLocaleString()} chars
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-l-2 border-[var(--color-accent)]/30 pl-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-all"
            placeholder="Thinking content..."
          />
        </div>
      )}
    </div>
  );
}
