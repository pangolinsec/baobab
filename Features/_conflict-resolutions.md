# Conflict Resolution Plan for Baobab Feature Specs

> **RECONCILED**: This document has been reconciled into the canonical feature specs. Decisions are recorded in [ADR-001](../Decisions/001-spec-reconciliation.md). The individual spec files have been updated to reflect the chosen resolutions. This file is retained for historical reference only.

Below is a detailed resolution for each of the 7 identified conflicts, organized by conflict number.

---

## Conflict 1: Tier/Dependency Mismatch -- Feature 08 (Model Cascade) depends on Feature 07 (Inference Providers), but 08 is Tier 1 while 07 is Tier 2

**Problem:** Feature 08 (Model Cascade, Tier 1) references `providerOverride`, `conversation.providerId`, and a model dropdown grouped by provider -- all of which depend on Feature 07 (Inference Providers, Tier 2), creating a circular priority conflict.

**Proposed Resolution:** Split Feature 08 into two phases rather than promoting Feature 07 to Tier 1. Feature 07 is large and involves six provider integrations; promoting it would bloat Tier 1 and delay core UX delivery.

**Phase 1 (Tier 1, ships without Feature 07):**
- Implement the cascade logic (global -> chat -> branch -> message) using only Anthropic models.
- The `TreeNode` interface adds `modelOverride?: string` but does NOT add `providerOverride?: string` yet.
- The `Conversation` interface does NOT add `providerId` yet. The provider is implicitly `'anthropic'`.
- The `resolveModel()` function walks node-to-root looking for `modelOverride` and falls back to `conversation.model`, then `settings.defaultModel`. It returns just `{ model: string }`, not `{ model, providerId }`.
- The model dropdown is a flat list of Anthropic models (from `availableModels` in `useSettingsStore`). No provider grouping headers.
- The "Set as branch default" button works as specified.
- Model chips on nodes work as specified.

**Phase 2 (ships with or after Feature 07):**
- Add `providerOverride?: string` to `TreeNode`.
- Add `providerId: string` to `Conversation`.
- Extend `resolveModel()` to return `{ model: string; providerId: string }` by checking `providerOverride` alongside `modelOverride`.
- Replace the flat model dropdown with the grouped-by-provider dropdown.
- Model chips show provider prefix when the provider differs from the chat default (e.g., "OpenAI GPT-4o").

**Concrete code path for Phase 1 `resolveModel`:**

```typescript
function resolveModel(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): string {
  let current = nodes[nodeId];
  while (current) {
    if (current.modelOverride) {
      return current.modelOverride;
    }
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return conversation.model || settings.defaultModel;
}
```

Phase 2 wraps this with provider resolution when Feature 07 lands.

**Questions for user:**
- Is splitting Feature 08 into two phases acceptable, or would you prefer to promote Feature 07 to Tier 1 so they ship together?
- If splitting, should Phase 1 still add the `providerOverride` field to `TreeNode` (as `undefined`) for forward compatibility, or add it only when Feature 07 ships?

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/08-model-cascade.md` -- Add a "Phased Implementation" section at the top describing Phase 1 (Anthropic-only) and Phase 2 (multi-provider). Replace the `resolveModel` code example with the Phase 1 version, and add the Phase 2 version below it gated by "when Feature 07 is available." Remove `providerOverride` and `conversation.providerId` from the Phase 1 data model section.
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` -- Add a note in the Tier 1 table for Feature 08: "Phase 1: Anthropic-only. Full multi-provider cascade requires 07."

---

## Conflict 2: Sidebar Design Collision -- Feature 13 (Projects) vs Feature 24 (Tags)

**Problem:** Features 13 and 24 both redesign the sidebar with competing organizational models (project folders with nested files vs. tag-based hierarchical grouping), and the overview says 13 depends on 24, but the two mockups never show a unified design.

**Proposed Resolution:** Unify the sidebar around a single design that supports both concepts as complementary, non-competing organizational layers:

