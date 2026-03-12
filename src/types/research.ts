// Feature 06: Research Agent types

export type ResearchMode = 'tree-search' | 'web-search';
export type ResearchStatus = 'planning' | 'researching' | 'synthesizing' | 'complete' | 'error' | 'cancelled';
export type SubTaskStatus = 'pending' | 'running' | 'complete' | 'error';
export type ProcessNodeType = 'tool_call' | 'finding' | 'error';
export type FindingRelevance = 'high' | 'medium' | 'low';

export interface ResearchConfig {
  goal: string;
  prompt: string;

  // Models
  plannerModelId: string;
  plannerProviderId: string;
  subAgentModelId: string;
  subAgentProviderId: string;

  // Limits
  maxSubTasks: number;
  maxToolCallsPerSubAgent: number;
  maxTotalToolCalls: number;

  // Incremental synthesis
  incrementalInterval?: number;
  previousReport?: string;
}

export interface ResearchSubTask {
  id: string;
  title: string;
  description: string;
  status: SubTaskStatus;
  findingsCount: number;
}

export interface ResearchPlan {
  subTasks: ResearchSubTask[];
  reasoning: string;
}

export interface ResearchProcessNode {
  id: string;
  subTaskId: string;
  type: ProcessNodeType;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string;
  citation?: string;
  createdAt: number;
}

export interface ResearchRun {
  id: string;
  conversationId: string;
  triggerNodeId: string;
  mode: ResearchMode;

  config: ResearchConfig;
  plan: ResearchPlan | null;
  processNodes: ResearchProcessNode[];

  report: string | null;
  reportUpdatedAt: number | null;

  status: ResearchStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
