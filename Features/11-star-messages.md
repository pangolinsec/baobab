# 11 — Star Messages

## Summary

Users can star (bookmark) individual messages for quick access and for use in downstream features (Socratic aggregation, comparisons, filtering). Starred messages get a visual star icon on their tree node and appear in a filterable list in the sidebar.

## Priority

Tier 2 — power feature.

## Dependencies

None.

## Data Model Changes

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  starred: boolean;    // default false
}
```

### Dexie Schema

Add an index on `starred` for efficient querying:

```
nodes: 'id, conversationId, parentId, starred'
```

## UI — Star Icon on Tree Node

In `MessageNode`, show a star icon on hover (top-right corner):

```
┌─────────────────────────────────────────┐
│ 🔮 Claude                   [Haiku] ☆  │
│                                         │
│ Here is my response to your question    │
│ about the nature of...                  │
└─────────────────────────────────────────┘
```

- **Unstarred**: faint outline star (`☆`), visible on hover.
- **Starred**: filled gold/amber star (`★`), always visible (not just on hover).
- Clicking the star toggles the state.

### Styling

- Unstarred hover: `text-[#C4B5A6]` (muted warm gray)
- Starred: `text-amber-400` (gold) — `fill-amber-400`
- Use `lucide-react`'s `Star` icon with conditional `fill` prop.

## UI — Star in Detail Panel

The detail panel header shows the star with a toggle:

```
┌──────────────────────────────────────┐
│ 🔮 Claude              ★   [X]      │
├──────────────────────────────────────┤
```

Clicking the star in the detail panel also toggles starred state.

## UI — Starred Messages in Sidebar

Below the conversation list (or as a filter/tab), a "Starred" section:

```
┌──────────────────────────────┐
│ Baobab                 [+] │
├──────────────────────────────┤
│ [All Chats] [★ Starred]     │
├──────────────────────────────┤
│ ★ "Frogs are amphibians..."  │
│   in: Biology Chat • 2h ago  │
│ ★ "The key insight is..."    │
│   in: Research Thread • 1d   │
│ ★ "Here's the code..."      │
│   in: Coding Help • 3d      │
└──────────────────────────────┘
```

- Shows starred messages across all conversations.
- Each entry shows a content preview, the conversation name, and relative time.
- Clicking an entry navigates to that conversation and selects the node.
- Can be filtered by conversation (dropdown or scope toggle).

## Store Changes

### `useTreeStore`

```typescript
interface TreeState {
  // ... existing
  toggleStar: (nodeId: string) => Promise<void>;
  getStarredNodes: () => Promise<TreeNode[]>;
}
```

```typescript
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

getStarredNodes: async () => {
  return db.nodes.where('starred').equals(1).toArray();
},
```

## Keyboard Shortcut

`S` key when a node is selected toggles the star (if keyboard shortcuts are implemented).

## Integration with Other Features

- **Feature 14 (Socratic elicitation)**: aggregation can operate on starred messages only.
- **Feature 17 (Compare/Classify)**: "Compare starred messages" as a quick action.
- **Feature 20 (Search)**: filter search results to starred messages only.
