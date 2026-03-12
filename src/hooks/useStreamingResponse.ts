import { useCallback } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { getProvider, findProviderForModel } from '../api/providers/registry';
import { getPathToRoot, resolveModel, resolveSystemPrompt, resolveProviderCascade } from '../lib/tree';
import { buildMessages } from '../lib/messageBuilder';
import type { TreeNode, TokenUsage, ThinkingBlock } from '../types';
import type { ProviderConfig, ToolDefinition, ToolCallRecord, RawApiCaptureData } from '../api/providers/types';
import type { MessageWithThinking } from '../lib/messageBuilder';
import { webSearchTool, createToolExecutor, readFileTool, createReadFileExecutor } from '../api/tools';
import { resolveFileReferences, extractFileReferences, buildFileIndex, hasFileReferences } from '../lib/fileReferences';
import { fetchFileText } from '../api/backend';
import type { Conversation } from '../types';
import { useProjectStore } from '../store/useProjectStore';
import { fetchProjectFiles } from '../api/backend';
import type { ProjectFile } from '../types';

/**
 * Merge historical tool definitions with current-turn tools.
 * Current-turn definitions take precedence (by name). Returns undefined
 * if no definitions to include.
 */
function mergeToolDefinitions(
  historical: ToolDefinition[],
  current?: ToolDefinition[],
): ToolDefinition[] | undefined {
  if (historical.length === 0 && (!current || current.length === 0)) return current;
  const byName = new Map<string, ToolDefinition>();
  for (const def of historical) byName.set(def.name, def);
  if (current) {
    for (const def of current) byName.set(def.name, def); // current takes precedence
  }
  const merged = [...byName.values()];
  return merged.length > 0 ? merged : undefined;
}

interface SendOptions {
  modelOverride?: string;
  systemPromptOverride?: string;
  providerOverride?: string;
  persistModelOverride?: boolean;
  persistSystemPromptOverride?: boolean;
}

// Module-level abort controller so multiple consumers share the same state
let abortController: AbortController | null = null;
let thinkingBlocksBuffer: ThinkingBlock[] = [];
let toolCallBuffer: ToolCallRecord[] = [];
let rawApiDataBuffer: RawApiCaptureData | null = null;

/**
 * Determine which provider to use for a given request.
 * Priority: per-message override → node cascade → conversation → settings default
 */
function resolveProvider(
  options?: SendOptions,
  conversationProviderId?: string,
  defaultProvider?: string
): string {
  if (options?.providerOverride) return options.providerOverride;
  if (conversationProviderId) return conversationProviderId;
  return defaultProvider || 'anthropic';
}

interface DispatchParams {
  providerId: string;
  model: string;
  messages: MessageWithThinking[];
  systemPrompt: string | undefined;
  assistantNodeId: string;
  userMessage?: string; // for auto-titling on first message
  tools?: ToolDefinition[];
  onToolCall?: (toolName: string, input: Record<string, unknown>) => Promise<string>;
  searchProvider?: string;
}

/**
 * Shared dispatch logic: route to provider.sendMessage() if possible,
 * else fall back to legacy Anthropic SDK.
 */
