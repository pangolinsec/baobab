# 20 — Search Across Chats

## Summary

Full-text search over all message content with filters by role (user, assistant, tool, thinking). Results link directly to the node in the tree. Available as a global search in the sidebar and as a per-chat search within a conversation.

## Priority

Tier 2 — power feature.

## Dependencies

None.

## Search Capabilities

### Full-Text Search

Search across all `TreeNode.content` fields in IndexedDB. Dexie doesn't have built-in full-text search, so we use a simple approach:

- **Small scale (< 10K messages)**: filter with `.filter()` and `String.includes()` or regex on the Dexie collection. Acceptable performance.
- **Medium scale (10K-100K)**: use Dexie's `WhereClause` with a word index table (denormalized search index).
- **Large scale**: defer to the backend with SQLite FTS5 full-text search.

For v1, the simple filter approach is sufficient.

### Filters

- **Role**: user, assistant (multi-select checkboxes). These map directly to `MessageRole`.
- **Content type**: tool calls, thinking (multi-select checkboxes). These are NOT role filters — they search specific content:
  - **Tool calls**: searches `node.toolCalls[].result` on assistant nodes (tool calls are metadata on assistant nodes per ADR-001 Decision 2, not a separate role).
  - **Thinking**: searches `node.thinking` on assistant nodes (thinking is a field on TreeNode, not a role).
- **Conversation**: search all conversations or scope to a specific one.
- **Project**: search within a project's conversations (when feature 13 is implemented).
- **Starred**: option to search only starred messages.
- **Date range**: optional from/to date filter.

## UI — Sidebar Search

### Search Bar

A search input at the top of the sidebar:

```
┌──────────────────────────────┐
│ Baobab                 [+] │
├──────────────────────────────┤
│ 🔍 [Search messages...    ]  │
├──────────────────────────────┤
│ ▼ Conversations              │
│ ...                          │
└──────────────────────────────┘
```

### Search Results View

When the user types a query and hits Enter (or after a debounced delay):

```
┌──────────────────────────────┐
│ 🔍 [climate change      ] ✕  │
│                              │
│ Filters: [All ▾] [★ ☐]      │
│                              │
│ 12 results                   │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔮 "Climate change has   │ │
│ │ led to significant..."   │ │
│ │ Biology Chat • 2h ago    │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 👤 "Tell me about        │ │
│ │ climate change impacts"  │ │
│ │ Research Thread • 1d     │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 💭 "I need to consider   │ │
│ │ the IPCC report..."      │ │
│ │ Research Thread • 1d     │ │
│ │ (thinking)               │ │
│ └──────────────────────────┘ │
│                              │
│ [Load more...]               │
└──────────────────────────────┘
```

Each result shows:
- Role icon (👤 user, 🔮 assistant). For matches found in tool call or thinking content, the result is displayed under the parent assistant node with a content-type tag:
  - 🔧 `(tool call)` tag when the match is in `toolCalls[].result`.
  - 💭 `(thinking)` tag when the match is in `thinking`.
- Content preview with the query highlighted in bold/color.
- Conversation name and relative timestamp.
- Starred indicator if starred.
- Dead-end indicator if in a dead-end branch.

### Clicking a Result

1. Navigate to the conversation: `navigate(`/c/${conversationId}`)`.
2. Load the conversation into the store.
3. Select the node: `selectNode(nodeId)`.
4. Fit the tree view to center on that node.

### Clearing Search

Click the ✕ button or press Escape to clear search and return to the conversation list.

## UI — Per-Chat Search

Within a conversation, a search bar in the tree view header or accessible via `Ctrl+F`:

