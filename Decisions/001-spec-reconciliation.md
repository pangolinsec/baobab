# ADR-001: Feature Spec Reconciliation

**Date**: 2026-02-19
**Status**: Accepted
**Context**: Three concurrent analysis passes produced overlapping proposals for Baobab's feature specs: conflict resolutions (`_conflict-resolutions.md`), structural specs (`_structural-specs.md`), and recommendation specs (`_recommendation-specs.md`). This ADR records the decisions made to reconcile them into a single canonical set.

---

## Decision 1: TreeNode Field Organization — NodeType Enum + Flat Flags

**Options considered**:

1. **Grouped sub-objects** (S1): `node.overrides?.modelOverride`, `node.annotations?.starred`, `node.synthesis?.isSummary`, with accessor functions like `isStarred(node)`.
2. **NodeType enum + flat orthogonal flags** (R3/C6): `node.nodeType = 'standard' | 'summary' | 'merge'` with `node.starred`, `node.deadEnd`, `node.modelOverride` as flat fields.
3. **Combined**: NodeType enum for type discrimination + sub-objects for grouped optional fields.

**Decision**: Option 2 — NodeType enum with flat orthogonal flags.

**Rationale**: The NodeType enum prevents invalid state combinations (a node cannot be both summary and merge). Flat fields are simpler for Dexie indexing, store updates, and general access. Sub-objects add null-chaining complexity that accessor functions then try to hide; if you need accessors to make the API ergonomic, the sub-objects aren't earning their keep. With a NodeType enum eliminating the boolean type flags, the flat field count is manageable (~15 fields).

**Canonical `TreeNode`**:
```typescript
type NodeType = 'standard' | 'summary' | 'merge';

interface TreeNode {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: MessageRole; // 'user' | 'assistant'
  content: string;
  model: string;
  createdAt: number;
  childIds: string[];

  nodeType: NodeType;           // default 'standard'
  collapsed: boolean;
  starred: boolean;             // default false
  deadEnd: boolean;             // default false
  userModified: boolean;        // default false

  modelOverride?: string;
  providerOverride?: string;    // added in Phase 2 (Feature 07)
  systemPromptOverride?: string;

  thinking?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; };
  mergeSourceIds?: string[];    // only when nodeType === 'merge'
  toolCalls?: Array<{ toolName: string; input: Record<string, unknown>; result?: string; }>;
}
```

**Impact**: Features 15 and 16 replace `isSummary`/`isSynthetic`/`isMerge` booleans with `nodeType`. Feature 23's `userModified` stays as a flat orthogonal flag.

---

## Decision 2: Tool Use Display — Nodules on Assistant Nodes

**Options considered**:

1. **Separate tree nodes** (C4): Tool calls as `role: 'tool'` nodes in the tree with smaller dagre sizing.
2. **Nodules on assistant nodes** (user preference): Tool calls shown as colored dots/badges on the side of assistant message nodes, expandable/collapsible.

**Decision**: Option 2 — Nodules on assistant message nodes.

**Rationale**: User's explicit preference. Avoids breaking the user/assistant tree alternation assumption. Keeps the tree clean. Tool call data is stored as a `toolCalls` array on the assistant node, not as separate tree nodes.

**Impact**: `MessageRole` stays as `'user' | 'assistant'` (no `'tool'`). No `NodeType.ToolUse` in the enum. No changes to dagre layout or tree traversal for tool nodes. Feature 05 spec updated to describe nodule approach.

---

## Decision 3: Tag Sync Semantics — Prune Orphan Tags

**Options considered**:

1. **Prune during reconciliation** (S4): Remove backend tags that no longer exist on any frontend conversation.
2. **Append-mostly** (R2): Keep tags in backend even after removal from all conversations.

**Decision**: Option 1 — Prune during reconciliation.

**Rationale**: Stale autocomplete suggestions are a worse UX than slightly more reconciliation logic. If a user wants a tag back, they just type it again.

---

## Decision 4: Offline Sync Queue — No Queue

**Options considered**:

1. **SyncQueue Dexie table** (S4): Queue failed sync operations, drain on next startup.
2. **No queue** (R2): Skip sync when offline, rely on startup reconciliation.

**Decision**: Option 2 — No queue, rely on startup reconciliation.

**Rationale**: Startup reconciliation compares current frontend state against backend state and pushes diffs. This is idempotent and always correct. A queue is redundant — it replays actions that reconciliation discovers anyway. Simplicity wins.

---

## Decision 5: Feature 08 resolveModel Return Type — ResolvedModel from Phase 1

**Options considered**:

1. **Return `string`** in Phase 1 (C1): Simple model ID, change to object in Phase 2.
2. **Return `ResolvedModel`** from Phase 1 (R4): `{ model: string; providerId: string }` with `providerId` hardcoded to `'anthropic'`.

**Decision**: Option 2 — `ResolvedModel` return type from Phase 1.

**Rationale**: Trivial upfront cost (one extra property on a return object). Makes Phase 2 dramatically simpler — just remove the hardcoded `'anthropic'` and add provider resolution logic. Callers already destructure `{ model, providerId }`, so Phase 2 changes are invisible to them.

