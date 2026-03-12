import type { ResearchRun, ResearchConfig, ResearchMode } from '../../types';
import { useResearchStore } from '../../store/useResearchStore';
import { useTreeStore } from '../../store/useTreeStore';
import { db } from '../../db/database';
import { runPlanner } from './planner';
import { runSubAgent } from './subAgent';
import { runSynthesizer } from './synthesizer';
import { TREE_SEARCH_TOOL_DEFINITIONS, createTreeSearchExecutor } from './tools/treeSearch';
import { RECORD_FINDING_TOOL, createRecordFindingExecutor } from './tools/shared';
import type { ToolDefinition } from '../../api/providers/types';

interface ResearchRunControl {
  runAbort: AbortController;
  currentAbort: AbortController;
}

const activeControls = new Map<string, ResearchRunControl>();

export async function startResearchRun(
  conversationId: string,
  triggerNodeId: string,
  mode: ResearchMode,
  config: ResearchConfig,
): Promise<string> {
  const { createRun } = useResearchStore.getState();

  const run: ResearchRun = {
    id: crypto.randomUUID(),
    conversationId,
    triggerNodeId,
    mode,
    config,
    plan: null,
    processNodes: [],
    report: null,
    reportUpdatedAt: null,
    status: 'planning',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await createRun(run);

  // Set researchRunId on the trigger node
  const nodes = useTreeStore.getState().nodes;
  if (nodes[triggerNodeId]) {
    await db.nodes.update(triggerNodeId, { researchRunId: run.id });
    useTreeStore.setState(state => ({
      nodes: {
        ...state.nodes,
        [triggerNodeId]: { ...state.nodes[triggerNodeId], researchRunId: run.id },
      },
    }));
  }

  const control: ResearchRunControl = {
    runAbort: new AbortController(),
    currentAbort: new AbortController(),
  };
  activeControls.set(run.id, control);

  // Fire-and-forget the pipeline
  runPipeline(run, control).catch((err) => {
    console.error('Research pipeline error:', err);
    useResearchStore.getState().updateRun(run.id, {
      status: 'error',
      error: String(err),
    });
  }).finally(() => {
    activeControls.delete(run.id);
  });

  return run.id;
}

export function cancelResearchRun(runId: string): void {
  const control = activeControls.get(runId);
  if (control) {
    control.runAbort.abort();
    control.currentAbort.abort();
  }
  useResearchStore.getState().updateRun(runId, { status: 'cancelled' });
  activeControls.delete(runId);
}

export function recoverOrphanedResearchRuns(): Promise<ResearchRun[]> {
  return useResearchStore.getState().recoverOrphanedRuns();
}

async function runPipeline(run: ResearchRun, control: ResearchRunControl): Promise<void> {
  const store = useResearchStore.getState;

  // --- PLANNING ---
  await store().updateRun(run.id, { status: 'planning' });

  let plan;
  try {
    plan = await runPlanner(run, control.runAbort.signal);
  } catch (err) {
    if (control.runAbort.signal.aborted) {
      await store().updateRun(run.id, { status: 'cancelled' });
      return;
    }
    throw err;
  }

  await store().setPlan(run.id, plan);

  if (control.runAbort.signal.aborted) {
    await store().updateRun(run.id, { status: 'cancelled' });
    return;
  }

  // --- RESEARCHING ---
  await store().updateRun(run.id, { status: 'researching' });

  const globalToolCallCount = { value: 0 };

  for (const subTask of plan.subTasks) {
    if (control.runAbort.signal.aborted) break;
    if (globalToolCallCount.value >= run.config.maxTotalToolCalls) break;

    // Fresh abort controller for each sub-agent
    control.currentAbort = new AbortController();

    // Link to run abort
    const onRunAbort = () => control.currentAbort.abort();
    control.runAbort.signal.addEventListener('abort', onRunAbort, { once: true });

    await store().updateSubTaskStatus(run.id, subTask.id, 'running');

    // Build tools and executor based on mode
    const { toolDefs, executor } = buildToolsForMode(run, subTask.id);

    try {
      const result = await runSubAgent(
        run,
        subTask,
        toolDefs,
        executor,
        control.currentAbort.signal,
        globalToolCallCount,
      );

      if (result.error && !control.runAbort.signal.aborted) {
        await store().updateSubTaskStatus(run.id, subTask.id, 'error', result.findingsCount);
        // Log error as process node
        await store().appendProcessNode(run.id, {
          id: crypto.randomUUID(),
          subTaskId: subTask.id,
          type: 'error',
          output: result.error,
          createdAt: Date.now(),
        });
      } else {
        await store().updateSubTaskStatus(run.id, subTask.id, 'complete', result.findingsCount);
      }
    } catch (err) {
      await store().updateSubTaskStatus(run.id, subTask.id, 'error');
      await store().appendProcessNode(run.id, {
        id: crypto.randomUUID(),
        subTaskId: subTask.id,
        type: 'error',
        output: String(err),
        createdAt: Date.now(),
      });
    } finally {
      control.runAbort.signal.removeEventListener('abort', onRunAbort);
    }
  }

  if (control.runAbort.signal.aborted) {
    await store().updateRun(run.id, { status: 'cancelled' });
    return;
  }

  // --- SYNTHESIZING ---
  await store().updateRun(run.id, { status: 'synthesizing' });

  // Re-read run state with all findings
  const currentRun = store().runs.find(r => r.id === run.id);
  if (!currentRun) return;

  try {
    control.currentAbort = new AbortController();
    const onRunAbort = () => control.currentAbort.abort();
    control.runAbort.signal.addEventListener('abort', onRunAbort, { once: true });

    const report = await runSynthesizer(currentRun, control.currentAbort.signal);

    control.runAbort.signal.removeEventListener('abort', onRunAbort);

    if (control.runAbort.signal.aborted) {
      await store().updateRun(run.id, { status: 'cancelled' });
      return;
    }

    await store().setReport(run.id, report);
    await store().updateRun(run.id, { status: 'complete' });
  } catch (err) {
    if (control.runAbort.signal.aborted) {
      await store().updateRun(run.id, { status: 'cancelled' });
      return;
    }
    throw err;
  }
}

function buildToolsForMode(
  run: ResearchRun,
  subTaskId: string,
): { toolDefs: ToolDefinition[]; executor: (toolName: string, input: Record<string, unknown>) => Promise<string> } {
  const recordFindingExec = createRecordFindingExecutor(run.id, subTaskId);

  if (run.mode === 'tree-search') {
    const treeExec = createTreeSearchExecutor(run.conversationId, run.triggerNodeId);
    return {
      toolDefs: [...TREE_SEARCH_TOOL_DEFINITIONS, RECORD_FINDING_TOOL],
      executor: async (toolName: string, input: Record<string, unknown>) => {
        if (toolName === 'record_finding') {
          return recordFindingExec(input);
        }
        return treeExec(toolName, input);
      },
    };
  }

  // web-search mode — tools defined in Phase B
  return {
    toolDefs: [RECORD_FINDING_TOOL],
    executor: async (toolName: string, input: Record<string, unknown>) => {
      if (toolName === 'record_finding') {
        return recordFindingExec(input);
      }
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    },
  };
}
