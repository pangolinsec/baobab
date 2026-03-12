# Dexie Migration Plan

Coordinated schema migration plan across all features. This prevents version conflicts when features are implemented in parallel or out of order.

## Current State (Version 1)

```typescript
this.version(1).stores({
  conversations: 'id, createdAt, updatedAt',
  nodes: 'id, conversationId, parentId',
  settings: '++id',
});
```

## Migration Versions

### Version 2 — Tier 1 Core: Cascades, Advanced Config, Resend, NodeType

**Supports**: Features 04, 08 Phase 1, 09, 23, ADR-001 NodeType foundation

**Schema string** (no index changes — new fields are stored but not queried via index):
```typescript
this.version(2).stores({
  conversations: 'id, createdAt, updatedAt',
  nodes: 'id, conversationId, parentId',
  settings: '++id',
}).upgrade(tx => {
  return tx.table('nodes').toCollection().modify(node => {
    if (node.nodeType === undefined) node.nodeType = 'standard';
    if (node.userModified === undefined) node.userModified = false;
    if (node.starred === undefined) node.starred = false;
    if (node.deadEnd === undefined) node.deadEnd = false;
  });
});
```

**Fields added to TreeNode** (not indexed):
- `nodeType: NodeType` — default `'standard'` (ADR-001 Decision 1)
- `userModified: boolean` — default `false` (Feature 23)
- `starred: boolean` — default `false` (forward-compat for Feature 11)
- `deadEnd: boolean` — default `false` (forward-compat for Feature 12)
- `thinking?: string` (Feature 04)
- `modelOverride?: string` (Feature 08)
- `systemPromptOverride?: string` (Feature 09)

**AppSettings additions** (handled at store level via defaults merge, not Dexie schema):
- `thinkingEnabled: false`, `thinkingBudget: 10000`, `temperature: 1.0`, `maxOutputTokens: 8192`, `topP: null`, `topK: null` (Feature 04)
- `defaultSystemPrompt: ''` (Feature 09)

---

### Version 3 — Tier 2 Annotations: Stars, Dead-Ends, Tags

**Supports**: Features 11, 12, 24

```typescript
this.version(3).stores({
  conversations: 'id, createdAt, updatedAt, *tags',
  nodes: 'id, conversationId, parentId, starred',
  settings: '++id',
}).upgrade(tx => {
  return tx.table('conversations').toCollection().modify(conv => {
    if (!conv.tags) conv.tags = [];
  });
});
```

**Index changes from V2**:
- `conversations`: added `*tags` multi-entry index (Feature 24)
- `nodes`: added `starred` index (Feature 11 — enables `db.nodes.where('starred').equals(1)`)

**Fields added to Conversation**:
- `tags: string[]` — default `[]` (Feature 24). Must be an array, not `undefined`, for the multi-entry index.

---

### Version 4 — Tier 2/3: Projects, Providers, Web Search, Summarize, Merge, Pricing

**Supports**: Features 07, 08 Phase 2, 05, 13, 15, 16, 22

```typescript
this.version(4).stores({
  conversations: 'id, createdAt, updatedAt, projectId, *tags',
  nodes: 'id, conversationId, parentId, starred, nodeType',
  settings: '++id',
  projects: 'id, name, createdAt',
}).upgrade(tx => {
  tx.table('conversations').toCollection().modify(conv => {
    if (conv.projectId === undefined) conv.projectId = null;
    if (conv.webSearchEnabled === undefined) conv.webSearchEnabled = false;
    if (conv.searchProvider === undefined) conv.searchProvider = 'duckduckgo';
  });
});
```

**Index changes from V3**:
- `conversations`: added `projectId` index (Feature 13 — project grouping queries)
- `nodes`: added `nodeType` index (Features 15/16 — query summary/merge nodes)

**New table**: `projects: 'id, name, createdAt'` (Feature 13 — project metadata in IndexedDB per ADR-001 Decision 9)

**Fields added to Conversation** (not indexed):
- `projectId?: string` — default `null` (Feature 13)
- `webSearchEnabled: boolean` — default `false` (Feature 05)
- `searchProvider: string` — default `'duckduckgo'` (Feature 05)
- `providerId?: string` (Feature 07/08 Phase 2)

**Fields added to TreeNode** (not indexed):
- `providerOverride?: string` (Feature 07/08 Phase 2)
- `tokenUsage?: { inputTokens: number; outputTokens: number }` (Feature 22)
- `toolCalls?: Array<{ toolName: string; input: Record<string, unknown>; result?: string }>` (Feature 05)
- `mergeSourceIds?: string[]` (Feature 16)

**AppSettings additions** (store level):
- `providers: Record<string, ProviderConfig>`, `defaultProvider: 'anthropic'` (Feature 07)
- `tavilyApiKey?: string`, `bingApiKey?: string`, `defaultSearchProvider: 'duckduckgo'` (Feature 05)
- `summarizationPrompt: string` (Feature 15)
- `mergePrompt: string` (Feature 16)

---

### Version 5 — Tier 4: Elicitation Sessions (IMPLEMENTED)

**Supports**: Feature 14