```
┌─────────────────────────────────────────────────────────────┐
│ Biology Chat                    🔍 [Search in chat...]  ✕  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      [Tree View]                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Results appear as highlighted nodes in the tree:
- Matching nodes get a highlight ring (distinct color, e.g., yellow/amber).
- A "N of M results" indicator with prev/next arrows to jump between matches.
- The tree viewport pans to center on the current match.

```
Results: ◀ 3 of 7 ▶
```

## Per-Chat Search in Thread View

When the user is in thread view (Feature 21) and triggers `Ctrl+F`, the search behavior adapts to the linear layout:

### Rendering

- **No highlight ring**: tree-node-style highlight rings don't apply. Instead, matching messages get a **yellow/amber left border** (`border-l-4 border-amber-400`) and a subtle background tint (`bg-amber-50 dark:bg-amber-900/20`).
- The matched text within the message card is wrapped in a `<mark>` tag (same as sidebar search result highlights).
- The results counter (`◀ 3 of 7 ▶`) renders in the same position as tree view — in the conversation header search bar.

### Navigation

- `Enter` / `Shift+Enter` (or ▶ / ◀ buttons) scroll the thread to the next/previous matching message using `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- The currently focused match gets a stronger highlight (e.g., `border-l-4 border-amber-500 bg-amber-100 dark:bg-amber-800/30`) to distinguish it from other matches.

### Scope

Per-chat search in thread view searches the **current thread path only** (root to selected leaf), not the entire conversation tree. This matches what the user sees. Global sidebar search still searches all nodes across all conversations regardless of view mode.

### View Switching with Active Search

- **Thread → Tree with search active**: search results transfer — matching node IDs are preserved, tree nodes get the standard yellow/amber highlight ring, viewport pans to the current match.
- **Tree → Thread with search active**: only matches on the current thread path remain highlighted. The results counter updates to reflect the reduced set. If the current match is not on the thread path, the counter resets to the first match on the path (or shows "0 results on this thread" if none match).

## Implementation

### Search Function

```typescript
async function searchMessages(
  query: string,
  options: {
    conversationId?: string;
    roles?: MessageRole[];       // 'user' | 'assistant' only
    starredOnly?: boolean;
    includeThinking?: boolean;   // search node.thinking field
    includeToolCalls?: boolean;  // search node.toolCalls[].result
    limit?: number;
    offset?: number;
  }
): Promise<{ results: SearchResult[]; total: number }> {
  const queryLower = query.toLowerCase();

  let collection = db.nodes.toCollection();

  if (options.conversationId) {
    collection = db.nodes.where('conversationId').equals(options.conversationId);
  }

  const results = await collection
    .filter((node) => {
      // Role filter (user | assistant — actual MessageRole values)
      if (options.roles && !options.roles.includes(node.role)) return false;
      // Starred filter
      if (options.starredOnly && !node.starred) return false;
      // Content match
      const contentMatch = node.content.toLowerCase().includes(queryLower);
      // Thinking content match (thinking is a field on TreeNode, not a role)
      const thinkingMatch = options.includeThinking && node.thinking?.toLowerCase().includes(queryLower);
      // Tool call content match (tool calls are metadata on assistant nodes, not a role)
      const toolMatch = options.includeToolCalls && node.toolCalls?.some(
        tc => tc.result?.toLowerCase().includes(queryLower)
      );
      return contentMatch || thinkingMatch || toolMatch;
    })
    .toArray();

  return {
    results: results.slice(options.offset || 0, (options.offset || 0) + (options.limit || 20)),
    total: results.length,
  };
}
```

### Highlight in Content Preview

Extract a snippet around the match with highlighted query terms:

```typescript
function getHighlightedSnippet(content: string, query: string, maxLength: number = 120): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, maxLength);

  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 80);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < content.length) snippet += '…';
  return snippet;
}
```

In the React component, wrap the query match in a `<mark>` tag or styled `<span>`.

## Store Changes

No persistent store changes. Search is a UI-only feature that reads from IndexedDB.

Transient state for in-chat search:
```typescript
interface SearchState {
  query: string;
  results: string[];          // node IDs
  currentResultIndex: number;
  isSearching: boolean;
}
```

This could be a separate small Zustand store or part of a UI state slice.

## Keyboard Shortcuts

- `Ctrl+F` / `Cmd+F`: open per-chat search (when in a conversation).
- `Ctrl+Shift+F` / `Cmd+Shift+F`: focus global sidebar search.
- `Enter`: next result (in per-chat search).
- `Shift+Enter`: previous result.
- `Escape`: close search.

## Performance

- For < 10K messages, Dexie `.filter()` is fast enough (~10-50ms).
- For larger datasets, consider a dedicated search index (inverted index in IndexedDB, or FTS5 on the backend).
- Debounce the search input (300ms) to avoid excessive queries during typing.
