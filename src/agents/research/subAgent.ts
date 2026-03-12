import type { ResearchRun, ResearchSubTask, ResearchProcessNode } from '../../types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useResearchStore } from '../../store/useResearchStore';
import { getProvider } from '../../api/providers/registry';
import type { ProviderConfig, ProviderSendParams, ToolDefinition } from '../../api/providers/types';

export interface SubAgentResult {
  findingsCount: number;
  toolCallCount: number;
  error?: string;
}

const SUB_AGENT_SYSTEM_PROMPT = `You are a research sub-agent. Your task:

{description}

Use the available tools to investigate this topic. When you discover relevant
information, use the record_finding tool to save it with a source citation.

Guidelines:
- Be thorough but focused — investigate your specific sub-task, not tangential topics.
- Record findings as you go — don't wait until the end.
- Include direct quotes or specific data when possible.
- Rate each finding's relevance to your sub-task (high/medium/low).
- When you've gathered enough information or exhausted available sources, stop.`;

export async function runSubAgent(
  run: ResearchRun,
  subTask: ResearchSubTask,
  toolDefs: ToolDefinition[],
  toolExecutor: (toolName: string, input: Record<string, unknown>) => Promise<string>,
  signal: AbortSignal,
  globalToolCallCount: { value: number },
): Promise<SubAgentResult> {
  const { providers: providerConfigs } = useSettingsStore.getState();
  const provider = getProvider(run.config.subAgentProviderId);
  const providerConfig = providerConfigs.find(p => p.id === run.config.subAgentProviderId);

  if (!provider || !providerConfig?.enabled) {
    return { findingsCount: 0, toolCallCount: 0, error: `Sub-agent provider "${run.config.subAgentProviderId}" not available` };
  }

  if (!provider.supportsToolUse) {
    return { findingsCount: 0, toolCallCount: 0, error: `Provider "${provider.name}" does not support tool use` };
  }

  const systemPrompt = SUB_AGENT_SYSTEM_PROMPT.replace('{description}', subTask.description);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: `Investigate: ${subTask.title}\n\n${subTask.description}` },
  ];

  let localToolCallCount = 0;
  let findingsCount = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      provider.sendMessage(providerConfig as ProviderConfig, {
        model: run.config.subAgentModelId,
        messages,
        systemPrompt,
        signal,
        tools: toolDefs,
        onToolCall: async (toolName: string, toolInput: Record<string, unknown>) => {
          // Check limits
          localToolCallCount++;
          globalToolCallCount.value++;

          if (localToolCallCount > run.config.maxToolCallsPerSubAgent) {
            return JSON.stringify({ error: 'Tool call limit reached for this sub-agent' });
          }
          if (globalToolCallCount.value > run.config.maxTotalToolCalls) {
            return JSON.stringify({ error: 'Global tool call limit reached' });
          }
          if (signal.aborted) {
            return JSON.stringify({ error: 'Run cancelled' });
          }

          // Log tool call as a process node
          const processNode: ResearchProcessNode = {
            id: crypto.randomUUID(),
            subTaskId: subTask.id,
            type: 'tool_call',
            toolName,
            input: toolInput,
            createdAt: Date.now(),
          };

          // Execute the tool
          const result = await toolExecutor(toolName, toolInput);

          // Update process node with result
          processNode.output = result.slice(0, 2000);
          await useResearchStore.getState().appendProcessNode(run.id, processNode);

          // Track findings
          if (toolName === 'record_finding') {
            findingsCount++;
          }

          return result;
        },
        onToken: () => {},
        onComplete: () => { resolve(); },
        onError: (error: Error) => { reject(error); },
      } as ProviderSendParams);
    });
  } catch (err) {
    if (signal.aborted) {
      return { findingsCount, toolCallCount: localToolCallCount, error: 'Cancelled' };
    }
    return { findingsCount, toolCallCount: localToolCallCount, error: String(err) };
  }

  return { findingsCount, toolCallCount: localToolCallCount };
}