---

## Decision 6: Sidebar Tag Grouping — Architecture Ready, UI Deferred

**Options considered**:

1. **Include tag grouping in v1** (R1): `[None|Projects|Tags]` grouping selector with all three modes functional.
2. **Defer tag grouping to v2** (C2): Tags are filter + pills only, no grouped view.

**Decision**: Include R1's `[None|Projects|Tags]` grouping selector in the sidebar architecture, but the "Tags" grouping option is hidden/disabled in v1. Tag filtering via dropdown and tag pills on conversations are functional in v1.

**Rationale**: The sidebar architecture supports tag grouping from day one (avoiding a later refactor), but we don't build the tag grouping UI until v2. Ships faster while preserving extensibility.

---

## Decision 7: Cascade Traversal Direction — Root-to-Node with Shared Utility

**Options considered**:

1. **Root-to-node, last override wins** (C5): Uses `getPathToRoot()` which returns root-to-node order; simple `for` loop.
2. **Node-to-root, first override wins** (R4/C1): Early termination at first override found.

**Decision**: Option 1 — Root-to-node traversal, shared `resolveCascade<T>()` utility.

**Rationale**: Both produce identical results. Root-to-node uses `getPathToRoot()` directly with a simple loop. One generic function for all cascades (model, system prompt, future settings) reduces bugs and ensures consistency.

```typescript
function resolveCascade<T>(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  getOverride: (node: TreeNode) => T | undefined,
  defaultValue: T
): T {
  const path = getPathToRoot(nodeId, nodes); // root → node order
  let resolved = defaultValue;
  for (const node of path) {
    const override = getOverride(node);
    if (override !== undefined && override !== null) {
      resolved = override;
    }
  }
  return resolved;
}
```

---

## Decision 8: Feature 08 Phasing — Phase 1 Anthropic-Only, Phase 2 Multi-Provider

**Decision**: Split Feature 08 (Model Cascade) into two phases rather than promoting Feature 07 to Tier 1.

- **Phase 1 (Tier 1, no Feature 07 dependency)**: Full cascade UX with Anthropic models only. Flat model dropdown. `ResolvedModel` return type with `providerId: 'anthropic'`. No `providerOverride` on TreeNode.
- **Phase 2 (ships with Feature 07)**: Add `providerOverride`, grouped-by-provider dropdown, extend resolution to include provider.

---

## Decision 9: Data Sync Protocol — Merged S4 + R2

**Decision**: Merge the best aspects of S4 and R2:

- **From R2**: Bulk `POST /api/sync` endpoint for initial startup sync (single round-trip). No sync queue. `withSyncRetry` with exponential backoff.
- **From S4**: Detailed reconciliation logic that prunes orphan tags and backend projects. Frontend-driven event-based sync during session.
- **Ownership**: IndexedDB is source of truth for conversations, nodes, settings, projects, tags. Backend SQLite owns files and provides an autocomplete cache for tags.

---

## Decision 10: Merge Edges — Overlay-Only, Excluded from Dagre

**Decision** (C7, consensus): Merge link edges (dashed cross-branch connections from Feature 16) are NOT fed to dagre layout. They are rendered as overlay edges after dagre positions all nodes.

---

## Decision 11: Settings Architecture — Full Routed Page

**Decision** (S2, consensus): Convert settings from a modal dialog to a full routed page at `/settings/:section` with tabbed sections: General, Providers, Advanced, Prompts, Search, Research, Pricing, About.

---

## Decision 12: Context Menu Architecture — Structured Groups

**Decision** (S3, consensus): Context menu items organized into 5 groups (Primary Actions, Annotations, Branch Operations, Clipboard, Danger Zone) with conditional visibility based on node state and feature flags.

---

## Decision 13: Socratic Elicitation — Deferred

**Decision**: Hold off on Feature 14 (Socratic Elicitation) and R5 spec. Remove Socratic node types from the NodeType enum. Can be revisited later.

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `_overview.md` | NodeType convention, cascade convention, sidebar architecture, data ownership, visual channels updates, dependency graph update |
| `00-backend-architecture.md` | Removed `projects` from SQLite, added data ownership section, clarified `tags` as cache |
| `05-web-search.md` | Tool calls as nodules on assistant nodes, not separate tree nodes |
| `08-model-cascade.md` | Phase 1/2 split, `ResolvedModel` return type, `resolveCascade` utility |
| `09-system-prompt-cascade.md` | Shared `resolveCascade` utility reference |
| `13-project-knowledge.md` | Projects in IndexedDB only, unified sidebar reference, sync protocol |
| `15-summarize-branches.md` | `isSummary` replaced with `nodeType: 'summary'` |
| `16-merge-branches.md` | `isSynthetic`/`isMerge` replaced with `nodeType: 'merge'`, overlay-only merge edges |
| `23-resend-duplicate.md` | `userModified` noted as orthogonal to `nodeType` |

## Superseded Documents

The following proposal documents have been reconciled into the canonical specs and are retained for historical reference only:

- `Features/_conflict-resolutions.md`
- `Features/_structural-specs.md`
- `Features/_recommendation-specs.md`