async function dispatchToProvider(params: DispatchParams) {
  const {
    providerId,
    model,
    messages,
    systemPrompt,
    assistantNodeId,
    userMessage,
    tools,
    onToolCall,
    searchProvider,
  } = params;

  const {
    thinkingEnabled,
    thinkingBudget,
    temperature,
    maxOutputTokens,
    topP,
    topK,
    providers,
    captureRawApiData,
    reasoningEffort,
  } = useSettingsStore.getState();

  const {
    updateNodeContent,
    finalizeNode,
    updateNodeRawApiData,
    selectNode,
  } = useTreeStore.getState();

  const provider = getProvider(providerId);
  const providerConfig = providers.find(p => p.id === providerId);

  const abort = new AbortController();
  abortController = abort;
  thinkingBlocksBuffer = [];
  toolCallBuffer = [];
  rawApiDataBuffer = null;

  const callbacks = {
    onToken: (text: string) => {
      updateNodeContent(assistantNodeId, text);
    },
    onThinkingComplete: (thinking: string | { text: string; signature?: string; encryptedContent?: string; apiItemId?: string; apiSummary?: unknown }) => {
      const block: ThinkingBlock = typeof thinking === 'string'
        ? {
            id: crypto.randomUUID(),
            text: thinking,
            providerId,
            isOriginal: true,
            plaintextEnabled: false,
            active: true,
          }
        : {
            id: crypto.randomUUID(),
            text: thinking.text,
            providerId,
            signature: thinking.signature,
            encryptedContent: thinking.encryptedContent,
            apiItemId: thinking.apiItemId,
            apiSummary: thinking.apiSummary,
            isOriginal: true,
            plaintextEnabled: false,
            active: true,
          };
      thinkingBlocksBuffer = [block];
    },
    onToolCallsComplete: (toolCalls: ToolCallRecord[]) => {
      toolCallBuffer = searchProvider
        ? toolCalls.map(tc => tc.toolName === 'web_search' ? { ...tc, searchProvider } : tc)
        : toolCalls;
    },
    onComplete: async (fullText: string, tokenUsage?: TokenUsage) => {
      await finalizeNode(
        assistantNodeId, fullText,
        thinkingBlocksBuffer.length > 0 ? thinkingBlocksBuffer : undefined,
        tokenUsage,
        toolCallBuffer.length > 0 ? toolCallBuffer : undefined
      );

      // Store raw API data if captured
      if (rawApiDataBuffer && captureRawApiData) {
        const provName = providerConfig?.name || providerId;
        await updateNodeRawApiData(assistantNodeId, {
          rawApiRequest: {
            url: rawApiDataBuffer.request.url,
            method: rawApiDataBuffer.request.method,
            body: rawApiDataBuffer.request.body,
            providerId,
            providerName: provName,
            timestamp: Date.now(),
          },
          rawApiResponse: {
            statusCode: rawApiDataBuffer.response.statusCode,
            headers: rawApiDataBuffer.response.headers,
            body: rawApiDataBuffer.response.body,
            providerId,
            timestamp: Date.now(),
          },
        });
      }

      selectNode(assistantNodeId);
      abortController = null;
      thinkingBlocksBuffer = [];
      toolCallBuffer = [];
      rawApiDataBuffer = null;

      if (userMessage) {
        const conv = useTreeStore.getState().currentConversation;
        if (conv && conv.title === 'New Conversation') {
          const truncatedTitle = userMessage.slice(0, 50) + (userMessage.length > 50 ? '…' : '');
          useTreeStore.getState().updateConversationTitle(conv.id, truncatedTitle);

          // Feature 32: Auto-generate LLM title if enabled
          const { autoGenerateTitles, titleGenerationModel } = useSettingsStore.getState();
          if (autoGenerateTitles) {
            import('../lib/generateTitle').then(({ generateTitle }) => {
              generateTitle(
                conv.id,
                userMessage,
                fullText,
                titleGenerationModel || model,
                truncatedTitle,
              );
            });
          }
        }
      }
    },
    onError: async (error: Error) => {
      await finalizeNode(assistantNodeId, `Error: ${error.message}`);
      abortController = null;
      thinkingBlocksBuffer = [];
      toolCallBuffer = [];
      rawApiDataBuffer = null;
    },
    signal: abort.signal,
  };

  // Use provider if available, enabled, and properly configured
  const providerHasValidConfig = provider && providerConfig && providerConfig.enabled && (
    !provider.requiresApiKey || providerConfig.apiKey
  );

  if (providerHasValidConfig) {
    await provider.sendMessage(providerConfig as ProviderConfig, {
      model,
      messages,
      systemPrompt,
      thinkingEnabled,
      thinkingBudget,
      temperature,
      maxOutputTokens,
      topP,
      topK,
      reasoningEffort,
      tools,
      onToolCall,
      captureRawApiData: captureRawApiData || false,
      onRawApiData: (data) => { rawApiDataBuffer = data; },
      ...callbacks,
    });
  } else {
    // No valid provider — show error
    const anyEnabled = providers.some(p => p.enabled);
    const errorMsg = !anyEnabled
      ? 'Error: No provider enabled. Please enable a provider in Settings.'
      : `Error: Provider "${providerId}" is not properly configured. Check its API key in Settings.`;
    await finalizeNode(assistantNodeId, errorMsg);
    abortController = null;
    thinkingBlocksBuffer = [];
  }
}

