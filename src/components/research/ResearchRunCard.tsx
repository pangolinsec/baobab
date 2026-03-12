import { FlaskConical } from 'lucide-react';
import type { ResearchRun } from '../../types';

interface ResearchRunCardProps {
  run: ResearchRun;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planning...',
  researching: 'Researching',
  synthesizing: 'Synthesizing...',
  complete: 'Complete',
  error: 'Error',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  planning: 'text-[var(--color-accent)]',
  researching: 'text-[var(--color-accent)]',
  synthesizing: 'text-[var(--color-accent)]',
  complete: 'text-emerald-500',
  error: 'text-red-500',
  cancelled: 'text-[var(--color-text-muted)]',
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ResearchRunCard({ run, isSelected, onClick }: ResearchRunCardProps) {
  const isActive = run.status === 'planning' || run.status === 'researching' || run.status === 'synthesizing';

  // Progress for researching state
  let progressText = '';
  if (run.status === 'researching' && run.plan) {
    const done = run.plan.subTasks.filter(st => st.status === 'complete' || st.status === 'error').length;
    const total = run.plan.subTasks.length;
    progressText = ` (${done}/${total})`;
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
        isSelected
          ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
          : 'hover:bg-[var(--color-bg-hover)] border border-transparent'
      }`}
    >
      <div className="flex items-start gap-2">
        <FlaskConical
          size={14}
          className={`mt-0.5 shrink-0 ${isActive ? 'text-[var(--color-accent)] animate-pulse' : 'text-emerald-500'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-[var(--color-text)] truncate">
            {run.config.goal.slice(0, 60) || 'Research run'}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">{run.mode}</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
            <span className={`text-[10px] ${STATUS_COLORS[run.status]}`}>
              {STATUS_LABELS[run.status]}{progressText}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{formatTimeAgo(run.updatedAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
