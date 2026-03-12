---
title: State Management
parent: Architecture
nav_order: 2
---

# State Management

Baobab uses [Zustand](https://github.com/pmndrs/zustand) v5 for state management. State is split across focused stores, each responsible for a specific domain.

## Stores

### useTreeStore

The primary store managing conversation tree state, node operations, and UI selection.

**State shape:**

```typescript
{
  // Conversation data
  conversations: Conversation[];
  currentConversation: Conversation | null;
  nodes: Record<string, TreeNode>;   // Flat map, O(1) lookup

  // UI state
  selectedNodeId: string | null;
  replyTargetNodeId: string | null;
  streamingNodeId: string | null;
  isStreaming: boolean;
  viewMode: 'tree' | 'thread';
  multiSelectIds: string[];
  reasoningClipboard: ThinkingBlock | null;  // Clipboard for reasoning block copy/paste
}
```

**Key operations:**

| Method | Description |
|:-------|:------------|
| `loadConversations()` | Fetch all conversations from IndexedDB |
| `loadConversation(id)` | Load a conversation and all its nodes |
| `createConversation(title?, systemPrompt?)` | Create a new conversation |
| `selectNode(nodeId, browseOnly?)` | Select a node; optionally set reply target |
| `addNode(node)` | Add a node and update parent's `childIds` |
| `updateNodeContent(nodeId, content)` | Update content during streaming |
| `finalizeNode(nodeId, content, thinking?, tokenUsage?)` | Finalize after streaming completes |
| `deleteSubtree(nodeId)` | Delete a node and all descendants |
| `setReplyTarget(nodeId)` | Explicitly set where the next message replies |
| `toggleStar(nodeId)` | Toggle starred annotation |
| `toggleDeadEnd(nodeId)` | Toggle dead-end annotation |
| `summarizeBranch(nodeId, options?)` | Generate a summary node |
| `mergeBranches(nodeIdA, nodeIdB, options?)` | Merge two branches |
| `editNodeContent(nodeId, newContent)` | In-place edit of a node's content |
| `cloneBranch(nodeId)` | Deep-clone a node and its entire subtree |
| `clonePath(nodeIdA, nodeIdB)` | Clone a linear path between two nodes |
| `copyReasoningBlock(nodeId, blockId)` | Copy a thinking block to the reasoning clipboard |
| `pasteReasoningBlock(targetNodeId)` | Paste the clipboard thinking block onto a node |
| `removeReasoningBlock(nodeId, blockId)` | Remove a thinking block from a node |
| `toggleReasoningPlaintext(nodeId, blockId)` | Toggle plaintext display for a thinking block |
| `toggleReasoningActive(nodeId, blockId)` | Toggle whether a thinking block is included in API context |
| `toggleReasoningInjectAtEnd(nodeId, blockId)` | Toggle inject-at-end positioning for a thinking block |

#### Selection vs Reply Target

An important distinction in the UI:

- **Selection** (`selectedNodeId`): determines which node's details are shown in the panel. Changes on every click.
- **Reply target** (`replyTargetNodeId`): determines where the next message will be attached. Only changes when the user explicitly clicks "Reply here" or sends a message.

This separation allows browsing the tree without accidentally changing the conversation target.

### useSettingsStore

Settings and provider configuration.

```typescript
{
  apiKey: string;
  defaultModel: string;
  theme: 'light' | 'dark';
  loaded: boolean;

  // Models
  availableModels: ModelInfo[];
  allProviderModels: ProviderModelInfo[];

  // Providers
  providers: ProviderConfigData[];
  defaultProvider: string;

  // Advanced
  thinkingEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
  // ...etc
}
```

**Key operations:**

| Method | Description |
|:-------|:------------|
| `loadSettings()` | Hydrate from IndexedDB, apply defaults |
| `validateKey(key)` | Validate API key and fetch models |
| `setDefaultModel(model)` | Switch default model |
| `setTheme(theme)` | Toggle light/dark |
| `setProviders(providers)` | Update provider configurations |
| `refreshProviderModels()` | Fetch model lists from all enabled providers |
| `refreshLivePricing()` | Fetch live pricing from OpenRouter |

### useProjectStore

Project and knowledge file management.

```typescript
{
  projects: Project[];
  filesByProject: Record<string, LocalProjectFile[]>;
}
```

**Key operations:**

| Method | Description |
|:-------|:------------|
| `loadProjects()` | Fetch all projects from IndexedDB |
| `createProject(name, description?)` | Create a new project |
| `updateProject(id, updates)` | Update project fields |
| `deleteProject(id)` | Delete project and associated files |
| `uploadFile(projectId, file)` | Upload and extract text from a file |
| `deleteFile(fileId)` | Remove a knowledge file |

### useResearchStore

Research run state management.

```typescript
{
  runs: ResearchRun[];
}
```

**Key operations:**

| Method | Description |
|:-------|:------------|
| `loadRuns(conversationId)` | Load research runs for a conversation |
| `upsertRun(run)` | Create or update a run |

### useSearchStore

Search state for full-text search across conversations.

```typescript
{
  query: string;
  results: TreeNode[];
  selectedResult: TreeNode | null;
  isSearching: boolean;
}
```

## Persistence pattern

Every store mutation that changes data (not transient UI state) writes through to IndexedDB:

```
User action
  → Zustand store mutation (synchronous state update)
    → Dexie write (async, fire-and-forget)
      → IndexedDB transaction
```

On app load:
```
App mount
  → useSettingsStore.loadSettings() reads from Dexie
  → useTreeStore.loadConversations() reads from Dexie
  → Components render from store state
```

There is no sync queue or conflict resolution — the frontend is the single writer and single reader, and writes are immediate.
