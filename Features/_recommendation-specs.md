# Recommendation Specs

> **RECONCILED**: This document has been reconciled into the canonical feature specs and `_overview.md`. Decisions are recorded in [ADR-001](../Decisions/001-spec-reconciliation.md). Key outcomes: R1 (Unified Sidebar) adopted as convention in `_overview.md` with tag grouping deferred to v2. R2 (Data Sync) merged with S4 into Feature 00. R3 (NodeType Enum) adopted with simplified enum and Socratic types removed. R4 (Feature 08 Phasing) adopted with `ResolvedModel` return type. R5 (Socratic Elicitation) deferred per user decision. This file is retained for historical reference only.

Five pre-implementation recommendations for Baobab, written as full feature specs following the project's established format.

---

## R1 -- Unified Sidebar Design

### Summary

Define a single, coherent sidebar design that accommodates all planned navigation surfaces: projects (feature 13), tags (feature 24), starred messages (feature 11), search (feature 20), and the conversation list. The current sidebar (in `/home/baud/Documents/DataML/GIT/baobab/src/components/layout/Sidebar.tsx`) is a flat conversation list with a header and footer. Features 13, 24, 11, and 20 each independently propose sidebar additions that conflict or overlap. This spec reconciles them into one design.

### Priority

Pre-implementation -- should be finalized before features 11, 13, 20, and 24 are built.

### Dependencies

- **11 Star Messages**: starred list appears in sidebar.
- **13 Project Knowledge**: project grouping appears in sidebar.
- **20 Search**: global search bar in sidebar.
- **24 Tags**: tag filter/grouping in sidebar.

### Problem Statement

Feature 13 proposes a sidebar organized as `Search > Projects > Ungrouped`. Feature 24 proposes a sidebar organized as `Search > Tag Filter > Tag Groups > Untagged`. Feature 11 proposes a `[All Chats] [Starred]` tab bar. Feature 20 proposes a search bar that replaces the conversation list with search results. These four designs compete for the same vertical space and navigation hierarchy without a unified layout.

### Design Principles

1. **Search is always accessible** -- the search bar is persistent at the top, never hidden behind a tab.
2. **One primary grouping mode at a time** -- the user chooses between grouping by project, by tag, or flat (chronological). These are not nested inside each other.
3. **Starred messages are a filter, not a separate view** -- starring crosses all organizational boundaries.
4. **The footer remains stable** -- settings and export stay in the footer.

### Unified Sidebar Layout

```
+------------------------------+
| Baobab                 [+] |
+------------------------------+
| [Search messages...]     [Q] |   <-- persistent search bar
+------------------------------+
| View: [Chats] [Starred]     |   <-- primary mode toggle
+------------------------------+
| Group: [None|Projects|Tags]  |   <-- grouping selector (only in Chats view)
+------------------------------+
|                              |
| (content area -- scrollable) |
|                              |
+------------------------------+
| [Export]                     |
| [Settings]                  |
+------------------------------+
```

### Content Area Variants

#### Chats View + No Grouping (default)

```
+------------------------------+
| Chat: Biology Chat           |
|   [research/biology] [imp.]  |
| Chat: Random Question        |
| Chat: Code Review            |
+------------------------------+
```

Conversations listed chronologically (most recent first). Tag pills shown inline. This matches the current sidebar behavior plus tag pills from feature 24.

#### Chats View + Group by Projects

```
+------------------------------+
| v Biology Research (project) |
|   [files] textbook.pdf       |
|   [files] notes.md           |
|   Chat: Frog Evolution       |
|   Chat: Amphibian Genetics   |
|                              |
| v Code Review (project)      |
|   Chat: Refactoring Plan     |
|                              |
| v Ungrouped                  |
|   Chat: Random Chat          |
+------------------------------+
```

This matches feature 13's sidebar spec. Projects are collapsible. Knowledge files appear under their project. The `[+]` button on a project header adds a file or conversation to that project.

#### Chats View + Group by Tags

```
+------------------------------+
| Active filter: [All tags v]  |
|                              |
| v research                   |
|   Chat: Biology Chat         |
|   Chat: Physics Exploration  |
| v work                       |
|   Chat: Project Alpha Notes  |
| v untagged                   |
|   Chat: Random Chat          |
+------------------------------+
```

This matches feature 24's sidebar spec. The tag filter dropdown appears at the top of the content area. Tags act as collapsible groups. A conversation can appear under multiple tag groups if it has multiple tags.

#### Starred View

```
+------------------------------+
| Filter: [All chats v] [S ?]  |
|                              |
| S "Frogs are amphibians..."  |
|   in: Biology Chat -- 2h ago |
| S "The key insight is..."    |
|   in: Research -- 1d ago     |
| S "Here's the code..."      |
|   in: Coding Help -- 3d     |
+------------------------------+
```

This matches feature 11's starred messages list. Each entry shows a content preview, conversation name, and relative time. Clicking navigates to the node. The filter dropdown scopes to a specific conversation or project.

#### Search Results (replaces content area)

When the user types in the search bar and hits Enter:

```
+------------------------------+
| [climate change         ] [X]|
|                              |
| Filters: [All v] [S ?]      |
|                              |
| 12 results                   |
|                              |
| Asst: "Climate change has    |
|   led to significant..."     |
|   Biology Chat -- 2h ago     |
|                              |
| User: "Tell me about         |
|   climate change impacts"    |
|   Research Thread -- 1d      |
+------------------------------+
```

Clicking `[X]` or pressing Escape clears search and returns to the previous view. This matches feature 20's sidebar search spec.

### Data Model Changes

No new data model fields. This spec organizes existing and planned fields:

- `Conversation.projectId` (from feature 13)
- `Conversation.tags` (from feature 24)
- `TreeNode.starred` (from feature 11)

### State Management

Add a sidebar state slice to the UI store (or a new small Zustand store):

```typescript
interface SidebarState {
  primaryView: 'chats' | 'starred';
  groupingMode: 'none' | 'projects' | 'tags';
  activeTagFilter: string | null;       // null = all tags
  activeProjectFilter: string | null;   // null = all projects
  searchQuery: string;
  isSearchActive: boolean;
}
```

This is transient UI state -- not persisted to IndexedDB. The `groupingMode` could optionally be persisted in `AppSettings` as a user preference.

### Component Structure

Refactor the existing `Sidebar.tsx` (`/home/baud/Documents/DataML/GIT/baobab/src/components/layout/Sidebar.tsx`):

