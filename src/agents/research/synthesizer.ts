import type { ResearchRun } from '../../types';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getProvider } from '../../api/providers/registry';
import type { ProviderConfig, ProviderSendParams } from '../../api/providers/types';

function buildSynthesizerPrompt(run: ResearchRun): string {
  let prompt = `You are a research synthesizer. Given a set of findings from multiple research
sub-agents, assemble them into a coherent, well-organized markdown document.

Research goal: ${run.config.goal}

Guidelines:
- Organize by topic, not by sub-agent.
- Include source citations inline using [N] notation, with a references section at the end.
- For tree-search: cite node IDs. For web-search: cite URLs.
- Highlight key findings, patterns, and conclusions.
- Note any gaps — topics where findings were limited or absent.
- If there are contradictions between sources, note them explicitly.
- Write in a clear, professional tone.`;

  if (run.config.previousReport) {
    prompt += `

IMPORTANT: A previous version of this report exists. You are updating it with new
findings. Preserve the structure and content of the previous report where it remains
accurate, and integrate the new findings. Here is the previous report:

---
${run.config.previousReport}
---

New findings since the last report are marked with [NEW] in the findings list.`;
  }

  return prompt;
}

function buildFindingsMessage(run: ResearchRun): string {
  if (!run.plan) return 'No plan or findings available.';

  const sections: string[] = [];
  let citationIndex = 1;
  const citations: string[] = [];

  for (const subTask of run.plan.subTasks) {
    const taskFindings = run.processNodes.filter(
      pn => pn.subTaskId === subTask.id && pn.type === 'finding'
    );

    if (taskFindings.length === 0) {
      sections.push(`## Sub-task: ${subTask.title}\nStatus: ${subTask.status}\nNo findings recorded.`);
      continue;
    }

    const findingLines = taskFindings.map(f => {
      const idx = citationIndex++;
      citations.push(
        run.mode === 'tree-search'
          ? `[${idx}] Node ${f.citation}`
          : `[${idx}] ${f.citation}`
      );
      return `- [${idx}] ${f.output}`;
    });

    sections.push(`## Sub-task: ${subTask.title}\nStatus: ${subTask.status}\n\n${findingLines.join('\n')}`);
  }

  // Note any failed sub-tasks
  const failedTasks = run.plan.subTasks.filter(st => st.status === 'error');
  if (failedTasks.length > 0) {
    sections.push(`## Incomplete Sub-tasks\nThe following sub-tasks encountered errors:\n${failedTasks.map(t => `- ${t.title}`).join('\n')}`);
  }

  let message = `Here are the findings from ${run.plan.subTasks.length} sub-agents:\n\n${sections.join('\n\n')}`;

  if (citations.length > 0) {
    message += `\n\n## Source References\n${citations.join('\n')}`;
  }

  return message;
}

export async function runSynthesizer(run: ResearchRun, signal: AbortSignal): Promise<string> {
  const { providers: providerConfigs } = useSettingsStore.getState();
  const provider = getProvider(run.config.plannerProviderId);
  const providerConfig = providerConfigs.find(p => p.id === run.config.plannerProviderId);

  if (!provider || !providerConfig?.enabled) {
    throw new Error(`Synthesizer provider "${run.config.plannerProviderId}" not available`);
  }

  const systemPrompt = buildSynthesizerPrompt(run);
  const findingsMessage = buildFindingsMessage(run);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: findingsMessage },
  ];

  const responseText = await new Promise<string>((resolve, reject) => {
    provider.sendMessage(providerConfig as ProviderConfig, {
      model: run.config.plannerModelId,
      messages,
      systemPrompt,
      signal,
      onToken: () => {},
      onComplete: (fullText: string) => { resolve(fullText); },
      onError: (error: Error) => { reject(error); },
    } as ProviderSendParams);
  });

  return responseText;
}