/**
 * Build tools and onToolCall if web search is enabled for the conversation
 * and the provider supports tool use.
 */
function resolveToolsForConversation(
  conv: { webSearchEnabled?: boolean; searchProvider?: string } | null,
  providerId: string,
  projectFiles?: ProjectFile[],
  knowledgeMode?: string,
): { tools?: ToolDefinition[]; onToolCall?: (name: string, input: Record<string, unknown>) => Promise<string>; searchProvider?: string } {
  const provider = getProvider(providerId);
  const supportsTools = provider?.supportsToolUse ?? false;

  const tools: ToolDefinition[] = [];
  const executors: Array<(name: string, input: Record<string, unknown>) => Promise<string>> = [];
  let searchProvider: string | undefined;

  // Web search tool
  if (conv?.webSearchEnabled && supportsTools) {
    const { defaultSearchProvider, tavilyApiKey, bingApiKey } = useSettingsStore.getState();
    searchProvider = conv.searchProvider || defaultSearchProvider || 'duckduckgo';
    let searchApiKey: string | undefined;
    if (searchProvider === 'tavily') searchApiKey = tavilyApiKey;
    else if (searchProvider === 'bing') searchApiKey = bingApiKey;
    tools.push(webSearchTool);
    executors.push(createToolExecutor(searchProvider, searchApiKey));
  }

  // Agentic file access tool
  if (knowledgeMode === 'agentic' && supportsTools && projectFiles && projectFiles.length > 0) {
    tools.push(readFileTool);
    executors.push(createReadFileExecutor(projectFiles));
  }

  if (tools.length === 0) return {};

  // Combine executors into a single onToolCall
  const onToolCall = async (name: string, input: Record<string, unknown>): Promise<string> => {
    for (const exec of executors) {
      const result = await exec(name, input);
      if (!result.startsWith('Unknown tool:')) return result;
    }
    return `Unknown tool: ${name}`;
  };

  return { tools, onToolCall, searchProvider };
}

/**
 * Fetch project files, using the store cache when available.
 */
async function resolveProjectFiles(projectId?: string): Promise<ProjectFile[]> {
  if (!projectId) return [];
  const cached = useProjectStore.getState().getProjectFiles(projectId);
  if (cached.length > 0) return cached;
  // Cache miss — fetch from backend
  try {
    const files = await fetchProjectFiles(projectId);
    return files;
  } catch {
    return [];
  }
}

/**
 * Walk through messages and resolve @file references in user messages.
 * Pre-scans all messages for unique filenames and batch-fetches their text
 * once, then passes a shared cache to each resolveFileReferences call.
 * Mutates the messages array in place.
 */
async function resolveMessagesFileReferences(
  messages: { role: string; content: string }[],
  files: ProjectFile[],
): Promise<void> {
  // Pre-scan: collect unique filenames across all user messages
  const allFilenames = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'user' && hasFileReferences(msg.content)) {
      for (const fn of extractFileReferences(msg.content)) {
        allFilenames.add(fn.toLowerCase());
      }
    }
  }
  if (allFilenames.size === 0) return;

  // Build filename -> file lookup
  const fileMap = new Map<string, ProjectFile>();
  for (const f of files) {
    fileMap.set(f.filename.toLowerCase(), f);
  }

  // Batch-fetch all unique file texts once
  const sharedTextCache = new Map<string, string>();
  await Promise.all(
    [...allFilenames].map(async (filenameLower) => {
      const file = fileMap.get(filenameLower);
      if (!file) return;
      try {
        const data = await fetchFileText(file.id);
        sharedTextCache.set(filenameLower, data.extractedText || '');
      } catch {
        // Will show as "not found" in resolveFileReferences
      }
    })
  );

  // Resolve each message using the shared cache
  for (const msg of messages) {
    if (msg.role === 'user' && hasFileReferences(msg.content)) {
      msg.content = await resolveFileReferences(msg.content, files, sharedTextCache);
    }
  }
}

