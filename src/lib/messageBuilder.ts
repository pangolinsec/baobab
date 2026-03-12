import type { TreeNode, ThinkingBlock } from '../types';
import type { ToolCallRecord, ToolDefinition } from '../api/providers/types';
import { useSettingsStore } from '../store/useSettingsStore';
import { getToolDefinitionsForNames } from '../api/tools';

export interface MessageWithThinking {
  role: 'user' | 'assistant';
  content: string;
  thinkingBlocks?: ThinkingBlock[];
  toolCalls?: ToolCallRecord[];
  messageType?: 'tool_invocations' | 'tool_results';
}

export interface BuildMessagesResult {
  messages: MessageWithThinking[];
  historicalToolDefs: ToolDefinition[];
}

/**
 * Expand an assistant node's tool calls into a multi-message sequence.
 *
 * For providers that support tools: produces 2N+1 messages for N tool rounds
 *   (assistant invocations → user results) pairs, then the final text message.
 * For providers that don't support tools: prepends a text summary to the
 *   base message content (analogous to plaintext thinking block injection).
 */
function expandToolCallMessages(
  node: TreeNode,
  supportsToolUse: boolean,
  baseMsg: MessageWithThinking,
): MessageWithThinking[] {
  if (!node.toolCalls || node.toolCalls.length === 0) {
    return [baseMsg];
  }

  if (!supportsToolUse) {
    // Text fallback for non-tool providers
    const {
      toolCallPlaintextPrefix,
      toolCallPlaintextSuffix,
      toolCallResultMaxLength,
    } = useSettingsStore.getState();

    const prefix = toolCallPlaintextPrefix ?? '[Tool use: ';
    const suffix = toolCallPlaintextSuffix ?? ']';
    const maxLen = toolCallResultMaxLength ?? 500;

    const summaries = node.toolCalls.map(tc => {
      const inputStr = JSON.stringify(tc.input);
      const resultStr = tc.result
        ? (tc.result.length > maxLen ? tc.result.slice(0, maxLen) + '…' : tc.result)
        : '';
      return `${prefix}${tc.toolName}(${inputStr}) → "${resultStr}"${suffix}`;
    });

    return [{
      ...baseMsg,
      content: summaries.join('\n') + '\n\n' + baseMsg.content,
    }];
  }

  // Group tool calls by round, sort ascending
  const byRound = new Map<number, ToolCallRecord[]>();
  for (const tc of node.toolCalls) {
    const round = tc.round ?? 0;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round)!.push(tc);
  }

  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const expanded: MessageWithThinking[] = [];

  for (const round of rounds) {
    const calls = byRound.get(round)!;
    // Assistant message with tool invocations
    expanded.push({
      role: 'assistant',
      content: '',
      toolCalls: calls,
      messageType: 'tool_invocations',
    });
    // User message with tool results
    expanded.push({
      role: 'user',
      content: '',
      toolCalls: calls,
      messageType: 'tool_results',
    });
  }

  // Final message: only if there's actual content or thinking blocks to send
  if (baseMsg.content || baseMsg.thinkingBlocks?.length) {
    expanded.push(baseMsg);
  }

  return expanded;
}

/**
 * Build the messages array for an API call, expanding tool call history
 * and attaching thinking blocks from the node path.
 *
 * Returns both the messages and any tool definitions needed for historical
 * tool calls in the path.
 */
export function buildMessages(
  path: TreeNode[],
  activeProviderId: string,
  supportsToolUse: boolean,
): BuildMessagesResult {
  const {
    reasoningInjectionPlaintextPrefix,
    reasoningInjectionPlaintextSuffix,
  } = useSettingsStore.getState();

  const prefix = reasoningInjectionPlaintextPrefix ?? '[Prior reasoning: ';
  const suffix = reasoningInjectionPlaintextSuffix ?? ']';

  // Track tool names used in the path for historical tool definitions
  const historicalToolNames = new Set<string>();

  const messages = path
    .filter((n) => (n.content || n.toolCalls?.length) && !(n.parentId === null && n.role === 'assistant'))
    .flatMap((n) => {
      const msg: MessageWithThinking = { role: n.role, content: n.content };

      if (n.role === 'assistant' && n.thinkingBlocks?.length) {
        const nativeBlocks: ThinkingBlock[] = [];
        const plaintextParts: string[] = [];

        for (const block of n.thinkingBlocks) {
          if (!block.active) continue;
          // Native: Anthropic blocks with signature, or OpenAI/Azure blocks with encryptedContent
          const isNativeAnthropic = block.providerId === 'anthropic' && block.signature && activeProviderId === 'anthropic';
          const isNativeOpenAI = (block.providerId === 'openai' || block.providerId === 'azure')
            && block.encryptedContent
            && (activeProviderId === 'openai' || activeProviderId === 'azure');
          if (isNativeAnthropic || isNativeOpenAI) {
            nativeBlocks.push(block);
          } else if (block.plaintextEnabled) {
            plaintextParts.push(`${prefix}${block.text}${suffix}`);
          }
        }

        if (nativeBlocks.length > 0) {
          msg.thinkingBlocks = nativeBlocks;
        }

        if (plaintextParts.length > 0) {
          msg.content = plaintextParts.join('\n') + '\n\n' + msg.content;
        }
      }

      // Expand tool calls for assistant nodes
      if (n.role === 'assistant' && n.toolCalls?.length) {
        for (const tc of n.toolCalls) {
          historicalToolNames.add(tc.toolName);
        }
        return expandToolCallMessages(n, supportsToolUse, msg);
      }

      return [msg];
    });

  const historicalToolDefs = getToolDefinitionsForNames(historicalToolNames);

  return { messages, historicalToolDefs };
}

/** @deprecated Use buildMessages instead */
export function buildMessagesWithThinkingBlocks(
  path: TreeNode[],
  activeProviderId: string,
): MessageWithThinking[] {
  return buildMessages(path, activeProviderId, false).messages;
}
