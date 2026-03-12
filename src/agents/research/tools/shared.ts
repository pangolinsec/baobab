import type { ToolDefinition } from '../../../api/providers/types';
import type { FindingRelevance } from '../../../types';
import { useResearchStore } from '../../../store/useResearchStore';

export const RECORD_FINDING_TOOL: ToolDefinition = {
  name: 'record_finding',
  description: 'Record a finding from your research. Each finding should be a discrete piece of information with a source citation.',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The finding — a clear, concise statement of what was discovered.',
      },
      citation: {
        type: 'string',
        description: 'Source reference. For tree-search: node ID. For web-search: URL.',
      },
      relevance: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How relevant this finding is to the sub-task goal.',
      },
    },
    required: ['content', 'citation', 'relevance'],
  },
};

export function createRecordFindingExecutor(runId: string, subTaskId: string) {
  return async (input: Record<string, unknown>): Promise<string> => {
    const content = input.content as string;
    const citation = input.citation as string;
    const relevance = (input.relevance as FindingRelevance) || 'medium';

    if (!content || !citation) {
      return JSON.stringify({ error: 'content and citation are required' });
    }

    const node = {
      id: crypto.randomUUID(),
      subTaskId,
      type: 'finding' as const,
      output: content,
      citation,
      createdAt: Date.now(),
    };

    await useResearchStore.getState().appendProcessNode(runId, node);

    return JSON.stringify({
      recorded: true,
      findingId: node.id,
      relevance,
    });
  };
}