```
components/layout/
  Sidebar.tsx                    -- shell: header, search bar, mode toggles, footer
  sidebar/
    ConversationList.tsx         -- flat chronological list (groupingMode='none')
    ProjectGroupedList.tsx       -- project-grouped list (groupingMode='projects')
    TagGroupedList.tsx           -- tag-grouped list (groupingMode='tags')
    StarredList.tsx              -- starred messages list
    SearchResults.tsx            -- search results overlay
    SidebarConversationItem.tsx  -- shared conversation row component
    SidebarStarredItem.tsx       -- shared starred message row component
```

### Keyboard Shortcuts

- `Ctrl+K` / `Cmd+K`: focus sidebar search.
- `Ctrl+Shift+S` / `Cmd+Shift+S`: toggle starred view.
- `Escape` (when search is active): clear search.

### Edge Cases

- **No conversations exist**: show an empty state in all views. "No conversations yet" in Chats view, "No starred messages" in Starred view.
- **Conversation belongs to a project AND has tags**: when grouping by projects, it appears under its project. When grouping by tags, it appears under each of its tags. No conflict -- the grouping mode determines which organizational axis is active.
- **Starred messages from deleted conversations**: starred nodes should be cleaned up when a conversation is deleted (cascade delete in `deleteConversation`).
- **Switching grouping mode preserves scroll position**: each grouping mode should independently remember its scroll offset.
- **Sidebar width**: current sidebar is `w-64` (256px). This is sufficient for all variants. If tag pills or project names are long, truncate with ellipsis.

---

## R2 -- Data Sync Protocol

### Summary

Define the authoritative data ownership and synchronization protocol between the frontend (IndexedDB via Dexie) and the backend (SQLite via Drizzle). The current architecture (feature 00) states that "conversations and nodes remain in the browser's IndexedDB" while the backend stores projects and files. This spec formalizes the boundaries, conflict resolution, and sync behavior as more features introduce backend-resident data.

### Priority

Pre-implementation -- must be decided before feature 00 backend is built.

### Dependencies

- **00 Backend Architecture**: defines the backend database schema.
- **13 Project Knowledge**: first feature that requires frontend-backend data sharing (projects exist in both stores).
- **24 Tags**: canonical tag list lives in the backend, but tag-conversation associations live in IndexedDB.

### Protocol: Split Ownership with Defined Boundaries

After analyzing the architecture, the recommended protocol is **"Each store owns different data, with defined boundaries and a thin sync layer for shared references."**

Rationale: The frontend must work without the backend (browser-only mode is a core requirement per `_overview.md`). Making the backend authoritative would break offline/browser-only mode. Making the frontend authoritative for everything would make the backend pointless for data storage. Split ownership respects both constraints.

### Ownership Table

```
+-------------------+---------+----------+---------------------------+
| Data              | Owner   | Also In  | Sync Direction            |
+-------------------+---------+----------+---------------------------+
| Conversations     | Frontend| --       | None (frontend-only)      |
| TreeNodes         | Frontend| --       | None (frontend-only)      |
| AppSettings       | Frontend| --       | None (frontend-only)      |
| Projects (meta)   | Frontend| Backend  | Frontend -> Backend       |
| Project files     | Backend | Frontend | Backend -> Frontend (meta)|
| File content      | Backend | --       | On-demand fetch           |
| Tag canonical list| Backend | Frontend | Bidirectional merge       |
| Tag-conversation  | Frontend| --       | None (frontend-only)      |
| Search index (FTS)| Backend | --       | Frontend pushes content   |
| ML inference      | Backend | --       | On-demand call            |
+-------------------+---------+----------+---------------------------+
```

### Sync Protocol Details

#### Initial Sync (App Load)

When the app loads and the backend is available:

```typescript
async function initialSync(): Promise<void> {
  const backendAvailable = await checkBackendHealth();
  if (!backendAvailable) {
    // Browser-only mode: skip all sync
    return;
  }

  // 1. Push local projects to backend (frontend is owner)
  await syncProjectsToBackend();

  // 2. Pull file metadata from backend (backend is owner)
  await pullFileMetadataFromBackend();

  // 3. Merge tag canonical list (bidirectional)
  await mergeTagLists();
}
```

#### Project Sync (Frontend -> Backend)

Projects are created and managed in the frontend. The backend receives a copy for file association:

```typescript
async function syncProjectsToBackend(): Promise<void> {
  const localProjects = await db.projects.toArray();
  const remoteProjects = await backendFetch('/api/projects');

  // Projects that exist locally but not remotely: push to backend
  for (const local of localProjects) {
    const remote = remoteProjects.find(r => r.id === local.id);
    if (!remote) {
      await backendFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(local),
      });
    } else if (local.updatedAt > remote.updatedAt) {
      // Local is newer: update backend
      await backendFetch(`/api/projects/${local.id}`, {
        method: 'PUT',
        body: JSON.stringify(local),
      });
    }
  }

  // Projects that exist remotely but not locally: were deleted locally
  for (const remote of remoteProjects) {
    const local = localProjects.find(l => l.id === remote.id);
    if (!local) {
      await backendFetch(`/api/projects/${remote.id}`, {
        method: 'DELETE',
      });
    }
  }
}
```

#### File Metadata Sync (Backend -> Frontend)

File metadata is pulled from the backend and cached in frontend memory (not IndexedDB) for autocomplete:

```typescript
interface FileMetadataCache {
  projectId: string;
  files: ProjectFile[];      // lightweight metadata, no full text
  fetchedAt: number;
}

// In-memory cache, refreshed on project load
const fileCache = new Map<string, FileMetadataCache>();

async function pullFileMetadataFromBackend(): Promise<void> {
  const projects = await db.projects.toArray();
  for (const project of projects) {
    const files = await backendFetch(`/api/projects/${project.id}/files`);
    fileCache.set(project.id, {
      projectId: project.id,
      files,
      fetchedAt: Date.now(),
    });
  }
}
```

#### Tag List Merge (Bidirectional)

Tags have split ownership: the canonical tag list lives in the backend (for persistence and autocomplete), but tag-conversation associations live in the frontend. The merge reconciles both:

```typescript
async function mergeTagLists(): Promise<void> {
  // Get all tags used in frontend conversations
  const localTags = await getAllTagsFromConversations(); // scans IndexedDB

  // Get canonical tags from backend
  const remoteTags = await backendFetch('/api/tags');
  const remoteTagNames = new Set(remoteTags.map(t => t.name));
  const localTagNames = new Set(localTags);

  // Tags in frontend but not backend: push to backend
  for (const tag of localTags) {
    if (!remoteTagNames.has(tag)) {
      await backendFetch('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name: tag }),
      });
    }
  }

  // Tags in backend but not frontend: keep in backend (they may be used
  // by other clients or were recently removed from all conversations).
  // Do NOT delete from backend -- the canonical list is append-mostly.
}
```