/**
 * Resolve all knowledge context for a conversation: project files,
 * @file references, agentic system prompt augmentation, and tools.
 */
async function resolveKnowledgeContext(
  conv: Conversation,
  messages: { role: string; content: string }[],
  systemPrompt: string | undefined,
  providerId: string,
  project?: { injectDescription?: boolean; description?: string; knowledgeMode?: string },
): Promise<{ finalSystemPrompt: string | undefined; tools?: ToolDefinition[]; onToolCall?: (name: string, input: Record<string, unknown>) => Promise<string>; searchProvider?: string }> {
  const projectFiles = await resolveProjectFiles(conv.projectId);

  // Gate @file resolution on knowledgeMode (now lives on the project)
  const km = project?.knowledgeMode;
  if (projectFiles.length > 0 && (km === 'direct' || km === 'agentic')) {
    await resolveMessagesFileReferences(messages, projectFiles);
  }

  // Inject project description before system prompt if enabled
  let finalSystemPrompt = systemPrompt;
  if (project?.injectDescription && project.description?.trim()) {
    const descBlock = `This is the description of the project you are working in:\n${project.description}`;
    finalSystemPrompt = finalSystemPrompt
      ? `${descBlock}\n\n${finalSystemPrompt}`
      : descBlock;
  }
  if (km === 'agentic' && projectFiles.length > 0) {
    const fileIndex = buildFileIndex(projectFiles);
    finalSystemPrompt = finalSystemPrompt
      ? `${finalSystemPrompt}\n\n${fileIndex}`
      : fileIndex;
  }

  const { tools, onToolCall, searchProvider } = resolveToolsForConversation(conv, providerId, projectFiles, km);
  return { finalSystemPrompt, tools, onToolCall, searchProvider };
}

