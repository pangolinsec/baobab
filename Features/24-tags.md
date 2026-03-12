# 24 — Tags

## Summary

Apply freeform tags to conversations for organization and filtering. Tags support nested hierarchy via slash notation (e.g., `research/biology`, `work/project-alpha`). Autocomplete suggests existing tags. Filter the sidebar by tag.

## Priority

Tier 2 — power feature.

## Dependencies

None.

## Data Model

### Frontend (IndexedDB)

```typescript
interface Conversation {
  // ... existing
  tags: string[];    // e.g. ["research/biology", "important", "work/project-alpha"]
}
```

Dexie schema update — add a multi-entry index for tags:

```
conversations: 'id, createdAt, updatedAt, projectId, *tags'
```

The `*tags` multi-entry index allows querying conversations by individual tag values.

### Backend (SQLite)

The `tags` table stores the canonical tag list for autocomplete:

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,    -- full tag path: "research/biology"
  created_at INTEGER NOT NULL
);
```

When the backend isn't present, the frontend derives the tag list from existing conversations (scan all `conversation.tags` and deduplicate).

## Tag Format

- **Freeform strings**: any text, no character restrictions except `/` is reserved as a hierarchy separator.
- **Nested via slash**: `parent/child` creates a hierarchy. Examples:
  - `research/biology`
  - `research/physics`
  - `work/project-alpha`
  - `personal`
- **Case-insensitive matching** for deduplication and autocomplete.
- **No colors** in v1 (plain text labels).

## UI — Adding Tags

### In the Sidebar (Conversation Item)

Right-click a conversation → "Add tag":

```
┌─────────────────────────┐
│ Rename                  │
│ Add tag                 │
│ Move to project         │
│ ─────────────────────── │
│ Delete                  │
└─────────────────────────┘
```

### Tag Input with Autocomplete

Clicking "Add tag" opens an inline input with autocomplete:

```
┌──────────────────────────────┐
│ Biology Chat            🏷️  │
│ ┌──────────────────────────┐ │
│ │ [res                   ] │ │
│ │ ┌──────────────────────┐ │ │
│ │ │ research             │ │ │
│ │ │ research/biology     │ │ │
│ │ │ research/physics     │ │ │
│ │ │ + Create "res"       │ │ │
│ │ └──────────────────────┘ │ │
│ └──────────────────────────┘ │
│ Tags: [research/biology ✕]   │
│       [important ✕]          │
└──────────────────────────────┘
```

- **Autocomplete**: as the user types, existing tags are filtered and shown in a dropdown.
- **Hierarchy awareness**: typing `research/` shows all children of `research`.
- **Create new**: if the typed text doesn't match an existing tag, a "Create [tag]" option appears at the bottom.
- **Enter** or click to select/create.
- **Backspace** on an empty input removes the last tag.

### Tag Pills on Conversation Item

Tags appear as small pills on the conversation item in the sidebar:

```
┌──────────────────────────────┐
│ 💬 Biology Chat              │
│   [research/biology] [imp.]  │
└──────────────────────────────┘
```

- Truncate long tags to fit (e.g., `research/bio...`).
- Hovering shows the full tag.
- Clicking a tag pill filters the sidebar by that tag.
- The ✕ on the pill removes the tag from the conversation.

### In the Conversation Header

Tags are also editable in the conversation header bar:

```
┌─────────────────────────────────────────────────────────────────┐
│ Biology Chat     [research/biology ✕] [+ tag]    [🌳] [💬]    │
└─────────────────────────────────────────────────────────────────┘
```

## UI — Filtering by Tag

### Sidebar Filter

A tag filter control above the conversation list:

```
┌──────────────────────────────┐
│ Baobab                 [+] │
├──────────────────────────────┤
│ 🔍 [Search...]               │
│ 🏷️ Filter: [All tags ▾]     │
├──────────────────────────────┤
│ ▼ research                   │  ← tag group header
│   💬 Biology Chat            │
│   💬 Physics Exploration     │
│ ▼ work                       │
│   💬 Project Alpha Notes     │
│ ▼ untagged                   │
│   💬 Random Chat             │
└──────────────────────────────┘
```

### Filter Dropdown

```
┌──────────────────────────┐
│ All tags                 │
│ ────────────────────     │
│ research (4)             │
│   research/biology (2)   │
│   research/physics (2)   │
│ work (3)                 │
│   work/project-alpha (1) │
│   work/meetings (2)      │
│ important (5)            │
│ ────────────────────     │
│ Untagged (7)             │
└──────────────────────────┘
```

- Selecting a parent tag (e.g., `research`) shows all conversations with any `research/*` tag.
- Selecting a specific tag (e.g., `research/biology`) shows only those conversations.
- Multiple tags can be selected (AND logic: show conversations that have ALL selected tags).
- "Untagged" shows conversations with no tags.

### Tag Hierarchy in Sidebar (Deferred to v2)

> **Note**: Tag-based grouping in the sidebar (where conversations are organized under tag hierarchy headers) is architecturally supported but deferred to v2. In v1, tags function as a **filter mechanism** (dropdown at top of sidebar) and **visual metadata** (pills on conversation items). The sidebar grouping selector includes a "Tags" option that is disabled in v1. See ADR-001 Decision 6.

When tag grouping is implemented in v2, it would look like:

```
Filtered by: research
┌──────────────────────────────┐
│ ▼ research/biology           │
│   💬 Biology Chat            │
│   💬 Frog Research           │
│ ▼ research/physics           │
│   💬 Quantum Notes           │
│   💬 Physics Exploration     │
└──────────────────────────────┘
```

## Store Changes

### `useTreeStore`

```typescript
interface TreeState {
  // ... existing
  addTag: (conversationId: string, tag: string) => Promise<void>;
  removeTag: (conversationId: string, tag: string) => Promise<void>;
  getAllTags: () => Promise<string[]>;
}
```

```typescript
addTag: async (conversationId: string, tag: string) => {
  const conv = get().conversations.find(c => c.id === conversationId);
  if (!conv) return;
  if (conv.tags.includes(tag)) return; // already has this tag
  const tags = [...conv.tags, tag];
  await db.conversations.update(conversationId, { tags });
  // Also register the tag in the backend canonical list if available
  set((state) => ({
    conversations: state.conversations.map(c =>
      c.id === conversationId ? { ...c, tags } : c
    ),
  }));
},

removeTag: async (conversationId: string, tag: string) => {
  const conv = get().conversations.find(c => c.id === conversationId);
  if (!conv) return;
  const tags = conv.tags.filter(t => t !== tag);
  await db.conversations.update(conversationId, { tags });
  set((state) => ({
    conversations: state.conversations.map(c =>
      c.id === conversationId ? { ...c, tags } : c
    ),
  }));
},

getAllTags: async () => {
  const conversations = await db.conversations.toArray();
  const tagSet = new Set<string>();
  for (const conv of conversations) {
    for (const tag of conv.tags || []) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
},
```

## Tag Autocomplete Logic

```typescript
function filterTags(input: string, existingTags: string[]): string[] {
  const lower = input.toLowerCase();
  return existingTags
    .filter(tag => tag.toLowerCase().includes(lower))
    .sort((a, b) => {
      // Exact prefix match first
      const aPrefix = a.toLowerCase().startsWith(lower);
      const bPrefix = b.toLowerCase().startsWith(lower);
      if (aPrefix && !bPrefix) return -1;
      if (!aPrefix && bPrefix) return 1;
      return a.localeCompare(b);
    });
}
```

## Sync with Backend

The authoritative tag data is `conversation.tags: string[]` in IndexedDB. The backend `tags` table (Feature 00) is an **autocomplete cache**, not a source of truth. See ADR-001 Decision 3.

- When a tag is added to a conversation, the frontend pushes it to the backend via `PUT /api/tags` (idempotent upsert).
- When the backend is unavailable, autocomplete uses `getAllTags()` which scans `conversation.tags` across all IndexedDB conversations.
- During startup reconciliation, the frontend prunes backend tags that no longer exist on any conversation (prevents stale autocomplete suggestions).
- Tag removal from a conversation does NOT eagerly delete from backend — pruning happens at reconciliation time only.

## Dexie Migration

Existing conversations need a `tags` field added (default `[]`). *Dexie migration: see [Dexie Migration Plan](_dexie-migrations.md), Version 3.* The `*tags` multi-entry index and upgrade function that defaults `tags` to `[]` are defined there.

## Edge Cases

- **Renaming a tag**: not supported in v1. The user would remove the old tag and add the new one. (Could be added later as a batch operation.)
- **Deleting a tag entirely**: no explicit "delete tag" action. Tags that are no longer on any conversation naturally disappear from the autocomplete list.
- **Slash in conversation title**: no conflict — slashes in tags are only meaningful in the tag field, not in titles.
- **Very long tags**: truncate display at ~30 characters with ellipsis. Full tag shown on hover.
