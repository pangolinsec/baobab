import { useCallback, useState } from 'react';
import { FlaskConical, Download, Trash2, XCircle, Settings } from 'lucide-react';
import { useResearchStore } from '../../store/useResearchStore';
import { cancelResearchRun } from '../../agents/research/researchRunner';
import { ResearchRunCard } from './ResearchRunCard';
import { ResearchReport } from './ResearchReport';
import type { ResearchRun } from '../../types';

type DetailTab = 'report' | 'config';

export function ResearchView() {
  const runs = useResearchStore((s) => s.runs);
  const activeRunId = useResearchStore((s) => s.activeRunId);
  const setActiveRunId = useResearchStore((s) => s.setActiveRunId);
  const deleteRun = useResearchStore((s) => s.deleteRun);
  const [tab, setTab] = useState<DetailTab>('report');

  const selectedRun = runs.find(r => r.id === activeRunId) ?? null;

  const handleSelectRun = useCallback((id: string) => {
    setActiveRunId(id);
    setTab('report');
  }, [setActiveRunId]);

  const handleDelete = useCallback(async (run: ResearchRun) => {
    if (!window.confirm('Delete this research run? This cannot be undone.')) return;
    await deleteRun(run.id);
  }, [deleteRun]);

  const handleCancel = useCallback((runId: string) => {
    cancelResearchRun(runId);
  }, []);

  const handleDownload = useCallback((run: ResearchRun) => {
    if (!run.report) return;
    const blob = new Blob([run.report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${run.config.goal.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-3 px-8">
        <FlaskConical size={32} className="opacity-40" />
        <span className="text-sm text-center">No research runs yet.</span>
        <span className="text-xs text-center">Right-click a node and select "Research this subtree" to start.</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left panel — run list */}
      <div className="w-64 shrink-0 border-r border-[var(--color-border-soft)] overflow-y-auto p-2 space-y-1">
        {runs
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(run => (
            <ResearchRunCard
              key={run.id}
              run={run}
              isSelected={run.id === activeRunId}
              onClick={() => handleSelectRun(run.id)}
            />
          ))}
      </div>

      {/* Right panel — selected run detail */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selectedRun ? (
          <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
            Select a research run
          </div>
        ) : (
          <>
            {/* Tab bar + actions */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-soft)]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTab('report')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    tab === 'report'
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Report
                </button>
                <button
                  onClick={() => setTab('config')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    tab === 'config'
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Settings size={12} className="inline mr-1" />
                  Config
                </button>
              </div>

              <div className="flex items-center gap-1">
                {(selectedRun.status === 'planning' || selectedRun.status === 'researching' || selectedRun.status === 'synthesizing') && (
                  <button
                    onClick={() => handleCancel(selectedRun.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Cancel run"
                  >
                    <XCircle size={12} />
                    Cancel
                  </button>
                )}
                {selectedRun.report && (
                  <button
                    onClick={() => handleDownload(selectedRun)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    title="Download as .md"
                  >
                    <Download size={12} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedRun)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Delete run"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {tab === 'report' && <ResearchReport run={selectedRun} />}
              {tab === 'config' && <ConfigTab run={selectedRun} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfigTab({ run }: { run: ResearchRun }) {
  return (
    <div className="overflow-y-auto p-4 space-y-3">
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Mode</span>
        <p className="text-sm text-[var(--color-text)]">{run.mode}</p>
      </div>
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Goal</span>
        <p className="text-sm text-[var(--color-text)]">{run.config.goal}</p>
      </div>
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Planner Model</span>
        <p className="text-sm text-[var(--color-text)]">{run.config.plannerModelId}</p>
      </div>
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Sub-agent Model</span>
        <p className="text-sm text-[var(--color-text)]">{run.config.subAgentModelId}</p>
      </div>
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Limits</span>
        <div className="text-sm text-[var(--color-text)] space-y-0.5">
          <p>Max sub-tasks: {run.config.maxSubTasks}</p>
          <p>Max tool calls per agent: {run.config.maxToolCallsPerSubAgent}</p>
          <p>Max total tool calls: {run.config.maxTotalToolCalls}</p>
        </div>
      </div>
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Status</span>
        <p className="text-sm text-[var(--color-text)]">{run.status}</p>
      </div>
      {run.error && (
        <div>
          <span className="text-xs font-medium text-red-500">Error</span>
          <p className="text-sm text-red-500">{run.error}</p>
        </div>
      )}
      {run.plan && (
        <div>
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Plan</span>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">{run.plan.reasoning}</p>
          <div className="space-y-1">
            {run.plan.subTasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  st.status === 'complete' ? 'bg-emerald-500' :
                  st.status === 'running' ? 'bg-[var(--color-accent)] animate-pulse' :
                  st.status === 'error' ? 'bg-red-500' :
                  'bg-[var(--color-text-muted)]/30'
                }`} />
                <span>{st.title}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {st.findingsCount > 0 ? `${st.findingsCount} findings` : st.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Prompt</span>
        <pre className="text-xs text-[var(--color-text)] whitespace-pre-wrap mt-1 p-2 rounded bg-[var(--color-bg-secondary)]">
          {run.config.prompt}
        </pre>
      </div>
    </div>
  );
}