export function useStreamingResponse() {
  const send = useCallback(async (userMessage: string, options?: SendOptions) => {
    const {
      nodes,
      replyTargetNodeId,
      currentConversation,
      addNode,
      setStreaming,
    } = useTreeStore.getState();

    const {
      defaultModel,
      availableModels,
      defaultSystemPrompt,
      defaultProvider,
      providers: providerConfigs,
    } = useSettingsStore.getState();

    if (!currentConversation || !replyTargetNodeId) return;

    // Lookup project for system prompt cascade and description injection
    const project = currentConversation.projectId
      ? useProjectStore.getState().getProject(currentConversation.projectId)
      : undefined;

    // Cascade model resolution
    const resolved = options?.modelOverride
      ? { model: options.modelOverride, providerId: '' }
      : resolveModel(
          replyTargetNodeId,
          nodes,
          currentConversation.model,
          defaultModel,
          availableModels,
          currentConversation.providerId,
          defaultProvider
        );
    const model = resolved.model;

    // Resolve provider: explicit override > derive from model > cascade fallback
    const providerId = options?.providerOverride
      || findProviderForModel(model, providerConfigs)
      || resolveProvider(options, currentConversation.providerId, defaultProvider);

    // Cascade system prompt resolution
    const systemPrompt = options?.systemPromptOverride !== undefined
      ? (options.systemPromptOverride || undefined)
      : resolveSystemPrompt(
          replyTargetNodeId,
          nodes,
          currentConversation.systemPrompt,
          defaultSystemPrompt,
          project?.systemPrompt
        );

    // Create user node
    const userNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId: replyTargetNodeId,
      role: 'user',
      content: userMessage,
      model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
      providerId,
      ...(options?.persistModelOverride && options?.modelOverride
        ? { modelOverride: options.modelOverride }
        : {}),
      ...(options?.persistSystemPromptOverride && options?.systemPromptOverride !== undefined
        ? { systemPromptOverride: options.systemPromptOverride }
        : {}),
      ...(options?.systemPromptOverride !== undefined && !options?.persistSystemPromptOverride
        ? { usedSystemPrompt: options.systemPromptOverride }
        : {}),
    };
    await addNode(userNode);

    // Create placeholder assistant node
    const assistantNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId: userNode.id,
      role: 'assistant',
      content: '',
      model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
      providerId,
    };
    await addNode(assistantNode);

    setStreaming(assistantNode.id);

    // Build message path from root to user node, with thinking block + tool call injection
    const updatedNodes = useTreeStore.getState().nodes;
    const path = getPathToRoot(userNode.id, updatedNodes);
    const provider = getProvider(providerId);
    const supportsToolUse = provider?.supportsToolUse ?? false;
    const { messages, historicalToolDefs } = buildMessages(path, providerId, supportsToolUse);

    // Feature 13: Resolve knowledge context (project files, @mentions, tools)
    const { finalSystemPrompt, tools, onToolCall, searchProvider } =
      await resolveKnowledgeContext(currentConversation, messages, systemPrompt, providerId, project);

    // Merge historical tool defs with current-turn tools (current takes precedence)
    const mergedTools = mergeToolDefinitions(historicalToolDefs, tools);

    await dispatchToProvider({
      providerId,
      model,
      messages,
      systemPrompt: finalSystemPrompt,
      assistantNodeId: assistantNode.id,
      userMessage,
      tools: mergedTools,
      onToolCall,
      searchProvider,
    });
  }, []);

  const resend = useCallback(async (userNodeId: string, options?: SendOptions) => {
    const {
      nodes,
      currentConversation,
      addNode,
      setStreaming,
      setNodeModelOverride,
      setNodeSystemPromptOverride,
    } = useTreeStore.getState();

    const {
      defaultModel,
      availableModels,
      defaultSystemPrompt,
      defaultProvider,
      allProviderModels,
    } = useSettingsStore.getState();

    const userNode = nodes[userNodeId];
    if (!currentConversation || !userNode || userNode.role !== 'user') return;

    // Lookup project for system prompt cascade and description injection
    const project = currentConversation.projectId
      ? useProjectStore.getState().getProject(currentConversation.projectId)
      : undefined;

    // Model: use override if provided, else cascade
    const model = options?.modelOverride
      ? options.modelOverride
      : resolveModel(
          userNodeId,
          nodes,
          currentConversation.model,
          defaultModel,
          availableModels,
          currentConversation.providerId,
          defaultProvider
        ).model;

    // System prompt: use override if provided, else cascade
    const systemPrompt = options?.systemPromptOverride !== undefined
      ? (options.systemPromptOverride || undefined)
      : resolveSystemPrompt(
          userNodeId,
          nodes,
          currentConversation.systemPrompt,
          defaultSystemPrompt,
          project?.systemPrompt
        );

    // Provider: use override, else auto-resolve from model, else cascade
    let providerId: string;
    if (options?.providerOverride) {
      providerId = options.providerOverride;
    } else if (options?.modelOverride) {
      const providerModel = allProviderModels.find(m => m.id === options.modelOverride);
      providerId = providerModel?.providerId
        || resolveProviderCascade(userNodeId, nodes, currentConversation.providerId, defaultProvider);
    } else {
      providerId = resolveProviderCascade(
        userNodeId,
        nodes,
        currentConversation.providerId,
        defaultProvider
      );
    }

    // If persist flags are set, update the user node's cascade overrides
    if (options?.persistModelOverride && options?.modelOverride) {
      await setNodeModelOverride(userNodeId, options.modelOverride);
    }
    if (options?.persistSystemPromptOverride && options?.systemPromptOverride !== undefined) {
      await setNodeSystemPromptOverride(userNodeId, options.systemPromptOverride);
    }

    const assistantNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId: userNodeId,
      role: 'assistant',
      content: '',
      model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
      providerId,
    };
    await addNode(assistantNode);

    setStreaming(assistantNode.id);

    const updatedNodes = useTreeStore.getState().nodes;
    const path = getPathToRoot(userNodeId, updatedNodes);
    const resendProvider = getProvider(providerId);
    const resendSupportsToolUse = resendProvider?.supportsToolUse ?? false;
    const { messages, historicalToolDefs } = buildMessages(path, providerId, resendSupportsToolUse);

    // Feature 13: Resolve knowledge context (project files, @mentions, tools)
    const { finalSystemPrompt, tools, onToolCall, searchProvider } =
      await resolveKnowledgeContext(currentConversation, messages, systemPrompt, providerId, project);

    const mergedTools = mergeToolDefinitions(historicalToolDefs, tools);

    await dispatchToProvider({
      providerId,
      model,
      messages,
      systemPrompt: finalSystemPrompt,
      assistantNodeId: assistantNode.id,
      tools: mergedTools,
      onToolCall,
      searchProvider,
    });
  }, []);

  const retry = useCallback(async (errorNodeId: string) => {
    const {
      nodes,
      currentConversation,
      deleteSubtree,
      addNode,
      setStreaming,
    } = useTreeStore.getState();

    const {
      defaultModel,
      availableModels,
      defaultSystemPrompt,
      defaultProvider,
    } = useSettingsStore.getState();

    const errorNode = nodes[errorNodeId];
    if (!currentConversation || !errorNode || !errorNode.parentId) return;
    if (!errorNode.content.startsWith('Error: ')) return;

    // Lookup project for system prompt cascade and description injection
    const project = currentConversation.projectId
      ? useProjectStore.getState().getProject(currentConversation.projectId)
      : undefined;

    const parentId = errorNode.parentId;

    await deleteSubtree(errorNodeId);

    const updatedNodes = useTreeStore.getState().nodes;

    const { model } = resolveModel(
      parentId,
      updatedNodes,
      currentConversation.model,
      defaultModel,
      availableModels,
      currentConversation.providerId,
      defaultProvider
    );
    const systemPrompt = resolveSystemPrompt(
      parentId,
      updatedNodes,
      currentConversation.systemPrompt,
      defaultSystemPrompt,
      project?.systemPrompt
    );

    // Resolve provider from node cascade
    const providerId = resolveProviderCascade(
      parentId,
      updatedNodes,
      currentConversation.providerId,
      defaultProvider
    );

    const assistantNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId,
      role: 'assistant',
      content: '',
      model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
      providerId,
    };
    await addNode(assistantNode);

    setStreaming(assistantNode.id);

    const path = getPathToRoot(parentId, updatedNodes);
    const retryProvider = getProvider(providerId);
    const retrySupportsToolUse = retryProvider?.supportsToolUse ?? false;
    const { messages, historicalToolDefs } = buildMessages(path, providerId, retrySupportsToolUse);

    // Feature 13: Resolve knowledge context (project files, @mentions, tools)
    const { finalSystemPrompt, tools, onToolCall, searchProvider } =
      await resolveKnowledgeContext(currentConversation, messages, systemPrompt, providerId, project);

    const mergedTools = mergeToolDefinitions(historicalToolDefs, tools);

    await dispatchToProvider({
      providerId,
      model,
      messages,
      systemPrompt: finalSystemPrompt,
      assistantNodeId: assistantNode.id,
      tools: mergedTools,
      onToolCall,
      searchProvider,
    });
  }, []);

  const cancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
      const streamingNodeId = useTreeStore.getState().streamingNodeId;
      const blocks = thinkingBlocksBuffer.length > 0 ? thinkingBlocksBuffer : undefined;
      const toolCalls = toolCallBuffer.length > 0 ? toolCallBuffer : undefined;
      abortController = null;
      thinkingBlocksBuffer = [];
      toolCallBuffer = [];
      rawApiDataBuffer = null;
      if (streamingNodeId) {
        const content = useTreeStore.getState().nodes[streamingNodeId]?.content || '';
        useTreeStore.getState().finalizeNode(streamingNodeId, content, blocks, undefined, toolCalls);
      } else {
        useTreeStore.getState().setStreaming(null);
      }
    }
  }, []);

  return { send, resend, retry, cancel };
}