### Conflict Resolution Rules

| Scenario | Resolution |
|----------|-----------|
| Same project edited in two tabs | Last-write-wins based on `updatedAt` timestamp |
| File uploaded while frontend offline | File appears on next sync when frontend comes online |
| Tag removed from all conversations | Tag remains in backend canonical list until explicit prune |
| Backend unavailable during operation | Operation proceeds locally; sync resumes on reconnect |
| Backend has file, frontend has no project | Backend file is orphaned; cleanup job removes it |

### Offline Behavior

When the backend is unavailable:

1. **All conversation operations work normally** -- they are frontend-only.
2. **File upload is disabled** -- the upload button shows a tooltip: "Backend required for file upload."
3. **Tag autocomplete uses local data** -- derived by scanning `conversation.tags` across all conversations (same as browser-only mode per feature 24).
4. **Search is local-only** -- uses Dexie `.filter()` instead of backend FTS5.
5. **A "Backend offline" indicator appears** -- small banner at the top of the sidebar or an icon in the footer.

### Incremental Sync

After initial sync, incremental changes are pushed/pulled as they happen:

```typescript
// When a project is created/updated/deleted in the frontend:
async function onProjectChange(project: Project, action: 'create' | 'update' | 'delete') {
  if (!isBackendAvailable()) return; // queue for later? No -- keep it simple.

  switch (action) {
    case 'create':
      await backendFetch('/api/projects', { method: 'POST', body: JSON.stringify(project) });
      break;
    case 'update':
      await backendFetch(`/api/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
      break;
    case 'delete':
      await backendFetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      break;
  }
}

// When a tag is added/removed from a conversation in the frontend:
async function onTagChange(tag: string, action: 'add' | 'remove') {
  if (!isBackendAvailable()) return;

  if (action === 'add') {
    // Ensure the tag exists in the backend canonical list
    await backendFetch('/api/tags', { method: 'POST', body: JSON.stringify({ name: tag }) });
    // Backend should handle idempotent creation (ignore if already exists)
  }
  // 'remove' does NOT delete from backend canonical list
}
```

### Error Recovery

```typescript
async function withSyncRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.warn('Sync failed after retries, continuing in offline mode', error);
        return null;
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  return null;
}
```

### Backend API Changes

Add a sync-oriented endpoint for bulk operations:

```typescript
// POST /api/sync
interface SyncRequest {
  projects: { action: 'upsert' | 'delete'; data: Project }[];
  tags: { action: 'upsert'; name: string }[];
}

interface SyncResponse {
  projects: Project[];          // full list after sync
  tags: { name: string }[];    // full canonical list after sync
  files: ProjectFile[];         // all file metadata
}
```

This allows the initial sync to be a single round-trip instead of N requests.

### Browser-Only Mode

When `isBackendAvailable()` returns false (no `VITE_API_URL` configured):

- All data lives in IndexedDB exclusively.
- Projects are stored in a frontend-only Dexie table.
- Tag canonical list is derived from conversation tags on the fly.
- No sync operations run.
- No "Backend offline" indicator (this is the expected mode).

### Edge Cases

- **Multiple browser tabs**: each tab does its own sync with the backend. The backend is the arbiter for file and tag data. Conversations are per-tab (Dexie handles multi-tab via its built-in observable system).
- **Backend schema migration**: the backend should version its API. The frontend checks `/api/health` response for a version field and warns if incompatible.
- **Very large conversation export/import**: not part of sync. Export/import remains a manual JSON file operation (per the current sidebar Export button).

---

## R3 -- NodeType Enum

### Summary

Replace the accumulating boolean flags on `TreeNode` (`isSummary`, `isSynthetic`, `isMerge`, `userModified`, `deadEnd`, `starred`) with a `NodeType` enum for mutually exclusive type classification, plus a separate `NodeFlags` bitfield for orthogonal boolean properties. This reduces confusion about which combinations are valid and centralizes rendering/behavior decisions.

### Priority

Pre-implementation -- should be introduced before features 05, 15, and 16 add their node types.

### Dependencies

None (this is a foundational type change that all features build on).

### Problem Statement

The current `TreeNode` in `/home/baud/Documents/DataML/GIT/baobab/src/types/index.ts` has no type classification beyond `role: 'user' | 'assistant'`. Planned features add boolean flags:

- Feature 05: `role: 'tool'` (extends MessageRole)
- Feature 12: `deadEnd: boolean`
- Feature 15: `isSummary: boolean`
- Feature 16: `isSynthetic: boolean`, `isMerge: boolean`
- Feature 23: `userModified: boolean`
- Feature 11: `starred: boolean`

Some of these are **mutually exclusive types** (a node cannot be both a regular message and a tool-use node and a summary node). Others are **orthogonal flags** (a summary node can be starred and dead-ended). Mixing them as flat booleans creates an invalid-state explosion: `isSummary && isMerge && role === 'tool'` is meaningless but the type system allows it.

### Design

#### NodeType Enum (Mutually Exclusive)

```typescript
enum NodeType {
  /** Regular user or assistant message */
  Message = 'message',

  /** Tool use/result node (feature 05) -- search results, file reads */
  ToolUse = 'tool_use',

  /** Summary node generated by the summarize-branch feature (feature 15) */
  Summary = 'summary',

  /** Synthetic user node created for a merge request (feature 16) */
  MergeRequest = 'merge_request',

  /** Assistant node containing merged/synthesized content (feature 16) */
  MergeResult = 'merge_result',

  /** Synthetic user node for Socratic elicitation prompts (feature 14) */
  SocraticProbe = 'socratic_probe',

  /** Assistant node containing a Socratic elicitation response (feature 14) */
  SocraticResponse = 'socratic_response',
}
```

Each node has exactly one `nodeType`. The default is `NodeType.Message`.

#### NodeFlags (Orthogonal Booleans)

These are properties that can apply to ANY node type:

```typescript
interface TreeNode {
  // ... existing fields (id, conversationId, parentId, role, content, model, etc.)

  /** Mutually exclusive classification */
  nodeType: NodeType;             // default: 'message'

  /** Orthogonal flags -- any combination is valid */
  starred: boolean;               // default: false (feature 11)
  deadEnd: boolean;               // default: false (feature 12)
  userModified: boolean;          // default: false (feature 23)
  collapsed: boolean;             // already exists

