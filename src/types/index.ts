import type { ToolCallRecord } from '../api/providers/types';
export type { ToolCallRecord } from '../api/providers/types';

export type MessageRole = 'user' | 'assistant';
export type NodeType = 'standard' | 'summary' | 'merge';

export interface RawApiRequest {
  url: string;
  method: string;
  body: Record<string, unknown>;
  providerId: string;
  providerName: string;
  timestamp: number;
}

export interface RawApiResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  providerId: string;
  timestamp: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AzureModelEntry {
  id: string;               // auto-generated UUID, stable model identifier stored in tree nodes
  endpoint: string;         // Azure deployment name, sent as `model` parameter
  baseUrl: string;          // full Azure base URL (e.g., "https://resource.openai.azure.com/openai/v1")
  apiKey: string;           // Azure resource API key
  nickname?: string;        // optional display name; required if endpoint duplicates another entry
  isReasoningModel: boolean; // true → Responses API + reasoning capture; false → Chat Completions
}

export interface ProviderConfigData {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  enabledModels?: string[];
  azureModels?: AzureModelEntry[];  // only used when id === 'azure'
}

export interface ThinkingBlock {
  id: string;
  text: string;
  providerId: string;        // 'anthropic' | 'openai' | 'plaintext'
  signature?: string;
  encryptedContent?: string; // Phase B
  apiItemId?: string;        // Original API reasoning item ID (for encrypted content roundtrip)
  apiSummary?: unknown;      // Raw API summary (opaque, for roundtrip re-injection)
  sourceNodeId?: string;
  sourceConversationId?: string;
  isOriginal: boolean;
  plaintextEnabled: boolean;
  active: boolean;  // false = excluded from API context
  injectAtEnd?: boolean;  // Append after last user message (for OpenAI reasoning injection)
}

export interface CoverageScore {
  totalTerms: number;
  coveredTerms: string[];
  uncoveredTerms: string[];
  coveragePercent: number;
  termLocations: Record<string, number>;
}

export interface TreeNode {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: MessageRole;
  content: string;
  model: string;
  createdAt: number;
  childIds: string[];
  collapsed: boolean;
  manualPosition?: { x: number; y: number };

  // V2 migration fields
  nodeType: NodeType;
  userModified: boolean;
  starred: boolean;
  deadEnd: boolean;

  // Feature 04/39: thinking content (blocks with optional signatures)
  thinkingBlocks?: ThinkingBlock[];

  // Feature 08: Model cascade
  modelOverride?: string;         // undefined = inherit, string = override for this subtree

  // Feature 09: System prompt cascade
  systemPromptOverride?: string;  // undefined = inherit, "" = explicitly clear, string = override

  // Feature 07: Provider override
  providerId?: string;            // which provider this node uses
  providerOverride?: string;      // undefined = inherit, string = override for this subtree

  // Feature 22: Token usage from API response
  tokenUsage?: TokenUsage;

  // Feature 05: Tool calls stored on assistant nodes
  toolCalls?: ToolCallRecord[];

  // Feature 16: Merge source node references
  mergeSourceIds?: string[];
  mergeMode?: 'summarize' | 'full-context';

  // Message authorship
  source?: 'user' | 'manual';

  // System prompt actually used for this node's API call (enables one-shot detection)
  usedSystemPrompt?: string;

  // Raw API capture
  rawApiRequest?: RawApiRequest;
  rawApiResponse?: RawApiResponse;

  // Feature 06: Research run link
  researchRunId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  rootNodeId: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  systemPrompt?: string;
  tags: string[];
  providerId?: string;            // default provider for this conversation
  projectId?: string;             // for Tier 3 Feature 13 (projects)
  // Feature 05: Web search settings
  webSearchEnabled?: boolean;
  searchProvider?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  injectDescription?: boolean;
  knowledgeMode?: 'off' | 'direct' | 'agentic';
}

export interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedTextPreview: string | null;
}

export interface LocalProjectFile {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  createdAt: number;
}

export interface CustomPricingEntry {
  modelPattern: string;
  providerId: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

export interface AppSettings {
  id?: number;
  apiKey: string;
  defaultModel: string;
  theme: 'light' | 'dark';

  // Feature 04: advanced API config
  thinkingEnabled: boolean;
  thinkingBudget: number;
  temperature: number;
  maxOutputTokens: number;
  topP: number | null;
  topK: number | null;

  // Feature 09: Default system prompt
  defaultSystemPrompt: string;

  // Feature 15: Summarization prompt
  summarizationPrompt: string;

  // Feature 07: Providers
  providers: ProviderConfigData[];
  defaultProvider: string;

  // Feature 05: Search API keys
  tavilyApiKey?: string;
  bingApiKey?: string;
  defaultSearchProvider?: string;

  // Feature 16: Merge settings
  mergePrompt?: string;
  defaultMergeMode?: 'summarize' | 'full-context';

  // Feature 22: Custom pricing overrides
  customPricing?: CustomPricingEntry[];

  // Raw API capture
  captureRawApiData?: boolean;

  // Feature 32: Auto-generate titles
  autoGenerateTitles?: boolean;
  titleGenerationModel?: string;

  // Feature 06: Research defaults
  researchTreeSearchPrompt?: string;
  researchWebSearchPrompt?: string;
  researchDefaultPlannerModelId?: string;
  researchDefaultPlannerProviderId?: string;
  researchDefaultSubAgentModelId?: string;
  researchDefaultSubAgentProviderId?: string;
  researchMaxSubTasks?: number;
  researchMaxToolCallsPerSubAgent?: number;
  researchMaxTotalToolCalls?: number;
  researchIncrementalInterval?: number;

  // Feature 39: Reasoning injection
  reasoningInjectionPlaintextPrefix?: string;
  reasoningInjectionPlaintextSuffix?: string;

  // Feature 40: Reasoning effort for OpenAI/Azure reasoning models
  reasoningEffort?: 'low' | 'medium' | 'high';

  // ADR-022: Tool call history reconstruction — plaintext fallback settings
  toolCallPlaintextPrefix?: string;    // Default: '[Tool use: '
  toolCallPlaintextSuffix?: string;    // Default: ']'
  toolCallResultMaxLength?: number;    // Default: 500
}

// Feature 06: Research types
export type {
  ResearchMode,
  ResearchStatus,
  SubTaskStatus,
  ProcessNodeType,
  FindingRelevance,
  ResearchConfig,
  ResearchSubTask,
  ResearchPlan,
  ResearchProcessNode,
  ResearchRun,
} from './research';
