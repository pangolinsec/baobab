import { create } from 'zustand';
import type { TreeNode, Conversation, TokenUsage, RawApiRequest, RawApiResponse, ThinkingBlock } from '../types';
import type { ToolCallRecord } from '../api/providers/types';
import { db } from '../db/database';

interface TreeState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  nodes: Record<string, TreeNode>;
  selectedNodeId: string | null;
  replyTargetNodeId: string | null;
  streamingNodeId: string | null;
  agentStreamingNodeId: string | null;
  isStreaming: boolean;
  prefillContent: string | null;
  viewMode: 'tree' | 'thread' | 'research';
  multiSelectIds: string[];
  reasoningClipboard: ThinkingBlock | null;

  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (title?: string, systemPrompt?: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  selectNode: (nodeId: string | null, browseOnly?: boolean) => void;
  setReplyTarget: (nodeId: string | null) => void;
  addNode: (node: TreeNode) => Promise<void>;
  updateNodeContent: (nodeId: string, content: string) => void;
  finalizeNode: (nodeId: string, content: string, thinkingBlocks?: ThinkingBlock[], tokenUsage?: TokenUsage, toolCalls?: ToolCallRecord[]) => Promise<void>;
  toggleCollapse: (nodeId: string) => Promise<void>;
  deleteSubtree: (nodeId: string) => Promise<void>;
  setStreaming: (nodeId: string | null) => void;
  setAgentStreaming: (nodeId: string | null) => void;
  setNodePosition: (nodeId: string, position: { x: number; y: number }) => Promise<void>;
  clearAllManualPositions: () => Promise<void>;
  clearPrefill: () => void;
  setNodeModelOverride: (nodeId: string, model: string | undefined) => Promise<void>;
  setNodeSystemPromptOverride: (nodeId: string, prompt: string | undefined) => Promise<void>;
  duplicateAndModifyAssistant: (nodeId: string, newContent: string, newThinkingBlocks?: ThinkingBlock[], newToolCalls?: ToolCallRecord[]) => Promise<void>;
  createManualNode: (parentId: string, content: string, thinkingBlocks?: ThinkingBlock[], toolCalls?: ToolCallRecord[]) => Promise<string>;

  // Feature 39: Reasoning block clipboard
  copyReasoningBlock: (nodeId: string, blockId: string) => void;
  pasteReasoningBlock: (targetNodeId: string) => Promise<void>;
  clearReasoningClipboard: () => void;
  removeReasoningBlock: (nodeId: string, blockId: string) => Promise<void>;
  toggleReasoningPlaintext: (nodeId: string, blockId: string) => Promise<void>;
  toggleReasoningActive: (nodeId: string, blockId: string) => Promise<void>;
  toggleReasoningInjectAtEnd: (nodeId: string, blockId: string) => Promise<void>;

  // In-place node editing
  editNodeContent: (nodeId: string, newContent: string) => Promise<void>;

  // Deep clone
  cloneBranch: (nodeId: string) => Promise<void>;
  clonePath: (nodeIdA: string, nodeIdB: string) => Promise<void>;
  prefillDuplicateUser: (nodeId: string) => void;
  setViewMode: (mode: 'tree' | 'thread' | 'research') => void;

  // Feature 11: Stars
  toggleStar: (nodeId: string) => Promise<void>;
  getStarredNodes: () => TreeNode[];

  // Feature 07: Provider override
  setNodeProviderOverride: (nodeId: string, providerId: string | undefined) => Promise<void>;

  // Feature 05: Web search per-conversation settings
  setWebSearchEnabled: (conversationId: string, enabled: boolean) => Promise<void>;
  setSearchProvider: (conversationId: string, provider: string) => Promise<void>;

  // Feature 12: Dead-ends
  toggleDeadEnd: (nodeId: string) => Promise<void>;
  setDeadEnd: (nodeId: string, deadEnd: boolean) => Promise<void>;

  // Feature 24: Tags
  addTag: (conversationId: string, tag: string) => Promise<void>;
  removeTag: (conversationId: string, tag: string) => Promise<void>;
  getAllTags: () => string[];

  // Feature 16: Multi-select & Merge
  toggleMultiSelect: (nodeId: string) => void;
  clearMultiSelect: () => void;
  mergeBranches: (nodeIdA: string, nodeIdB: string, options?: {
    prompt?: string;
    model?: string;
    mode?: 'summarize' | 'full-context';
  }) => Promise<void>;

  // Feature 15: Summarize Branch
  summarizeBranch: (nodeId: string, options?: { prompt?: string; model?: string; direction?: 'up' | 'down' }) => Promise<void>;

  // Raw API data capture
  updateNodeRawApiData: (nodeId: string, data: { rawApiRequest?: RawApiRequest; rawApiResponse?: RawApiResponse }) => Promise<void>;

  // Import conversation from exported JSON
  importConversation: (data: { conversation: Conversation; nodes: Record<string, TreeNode> }) => Promise<Conversation>;

  // Feature 13: Project knowledge
  setConversationProject: (conversationId: string, projectId: string | undefined) => Promise<void>;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  nodes: {},
  selectedNodeId: null,
  replyTargetNodeId: null,
  streamingNodeId: null,
  agentStreamingNodeId: null,
  isStreaming: false,
  prefillContent: null,
  viewMode: 'tree',
  multiSelectIds: [],
  reasoningClipboard: null,

  loadConversations: async () => {
    const conversations = await db.conversations
      .orderBy('updatedAt')
      .reverse()
      .toArray();
    set({ conversations });
  },

  loadConversation: async (id: string) => {
    const conversation = await db.conversations.get(id);
    if (!conversation) return;

    const nodeList = await db.nodes.where('conversationId').equals(id).toArray();
    const nodes: Record<string, TreeNode> = {};
    for (const node of nodeList) {
      nodes[node.id] = node;
    }

    const rootNode = nodeList.find(n => n.parentId === null);
    set({
      currentConversation: conversation,
      nodes,
      selectedNodeId: null,
      replyTargetNodeId: rootNode?.id || null,
      streamingNodeId: null,
      isStreaming: false,
      multiSelectIds: [],
    });
  },

  createConversation: async (title?: string, systemPrompt?: string) => {
    const { defaultModel } = await import('./useSettingsStore').then(m =>
      m.useSettingsStore.getState()
    );

    const rootNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: '',
      parentId: null,
      role: 'assistant',
      content: '',
      model: defaultModel,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
    };

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: title || 'New Conversation',
      rootNodeId: rootNode.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: defaultModel,
      systemPrompt,
      tags: [],
    };

    rootNode.conversationId = conversation.id;

    await db.conversations.add(conversation);
    await db.nodes.add(rootNode);

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversation: conversation,
      nodes: { [rootNode.id]: rootNode },
      selectedNodeId: null,
      replyTargetNodeId: rootNode.id,
      streamingNodeId: null,
      isStreaming: false,
    }));

    return conversation;
  },

  deleteConversation: async (id: string) => {
    await db.nodes.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);

    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const isCurrent = state.currentConversation?.id === id;
      return {
        conversations,
        currentConversation: isCurrent ? null : state.currentConversation,
        nodes: isCurrent ? {} : state.nodes,
        selectedNodeId: isCurrent ? null : state.selectedNodeId,
        replyTargetNodeId: isCurrent ? null : state.replyTargetNodeId,
      };
    });
  },

  updateConversationTitle: async (id: string, title: string) => {
    await db.conversations.update(id, { title, updatedAt: Date.now() });
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
      currentConversation:
        state.currentConversation?.id === id
          ? { ...state.currentConversation, title, updatedAt: Date.now() }
          : state.currentConversation,
    }));
  },

  selectNode: (nodeId: string | null, browseOnly?: boolean) => {
    set({ selectedNodeId: nodeId, multiSelectIds: [] });
    if (!browseOnly && nodeId) {
      const node = get().nodes[nodeId];
      if (node && node.role === 'assistant' && !node.content.startsWith('Error: ')) {
        set({ replyTargetNodeId: nodeId });
      }
    }
  },

  setReplyTarget: (nodeId: string | null) => {
    // Prevent setting error nodes as reply targets
    if (nodeId) {
      const node = get().nodes[nodeId];
      if (node && node.content.startsWith('Error: ')) return;
    }
    set({ replyTargetNodeId: nodeId });
  },

  addNode: async (node: TreeNode) => {
    await db.nodes.add(node);

    if (node.parentId) {
      const parent = get().nodes[node.parentId];
      if (parent) {
        const updatedParent = {
          ...parent,
          childIds: [...parent.childIds, node.id],
        };
        await db.nodes.update(parent.id, { childIds: updatedParent.childIds });

        set((state) => ({
          nodes: {
            ...state.nodes,
            [node.id]: node,
            [parent.id]: updatedParent,
          },
        }));
        return;
      }
    }

    set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    }));

    // Update conversation timestamp
    if (get().currentConversation) {
      const now = Date.now();
      await db.conversations.update(get().currentConversation!.id, { updatedAt: now });
      set((state) => ({
        currentConversation: state.currentConversation
          ? { ...state.currentConversation, updatedAt: now }
          : null,
      }));
    }
  },

  updateNodeContent: (nodeId: string, content: string) => {
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], content },
      },
    }));
  },

  finalizeNode: async (nodeId: string, content: string, thinkingBlocks?: ThinkingBlock[], tokenUsage?: TokenUsage, toolCalls?: ToolCallRecord[]) => {
    const updates: Partial<TreeNode> = { content };
    if (thinkingBlocks !== undefined && thinkingBlocks.length > 0) {
      updates.thinkingBlocks = thinkingBlocks;
    }
    if (tokenUsage !== undefined) {
      updates.tokenUsage = tokenUsage;
    }
    if (toolCalls !== undefined && toolCalls.length > 0) {
      updates.toolCalls = toolCalls;
    }
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], ...updates },
      },
      streamingNodeId: null,
      isStreaming: false,
    }));
    await db.nodes.update(nodeId, updates);
  },

  toggleCollapse: async (nodeId: string) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    const collapsed = !node.collapsed;
    await db.nodes.update(nodeId, { collapsed });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], collapsed },
      },
    }));
  },

  deleteSubtree: async (nodeId: string) => {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    // Collect all descendant IDs
    const toDelete: string[] = [];
    const queue = [nodeId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      toDelete.push(id);
      const n = nodes[id];
      if (n) queue.push(...n.childIds);
    }

    // Remove from parent's childIds
    if (node.parentId && nodes[node.parentId]) {
      const parent = nodes[node.parentId];
      const updatedChildIds = parent.childIds.filter((id) => id !== nodeId);
      await db.nodes.update(parent.id, { childIds: updatedChildIds });
    }

    // Delete all from Dexie
    await db.nodes.bulkDelete(toDelete);

    set((state) => {
      const newNodes = { ...state.nodes };
      for (const id of toDelete) {
        delete newNodes[id];
      }
      // Update parent
      if (node.parentId && newNodes[node.parentId]) {
        newNodes[node.parentId] = {
          ...newNodes[node.parentId],
          childIds: newNodes[node.parentId].childIds.filter((id) => id !== nodeId),
        };
      }
      return {
        nodes: newNodes,
        selectedNodeId:
          toDelete.includes(state.selectedNodeId || '') ? node.parentId : state.selectedNodeId,
        replyTargetNodeId:
          toDelete.includes(state.replyTargetNodeId || '') ? node.parentId : state.replyTargetNodeId,
      };
    });
  },

  setStreaming: (nodeId: string | null) => {
    set({
      streamingNodeId: nodeId,
      isStreaming: nodeId !== null,
    });
  },

  setAgentStreaming: (nodeId: string | null) => {
    set({ agentStreamingNodeId: nodeId });
  },

  setNodePosition: async (nodeId: string, position: { x: number; y: number }) => {
    await db.nodes.update(nodeId, { manualPosition: position });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], manualPosition: position },
      },
    }));
  },

  clearAllManualPositions: async () => {
    const state = get();
    const nodeIds = Object.keys(state.nodes);
    await Promise.all(
      nodeIds
        .filter((id) => state.nodes[id].manualPosition)
        .map((id) => db.nodes.update(id, { manualPosition: undefined }))
    );
    const clearedNodes = { ...state.nodes };
    for (const id of nodeIds) {
      if (clearedNodes[id].manualPosition) {
        clearedNodes[id] = { ...clearedNodes[id], manualPosition: undefined };
      }
    }
    set({ nodes: clearedNodes });
  },

  clearPrefill: () => {
    set({ prefillContent: null });
  },

  setNodeModelOverride: async (nodeId: string, modelOverride: string | undefined) => {
    await db.nodes.update(nodeId, { modelOverride });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], modelOverride },
      },
    }));
  },

  setNodeSystemPromptOverride: async (nodeId: string, systemPromptOverride: string | undefined) => {
    await db.nodes.update(nodeId, { systemPromptOverride });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], systemPromptOverride },
      },
    }));
  },

  setNodeProviderOverride: async (nodeId: string, providerOverride: string | undefined) => {
    await db.nodes.update(nodeId, { providerOverride });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], providerOverride },
      },
    }));
  },

  duplicateAndModifyAssistant: async (nodeId: string, newContent: string, newThinkingBlocks?: ThinkingBlock[], newToolCalls?: ToolCallRecord[]) => {
    const { nodes, currentConversation, addNode } = get();
    const node = nodes[nodeId];
    if (!node || node.role !== 'assistant' || !node.parentId || !currentConversation) return;

    const newNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId: node.parentId,
      role: 'assistant',
      content: newContent,
      model: node.model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: true,
      starred: false,
      deadEnd: false,
      // Copy metadata from source node
      providerId: node.providerId,
      modelOverride: node.modelOverride,
      systemPromptOverride: node.systemPromptOverride,
      providerOverride: node.providerOverride,
      usedSystemPrompt: node.usedSystemPrompt,
    };

    if (newThinkingBlocks && newThinkingBlocks.length > 0) {
      newNode.thinkingBlocks = newThinkingBlocks;
    }
    if (newToolCalls && newToolCalls.length > 0) {
      newNode.toolCalls = newToolCalls;
    }

    await addNode(newNode);
  },

  createManualNode: async (parentId: string, content: string, thinkingBlocks?: ThinkingBlock[], toolCalls?: ToolCallRecord[]) => {
    const { nodes, currentConversation, addNode, selectNode, setReplyTarget } = get();
    const parent = nodes[parentId];
    if (!parent || !currentConversation) return '';

    const role = parent.role === 'assistant' ? 'user' : 'assistant';

    const newNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId,
      role,
      content,
      model: parent.model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
      source: 'manual',
      providerId: parent.providerId,
      modelOverride: parent.modelOverride,
      providerOverride: parent.providerOverride,
    };

    if (thinkingBlocks && thinkingBlocks.length > 0) {
      newNode.thinkingBlocks = thinkingBlocks;
    }
    if (toolCalls && toolCalls.length > 0) {
      newNode.toolCalls = toolCalls;
    }

    await addNode(newNode);
    selectNode(newNode.id);
    setReplyTarget(newNode.id);

    return newNode.id;
  },

  prefillDuplicateUser: (nodeId: string) => {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node || node.role !== 'user' || !node.parentId) return;

    set({
      replyTargetNodeId: node.parentId,
      prefillContent: node.content,
    });
  },

  setViewMode: (mode: 'tree' | 'thread' | 'research') => {
    set({ viewMode: mode });
  },

  // Feature 11: Stars
  toggleStar: async (nodeId: string) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    const starred = !node.starred;
    await db.nodes.update(nodeId, { starred });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], starred },
      },
    }));
  },

  getStarredNodes: () => {
    const { nodes } = get();
    return Object.values(nodes).filter(n => n.starred);
  },

  // Feature 05: Web search per-conversation settings
  setWebSearchEnabled: async (conversationId: string, enabled: boolean) => {
    await db.conversations.update(conversationId, { webSearchEnabled: enabled });
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, webSearchEnabled: enabled } : c
      ),
      currentConversation:
        state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, webSearchEnabled: enabled }
          : state.currentConversation,
    }));
  },

  setSearchProvider: async (conversationId: string, provider: string) => {
    await db.conversations.update(conversationId, { searchProvider: provider });
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, searchProvider: provider } : c
      ),
      currentConversation:
        state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, searchProvider: provider }
          : state.currentConversation,
    }));
  },

  // Feature 12: Dead-ends
  toggleDeadEnd: async (nodeId: string) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    const deadEnd = !node.deadEnd;
    await db.nodes.update(nodeId, { deadEnd });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], deadEnd },
      },
    }));
  },

  setDeadEnd: async (nodeId: string, deadEnd: boolean) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    await db.nodes.update(nodeId, { deadEnd });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], deadEnd },
      },
    }));
  },

  // Feature 24: Tags
  addTag: async (conversationId: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;

    const conv = get().conversations.find(c => c.id === conversationId) || get().currentConversation;
    if (!conv || conv.id !== conversationId) return;
    if (conv.tags.includes(trimmed)) return;

    const newTags = [...conv.tags, trimmed];
    await db.conversations.update(conversationId, { tags: newTags });

    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, tags: newTags } : c
      ),
      currentConversation:
        state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, tags: newTags }
          : state.currentConversation,
    }));
  },

  removeTag: async (conversationId: string, tag: string) => {
    const conv = get().conversations.find(c => c.id === conversationId) || get().currentConversation;
    if (!conv || conv.id !== conversationId) return;

    const newTags = conv.tags.filter(t => t !== tag);
    await db.conversations.update(conversationId, { tags: newTags });

    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, tags: newTags } : c
      ),
      currentConversation:
        state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, tags: newTags }
          : state.currentConversation,
    }));
  },

  getAllTags: () => {
    const { conversations } = get();
    const tagSet = new Set<string>();
    for (const conv of conversations) {
      if (conv.tags) {
        for (const tag of conv.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  },

  // Feature 16: Multi-select
  toggleMultiSelect: (nodeId: string) => {
    const { multiSelectIds } = get();
    const idx = multiSelectIds.indexOf(nodeId);
    if (idx >= 0) {
      // Remove from selection
      set({ multiSelectIds: multiSelectIds.filter(id => id !== nodeId) });
    } else if (multiSelectIds.length < 2) {
      // Add (up to 2)
      set({ multiSelectIds: [...multiSelectIds, nodeId], selectedNodeId: null });
    } else {
      // Replace second selection
      set({ multiSelectIds: [multiSelectIds[0], nodeId], selectedNodeId: null });
    }
  },

  clearMultiSelect: () => {
    set({ multiSelectIds: [] });
  },

  // Feature 15: Summarize Branch
  summarizeBranch: async (nodeId: string, options?: { prompt?: string; model?: string; direction?: 'up' | 'down' }) => {
    const { nodes, currentConversation, addNode, setStreaming, updateNodeContent, finalizeNode, setReplyTarget } = get();
    const node = nodes[nodeId];
    if (!node || !currentConversation) return;

    const { collectBranchContent, formatBranchForSummary } = await import('../lib/summarize');
    const { sendMessage } = await import('../api/claude');
    const settingsStore = await import('./useSettingsStore').then(m => m.useSettingsStore.getState());

    const direction = options?.direction ?? 'up';
    const branch = collectBranchContent(nodeId, nodes, direction);
    const branchText = formatBranchForSummary(branch);
    const prompt = options?.prompt || settingsStore.summarizationPrompt || 'Summarize this conversation branch.';
    const model = options?.model || settingsStore.defaultModel;

    // Create synthetic user node (summary request)
    const userNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId: nodeId,
      role: 'user',
      content: `[Summary request] ${prompt}`,
      model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'summary',
      userModified: false,
      starred: false,
      deadEnd: false,
    };
    await addNode(userNode);

    // Create assistant placeholder
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
      nodeType: 'summary',
      userModified: false,
      starred: false,
      deadEnd: false,
    };
    await addNode(assistantNode);

    setStreaming(assistantNode.id);

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      {
        role: 'user',
        content: `Here is a conversation branch to summarize:\n\n${branchText}\n\n${prompt}`,
      },
    ];

    await sendMessage({
      apiKey: settingsStore.apiKey,
      model,
      messages,
      onToken: (text) => {
        updateNodeContent(assistantNode.id, text);
      },
      onComplete: async (fullText) => {
        await finalizeNode(assistantNode.id, fullText);
        setReplyTarget(assistantNode.id);
      },
      onError: async (error) => {
        await finalizeNode(assistantNode.id, `Error: ${error.message}`);
      },
    });
  },

  // Feature 16: Merge Branches
  mergeBranches: async (nodeIdA: string, nodeIdB: string, options?: {
    prompt?: string;
    model?: string;
    mode?: 'summarize' | 'full-context';
  }) => {
    const { nodes, currentConversation, addNode, setStreaming, updateNodeContent, finalizeNode, setReplyTarget } = get();
    if (!currentConversation) return;

    const { findCommonAncestor, collectBranchFromAncestor, buildMergeUserContent, buildMergePromptMessages } = await import('../lib/merge');
    const { sendMessage } = await import('../api/claude');
    const settingsStore = await import('./useSettingsStore').then(m => m.useSettingsStore.getState());

    const ancestorId = findCommonAncestor(nodeIdA, nodeIdB, nodes);
    if (!ancestorId) return;

    const mode = options?.mode || settingsStore.defaultMergeMode || 'summarize';
    const prompt = options?.prompt || settingsStore.mergePrompt || 'Synthesize the key insights from both branches.';
    const model = options?.model || settingsStore.defaultModel;

    const branchA = collectBranchFromAncestor(nodeIdA, ancestorId, nodes);
    const branchB = collectBranchFromAncestor(nodeIdB, ancestorId, nodes);

    const userContent = buildMergeUserContent(branchA, branchB, mode);

    // Create synthetic user node as child of common ancestor
    const userNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      parentId: ancestorId,
      role: 'user',
      content: userContent,
      model,
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'merge',
      userModified: false,
      starred: false,
      deadEnd: false,
      mergeSourceIds: [nodeIdA, nodeIdB],
      mergeMode: mode,
    };
    await addNode(userNode);

    // Create assistant placeholder
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
      nodeType: 'merge',
      userModified: false,
      starred: false,
      deadEnd: false,
      mergeSourceIds: [nodeIdA, nodeIdB],
      mergeMode: mode,
    };
    await addNode(assistantNode);

    setStreaming(assistantNode.id);

    const messages = buildMergePromptMessages(prompt, branchA, branchB);

    await sendMessage({
      apiKey: settingsStore.apiKey,
      model,
      messages,
      onToken: (text) => {
        updateNodeContent(assistantNode.id, text);
      },
      onComplete: async (fullText) => {
        await finalizeNode(assistantNode.id, fullText);
        setReplyTarget(assistantNode.id);
        set({ multiSelectIds: [] });
      },
      onError: async (error) => {
        await finalizeNode(assistantNode.id, `Error: ${error.message}`);
        set({ multiSelectIds: [] });
      },
    });
  },

  updateNodeRawApiData: async (nodeId: string, data: { rawApiRequest?: RawApiRequest; rawApiResponse?: RawApiResponse }) => {
    const updates: Partial<TreeNode> = {};
    if (data.rawApiRequest) updates.rawApiRequest = data.rawApiRequest;
    if (data.rawApiResponse) updates.rawApiResponse = data.rawApiResponse;
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], ...updates },
      },
    }));
    await db.nodes.update(nodeId, updates);
  },

  importConversation: async (data) => {
    const oldConv = data.conversation;
    const oldNodes = data.nodes;

    // Build ID remap: old ID -> new UUID
    const idMap = new Map<string, string>();
    idMap.set(oldConv.id, crypto.randomUUID());
    for (const oldId of Object.keys(oldNodes)) {
      idMap.set(oldId, crypto.randomUUID());
    }

    const newConvId = idMap.get(oldConv.id)!;

    // Create a new root node (silent root) for the imported conversation
    const rootNode: TreeNode = {
      id: crypto.randomUUID(),
      conversationId: newConvId,
      parentId: null,
      role: 'assistant',
      content: '',
      model: oldConv.model || '',
      createdAt: Date.now(),
      childIds: [],
      collapsed: false,
      nodeType: 'standard',
      userModified: false,
      starred: false,
      deadEnd: false,
    };

    // Remap all nodes with new IDs
    const newNodes: TreeNode[] = [];
    // Track which nodes were top-level (parentId null or parentId not in imported nodes)
    const topLevelNodeIds: string[] = [];

    for (const [oldId, oldNode] of Object.entries(oldNodes)) {
      const newId = idMap.get(oldId)!;
      const parentIsInImport = oldNode.parentId && idMap.has(oldNode.parentId);

      const newNode: TreeNode = {
        ...oldNode,
        id: newId,
        conversationId: newConvId,
        parentId: parentIsInImport ? idMap.get(oldNode.parentId!)! : rootNode.id,
        childIds: oldNode.childIds
          .map((cid: string) => idMap.get(cid))
          .filter((cid): cid is string => cid !== undefined),
        // Ensure V2+ fields have defaults
        nodeType: oldNode.nodeType || 'standard',
        userModified: oldNode.userModified ?? false,
        starred: oldNode.starred ?? false,
        deadEnd: oldNode.deadEnd ?? false,
      };

      if (!parentIsInImport) {
        topLevelNodeIds.push(newId);
      }

      newNodes.push(newNode);
    }

    // Wire top-level nodes as children of the root
    rootNode.childIds = topLevelNodeIds;

    // Create conversation record
    const now = Date.now();
    const newConv: Conversation = {
      id: newConvId,
      title: oldConv.title ? `${oldConv.title} (imported)` : 'Imported Conversation',
      rootNodeId: rootNode.id,
      createdAt: now,
      updatedAt: now,
      model: oldConv.model || '',
      systemPrompt: oldConv.systemPrompt,
      tags: oldConv.tags || [],
      providerId: oldConv.providerId,
    };

    // Write to Dexie
    await db.conversations.add(newConv);
    await db.nodes.bulkAdd([rootNode, ...newNodes]);

    // Update store
    set((state) => ({
      conversations: [newConv, ...state.conversations],
    }));

    return newConv;
  },

  // Feature 39: Reasoning block clipboard
  copyReasoningBlock: (nodeId: string, blockId: string) => {
    const node = get().nodes[nodeId];
    if (!node?.thinkingBlocks) return;
    const block = node.thinkingBlocks.find(b => b.id === blockId);
    if (!block) return;
    set({
      reasoningClipboard: {
        ...block,
        sourceNodeId: nodeId,
        sourceConversationId: node.conversationId,
        isOriginal: false,
      },
    });
  },

  pasteReasoningBlock: async (targetNodeId: string) => {
    const { nodes, reasoningClipboard } = get();
    const node = nodes[targetNodeId];
    if (!node || !reasoningClipboard) return;

    const newBlock: ThinkingBlock = {
      ...reasoningClipboard,
      id: crypto.randomUUID(),
      isOriginal: false,
      active: true,
      injectAtEnd: !!reasoningClipboard.encryptedContent,
    };

    const updated = [...(node.thinkingBlocks || []), newBlock];
    await db.nodes.update(targetNodeId, { thinkingBlocks: updated });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [targetNodeId]: { ...state.nodes[targetNodeId], thinkingBlocks: updated },
      },
    }));
  },

  clearReasoningClipboard: () => {
    set({ reasoningClipboard: null });
  },

  removeReasoningBlock: async (nodeId: string, blockId: string) => {
    const node = get().nodes[nodeId];
    if (!node?.thinkingBlocks) return;
    const updated = node.thinkingBlocks.filter(b => b.id !== blockId);
    const value = updated.length > 0 ? updated : undefined;
    await db.nodes.update(nodeId, { thinkingBlocks: value });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], thinkingBlocks: value },
      },
    }));
  },

  toggleReasoningPlaintext: async (nodeId: string, blockId: string) => {
    const node = get().nodes[nodeId];
    if (!node?.thinkingBlocks) return;
    const updated = node.thinkingBlocks.map(b =>
      b.id === blockId ? { ...b, plaintextEnabled: !b.plaintextEnabled } : b
    );
    await db.nodes.update(nodeId, { thinkingBlocks: updated });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], thinkingBlocks: updated },
      },
    }));
  },

  toggleReasoningActive: async (nodeId: string, blockId: string) => {
    const node = get().nodes[nodeId];
    if (!node?.thinkingBlocks) return;
    const updated = node.thinkingBlocks.map(b =>
      b.id === blockId ? { ...b, active: !b.active } : b
    );
    await db.nodes.update(nodeId, { thinkingBlocks: updated });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], thinkingBlocks: updated },
      },
    }));
  },

  toggleReasoningInjectAtEnd: async (nodeId: string, blockId: string) => {
    const node = get().nodes[nodeId];
    if (!node?.thinkingBlocks) return;
    const updated = node.thinkingBlocks.map(b =>
      b.id === blockId ? { ...b, injectAtEnd: !b.injectAtEnd } : b
    );
    await db.nodes.update(nodeId, { thinkingBlocks: updated });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], thinkingBlocks: updated },
      },
    }));
  },

  editNodeContent: async (nodeId: string, newContent: string) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    await db.nodes.update(nodeId, { content: newContent, userModified: true });
    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], content: newContent, userModified: true },
      },
    }));
    // Update conversation timestamp
    const conv = get().currentConversation;
    if (conv) {
      const now = Date.now();
      await db.conversations.update(conv.id, { updatedAt: now });
      set((state) => ({
        currentConversation: state.currentConversation
          ? { ...state.currentConversation, updatedAt: now }
          : null,
      }));
    }
  },

  cloneBranch: async (nodeId: string) => {
    const { nodes, currentConversation, selectNode, setReplyTarget } = get();
    const node = nodes[nodeId];
    if (!node || !currentConversation) return;

    // Walk to root
    const path: TreeNode[] = [];
    let cur: TreeNode | undefined = nodes[nodeId];
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? nodes[cur.parentId] : undefined;
    }
    // path[0] is root, skip it (shared silent root)
    if (path.length < 2) return;
    const toClone = path.slice(1); // nodes to clone

    // Clone each node with new IDs
    const idMap = new Map<string, string>();
    const clonedNodes: TreeNode[] = [];
    for (let i = 0; i < toClone.length; i++) {
      const src = toClone[i];
      const newId = crypto.randomUUID();
      idMap.set(src.id, newId);

      const parentId = i === 0
        ? src.parentId! // same parent as original (sibling of root's first child)
        : idMap.get(toClone[i - 1].id)!;

      const clone: TreeNode = {
        id: newId,
        conversationId: currentConversation.id,
        parentId,
        role: src.role,
        content: src.content,
        model: src.model,
        createdAt: Date.now(),
        childIds: [],
        collapsed: false,
        nodeType: 'standard',
        userModified: false,
        starred: false,
        deadEnd: false,
        providerId: src.providerId,
        modelOverride: src.modelOverride,
        systemPromptOverride: src.systemPromptOverride,
        providerOverride: src.providerOverride,
        tokenUsage: src.tokenUsage,
      };

      // Deep-copy thinking blocks with new IDs
      if (src.thinkingBlocks && src.thinkingBlocks.length > 0) {
        clone.thinkingBlocks = src.thinkingBlocks.map(b => ({
          ...b,
          id: crypto.randomUUID(),
          isOriginal: false,
        }));
      }

      // Deep-copy tool calls
      if (src.toolCalls && src.toolCalls.length > 0) {
        clone.toolCalls = src.toolCalls.map(tc => ({ ...tc }));
      }

      clonedNodes.push(clone);
    }

    // Wire childIds between clones
    for (let i = 0; i < clonedNodes.length - 1; i++) {
      clonedNodes[i].childIds = [clonedNodes[i + 1].id];
    }

    // Attach first clone to root's childIds
    const rootNode = nodes[path[0].id];
    const updatedRootChildIds = [...rootNode.childIds, clonedNodes[0].id];

    // Persist in transaction
    await db.transaction('rw', db.nodes, async () => {
      await db.nodes.bulkAdd(clonedNodes);
      await db.nodes.update(rootNode.id, { childIds: updatedRootChildIds });
    });

    // Update store
    const newNodes = { ...get().nodes };
    newNodes[rootNode.id] = { ...newNodes[rootNode.id], childIds: updatedRootChildIds };
    for (const clone of clonedNodes) {
      newNodes[clone.id] = clone;
    }
    set({ nodes: newNodes });

    // Select leaf clone
    const leafId = clonedNodes[clonedNodes.length - 1].id;
    selectNode(leafId);
    setReplyTarget(leafId);
  },

  clonePath: async (nodeIdA: string, nodeIdB: string) => {
    const { nodes, currentConversation, selectNode, setReplyTarget } = get();
    const nodeA = nodes[nodeIdA];
    const nodeB = nodes[nodeIdB];
    if (!nodeA || !nodeB || !currentConversation) return;
    if (nodeA.conversationId !== nodeB.conversationId) return;

    // Walk both to root and determine ancestor/descendant
    const pathA: string[] = [];
    let c: TreeNode | undefined = nodeA;
    while (c) { pathA.push(c.id); c = c.parentId ? nodes[c.parentId] : undefined; }

    const pathB: string[] = [];
    c = nodeB;
    while (c) { pathB.push(c.id); c = c.parentId ? nodes[c.parentId] : undefined; }

    const setA = new Set(pathA);
    const setB = new Set(pathB);

    let ancestorId: string;
    let descendantId: string;
    if (setA.has(nodeIdB)) {
      // B is ancestor of A
      ancestorId = nodeIdB;
      descendantId = nodeIdA;
    } else if (setB.has(nodeIdA)) {
      // A is ancestor of B
      ancestorId = nodeIdA;
      descendantId = nodeIdB;
    } else {
      // Not on same linear path
      return;
    }

    // Build path from ancestor to descendant
    const segment: TreeNode[] = [];
    c = nodes[descendantId];
    while (c && c.id !== ancestorId) {
      segment.unshift(c);
      c = c.parentId ? nodes[c.parentId] : undefined;
    }
    if (c) segment.unshift(c); // include ancestor

    if (segment.length < 2) return;

    // Clone the segment
    const idMap = new Map<string, string>();
    const clonedNodes: TreeNode[] = [];
    for (let i = 0; i < segment.length; i++) {
      const src = segment[i];
      const newId = crypto.randomUUID();
      idMap.set(src.id, newId);

      const parentId = i === 0
        ? src.parentId! // attach as sibling of ancestor
        : idMap.get(segment[i - 1].id)!;

      const clone: TreeNode = {
        id: newId,
        conversationId: currentConversation.id,
        parentId,
        role: src.role,
        content: src.content,
        model: src.model,
        createdAt: Date.now(),
        childIds: [],
        collapsed: false,
        nodeType: 'standard',
        userModified: false,
        starred: false,
        deadEnd: false,
        providerId: src.providerId,
        modelOverride: src.modelOverride,
        systemPromptOverride: src.systemPromptOverride,
        providerOverride: src.providerOverride,
        tokenUsage: src.tokenUsage,
      };

      if (src.thinkingBlocks && src.thinkingBlocks.length > 0) {
        clone.thinkingBlocks = src.thinkingBlocks.map(b => ({
          ...b,
          id: crypto.randomUUID(),
          isOriginal: false,
        }));
      }
      if (src.toolCalls && src.toolCalls.length > 0) {
        clone.toolCalls = src.toolCalls.map(tc => ({ ...tc }));
      }

      clonedNodes.push(clone);
    }

    // Wire childIds between clones
    for (let i = 0; i < clonedNodes.length - 1; i++) {
      clonedNodes[i].childIds = [clonedNodes[i + 1].id];
    }

    // Attach first clone to ancestor's parent's childIds
    const ancestorParentId = nodes[ancestorId].parentId;
    if (!ancestorParentId || !nodes[ancestorParentId]) return;
    const parentNode = nodes[ancestorParentId];
    const updatedParentChildIds = [...parentNode.childIds, clonedNodes[0].id];

    await db.transaction('rw', db.nodes, async () => {
      await db.nodes.bulkAdd(clonedNodes);
      await db.nodes.update(parentNode.id, { childIds: updatedParentChildIds });
    });

    const newNodes = { ...get().nodes };
    newNodes[parentNode.id] = { ...newNodes[parentNode.id], childIds: updatedParentChildIds };
    for (const clone of clonedNodes) {
      newNodes[clone.id] = clone;
    }
    set({ nodes: newNodes, multiSelectIds: [] });

    const leafId = clonedNodes[clonedNodes.length - 1].id;
    selectNode(leafId);
    setReplyTarget(leafId);
  },

  // Feature 13: Project knowledge
  setConversationProject: async (conversationId: string, projectId: string | undefined) => {
    await db.conversations.update(conversationId, { projectId });
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId ? { ...c, projectId } : c
      ),
      currentConversation:
        state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, projectId }
          : state.currentConversation,
    }));
  },

}));
