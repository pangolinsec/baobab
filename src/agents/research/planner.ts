import type { ResearchRun, ResearchPlan, ResearchSubTask } from '../../types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getProvider } from '../../api/providers/registry';
import type { ProviderConfig, ProviderSendParams } from '../../api/providers/types';
import { createTreeSearchExecutor } from './tools/treeSearch';

export const DEFAULT_TREE_SEARCH_PROMPT = `You are a research planner. Given a research goal and a conversation tree to analyze,
decompose the goal into 3–7 focused sub-tasks. Each sub-task should target a specific
aspect of the goal that can be investigated by searching and reading the conversation tree.

The conversation tree may have multiple branches exploring different topics or approaches.
Design sub-tasks that cover the tree comprehensively — different sub-tasks should target
different branches or aspects of the conversation.

Output a JSON object:
{
  "reasoning": "Brief explanation of your decomposition strategy",
  "subTasks": [
    {
      "title": "Short title for this sub-task",
      "description": "Detailed description of what to investigate. Include specific
                       search terms, topics to look for, or branches to explore."
    }
  ]
}`;

export const DEFAULT_WEB_SEARCH_PROMPT = `You are a research planner. Given a research goal, decompose it into 3–7 focused
sub-tasks. Each sub-task should target a specific aspect of the goal that can be
investigated through web searches.

Design sub-tasks that are complementary — they should cover different facets of the
topic without excessive overlap. Consider: different angles, subtopics, comparisons,
recent developments, expert perspectives, and counterarguments.

Output a JSON object:
{
  "reasoning": "Brief explanation of your decomposition strategy",
  "subTasks": [
    {
      "title": "Short title for this sub-task",
      "description": "Detailed description of what to investigate. Include specific
                       search queries to try, what kind of sources to look for,
                       and what information to extract."
    }
  ]
}`;

/** Parse JSON from an LLM response with a fallback chain. */
function parseJsonResponse(text: string): unknown {
  // 1. Try direct parse
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // 2. Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch { /* continue */ }
  }

  // 3. Bracket-depth extraction: find outermost { ... }
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch { /* continue looking */ }
      }
    }
  }

  return null;
}

export async function runPlanner(run: ResearchRun, signal: AbortSignal): Promise<ResearchPlan> {
  const { providers: providerConfigs } = useSettingsStore.getState();
  const provider = getProvider(run.config.plannerProviderId);
  const providerConfig = providerConfigs.find(p => p.id === run.config.plannerProviderId);

  if (!provider || !providerConfig?.enabled) {
    throw new Error(`Planner provider "${run.config.plannerProviderId}" not available`);
  }

  const systemPrompt = run.config.prompt;

  // Build user message with context
  let userMessage = `Research goal: ${run.config.goal}`;

  if (run.mode === 'tree-search') {
    // Provide tree overview context for the planner
    const executor = createTreeSearchExecutor(run.conversationId, run.triggerNodeId);
    const overviewJson = await executor('get_tree_overview', {});
    userMessage += `\n\nConversation tree overview:\n${overviewJson}`;
  }

  userMessage += `\n\nDecompose this goal into ${run.config.maxSubTasks} or fewer sub-tasks. Output only the JSON object.`;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: userMessage },
  ];

  // Call provider — no tools, just text
  const responseText = await new Promise<string>((resolve, reject) => {
    let text = '';
    provider.sendMessage(providerConfig as ProviderConfig, {
      model: run.config.plannerModelId,
      messages,
      systemPrompt,
      signal,
      onToken: (t: string) => { text = t; },
      onComplete: (fullText: string) => { resolve(fullText); },
      onError: (error: Error) => { reject(error); },
    } as ProviderSendParams);
  });

  // Parse the response
  const parsed = parseJsonResponse(responseText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Planner did not return valid JSON. Response: ' + responseText.slice(0, 200));
  }

  const obj = parsed as Record<string, unknown>;
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : '';
  const rawSubTasks = Array.isArray(obj.subTasks) ? obj.subTasks : [];

  if (rawSubTasks.length === 0) {
    throw new Error('Planner returned zero sub-tasks. Response: ' + responseText.slice(0, 200));
  }

  // Validate and normalize sub-tasks
  const subTasks: ResearchSubTask[] = rawSubTasks
    .filter((st: unknown): st is Record<string, unknown> =>
      typeof st === 'object' && st !== null &&
      typeof (st as Record<string, unknown>).title === 'string' &&
      typeof (st as Record<string, unknown>).description === 'string'
    )
    .slice(0, run.config.maxSubTasks)
    .map((st: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      title: st.title as string,
      description: st.description as string,
      status: 'pending' as const,
      findingsCount: 0,
    }));

  if (subTasks.length === 0) {
    throw new Error('Planner returned no valid sub-tasks (each needs title + description).');
  }

  return { subTasks, reasoning };
}
