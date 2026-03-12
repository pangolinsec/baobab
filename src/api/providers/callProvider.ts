import { useSettingsStore } from '../../store/useSettingsStore';
import { getProvider } from './registry';
import type { ProviderConfig, ProviderSendParams, ToolDefinition, ProviderToolUseBlock } from './types';
import type { TokenUsage } from '../../types';

export interface CallProviderResult {
  text: string;
  tokenUsage?: TokenUsage;
  toolUseBlocks?: ProviderToolUseBlock[];
  error?: unknown;
}

export async function callProvider(
  providerId: string,
  model: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string | undefined,
  signal: AbortSignal,
  options?: {
    onToken?: (text: string) => void;
    tools?: ToolDefinition[];
    returnToolUseBlocks?: boolean;
  },
): Promise<CallProviderResult> {
  const providers = useSettingsStore.getState().providers;
  const provider = getProvider(providerId);
  const providerConfig = providers.find(p => p.id === providerId);

  if (!provider || !providerConfig?.enabled) {
    throw new Error(`Provider "${providerId}" not available`);
  }

  return new Promise((resolve) => {
    provider.sendMessage(providerConfig as ProviderConfig, {
      model,
      messages,
      systemPrompt,
      signal,
      tools: options?.tools,
      // Do NOT pass onToolCall — provider returns tool_use blocks in onComplete metadata
      onToken: (text) => options?.onToken?.(text),
      onComplete: (fullText, tokenUsage, metadata) => {
        resolve({
          text: fullText,
          tokenUsage,
          toolUseBlocks: metadata?.toolUseBlocks,
        });
      },
      onError: (error) => {
        resolve({ text: '', error });
      },
    } as ProviderSendParams);
  });
}