```typescript
this.version(5).stores({
  // ... existing tables unchanged
  elicitationSessions: 'id, conversationId, status',
});
```

**New table**: `elicitationSessions` (Feature 14)

---

### Version 6 — Local Project Files (IMPLEMENTED)

**Supports**: Feature 13 (browser-only file storage)

```typescript
this.version(6).stores({
  // ... existing tables unchanged
  projectFiles: 'id, projectId, createdAt',
});
```

**New table**: `projectFiles` (Feature 13 browser-only mode)

---

### Version 7 — Research Agent

**Supports**: Feature 06

```typescript
this.version(7).stores({
  // ... existing tables unchanged
  researchRuns: 'id, conversationId, triggerNodeId, status',
});
// No upgrade function needed — new table starts empty.
```

**New table**:
- `researchRuns: 'id, conversationId, triggerNodeId, status'` (Feature 06)

**Note**: The original plan reserved V5 for `researchRuns`, `researchNodes`, and `embeddings`. In practice, V5 and V6 were used for elicitation sessions and project files respectively. Feature 06's unified design stores process nodes as a JSON array on `ResearchRun` (no separate `researchNodes` table needed). Feature 19 (RAG) will add `embeddings` in a later version.

**AppSettings additions** (store level):
- `researchTreeSearchPrompt`, `researchWebSearchPrompt`, `researchDefaultPlannerModelId`, `researchDefaultPlannerProviderId`, `researchDefaultSubAgentModelId`, `researchDefaultSubAgentProviderId`, `researchMaxSubTasks: 7`, `researchMaxToolCallsPerSubAgent: 20`, `researchMaxTotalToolCalls: 100`, `researchIncrementalInterval: 10` (Feature 06)

---

### Version 8 — Reasoning Block Injection

**Supports**: Feature 39 (Phase A: Anthropic, Phase B: OpenAI)

```typescript
this.version(8).stores({
  // ... existing tables unchanged — no index changes
}).upgrade(tx => {
  return tx.table('nodes').toCollection().modify(node => {
    if (node.thinking && !node.thinkingBlocks) {
      node.thinkingBlocks = [{
        id: crypto.randomUUID(),
        text: node.thinking,
        providerId: 'anthropic',
        isOriginal: true,
        plaintextEnabled: false,
      }];
    }
    delete node.thinking;
  });
});
```

**Fields migrated on TreeNode**:
- `thinking?: string` → removed
- `thinkingBlocks?: ThinkingBlock[]` → added (see Feature 39 for `ThinkingBlock` interface)

**AppSettings additions** (store level):
- `reasoningInjectionPlaintextPrefix: '[Prior reasoning: '`
- `reasoningInjectionPlaintextSuffix: ']'`

---

### Version 9 (reserved) — RAG Embeddings

**Supports**: Feature 19

```typescript
this.version(9).stores({
  // ... existing tables unchanged
  embeddings: 'nodeId, conversationId',
});
```

**New table**: `embeddings` (Feature 19)

---

## Summary Table

| Version | Index/Table Changes | Features | Tier | Status |
|---------|-------------------|----------|------|--------|
| 1 | Baseline | — | — | Implemented |
| 2 | Upgrade adds defaults to nodes | 04, 08 P1, 09, 23, NodeType | Tier 1 | Implemented |
| 3 | `*tags` on conversations, `starred` on nodes | 11, 12, 24 | Tier 2 | Implemented |
| 4 | `projectId` + `nodeType` indexes, `projects` table | 07, 08 P2, 05, 13, 15, 16, 22 | Tier 2/3 | Implemented |
| 5 | `elicitationSessions` table | 14 | Tier 4 | Implemented |
| 6 | `projectFiles` table | 13 (browser-only) | Tier 3 | Implemented |
| 7 | `researchRuns` table | 06 | Tier 4 | Not started |
| 8 | Migrate `thinking` → `thinkingBlocks` on nodes | 39 | Tier 2 | Not started |
| 9 | `embeddings` table | 19 | Tier 4 | Not started |

## Important Notes

### AppSettings Growth Strategy

Dexie does not require schema changes for non-indexed properties. All `AppSettings` growth is handled at the **store level**: `loadSettings` merges stored settings with current defaults using spread syntax. New defaults fill in missing fields automatically.

```typescript
loadSettings: async () => {
  const stored = await db.settings.toCollection().first();
  if (stored) {
    set({ ...defaults, ...stored, loaded: true });
  } else {
    const id = await db.settings.add({ ...defaults });
    set({ ...defaults, id, loaded: true });
  }
},
```

### Non-Indexed Fields

Most TreeNode and Conversation fields do not need Dexie indexes. They are accessed via full-object loading or tree traversal. Only fields queried via `where()` need indexes: `starred`, `nodeType`, `projectId`, `*tags`.

### Deployment Order

Migrations are cumulative and forward-only. Version numbers must be monotonically increasing. If you deploy features out of order, you can consolidate version bumps — but the recommended approach is to deploy in version order matching the tier priorities.

### Conversation.tags Default

The `tags` field must default to `[]` (empty array), not `undefined`. The multi-entry index `*tags` requires the field to be an array.
