export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  azureModels?: import('../../types').AzureModelEntry[];
}

export interface ProviderModelInfo {
  id: string;
  displayName: string;
  providerId: string;
}

import type { TokenUsage } from '../../types';
import type { LivePricingEntry } from '../../lib/pricing';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCallRecord {
  id: string;              // correlation UUID (provider-neutral)
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  searchProvider?: string;
  round: number;           // 0-indexed tool-loop iteration
}

export interface ProviderToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderResponseMetadata {
  toolUseBlocks?: ProviderToolUseBlock[];
}

export interface RawApiCaptureData {
  request: { url: string; method: string; body: Record<string, unknown> };
  response: { statusCode?: number; headers?: Record<string, string>; body?: unknown };
}

export interface ProviderSendParams {
  model: string;
  messages: { role: 'user' | 'assistant'; content: string; thinkingBlocks?: import('../../types').ThinkingBlock[]; toolCalls?: ToolCallRecord[]; messageType?: 'tool_invocations' | 'tool_results' }[];
  systemPrompt?: string;
  onToken: (text: string) => void;
  onComplete: (fullText: string, tokenUsage?: TokenUsage, metadata?: ProviderResponseMetadata) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
  thinkingEnabled?: boolean;
  thinkingBudget?: number;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number | null;
  topK?: number | null;
  onThinkingComplete?: (thinking: string | { text: string; signature?: string; encryptedContent?: string; apiItemId?: string; apiSummary?: unknown }) => void;
  tools?: ToolDefinition[];
  onToolCall?: (toolName: string, input: Record<string, unknown>) => Promise<string>;
  onToolCallsComplete?: (toolCalls: ToolCallRecord[]) => void;
  reasoningEffort?: 'low' | 'medium' | 'high';
  captureRawApiData?: boolean;
  onRawApiData?: (data: RawApiCaptureData) => void;
}

export function filterResponseHeaders(headers: Headers): Record<string, string> {
  const deny = ['set-cookie', 'authorization', 'x-api-key', 'cookie'];
  const filtered: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!deny.includes(key.toLowerCase())) filtered[key] = value;
  });
  return filtered;
}

export interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean;
  supportsToolUse: boolean;

  /** Validate the API key and return true if valid */
  validateKey(config: ProviderConfig): Promise<boolean>;

  /** Fetch available models for this provider */
  fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]>;

  /** Send a message and stream the response */
  sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void>;

  /** Fetch live pricing data for this provider's models */
  fetchPricing?(config: ProviderConfig): Promise<LivePricingEntry[]>;
}
