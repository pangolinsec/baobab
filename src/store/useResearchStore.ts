import { create } from 'zustand';
import type { ResearchRun, ResearchPlan, ResearchProcessNode, SubTaskStatus } from '../types';
import { db } from '../db/database';

interface ResearchState {
  runs: ResearchRun[];
  activeRunId: string | null;

  loadRuns: (conversationId: string) => Promise<void>;
  createRun: (run: ResearchRun) => Promise<void>;
  updateRun: (id: string, updates: Partial<ResearchRun>) => Promise<void>;
  deleteRun: (id: string) => Promise<void>;
  appendProcessNode: (runId: string, node: ResearchProcessNode) => Promise<void>;
  setPlan: (runId: string, plan: ResearchPlan) => Promise<void>;
  updateSubTaskStatus: (runId: string, subTaskId: string, status: SubTaskStatus, findingsCount?: number) => Promise<void>;
  setReport: (runId: string, report: string) => Promise<void>;
  setActiveRunId: (id: string | null) => void;
  recoverOrphanedRuns: () => Promise<ResearchRun[]>;
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  runs: [],
  activeRunId: null,

  loadRuns: async (conversationId: string) => {
    const runs = await db.researchRuns
      .where('conversationId')
      .equals(conversationId)
      .toArray();
    const active = runs.find(r =>
      r.status === 'planning' || r.status === 'researching' || r.status === 'synthesizing'
    );
    set({ runs, activeRunId: active?.id ?? null });
  },

  createRun: async (run: ResearchRun) => {
    await db.researchRuns.put(run);
    set(state => ({
      runs: [...state.runs, run],
      activeRunId: run.id,
    }));
  },

  updateRun: async (id: string, updates: Partial<ResearchRun>) => {
    const updatedFields = { ...updates, updatedAt: Date.now() };
    await db.researchRuns.update(id, updatedFields);
    set(state => ({
      runs: state.runs.map(r =>
        r.id === id ? { ...r, ...updatedFields } : r
      ),
    }));
  },

  deleteRun: async (id: string) => {
    await db.researchRuns.delete(id);
    set(state => ({
      runs: state.runs.filter(r => r.id !== id),
      activeRunId: state.activeRunId === id ? null : state.activeRunId,
    }));
  },

  appendProcessNode: async (runId: string, node: ResearchProcessNode) => {
    const run = get().runs.find(r => r.id === runId);
    if (!run) return;
    const newProcessNodes = [...run.processNodes, node];
    await db.researchRuns.update(runId, {
      processNodes: newProcessNodes,
      updatedAt: Date.now(),
    });
    set(state => ({
      runs: state.runs.map(r =>
        r.id === runId ? { ...r, processNodes: newProcessNodes, updatedAt: Date.now() } : r
      ),
    }));
  },

  setPlan: async (runId: string, plan: ResearchPlan) => {
    await db.researchRuns.update(runId, {
      plan,
      updatedAt: Date.now(),
    });
    set(state => ({
      runs: state.runs.map(r =>
        r.id === runId ? { ...r, plan, updatedAt: Date.now() } : r
      ),
    }));
  },

  updateSubTaskStatus: async (runId: string, subTaskId: string, status: SubTaskStatus, findingsCount?: number) => {
    const run = get().runs.find(r => r.id === runId);
    if (!run?.plan) return;
    const updatedSubTasks = run.plan.subTasks.map(st =>
      st.id === subTaskId
        ? { ...st, status, findingsCount: findingsCount ?? st.findingsCount }
        : st
    );
    const updatedPlan = { ...run.plan, subTasks: updatedSubTasks };
    await db.researchRuns.update(runId, {
      plan: updatedPlan,
      updatedAt: Date.now(),
    });
    set(state => ({
      runs: state.runs.map(r =>
        r.id === runId ? { ...r, plan: updatedPlan, updatedAt: Date.now() } : r
      ),
    }));
  },

  setReport: async (runId: string, report: string) => {
    const now = Date.now();
    await db.researchRuns.update(runId, {
      report,
      reportUpdatedAt: now,
      updatedAt: now,
    });
    set(state => ({
      runs: state.runs.map(r =>
        r.id === runId ? { ...r, report, reportUpdatedAt: now, updatedAt: now } : r
      ),
    }));
  },

  setActiveRunId: (id: string | null) => {
    set({ activeRunId: id });
  },

  recoverOrphanedRuns: async () => {
    const orphanedStatuses = ['planning', 'researching', 'synthesizing'] as const;
    const orphaned: ResearchRun[] = [];
    for (const status of orphanedStatuses) {
      const runs = await db.researchRuns
        .where('status')
        .equals(status)
        .toArray();
      orphaned.push(...runs);
    }
    for (const run of orphaned) {
      await db.researchRuns.update(run.id, {
        status: 'error',
        error: 'Run interrupted by page reload. Partial results may be available.',
        updatedAt: Date.now(),
      });
    }
    const recovered = orphaned.map(r => ({
      ...r,
      status: 'error' as const,
      error: 'Run interrupted by page reload. Partial results may be available.',
      updatedAt: Date.now(),
    }));
    if (recovered.length > 0) {
      set(state => ({
        runs: state.runs.map(r => {
          const rec = recovered.find(o => o.id === r.id);
          return rec ?? r;
        }),
      }));
    }
    return recovered;
  },
}));