  /** Type-specific metadata (union based on nodeType) */
  toolUse?: {                     // present when nodeType === 'tool_use'
    toolName: string;
    input: Record<string, unknown>;
    result?: string;
  };
  mergeSourceIds?: string[];      // present when nodeType === 'merge_request'
  socraticConfig?: {              // present when nodeType === 'socratic_probe'
    goalId: string;
    probeModel: string;
    probeInstructions: string;
  };
}
```

#### Updated Type Definition

The full updated `TreeNode` in `/home/baud/Documents/DataML/GIT/baobab/src/types/index.ts`:

```typescript
export type MessageRole = 'user' | 'assistant';

export enum NodeType {
  Message = 'message',
  ToolUse = 'tool_use',
  Summary = 'summary',
  MergeRequest = 'merge_request',
  MergeResult = 'merge_result',
  SocraticProbe = 'socratic_probe',
  SocraticResponse = 'socratic_response',
}

export interface TreeNode {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: MessageRole;
  content: string;
  model: string;
  createdAt: number;
  childIds: string[];

  // Classification
  nodeType: NodeType;

  // Orthogonal flags
  collapsed: boolean;
  starred: boolean;
  deadEnd: boolean;
  userModified: boolean;

  // Cascade overrides (features 08, 09)
  modelOverride?: string;
  providerOverride?: string;
  systemPromptOverride?: string;

  // Type-specific metadata
  toolUse?: {
    toolName: string;
    input: Record<string, unknown>;
    result?: string;
  };
  mergeSourceIds?: string[];
  socraticConfig?: {
    goalId: string;
    probeModel: string;
    probeInstructions: string;
  };
}
```

### Rendering Differences by NodeType

```typescript
function getNodeVisualConfig(nodeType: NodeType): NodeVisualConfig {
  switch (nodeType) {
    case NodeType.Message:
      return { icon: null, badge: null, borderStyle: 'solid', bgTint: null };

    case NodeType.ToolUse:
      return {
        icon: 'Search',           // or 'FileText' etc based on toolName
        badge: 'tool',
        borderStyle: 'solid',
        bgTint: null,
        compact: true,            // smaller node in tree view
      };

    case NodeType.Summary:
      return {
        icon: 'FileText',
        badge: 'Summary',
        borderStyle: 'solid',
        bgTint: '#7C9AB5/10',     // blue-gray tint
        leftBorder: '#7C9AB5',    // 3px left border
      };

    case NodeType.MergeRequest:
      return {
        icon: 'GitMerge',
        badge: 'Merge',
        borderStyle: 'dashed',
        bgTint: '#7C9AB5/10',
      };

    case NodeType.MergeResult:
      return {
        icon: 'GitMerge',
        badge: 'Merged Response',
        borderStyle: 'solid',
        bgTint: '#7C9AB5/10',
        leftBorder: '#7C9AB5',
      };

    case NodeType.SocraticProbe:
      return {
        icon: 'HelpCircle',
        badge: 'Socratic',
        borderStyle: 'dotted',
        bgTint: '#9B7CB5/10',     // purple tint
      };

    case NodeType.SocraticResponse:
      return {
        icon: 'HelpCircle',
        badge: 'Socratic',
        borderStyle: 'solid',
        bgTint: '#9B7CB5/10',
      };
  }
}
```

### Behavior in Context Building (getPathToRoot)

When building the API context for a new message, different node types are treated differently:

```typescript
function buildApiContext(
  nodeId: string,
  nodes: Record<string, TreeNode>
): { role: string; content: string }[] {
  const path = getPathToRoot(nodeId, nodes);

  return path
    .filter(node => {
      // Skip the root greeting
      if (node.parentId === null && node.role === 'assistant') return false;
      // Skip empty content
      if (!node.content) return false;

      switch (node.nodeType) {
        case NodeType.Message:
          return true;               // always included

        case NodeType.ToolUse:
          return false;              // tool nodes are NOT included in context
                                     // (they were part of a previous tool-use loop)

        case NodeType.Summary:
          return true;               // summaries ARE included (they replace the
                                     // original branch content for context)

        case NodeType.MergeRequest:
          return true;               // synthetic merge prompt IS included
                                     // (frames the merged response)

        case NodeType.MergeResult:
          return true;               // merged content IS included

        case NodeType.SocraticProbe:
          return false;              // probe prompts are NOT included in user
                                     // conversation context (they're meta-prompts)

        case NodeType.SocraticResponse:
          return false;              // probe responses are NOT included in
                                     // user conversation context
      }
    })
    .map(node => ({ role: node.role, content: node.content }));
}
```

### Migration

Existing nodes in IndexedDB have no `nodeType` field. The Dexie migration adds a default:

```typescript
this.version(2).stores({
  conversations: 'id, createdAt, updatedAt',
  nodes: 'id, conversationId, parentId, starred, nodeType',
}).upgrade(tx => {
  return tx.table('nodes').toCollection().modify(node => {
    if (!node.nodeType) node.nodeType = 'message';
    if (node.starred === undefined) node.starred = false;
    if (node.deadEnd === undefined) node.deadEnd = false;
    if (node.userModified === undefined) node.userModified = false;
  });
});
```

### Visual Channels Update

Add to the Visual Channels Convention table in `_overview.md`:

| Visual Property | Reserved For | Feature |
|----------------|-------------|---------|
| **Node left border (blue-gray)** | Summary / merge type indicator | Features 15, 16 |
| **Node border style (dashed)** | Merge request synthetic node | Feature 16 |
| **Node border style (dotted)** | Socratic probe node | Feature 14 |
| **Node background tint (blue-gray)** | Summary / merge nodes | Features 15, 16 |
| **Node background tint (purple)** | Socratic elicitation nodes | Feature 14 |

### Edge Cases

- **Unknown nodeType in stored data**: if a node is loaded with an unrecognized `nodeType` (e.g., from a future version), treat it as `NodeType.Message` with a warning in the console.
- **Changing a node's type after creation**: not supported. Node types are set at creation time and are immutable.
- **Querying by nodeType**: the Dexie index on `nodeType` allows efficient queries like "find all summary nodes in this conversation."

---

## R4 -- Feature 08 Phasing (Model Cascade)

### Summary

Split feature 08 (Model Cascade) into two implementation phases. Phase 1 delivers the full cascade UX (global, chat, branch, message model selection) using only Anthropic models. Phase 2 extends the model selector to group by provider after feature 07 (Inference Providers) lands. This avoids blocking the cascade UX on the multi-provider abstraction while ensuring Phase 1 code gracefully extends to Phase 2.

### Priority

Tier 1 -- Phase 1 should be implemented early (it is already Tier 1 in `_overview.md`).

### Dependencies

- **Phase 1**: None (removes the feature 07 dependency).
- **Phase 2**: **07 Inference Providers**.

### Phase 1: Anthropic-Only Cascade

#### What Ships

1. **Four-level cascade**: global default, chat default, branch default, message override.
2. **Model selector**: flat list of Anthropic models (fetched from `client.models.list()` as currently implemented in `/home/baud/Documents/DataML/GIT/baobab/src/store/useSettingsStore.ts`).
3. **"Inherit" option**: first item in the selector, showing the currently resolved model.
4. **Model chip on tree nodes**: abbreviated model name, orange when overridden.
5. **Chat input model selector**: shows effective model for the next message with a "change" dropdown.
6. **Detail panel model section**: shows the effective model, source of inheritance, and override controls.

#### Data Model (Phase 1)

```typescript
interface TreeNode {
  // ... existing fields
  modelOverride?: string;        // null = inherit from parent/cascade
  // NO providerOverride in Phase 1
}