**Design: Projects as primary grouping, Tags as cross-cutting filters**

1. **Projects are the top-level sidebar structure.** Conversations belong to zero or one project. The sidebar displays:
   - A tag filter bar at the top (Feature 24's filter dropdown).
   - Collapsible project groups below it, each containing its conversations and knowledge files.
   - An "Ungrouped" section at the bottom for conversations without a project.

2. **Tags are metadata on conversations, not a separate sidebar structure.** Tags appear as pills on conversation items (Feature 24's design). The tag filter at the top of the sidebar filters conversations across all projects.

3. **When a tag filter is active**, projects that contain no matching conversations are hidden. This gives the "tag-based grouping" feel without requiring a separate sidebar mode.

4. **No "group by tag" view in v1.** The Feature 24 spec shows a mode where conversations are grouped by tag hierarchy in the sidebar. Defer this to v2. In v1, tags are exclusively a filtering mechanism plus visual pills on conversations.

**Unified sidebar mockup:**

```
+------------------------------------+
| Baobab                       [+] |
+------------------------------------+
| [Search...]                        |
| [Filter: All tags v]               |
+------------------------------------+
| v Biology Research (project)       |
|   file: textbook.pdf               |
|   file: notes.md                   |
|   chat: Frog Evolution             |
|         [research/biology]         |
|   chat: Amphibian Genetics         |
|         [research/biology] [imp.]  |
|                                    |
| v Code Review (project)            |
|   file: codebase.ts               |
|   chat: Refactoring Plan           |
|         [work/code-review]         |
|                                    |
| v Ungrouped                        |
|   chat: Random Chat                |
|   chat: Quick Question             |
|         [personal]                 |
+------------------------------------+
```

**Why this approach:**
- Projects provide *containment* (a conversation belongs to a project, and inherits its knowledge files). This is a structural relationship.
- Tags provide *classification* (a conversation can have many tags, tags cross-cut projects). This is a metadata relationship.
- These two concepts are orthogonal and serve different purposes. Forcing them into the same visual space (both as grouping mechanisms) creates confusion.

**Questions for user:**
- Is deferring the "group-by-tag sidebar view" (from Feature 24) to v2 acceptable? The tag filter + pills approach still provides most of the organizational value.
- Should the tag filter interact with projects? E.g., filtering by "research/biology" shows only conversations with that tag regardless of which project they belong to (which could split project groups visually). Or should the filter only apply within the currently expanded projects?
- The overview says Feature 13 depends on Feature 24. With this unified approach, the dependency is lighter: Feature 13 just needs the `tags` field on `Conversation` (from Feature 24) to display tag pills. Is this acceptable, or do you want Feature 13 to be fully independent of 24?

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/24-tags.md` -- Remove the "Tag Hierarchy in Sidebar" section that shows conversations grouped by tag. Replace it with a note: "Tags appear as filter + pills in the sidebar. Grouped-by-tag sidebar view is deferred to v2." Update the sidebar filter mockup to show it coexisting with project groups.
- `/home/baud/Documents/DataML/GIT/baobab/Features/13-project-knowledge.md` -- Update the "UI -- Sidebar Projects" section to show the unified sidebar layout (with tag pills on conversations, tag filter bar above projects). Add a note that the sidebar design is shared with Feature 24.
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` -- Add a "Sidebar Architecture" note explaining that projects are primary grouping, tags are cross-cutting filters. Clarify that Feature 13's dependency on 24 is limited to the `tags` field on `Conversation`.

---

## Conflict 3: Dual Storage Sync Problem

**Problem:** Feature 00 establishes conversations/nodes in IndexedDB (frontend) and project files/tags in SQLite (backend), but Features 13 and 24 store overlapping data in both stores with no defined sync protocol.

**Proposed Resolution:** Establish a clear "single source of truth" principle for each data type, and define the sync boundary.

**Principle: IndexedDB is the source of truth for conversation-scoped data. SQLite is the source of truth for backend-managed resources.**

The specific allocations:

| Data | Source of Truth | Rationale |
|------|----------------|-----------|
| Conversations (metadata, title, model, systemPrompt) | IndexedDB | Already there. Browser-only mode must work. |
| TreeNodes (messages, content, overrides) | IndexedDB | Already there. Core data, browser-only must work. |
| Tags on conversations (`conversation.tags: string[]`) | IndexedDB | Tags are conversation metadata. The frontend owns conversations. |
| Tag canonical list (for autocomplete) | Derived from IndexedDB, cached in backend SQLite when available | Feature 24 already describes this: `getAllTags()` scans conversations in IndexedDB. Backend `tags` table is an optimization for autocomplete, NOT a source of truth. |
| Projects (id, name, timestamps) | IndexedDB | Projects group conversations. Conversations are in IndexedDB. Keeping projects there too avoids cross-store joins. |
| Project-conversation membership (`conversation.projectId`) | IndexedDB | Already on the Conversation interface. |
| Project knowledge files (uploaded files, extracted text) | SQLite + filesystem (backend) | Files require server-side processing (PDF, OCR). The backend owns these. |
| Project file index (lightweight metadata for autocomplete) | Backend is source of truth; frontend caches in memory | Frontend fetches file list from `GET /api/projects/:id/files` and holds it in Zustand, not IndexedDB. |

**Sync protocol for tag canonical list (when backend is available):**
1. On app load, if backend is available, `POST /api/tags/sync` with the full tag list derived from IndexedDB conversations.
2. Backend upserts into the `tags` table (insert-if-not-exists).
3. Backend returns the merged list (which may include tags from a previous session or another device, if multi-device is ever supported).
4. This is a soft sync -- IndexedDB is always authoritative. The backend `tags` table is a convenience cache.

**Sync protocol for projects:**
1. Remove the `projects` table from the backend SQLite schema entirely. Projects are lightweight metadata (id, name, timestamps) and do not require backend storage.
2. Add a `projects` table to the Dexie schema instead.
3. The backend only stores `project_files` (which references `project_id` as a foreign key, but the project record itself lives in IndexedDB).
4. When the frontend creates a project, it writes to IndexedDB. When it uploads a file to a project, it sends the `project_id` to the backend, which stores it in `project_files`.

**Why remove projects from backend SQLite?**
- Projects are just a grouping label. They have no backend-specific processing needs.
- Keeping them in IndexedDB means the browser-only mode works fully (projects as grouping, minus file upload).
- The backend `project_files` table still references `project_id` -- it just trusts that the frontend-provided ID is valid.

**What about the backend `tags` table?**
- Keep it as-is from the Feature 00 spec, but document clearly that it is a **cache for autocomplete**, not a source of truth.
- If the backend is unavailable, autocomplete works by scanning `conversation.tags` in IndexedDB (Feature 24 already specifies this fallback).

**Questions for user:**
- Is moving `projects` entirely to IndexedDB (removing from SQLite) acceptable? The tradeoff is that project metadata is lost if the user clears browser data, but conversation data would also be lost in that case (since conversations are also in IndexedDB), so the data loss is consistent.
- Should we document a future path for full backend sync (all conversation data mirrored to SQLite for backup/export)? This would be a separate feature, not part of the current specs.

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/00-backend-architecture.md` -- Remove the `projects` table from the SQLite schema section. Add a note: "Project metadata lives in IndexedDB. The backend `project_files` table references `project_id` but does not require a corresponding `projects` row in SQLite." Add a "Data Ownership" subsection documenting which store owns which data.
- `/home/baud/Documents/DataML/GIT/baobab/Features/24-tags.md` -- Add a "Sync" subsection clarifying that `conversation.tags` in IndexedDB is the source of truth, and the backend `tags` table is an autocomplete cache. Document the `POST /api/tags/sync` endpoint behavior.
- `/home/baud/Documents/DataML/GIT/baobab/Features/13-project-knowledge.md` -- Update the data model section: move the `Project` interface to the "Frontend (IndexedDB)" section. Add a Dexie schema update for a new `projects` table. Remove any reference to the backend `projects` SQLite table.

---

## Conflict 4: Tool Node Tree Structure (Feature 05) Breaks Tree Assumptions

**Problem:** Feature 05 introduces `role: 'tool'` nodes as children of assistant nodes, breaking the current assumption that the tree strictly alternates user -> assistant -> user -> assistant.

**Proposed Resolution:** Treat tool nodes as a special intermediate node type that is mostly invisible to tree traversal functions, but visible in the UI.

**Key principle: Tool nodes are "inline" nodes that belong to an assistant turn, not independent conversation turns.**

**Changes to the tree model:**

1. **`MessageRole` type expansion:**
   ```typescript
   export type MessageRole = 'user' | 'assistant' | 'tool';
   ```

2. **Tool nodes in the tree:** A tool node is a child of the assistant node that requested it. The final assistant response (after tool use) is also a child of the tool node. So the structure for a single tool-use turn is:
   ```
   [User: "What's the weather?"]
     [Assistant: "" (tool_use request, possibly empty text)]
       [Tool: web_search("weather today")]
         [Assistant: "The weather today is..."]
   ```
   This means the tree is: user -> assistant -> tool -> assistant.

3. **`getPathToRoot()` changes:** The current `getPathToRoot()` function (in `/home/baud/Documents/DataML/GIT/baobab/src/lib/tree.ts`) returns all nodes from root to the specified node. This should continue to return ALL nodes including tool nodes. However, add a filtering utility:
   ```typescript
   export function getConversationPath(
     nodeId: string,
     nodes: Record<string, TreeNode>
   ): TreeNode[] {
     return getPathToRoot(nodeId, nodes); // returns everything including tool nodes
   }

   export function getApiMessages(
     nodeId: string,
     nodes: Record<string, TreeNode>
   ): Array<{ role: string; content: string }> {
     const path = getPathToRoot(nodeId, nodes);
     // Tool nodes are included as-is -- the API expects them
     // for multi-turn tool use conversations
     return path.map(node => ({
       role: node.role,
       content: node.role === 'tool' ? node.toolUse?.result || '' : node.content,
     }));
   }
   ```

4. **Branch visualization:** Tool nodes are rendered as smaller, visually distinct nodes in the tree (Feature 05 already specifies "compact size, muted styling"). They DO participate in dagre layout, but with smaller dimensions:
   ```typescript
   const isToolNode = node.role === 'tool';
   const nodeWidth = isToolNode ? 200 : 320;
   const nodeHeight = isToolNode ? 80 : 140;
   g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
   ```

5. **Thread view (Feature 21):** Tool nodes appear inline as collapsible blocks (Feature 05 already describes this). `getThreadMessages()` returns all nodes in the path, and the `ThreadMessage` component renders tool nodes differently.

6. **Features that walk the tree need "skip tool" awareness:**
   - `resolveModel()` (Feature 08): walks node-to-root looking for `modelOverride`. Tool nodes will not have model overrides, so they are naturally skipped.
   - `resolveSystemPrompt()` (Feature 09): walks root-to-node looking for `systemPromptOverride`. Tool nodes will not have system prompt overrides, so they are naturally skipped.
   - `isDeadEnd()` (Feature 12): walks node-to-root looking for `deadEnd`. Tool nodes should inherit dead-end status from their parent. No special handling needed.
   - `collectBranchContent()` (Feature 15): should include tool nodes, formatted as `[Tool: search("query") -> results]`.
   - `findCommonAncestor()` (Feature 16): walks node-to-root. Tool nodes are included in the ancestor set. This is correct -- a common ancestor could theoretically be a tool node.

7. **The alternation assumption lives in `sendMessage` flow, not in the tree structure.** The current code assumes user -> assistant alternation when building API context. With tool use, the API expects: user, assistant (with tool_use), tool (with tool_result), assistant (final response). This is the standard Claude API tool-use protocol and is already accounted for in Feature 05's "Tool Use Flow" section.

**Questions for user:**
- Should tool nodes be hideable/collapsible in the tree view (so the tree looks like a clean user/assistant alternation when tool use is collapsed)? Feature 05 says "collapsed by default, expandable." Should this mean the tool node itself is collapsed (shows as a tiny icon on the edge), or that the tool's *content* is collapsed within a visible node?
- When multiple tool calls happen in a single assistant turn (sequential searches), should each be its own node, or should they be combined into one tool node with multiple results?

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/05-web-search.md` -- Add a "Tree Structure Impact" section documenting: (a) the node hierarchy for a tool-use turn, (b) that tool nodes use smaller dimensions in dagre layout, (c) how `getPathToRoot` and `getApiMessages` handle tool nodes. Clarify that "collapsed by default" refers to the tool node's detail content, not hiding the node from the tree.
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` -- Add a note in the conventions section: "Tree node roles include 'user', 'assistant', and 'tool'. Tool nodes are visually compact and may appear between assistant nodes during tool-use turns. All tree traversal functions handle tool nodes."

---

## Conflict 5: Traversal Direction Inconsistency -- Feature 08 vs Feature 09

**Problem:** Feature 08 resolves model by walking node-to-root (first override wins), while Feature 09 resolves system prompt by walking root-to-node (last override wins). The directions are opposite, yielding the same "most specific wins" semantic but with confusing code differences.

**Proposed Resolution:** This is intentional and correct, not a bug. Document it explicitly as a design decision, and unify the explanatory framing.

**Why the directions differ and why both are correct:**

Both cascades implement "most specific override wins" (i.e., the override closest to the current node in the tree takes precedence). The difference is the *semantics* of "finding" the override:

- **Model cascade (node-to-root, first match wins):** You want the model that is "closest" to the current node. Walking from node to root and taking the first `modelOverride` found gives you exactly that. This is efficient: you stop as soon as you find one.

- **System prompt cascade (root-to-node, last match wins):** System prompts can be layered -- a branch might refine the chat-level prompt. Walking root-to-node and overwriting with each `systemPromptOverride` found means the deepest override "wins." This is semantically identical to "closest to the node wins," but the walking direction is root-to-node because `getPathToRoot()` already returns the path in root-to-node order, making a simple loop natural.

**The key insight: both algorithms produce identical results.** You could rewrite model resolution to walk root-to-node (last `modelOverride` wins), or system prompt resolution to walk node-to-root (first `systemPromptOverride` wins), and get the same answer.

**Recommended unification:** Standardize on one direction for consistency in the codebase, and use it for both cascades. The cleanest approach is root-to-node with "last wins," because `getPathToRoot()` already returns the path in root-to-node order:

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

// Usage:
const model = resolveCascade(nodeId, nodes, n => n.modelOverride, conversation.model || settings.defaultModel);
const systemPrompt = resolveCascade(nodeId, nodes, n => n.systemPromptOverride, conversation.systemPrompt || settings.defaultSystemPrompt);
```

This is a single generic function that both features use.

**Questions for user:** None. This is a documentation and code-style issue, not a functional conflict.

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/08-model-cascade.md` -- Replace the `resolveModel` function with a version that uses root-to-node traversal (last override wins), consistent with Feature 09. Add a note: "The cascade resolves by walking root-to-node and taking the last override, which is equivalent to walking node-to-root and taking the first. Both features use a shared `resolveCascade` utility."
- `/home/baud/Documents/DataML/GIT/baobab/Features/09-system-prompt-cascade.md` -- Add the same note referencing the shared utility.
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` -- Add a "Cascade Resolution Convention" subsection: "All feature cascades (model, system prompt, future settings cascades) use the same resolution pattern: walk root-to-node, last override wins. A shared `resolveCascade<T>()` utility in `src/lib/tree.ts` implements this."

---

## Conflict 6: Node Type Flag Proliferation -- `isSummary`, `isSynthetic`, `isMerge`

**Problem:** Feature 15 adds `isSummary: boolean`, Feature 16 adds `isSynthetic: boolean` and `isMerge: boolean`. Summary nodes also create synthetic user messages (the "[Summary request]" node) but do not use `isSynthetic`. This leads to inconsistent flag usage and a growing set of booleans.

**Proposed Resolution:** Replace the boolean flags with a single `nodeType` discriminated union field.

**Current state of boolean flags across specs:**
- `isSummary` (Feature 15): marks both the synthetic user node and the assistant summary node
- `isSynthetic` (Feature 16): marks nodes not sent to the API (synthetic user messages for merges)
- `isMerge` (Feature 16): marks merge-related nodes
- `userModified` (Feature 23): marks assistant messages edited by the user

**The problem:** A summary's "[Summary request]" user node is both synthetic (it was never sent to the API as a real user message) and a summary. But Feature 15 marks it as `isSummary: true` without setting `isSynthetic: true`. Meanwhile, a merge's synthetic user node sets both `isSynthetic: true` and `isMerge: true`. The flags overlap inconsistently.

**Proposed unified model:**

```typescript
type NodeType =
  | 'standard'       // normal user or assistant message
  | 'summary'        // summary request (user) or summary response (assistant)
  | 'merge'          // merge request (user) or merged response (assistant)
  | 'tool'           // tool use node (Feature 05)
  | 'edited';        // user-modified assistant message (Feature 23)

interface TreeNode {
  // ... existing fields
  nodeType: NodeType;                // default 'standard'
  mergeSourceIds?: string[];         // only for nodeType === 'merge', IDs of source nodes
}
```

**Why a single field instead of multiple booleans:**
- **Mutual exclusivity:** A node is either a standard message, a summary, a merge, a tool call, or an edited message. It cannot be two of these simultaneously. A discriminated union enforces this.
- **Simpler conditionals:** Instead of `if (node.isSummary && !node.isMerge)`, you write `if (node.nodeType === 'summary')`.
- **Extensible:** Adding future node types (e.g., "citation", "annotation") requires adding one enum value instead of another boolean.

**Handling the "synthetic" concept:**
- Rather than a separate `isSynthetic` flag, "synthetic" is implied by the node type. Summary user nodes (nodeType `'summary'`, role `'user'`) and merge user nodes (nodeType `'merge'`, role `'user'`) are synthetic by definition. The context-building code can check:
  ```typescript
  const isSynthetic = node.nodeType === 'summary' || node.nodeType === 'merge';
  ```
  Or more precisely, synthetic means "a user-role node that was not typed by the user." This is always derivable from `nodeType + role`.

**Handling `userModified` (Feature 23):**
- `userModified` is slightly different from the others -- it modifies an *assistant* message's provenance, not its structural role. Two options:
  - **Option A:** Include `'edited'` as a `NodeType`. Simple, but it means a node cannot be both a summary response AND edited.
  - **Option B:** Keep `userModified: boolean` as a separate field alongside `nodeType`. This allows `{ nodeType: 'standard', userModified: true }`.

I recommend **Option B**. `userModified` is an orthogonal annotation (provenance metadata), not a structural type. A user could theoretically duplicate-and-edit a merge response, which should be `{ nodeType: 'merge', userModified: true }`.

**Final proposed `TreeNode` additions:**

```typescript
type NodeType = 'standard' | 'summary' | 'merge' | 'tool';

interface TreeNode {
  // ... existing fields
  nodeType: NodeType;                // default 'standard'
  userModified: boolean;             // default false (Feature 23)
  mergeSourceIds?: string[];         // only when nodeType === 'merge'
}
```

**Questions for user:**
- Is Option B (keeping `userModified` separate from `nodeType`) acceptable? The alternative is making `'edited'` a node type, but that prevents marking edited merge/summary responses.
- Should the `nodeType` field default to `'standard'` for existing nodes during the Dexie migration? (Yes, this is the obvious choice, but confirming.)

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/15-summarize-branches.md` -- Replace `isSummary: boolean` with `nodeType: 'summary'`. Update all references (`node.isSummary` becomes `node.nodeType === 'summary'`).
- `/home/baud/Documents/DataML/GIT/baobab/Features/16-merge-branches.md` -- Replace `isSynthetic: boolean` and `isMerge: boolean` with `nodeType: 'merge'`. Update all references. Keep `mergeSourceIds` as-is.
- `/home/baud/Documents/DataML/GIT/baobab/Features/23-resend-duplicate.md` -- Keep `userModified: boolean` as specified. Add a note that it is orthogonal to `nodeType`.
- `/home/baud/Documents/DataML/GIT/baobab/Features/05-web-search.md` -- Note that tool nodes use `nodeType: 'tool'` (in addition to `role: 'tool'`). The `nodeType` provides a unified way to identify special nodes, while `role` determines API message formatting.
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` -- Add a "Node Types" section documenting the `NodeType` union and explaining the distinction between `nodeType` (structural) and `userModified` (provenance).

---

## Conflict 7: Merge Edges Break Dagre Layout (Feature 16)

**Problem:** Feature 16 creates dashed cross-hierarchy edges (from merge source nodes to the synthetic merge node) that dagre cannot handle properly, because dagre is a tree/DAG layout algorithm that assigns ranks based on directed edges, and cross-branch edges would distort the vertical positioning of nodes.

**Proposed Resolution:** Do NOT include merge edges in the dagre layout calculation. Render them as overlay edges after dagre has positioned all nodes.

**Implementation approach:**

1. **Separate merge edges from tree edges in `buildReactFlowGraph()`.** The function currently builds one edge list. Split it into two:
   ```typescript
   // In buildReactFlowGraph (src/lib/tree.ts)
   const treeEdges: Edge[] = [];   // parent-child relationships, fed to dagre
   const overlayEdges: Edge[] = []; // merge links, NOT fed to dagre

   // When processing a merge node:
   if (node.nodeType === 'merge' && node.mergeSourceIds) {
     for (const sourceId of node.mergeSourceIds) {
       overlayEdges.push({
         id: `merge-${node.id}-${sourceId}`,
         source: sourceId,
         target: node.id,
         type: 'smoothstep',
         animated: false,
         style: {
           stroke: '#7C9AB5',
           strokeWidth: 1.5,
           strokeDasharray: '6 3',
         },
         // Mark as non-layout edge
         data: { isMergeLink: true },
       });
     }
   }
   ```

2. **Feed only `treeEdges` to dagre in `computeDagreLayout()`.** The overlay edges are not passed to `g.setEdge()`. This means dagre does not know about the cross-branch connections and lays out the tree normally.

3. **Combine both edge arrays for React Flow rendering.** After dagre computes positions:
   ```typescript
   const layoutNodes = computeDagreLayout(flowNodes, treeEdges);
   const allEdges = [...treeEdges, ...overlayEdges];
   return { nodes: layoutNodes, edges: allEdges };
   ```

4. **React Flow renders overlay edges using the positioned nodes.** Since React Flow draws edges between nodes based on their positions, the dashed merge edges will be drawn from the source nodes (wherever dagre placed them) to the merge node (wherever dagre placed it). The edges may cross other nodes or edges, which is acceptable and visually communicates the "cross-branch link" concept.

5. **Edge routing strategy:** Use `type: 'smoothstep'` for merge edges (same as tree edges) so they route around nodes reasonably. If the crossing is too messy, consider `type: 'straight'` for merge edges (simple diagonal lines) or a custom edge component that draws a curved bezier avoiding the tree structure.

6. **Optional: custom edge component for merge links.**
   ```typescript
   // src/components/tree/MergeLinkEdge.tsx
   // A custom React Flow edge that renders as a dashed curved line
   // with an optional "merge" label or icon at the midpoint.
   ```
   Register it with React Flow: `edgeTypes={{ mergeLink: MergeLinkEdge }}`.

**Performance consideration:** Merge edges are rare (only created by explicit user action). The number of overlay edges will be small (2 per merge operation). This has negligible impact on layout performance.

**Edge case -- collapsed nodes:** If one of the merge source nodes is inside a collapsed subtree and therefore not rendered, the merge edge should not be rendered either. Add a check:
```typescript
if (node.nodeType === 'merge' && node.mergeSourceIds) {
  for (const sourceId of node.mergeSourceIds) {
    if (flowNodeIds.has(sourceId)) {  // only if source is visible
      overlayEdges.push({ ... });
    }
  }
}
```

**Questions for user:** None. This approach is standard practice for graph visualization tools that need to overlay non-hierarchical edges on a tree layout.

**Spec changes needed:**
- `/home/baud/Documents/DataML/GIT/baobab/Features/16-merge-branches.md` -- Update the "Visual Link Edges" section to specify that merge edges are overlay-only (not fed to dagre). Add the implementation detail about separating `treeEdges` and `overlayEdges` in `buildReactFlowGraph`. Add the collapsed-node edge case.
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` -- In the "Visual Channels Convention" table, add a row: "Dashed cross-branch edges (blue-gray) | Merge source links | Feature 16" with a note: "These edges are overlay-only and excluded from dagre layout computation."

---

## Summary of All Spec File Changes

| Spec File | Conflicts Addressed | Type of Change |
|-----------|---------------------|---------------|
| `_overview.md` | 1, 2, 4, 5, 6, 7 | Add convention notes, update tables |
| `08-model-cascade.md` | 1, 5 | Phase 1/2 split, unify traversal direction |
| `09-system-prompt-cascade.md` | 5 | Add shared utility note |
| `24-tags.md` | 2, 3 | Remove tag grouping sidebar, add sync docs |
| `13-project-knowledge.md` | 2, 3 | Update sidebar mockup, move projects to IndexedDB |
| `00-backend-architecture.md` | 3 | Remove projects from SQLite, add data ownership section |
| `05-web-search.md` | 4, 6 | Add tree structure impact section, nodeType |
| `15-summarize-branches.md` | 6 | Replace isSummary with nodeType |
| `16-merge-branches.md` | 6, 7 | Replace isSynthetic/isMerge with nodeType, overlay edges |
| `23-resend-duplicate.md` | 6 | Note userModified orthogonal to nodeType |

### Critical Files for Implementation
- `/home/baud/Documents/DataML/GIT/baobab/src/types/index.ts` - Core types file where TreeNode, Conversation, AppSettings, MessageRole, and the new NodeType union must be defined
- `/home/baud/Documents/DataML/GIT/baobab/src/lib/tree.ts` - Tree traversal functions (getPathToRoot, buildReactFlowGraph, computeDagreLayout) that need updates for tool nodes, overlay edges, and the shared resolveCascade utility
- `/home/baud/Documents/DataML/GIT/baobab/src/db/database.ts` - Dexie schema that needs migration for new fields (nodeType, tags, projects table) and version bumps
- `/home/baud/Documents/DataML/GIT/baobab/src/store/useTreeStore.ts` - Store logic that will need updates for new node types, project management, tag management, and merge/summary operations
- `/home/baud/Documents/DataML/GIT/baobab/Features/_overview.md` - Central spec file that needs convention documentation for cascade resolution, node types, sidebar architecture, and visual channels