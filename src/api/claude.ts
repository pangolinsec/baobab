import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '../types';

let client: Anthropic | null = null;

export function getClient(apiKey: string): Anthropic {
  if (!client || (client as any).apiKey !== apiKey) {
    client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
  return client;
}

export interface ModelInfo {
  id: string;
  displayName: string;
}

export async function fetchModels(apiKey: string): Promise<ModelInfo[]> {
  const anthropic = getClient(apiKey);
  const response = await anthropic.models.list({ limit: 100 });
  const models: ModelInfo[] = [];

  for (const model of response.data) {
    // Only include Claude chat models, skip embedding/legacy
    if (model.id.startsWith('claude-')) {
      models.push({
        id: model.id,
        displayName: model.display_name,
      });
    }
  }

  // Sort: haiku first (default), then sonnet, then opus
  const tierOrder = (id: string) => {
    if (id.includes('haiku')) return 0;
    if (id.includes('sonnet')) return 1;
    if (id.includes('opus')) return 2;
    return 3;
  };
  models.sort((a, b) => tierOrder(a.id) - tierOrder(b.id) || b.id.localeCompare(a.id));

  return models;
}

export interface SendMessageParams {
  apiKey: string;
  model: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  systemPrompt?: string;
  onToken: (text: string) => void;
  onComplete: (fullText: string, tokenUsage?: TokenUsage) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
  // Advanced config
  thinkingEnabled?: boolean;
  thinkingBudget?: number;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number | null;
  topK?: number | null;
  onThinkingComplete?: (thinking: string) => void;
}

export async function sendMessage({
  apiKey,
  model,
  messages,
  systemPrompt,
  onToken,
  onComplete,
  onError,
  signal,
  thinkingEnabled,
  thinkingBudget = 10000,
  temperature = 1.0,
  maxOutputTokens = 8192,
  topP,
  topK,
  onThinkingComplete,
}: SendMessageParams): Promise<void> {
  try {
    const anthropic = getClient(apiKey);
    let fullText = '';

    // Build request params dynamically
    const params: Record<string, unknown> = {
      model,
      max_tokens: maxOutputTokens,
      system: systemPrompt || undefined,
      messages,
    };

    if (thinkingEnabled) {
      // Thinking is incompatible with temperature and top_k
      params.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
      // Do NOT set temperature or top_k when thinking is enabled
      // top_p can be set between 0.95-1 if needed
      if (topP !== null && topP !== undefined) {
        params.top_p = topP;
      }
    } else {
      // Only pass temperature if not default
      if (temperature !== 1.0) {
        params.temperature = temperature;
      }
      if (topP !== null && topP !== undefined) {
        params.top_p = topP;
      }
      if (topK !== null && topK !== undefined) {
        params.top_k = topK;
      }
    }

    const stream = anthropic.messages.stream(params as any);

    if (signal) {
      signal.addEventListener('abort', () => {
        stream.abort();
      });
    }

    stream.on('text', (text) => {
      fullText += text;
      onToken(fullText);
    });

    const finalMessage = await stream.finalMessage();

    // Extract thinking content from response
    let thinkingText = '';
    fullText = '';

    for (const block of finalMessage.content) {
      if (block.type === 'thinking') {
        thinkingText += (block as any).thinking;
      } else if (block.type === 'text') {
        fullText += (block as Anthropic.TextBlock).text;
      }
    }

    if (thinkingText && onThinkingComplete) {
      onThinkingComplete(thinkingText);
    }

    const tokenUsage: TokenUsage = {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    };

    onComplete(fullText, tokenUsage);
  } catch (error: any) {
    if (error?.name === 'AbortError' || signal?.aborted) return;
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