interface Conversation {
  // ... existing fields
  // model already exists and serves as chat-level default
  // NO providerId in Phase 1
}
```

#### Resolution Algorithm (Phase 1)

```typescript
function resolveModel(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): string {
  // Walk from node to root, looking for the first model override
  let current: TreeNode | undefined = nodes[nodeId];
  while (current) {
    if (current.modelOverride) {
      return current.modelOverride;
    }
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  // Fall back to conversation, then global
  return conversation.model || settings.defaultModel;
}
```

Note: returns a `string` (model ID), not an object with `providerId`. This is the key simplification.

#### Model Selector UI (Phase 1)

A flat dropdown (no provider grouping):

```
+-----------------------------------+
| (circle) Inherit (Haiku 4.5)     |
| --------------------------------- |
| (circle) Claude Haiku 4.5        |
| (circle) Claude Sonnet 4         |
| (circle) Claude Opus 4           |
+-----------------------------------+
```

The models come from `useSettingsStore.availableModels`, which is already populated by `fetchModels()` in `/home/baud/Documents/DataML/GIT/baobab/src/store/useSettingsStore.ts`.

#### Chat Input (Phase 1)

```
+---------------------------------------------------+
| Replying to: Here is my response...               |
|   Model: Haiku 4.5 [change v]                     |
+-------------------------------------------------  +
| [Type a message...]                    [Send >]   |
+---------------------------------------------------+
```

Clicking "change" opens the flat model dropdown. The selected model is stored temporarily in the chat input component state and applied as `modelOverride` on the new user + assistant nodes when the message is sent.

#### Streaming Hook Changes (Phase 1)

Update `useStreamingResponse` in `/home/baud/Documents/DataML/GIT/baobab/src/hooks/useStreamingResponse.ts`:

```typescript
// Current: uses conversation.model or settings.defaultModel
// Phase 1: resolves through cascade

const effectiveModel = resolveModel(
  replyTargetNodeId,
  nodes,
  currentConversation,
  settings
);

// If user selected a per-message override in the chat input:
const modelToUse = pendingModelOverride || effectiveModel;

// Store the override on the new nodes
const userNode: TreeNode = {
  // ... existing fields
  modelOverride: pendingModelOverride || undefined,
};
```

The API call still goes through `sendMessage` in `/home/baud/Documents/DataML/GIT/baobab/src/api/claude.ts`, which already accepts a `model` parameter.

### Phase 2: Multi-Provider Extension

#### What Changes

1. **Model selector becomes grouped by provider**: same cascade logic, but the dropdown shows provider sections.
2. **Provider ID tracked on nodes**: `providerOverride` field added to `TreeNode`.
3. **Resolution returns provider + model**: the function signature changes.
4. **Streaming routes through provider abstraction**: instead of calling `sendMessage` directly, it calls `getProvider(providerId).sendMessage(...)`.

#### Data Model (Phase 2 additions)

```typescript
interface TreeNode {
  // ... Phase 1 fields
  providerOverride?: string;     // NEW in Phase 2: null = inherit
}

interface Conversation {
  // ... Phase 1 fields
  providerId?: string;           // NEW in Phase 2: default provider for this chat
}

interface AppSettings {
  // ... Phase 1 fields
  providers: Record<string, ProviderConfig>;  // NEW in Phase 2
  defaultProvider: string;                     // NEW in Phase 2
}
```

#### Resolution Algorithm (Phase 2)

```typescript
interface ResolvedModel {
  model: string;
  providerId: string;
}

function resolveModel(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): ResolvedModel {
  let current: TreeNode | undefined = nodes[nodeId];
  while (current) {
    if (current.modelOverride) {
      return {
        model: current.modelOverride,
        providerId: current.providerOverride || conversation.providerId || settings.defaultProvider,
      };
    }
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return {
    model: conversation.model || settings.defaultModel,
    providerId: conversation.providerId || settings.defaultProvider,
  };
}
```

This is a backward-compatible extension. The Phase 1 version returns a `string`; Phase 2 wraps it in an object. To minimize Phase 2 churn, Phase 1 can use a wrapper:

```typescript
// Phase 1 compatibility: resolveModel returns string
// Phase 2: change return type and callers

// OR: Phase 1 already returns the object shape with providerId hardcoded
function resolveModel(...): ResolvedModel {
  // ... same walk logic ...
  return {
    model: resolvedModelId,
    providerId: 'anthropic',  // hardcoded in Phase 1; extended in Phase 2
  };
}
```

**Recommendation**: use the `ResolvedModel` return type from Phase 1, with `providerId` always set to `'anthropic'`. This way Phase 2 only needs to:
1. Remove the hardcoded `'anthropic'`.
2. Add `providerOverride` to the walk logic.
3. Update the UI to show grouped models.

#### Model Selector UI (Phase 2)

```
+-----------------------------------+
| (circle) Inherit (Haiku 4.5)     |
| --------------------------------- |
| Anthropic                         |
|   (circle) Claude Haiku 4.5      |
|   (circle) Claude Sonnet 4       |
|   (circle) Claude Opus 4         |
| --------------------------------- |
| OpenAI                            |
|   (circle) GPT-4o                |
|   (circle) GPT-4o mini           |
| --------------------------------- |
| Ollama                            |
|   (circle) llama3.1:70b          |
+-----------------------------------+
```

#### Shared Code Between Phases

| Component | Phase 1 | Phase 2 Change |
|-----------|---------|----------------|
| `resolveModel()` | Returns `{ model, providerId: 'anthropic' }` | Walk also checks `providerOverride` |
| `TreeNode.modelOverride` | `string \| undefined` | Same |
| `TreeNode.providerOverride` | Not present (undefined) | `string \| undefined` |
| Model chip on nodes | Shows model name | Shows `ProviderName ModelName` when non-default provider |
| Model dropdown component | Flat list | Grouped by provider (SectionList) |
| `getNodeIndicators()` | Compares model to chat default | Same logic, also compares provider |
| Streaming hook | Calls `sendMessage()` directly | Calls `getProvider(providerId).sendMessage()` |
| Settings store | `availableModels: ModelInfo[]` | Same type, but aggregated from all providers |

#### Graceful Extension Checklist

To ensure Phase 1 code transitions smoothly to Phase 2:

1. Use `ResolvedModel` return type from the start (even with hardcoded provider).
2. Store `ModelInfo` objects (with `providerId` field) in the available models list. In Phase 1, all will have `providerId: 'anthropic'`. Phase 2 adds models from other providers.
3. The model dropdown component should accept a `groupByProvider: boolean` prop. Phase 1 passes `false`; Phase 2 passes `true`.
4. The `sendMessage` abstraction should accept a `providerId` parameter from Phase 1, even if it only handles `'anthropic'`. Phase 2 routes to the provider registry.
5. Never compare model IDs with hardcoded strings like `'claude-3-5-haiku...'`. Always use the resolved model from the cascade.

### Edge Cases

- **Phase 1 nodes loaded in Phase 2**: nodes created in Phase 1 have no `providerOverride`. The cascade naturally falls through to the conversation or global default provider. No migration needed.
- **Phase 2 model IDs from non-Anthropic providers**: `modelOverride` stores the raw model ID (e.g., `gpt-4o`). Combined with `providerOverride: 'openai'`, it unambiguously identifies the model. If two providers have the same model ID (unlikely but possible with OpenRouter), the provider ID disambiguates.
- **Downgrading from Phase 2 to Phase 1**: not supported. Nodes with non-Anthropic `modelOverride` values will show "Model unavailable" in Phase 1.

---

## R5 -- Feature 14: Socratic Elicitation

### Summary

Enable goal-directed information elicitation using a secondary "probing" model that systematically asks questions to extract knowledge from the primary conversation. The user defines a goal (what information they want to gather) and instructions for the probing model. The probing model then generates targeted questions, evaluates responses against a rubric, scores progress across branches, and can aggregate a complete answer from partial answers scattered across the conversation tree.

### Priority

Tier 4 -- advanced/research.

### Dependencies

- **00 Backend Architecture**: rubric scoring and aggregation benefit from backend compute, though a degraded browser-only mode is possible.
- **07 Inference Providers**: the probing model can be a different provider than the conversation model.
- **08 Model Cascade**: the probing model needs to be selectable independently of the conversation model.
- **11 Star Messages**: aggregation can operate on starred messages as a scope filter.
- **15 Summarize Branches**: shares the branch content collection logic.

### Concepts

#### Socratic Goal

A named objective for information elicitation. Describes what the user wants to learn or extract from the conversation. Persisted per-conversation.

#### Probing Model

A separate LLM instance (can be the same or different model/provider from the conversation model) that generates targeted questions, evaluates responses, and performs aggregation. The probing model never appears in the main conversation context -- it operates in a meta-layer.

#### Rubric

A structured scoring template with terms/criteria that define completeness. The probing model evaluates conversation content against the rubric.

#### Aggregation

The process of compiling partial answers from across the conversation tree into a single comprehensive response.

### Data Model

#### Frontend (IndexedDB)

```typescript
interface SocraticGoal {
  id: string;
  conversationId: string;
  name: string;                           // e.g., "Extract full API documentation"
  description: string;                     // detailed goal description
  probeModel: string;                      // model ID for the probing model
  probeProvider: string;                   // provider ID for the probing model
  probeInstructions: string;              // system prompt for the probing model
  rubric: RubricItem[];
  status: 'active' | 'paused' | 'complete';
  createdAt: number;
  updatedAt: number;
}

interface RubricItem {
  id: string;
  term: string;                           // e.g., "Authentication methods"
  description: string;                     // what constitutes a complete answer
  weight: number;                          // 0-1, relative importance
  score: number;                           // 0-1, current completeness
  sourceNodeIds: string[];                // nodes that contributed to this score
  lastScoredAt: number;
}

interface SocraticScore {
  id: string;
  goalId: string;
  nodeId: string;                         // the node being scored
  rubricItemId: string;
  score: number;                          // 0-1
  explanation: string;                     // why this score
  createdAt: number;
}
```

Dexie schema:
```
socraticGoals: 'id, conversationId, status'
socraticScores: 'id, goalId, nodeId, rubricItemId'
```

#### TreeNode Extension (via NodeType enum from R3)

Socratic probe nodes use `NodeType.SocraticProbe` and `NodeType.SocraticResponse`:

```typescript
// On a SocraticProbe node:
interface TreeNode {
  // ... standard fields
  nodeType: NodeType.SocraticProbe;
  socraticConfig: {
    goalId: string;
    probeModel: string;
    probeInstructions: string;
  };
}
```

### Workflow

#### 1. Create a Socratic Goal

The user opens the Socratic panel from the conversation header:

```
+----------------------------------------------+
| Biology Chat    [Tree] [Thread] [? Socratic] |
+----------------------------------------------+
```

Clicking the Socratic button opens a side panel (replacing or tabbing alongside the detail panel):

```
+----------------------------------------------+
| Socratic Elicitation                    [X]  |
+----------------------------------------------+
| [+ New Goal]                                 |
|                                              |
| No goals yet. Create one to start            |
| guided information extraction.               |
+----------------------------------------------+
```

#### 2. Goal Configuration Dialog

```
+----------------------------------------------+
| New Socratic Goal                       [X]  |
+----------------------------------------------+
| Goal Name:                                   |
| [Extract climate change impacts        ]     |
|                                              |
| Description:                                 |
| +------------------------------------------+|
| | I want to systematically extract all     ||
| | known impacts of climate change on       ||
| | marine ecosystems, organized by          ||
| | ecosystem type.                          ||
| +------------------------------------------+|
|                                              |
| Probing Model: [Claude Haiku 4.5 v]         |
|                                              |
| Probe Instructions:                          |
| +------------------------------------------+|
| | You are a research interviewer.          ||
| | Your goal is to elicit detailed          ||
| | information about {goal}. Ask            ||
| | focused follow-up questions.             ||
| | Do not accept vague answers.             ||
| +------------------------------------------+|
|                                              |
| Rubric:                                      |
| +------------------------------------------+|
| | Term: [Coral reef impacts        ]       ||
| | Description: [Effects on coral    ]      ||
| | Weight: [0.3]          [+ Add term]      ||
| |                                          ||
| | Term: [Deep sea impacts          ]       ||
| | Description: [Effects on deep sea ]      ||
| | Weight: [0.3]          [Remove]          ||
| |                                          ||
| | Term: [Coastal impacts           ]       ||
| | Description: [Effects on coasts   ]      ||
| | Weight: [0.4]          [Remove]          ||
| +------------------------------------------+|
|                                              |
|                      [Cancel] [Create Goal]  |
+----------------------------------------------+
```

The probe instructions support `{goal}` and `{rubric}` template variables that are replaced with the actual goal description and rubric at runtime.

#### 3. Generating Probe Questions

Once a goal is active, the user can trigger probe question generation from any node:

Right-click context menu (when a Socratic goal is active):
```
+---------------------------+
| Reply here                |
| Star                      |
| --                        |
| ? Ask Socratic probe      |
| --                        |
| Copy                      |
| Delete                    |
+---------------------------+
```

Or from the Socratic panel:
```
+----------------------------------------------+
| Goal: Extract climate change impacts         |
| Status: Active                               |
|                                              |
| [? Generate next question]                   |
| Target node: "Frogs are amphibians..."       |
|                                              |
| Progress:                                    |
|  Coral reef impacts    [=====>    ] 52%      |
|  Deep sea impacts      [=>        ] 15%      |
|  Coastal impacts       [==>       ] 28%      |
|  Overall               [===>      ] 33%      |
+----------------------------------------------+
```

#### 4. Probe Execution Flow

1. User triggers "Ask Socratic probe" on a target node.
2. The system collects context:
   - The goal description and rubric.
   - The conversation path from root to the target node.
   - Current rubric scores (so the probe knows what information is still missing).
3. Sends to the probing model:
   ```
   System: {probeInstructions with {goal} and {rubric} replaced}

   User: Here is the conversation so far:
   {formatted conversation path}

   Current rubric progress:
   - Coral reef impacts: 52% complete
   - Deep sea impacts: 15% complete
   - Coastal impacts: 28% complete

   Generate a focused question that will help fill the gaps
   in the least-covered rubric areas. Return ONLY the question.
   ```
4. The probing model generates a question.
5. A `SocraticProbe` node is created as a child of the target node, containing the generated question as its content.
6. The user can then reply to this probe node, which continues the conversation naturally.
7. When the user's reply (and the main model's response) arrives, the scoring pipeline triggers.

### Scoring Pipeline

#### Automatic Scoring After Each Response

After any assistant response in a conversation with an active Socratic goal:

```typescript
async function scoreNode(
  nodeId: string,
  goal: SocraticGoal,
  nodes: Record<string, TreeNode>
): Promise<SocraticScore[]> {
  const node = nodes[nodeId];
  if (node.role !== 'assistant') return [];

  // Get the path context
  const path = getPathToRoot(nodeId, nodes);
  const recentContent = path.slice(-6).map(n =>
    `${n.role === 'user' ? 'User' : 'Assistant'}: ${n.content}`
  ).join('\n\n');

  const scores: SocraticScore[] = [];

  for (const rubricItem of goal.rubric) {
    // Ask the probing model to score this rubric item
    const scorePrompt = `
      Evaluate the following conversation excerpt against this rubric item:

      Rubric item: ${rubricItem.term}
      Description: ${rubricItem.description}

      Conversation:
      ${recentContent}

      Score from 0.0 to 1.0 how completely this conversation addresses
      the rubric item. Return JSON: {"score": 0.X, "explanation": "..."}
    `;

    const result = await callProbingModel(goal, scorePrompt);
    const parsed = JSON.parse(result);

    scores.push({
      id: crypto.randomUUID(),
      goalId: goal.id,
      nodeId,
      rubricItemId: rubricItem.id,
      score: parsed.score,
      explanation: parsed.explanation,
      createdAt: Date.now(),
    });
  }

  return scores;
}
```

#### Aggregate Rubric Scores

The overall score for a rubric item is the maximum score across all nodes:

```typescript
function aggregateRubricScore(
  rubricItemId: string,
  scores: SocraticScore[]
): number {
  const itemScores = scores.filter(s => s.rubricItemId === rubricItemId);
  if (itemScores.length === 0) return 0;
  return Math.max(...itemScores.map(s => s.score));
}
```

### Cross-Branch Scoring

The scoring operates across ALL branches in the conversation, not just the current path. This is the key differentiator -- information may be partially discovered in different branches.

```
+----------------------------------------------+
| Rubric: Coral reef impacts (52%)             |
|                                              |
| Sources:                                     |
|   Branch 1, msg 4: 0.45 -- "bleaching..."   |
|   Branch 2, msg 7: 0.52 -- "acidification.."| <-- best
|   Branch 3, msg 2: 0.20 -- "brief mention"  |
+----------------------------------------------+
```

### Aggregation

#### Aggregate from Starred Messages

The user can aggregate answers from starred messages only:

```
+----------------------------------------------+
| Aggregate Answer                        [X]  |
+----------------------------------------------+
| Scope:                                       |
|   (*) All branches                           |
|   ( ) Starred messages only                  |
|   ( ) Selected nodes (Ctrl+Click)            |
|                                              |
| Aggregation Model: [Claude Sonnet 4 v]      |
|                                              |
| Aggregation Prompt:                          |
| +------------------------------------------+|
| | Compile a complete, coherent answer      ||
| | from the following partial answers.      ||
| | Resolve contradictions. Organize by      ||
| | the rubric categories.                   ||
| +------------------------------------------+|
|                                              |
|                    [Cancel] [Aggregate]       |
+----------------------------------------------+
```

#### Aggregation Flow

1. User clicks "Aggregate" in the Socratic panel.
2. System collects source content based on scope:
   - **All branches**: walk every branch, extract assistant messages, include rubric scores.
   - **Starred only**: filter to `starred === true` nodes.
   - **Selected nodes**: use multi-select (same as feature 16 merge selection).
3. Build the aggregation prompt:
   ```
   System: {aggregation instructions}

   User: Goal: {goal description}

   Rubric:
   {rubric items with scores}

   Source material (from {N} messages across {M} branches):

   [Source 1 - Branch "Tell me about coral", msg 4, rubric score: 0.45]
   {content}

   [Source 2 - Branch "Marine ecosystems", msg 7, rubric score: 0.52]
   {content}

   ...

   Compile a complete answer addressing all rubric items.
   ```
4. Send to the aggregation model (may be different from the probing model).
5. The aggregated response is created as a new branch from the conversation root:
   - A `SocraticProbe` node (synthetic user) with content: `[Socratic aggregation: {goal name}]`.
   - A `SocraticResponse` node (assistant) with the aggregated answer.

### Visual Treatment

#### Socratic Probe Nodes in Tree

```
+----------------------------------------------+
| ? Socratic Probe              [Haiku]        |  <-- dotted border, purple tint
|                                              |
| What specific mechanisms drive coral         |
| bleaching under ocean acidification?         |
+----------------------------------------------+
```

- **Dotted border**: `border-dotted border-2 border-[#9B7CB5]`
- **Purple tint background**: subtle purple to distinguish from regular messages and blue-gray summaries/merges.
- **? icon**: `HelpCircle` from lucide-react.

#### Socratic Score Overlay on Tree Nodes

When a Socratic goal is active, scored nodes show a small progress indicator:

```
+----------------------------------------------+
| Claude                      [Haiku] [32%]    |
|                                              |
| Frogs are amphibians that...                 |
+----------------------------------------------+
```

The `[32%]` badge shows the maximum rubric contribution of this node. Clicking it opens the score breakdown in the Socratic panel.

#### Aggregation Result Nodes

```
+----------------------------------------------+
| ? Socratic Aggregation        [Sonnet]       |  <-- purple left border
|                                              |
| Based on analysis across 4 branches and      |
| 12 scored messages, here is the complete     |
| answer on climate impacts to marine...       |
+----------------------------------------------+
```

### UI -- Socratic Panel

The Socratic panel is a right-side panel (same slot as `NodeDetailPanel`), accessible via a tab or button:

```
+---+------------------+---+-------------------+
|   |                  |   |                   |
| S |   Tree/Thread    | D | Socratic Panel    |
| I |                  | E | or Detail Panel   |
| D |   Main View      | T |                   |
| E |                  | A |                   |
| B |                  | I |                   |
| A |                  | L |                   |
| R |                  |   |                   |
|   |                  |   |                   |
+---+------------------+---+-------------------+
```

Panel tabs (when Socratic goals exist):
```
[Node Detail] [? Socratic]
```

### Store Changes

```typescript
interface SocraticState {
  goals: SocraticGoal[];
  scores: SocraticScore[];
  activeGoalId: string | null;

  createGoal: (goal: Omit<SocraticGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SocraticGoal>;
  updateGoal: (id: string, updates: Partial<SocraticGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  setActiveGoal: (id: string | null) => void;

  generateProbe: (targetNodeId: string, goalId: string) => Promise<void>;
  scoreNode: (nodeId: string, goalId: string) => Promise<SocraticScore[]>;
  scoreAllUnscored: (goalId: string) => Promise<void>;
  aggregate: (goalId: string, scope: AggregationScope) => Promise<void>;

  loadGoalsForConversation: (conversationId: string) => Promise<void>;
}

type AggregationScope =
  | { type: 'all_branches' }
  | { type: 'starred_only' }
  | { type: 'selected_nodes'; nodeIds: string[] };
```

### API Integration

The probing model calls are made through the same provider abstraction as regular messages. The key difference is the system prompt and context:

```typescript
async function callProbingModel(
  goal: SocraticGoal,
  userContent: string
): Promise<string> {
  const provider = getProvider(goal.probeProvider);

  let fullResponse = '';
  await provider.sendMessage({
    config: getProviderConfig(goal.probeProvider),
    model: goal.probeModel,
    messages: [{ role: 'user', content: userContent }],
    systemPrompt: goal.probeInstructions
      .replace('{goal}', goal.description)
      .replace('{rubric}', formatRubric(goal.rubric)),
    onToken: (text) => { fullResponse = text; },
    onComplete: (text) => { fullResponse = text; },
    onError: (err) => { throw err; },
  });

  return fullResponse;
}
```

### Browser-Only Mode

Fully functional in browser-only mode. All scoring and aggregation calls go directly to the LLM API from the browser. The only limitation is that scoring many nodes can be slow (serial API calls from the browser). With the backend, scoring could be parallelized server-side.

### Edge Cases

- **Rubric with zero terms**: allowed -- the probing model generates questions based on the goal description alone, without rubric-guided scoring.
- **Probing model unavailable**: show error on the probe node, allow retry.
- **Scoring a very large tree**: the `scoreAllUnscored` function should batch nodes and show progress. If there are 100+ unscored nodes, warn the user about API costs.
- **Multiple active goals**: allowed. Each goal operates independently. Nodes can be scored against multiple goals.
- **Goal on a conversation with no branches**: still works -- the probing model asks questions linearly, creating a single deep branch of probe-response pairs.
- **Probing model hallucinating high scores**: the scoring explanation field provides transparency. The user can manually adjust scores in the Socratic panel.
- **Deleting a node that has Socratic scores**: cascade delete the associated `SocraticScore` records.
- **Template variables in probe instructions**: `{goal}` and `{rubric}` are the only supported variables. Unrecognized `{...}` patterns are left as-is (not treated as an error).

---

### Critical Files for Implementation

- `/home/baud/Documents/DataML/GIT/baobab/src/types/index.ts` - Core type definitions: NodeType enum, TreeNode interface extension, and SocraticGoal types all need to be defined here.
- `/home/baud/Documents/DataML/GIT/baobab/src/components/layout/Sidebar.tsx` - Primary refactoring target for R1 (Unified Sidebar); current flat list needs to become the shell for all sidebar variants.
- `/home/baud/Documents/DataML/GIT/baobab/src/lib/tree.ts` - Core tree utilities: `getPathToRoot`, `buildReactFlowGraph`, and new `buildApiContext` with NodeType-aware filtering (R3) and scoring traversal (R5).
- `/home/baud/Documents/DataML/GIT/baobab/src/hooks/useStreamingResponse.ts` - Streaming hook that must be extended for model cascade resolution (R4 Phase 1) and Socratic probe calls (R5).
- `/home/baud/Documents/DataML/GIT/baobab/src/db/database.ts` - Dexie schema that needs version migrations for NodeType field (R3), Socratic tables (R5), and tag/project indexes (R1/R2).