# 21 — Thread / Chat View

## Summary

An alternative view mode that displays the linear path from root to the selected node as a scrollable chat thread — like a traditional chat interface. Users can toggle between tree view and thread view. Chat is fully functional in both views. Branch points are marked with indicators showing sibling branches.

## Priority

Tier 2 — power feature.

## Dependencies

None.

## View Modes

Two modes, toggled via a button in the conversation header:

```
┌─────────────────────────────────────────────────────────┐
│ Biology Chat            [🌳 Tree] [💬 Thread]           │
├─────────────────────────────────────────────────────────┤
```

- **Tree view** (default): the current React Flow graph.
- **Thread view**: a linear scrollable chat.

The toggle is a segmented control or two buttons. The active view is visually highlighted.

## Thread View Layout

```
┌──────────────────────────────────────────────────────────┐
│ Biology Chat            [🌳 Tree] [💬 Thread]            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 🔮 Claude              Haiku 4.5    12:34 PM     │   │
│  │                                                   │   │
│  │ Hello! How can I help you today?                  │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 👤 You                              12:35 PM     │   │
│  │                                                   │   │
│  │ Tell me about frogs                               │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌ 🌿 2 other branches from here ──────────────────┐   │
│  │  └ "Tell me about toads" (3 msgs)                │   │
│  │  └ "Tell me about salamanders" (7 msgs)          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 🔮 Claude              Haiku 4.5    12:35 PM     │   │
│  │                                                   │   │
│  │ Frogs are fascinating amphibians belonging to     │   │
│  │ the order Anura. They are characterized by...     │   │
│  │                                                   │   │
│  │ ## Key Features                                   │   │
│  │ - Smooth, moist skin                              │   │
│  │ - Long hind legs for jumping                      │   │
│  │ ...                                               │   │
│  │                                         ★  🔀  📋│   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ ↳ Replying to: Frogs are fascinating...                  │
│ ┌────────────────────────────────────┐                   │
│ │ Type a message...                  │        [Send ▶]   │
│ └────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

## Thread Content

The thread shows the linear path from the conversation root to the currently selected leaf/node:

```typescript
function getThreadMessages(
  selectedNodeId: string,
  nodes: Record<string, TreeNode>
): TreeNode[] {
  return getPathToRoot(selectedNodeId, nodes); // already exists in lib/tree.ts
}
```

## Message Rendering

Each message in the thread is a full-width card (not the compact tree node):

- **Full markdown rendering**: uses `react-markdown` + `remark-gfm` + `rehype-highlight`, same as `NodeDetailPanel`.
- **User messages**: slightly tinted warm background, right-aligned name.
- **Assistant messages**: white/cream card with Claude sparkle icon.
- **Tool call sections**: compact, collapsible inline blocks within assistant message cards (see Feature 05). These are NOT separate messages — tool call data lives in the assistant node's `toolCalls` array and renders as expandable sections within the assistant card.
- **Thinking content**: collapsible section above the response (see feature 04).
- **Summary/merge nodes**: distinct styling carries over from features 15/16.

### Message Actions (on hover)

Each message shows action icons on hover (bottom-right corner):

- ★ Star toggle
- 🔀 Reply here (assistant messages only)
- 📋 Copy
- Icons match the warm aesthetic — muted until hovered.

### Model/Settings Chips

If the message has model or settings overrides (feature 10), show the same chips from the tree node, positioned in the message header.

## Branch Point Indicators

When a message in the thread has siblings (i.e., the parent has multiple children, and the thread follows one of them), show a **branch indicator** between messages:

```
┌─ 🌿 2 other branches from here ──────────────────┐
│  └ "Tell me about toads" (3 messages deep)        │
│  └ "Tell me about salamanders" (7 messages deep)  │
└───────────────────────────────────────────────────┘
```

- Clicking a branch label navigates to that branch (updates the thread to follow that path) or switches to tree view centered on that branch point.
- The indicator is subtle (muted background, small text) — it shouldn't disrupt the reading flow.

### "Zoom out to tree" Button

The branch indicator includes a small tree icon button that switches to tree view and centers on that branch point:

```
┌─ 🌿 2 other branches [🌳 View in tree] ─────────┐
```

## Reply Target in Thread View

**Note**: [UI Fix 6](_ui-fixes.md#ui-fix-6--selection--reply-target-decoupling) (selection/reply decoupling, **already implemented**) separates node selection from reply targeting across the entire app. Clicking a node in tree view selects it for viewing but does NOT auto-set the reply target. "Reply here" is always an explicit action. Thread view follows the same convention.

- The **reply target is whatever was explicitly set** before entering thread view. If no explicit target exists, the last message in the thread (the leaf node) is the default.
- Clicking a message in the thread selects it (scrolls to it, highlights it) but does **not** change the reply target.
- Clicking a message's "Reply here" action (🔀) explicitly sets that message as the reply target.
- The chat input updates to show the reply target indicator (same as in tree view).
- If the reply target is not the leaf, a notice appears: "Replying mid-thread — this will create a branch."

## Sending Messages in Thread View

When the user sends a message:
1. The new user message appears at the bottom of the thread.
2. The assistant response streams in below it.
3. The thread automatically scrolls to the bottom.
4. The tree view updates in the background (new nodes added, layout recalculated).

If the reply target was mid-thread (creating a branch), the thread re-renders to show the new branch path (from root to the new leaf).

## Switching Between Views

### Tree → Thread

- If a node is selected in tree view, thread view shows the path to that node.
- If no node is selected, thread view shows the path to the most recent leaf (deepest node by timestamp).

### Thread → Tree

- The tree view centers on the node that was at the bottom of the thread.
- The selected node is preserved.

Switching is instant (no loading) — both views read from the same Zustand store.

## Detail Panel Integration

In thread view, the detail panel can still be opened by clicking a node's detail icon. It slides in from the right as before. However, since thread view already shows full message content, the detail panel is less necessary — it's mainly useful for:
- System prompt inspection (feature 09).
- Model override controls (feature 08).
- Delete/branch/merge actions.

## Component Structure

```
components/
  thread/
    ThreadView.tsx           # Main scrollable thread container
    ThreadMessage.tsx        # Full-width message card
    BranchIndicator.tsx      # "2 other branches" inline indicator
```

## Scroll Behavior

- **On load**: scroll to the bottom (most recent message).
- **During streaming**: auto-scroll to keep the streaming content visible.
- **On branch point click**: smooth scroll to the branch indicator.
- **On search result navigation** (Feature 20): scroll to the highlighted message. See Feature 20's "Per-Chat Search in Thread View" section for full rendering and navigation spec.

## Keyboard Shortcuts

- `Ctrl+T` / `Cmd+T`: toggle between tree and thread view.
- `Up/Down`: navigate between messages (in thread view).
- `Enter` (on a selected message): set as reply target.

## Edge Cases

- **Very long threads** (100+ messages): virtualize the list (react-window or similar) to avoid rendering all messages at once. Only render visible messages + a buffer.
- **Branches at the root**: if the root node has multiple children, the branch indicator appears right at the top.
- **Thread view with collapsed nodes**: ignored — thread view always shows the full path regardless of collapse state in tree view.
