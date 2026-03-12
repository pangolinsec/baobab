# 12 — Dead-End Branches

## Summary

Users can flag a branch as a "dead end" — the node and all its descendants become visually dimmed to indicate they're not productive. The flag is removable. Dead-end branches are not auto-collapsed or hidden; the user can still read and interact with them.

## Priority

Tier 2 — power feature.

## Dependencies

None.

## Data Model Changes

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  deadEnd: boolean;    // default false
}
```

When a node is flagged as dead-end, the flag is stored only on *that* node. All descendants are considered dead-end by inheritance (checked at render time by walking up to root and seeing if any ancestor has `deadEnd: true`).

## Detection Logic

```typescript
function isDeadEnd(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  let current = nodes[nodeId];
  while (current) {
    if (current.deadEnd) return true;
    current = current.parentId ? nodes[current.parentId] : undefined;
  }
  return false;
}
```

This is computed in `buildReactFlowGraph` when building node data, so it's part of the memoized layout.

## UI — Dead-End Visual Treatment

### Tree Node (`MessageNode`)

Dead-end nodes are dimmed:

- **Opacity**: `opacity-40` on the entire node card.
- **No other style changes** — the node keeps its shape, model chips, star, etc. Just dimmed.
- **A small flag icon** on the node that initiated the dead-end (the one with `deadEnd: true`), distinguishing it from inherited dead-end nodes:
  - Use `lucide-react`'s `Flag` icon or `Ban` icon, small (`12px`), in a muted red/gray.

```
┌─────────────────────────────────────────┐  ← opacity-40
│ 🔮 Claude                   [Haiku] 🚫 │
│                                         │
│ This approach won't work because...     │
│                                         │
└─────────────────────────────────────────┘
```

### Edges

Edges leading to/from dead-end nodes are also dimmed:
- `stroke-opacity: 0.3` or lighter stroke color.

### Descendants

All descendants of a dead-end node are also dimmed (same `opacity-40`), without their own flag icon (the dimming makes it clear they're part of the dead-end branch).

## UI — Flagging a Node as Dead-End

### Right-Click Context Menu (preferred)

Right-click a node → context menu:
```
┌─────────────────────────┐
│ Reply here              │
│ Star                    │
│ ─────────────────────── │
│ Flag as dead end        │
│ ─────────────────────── │
│ Copy                    │
│ Delete branch           │
└─────────────────────────┘
```

### Detail Panel Action

In the `NodeDetailPanel` action bar:

```
[Reply here] [Copy] [🚫 Dead end] [Delete]
```

Button text changes based on state:
- Not dead-end: "Flag as dead end"
- Dead-end (this node flagged): "Remove dead-end flag"
- Dead-end (inherited from ancestor): "Dead end (inherited)" — disabled, with a note indicating which ancestor set the flag.

## UI — Removing the Flag

Click the same button/menu item on the node that has `deadEnd: true`. This removes the flag, and all descendants return to normal opacity.

If a descendant was independently flagged as dead-end (a nested dead-end), that flag remains even if the ancestor's flag is removed.

## Store Changes

### `useTreeStore`

```typescript
interface TreeState {
  // ... existing
  toggleDeadEnd: (nodeId: string) => Promise<void>;
}
```

```typescript
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
```

## Interaction with Other Features

- **Collapse/expand**: dead-end branches can still be collapsed/expanded normally.
- **Search (feature 20)**: search results from dead-end branches should be included but marked as dead-end in the results list.
- **Star (feature 11)**: a message in a dead-end branch can still be starred.
- **Pricing (feature 22)**: dead-end branches still count toward conversation cost.
- **Error nodes (UI Fix 3)**: error nodes have a red border (`border-red-500`). When a dead-end branch contains error nodes, both treatments apply simultaneously — the node gets reduced opacity AND the red border. The red border is still visible at `opacity-40`. Consider auto-suggesting dead-end flagging for branches that end in an error node (e.g., a subtle prompt in the detail panel: "This branch ends in an error. Flag as dead end?").

## Edge Cases

- **Flagging root node**: allowed — dims the entire conversation. This is an unusual action but not harmful.
- **Flagging a node that's already inherited dead-end**: the UI shows the flag is inherited and offers to navigate to the ancestor that set it. The user can still set their own flag on this node (which would persist even if the ancestor's flag is removed).
