# ADR-009: Auto-Sync Selection to Reply Target

**Date**: 2026-02-19
**Status**: Accepted
**Context**: The app maintains two independent pointers: `selectedNodeId` (which node the user is viewing in the detail panel) and `replyTargetNodeId` (where the next message will be sent). Users had to click a node to select it, then separately click "Reply here" to set the reply target. In practice, users almost always want to reply to the node they just clicked, making the extra step unnecessary friction. This ADR records the decision to auto-sync these two pointers and the browse-only escape hatch.

---

## Decision 1: Auto-Sync Selection to Reply Target for Assistant Nodes

**Problem**: Clicking a node only sets `selectedNodeId`. Setting `replyTargetNodeId` requires a separate "Reply here" action. This two-step workflow adds friction for the dominant use case (click a node, then type a reply).

**Options considered**:

1. **Always sync**: Every `selectNode` call also sets `replyTargetNodeId` to the same node.
2. **Sync only for assistant nodes**: Auto-set reply target only when the selected node is an assistant node (excluding error nodes). User nodes and error nodes are excluded since you can't reply to them.
3. **Keep independent**: Leave the current behavior, improve discoverability of "Reply here".

**Decision**: Option 2 — sync only for valid assistant nodes.

**Rationale**: Users can only reply to assistant nodes (the API requires alternating user/assistant turns). Auto-syncing for user or error nodes would either be a no-op or set an invalid reply target. Restricting auto-sync to non-error assistant nodes matches the existing `setReplyTarget` validation logic and eliminates the most common friction point without changing semantics for edge cases.

**Impact**: `selectNode` in `useTreeStore.ts` gains a `browseOnly` parameter and conditionally sets `replyTargetNodeId`. All call sites in `TreeView.tsx`, `ThreadView.tsx`, and `BranchIndicator.tsx` updated. Callers that pass `null` (deselect) or don't involve user interaction (sidebar, search results) use the default `browseOnly=false`, which is correct — navigating from those contexts should set the reply target.

---

## Decision 2: Shift+Click as Browse-Only Escape Hatch

**Problem**: Auto-syncing removes the ability to browse nodes without moving the reply target. Users exploring a tree may want to inspect a node without changing where their next message goes.

**Options considered**:

1. **Shift+click for browse-only**: Hold Shift while clicking or pressing arrow keys to select without moving the reply target. Simple, discoverable modifier key.
2. **Toggle mode**: A toolbar button to switch between "browse" and "navigate" modes. Persistent state, more UI surface.
3. **Undo reply target**: Let auto-sync happen, but provide Ctrl+Z to revert the reply target. Relies on undo infrastructure that doesn't exist.

**Decision**: Option 1 — Shift+click (and Shift+arrow in thread view) provides browse-only mode.

**Rationale**: Modifier keys are the standard pattern for "do the alternate thing" in direct-manipulation UIs. No new UI elements, no persistent state to manage, and the behavior is immediately intuitive to power users. The `browseOnly` parameter on `selectNode` cleanly encapsulates this — callers pass `event.shiftKey` and the store handles the rest.

**Impact**: `selectNode` signature changed from `(nodeId: string | null)` to `(nodeId: string | null, browseOnly?: boolean)`. All interactive click/keyboard handlers in `TreeView.tsx`, `ThreadView.tsx`, and `BranchIndicator.tsx` pass `shiftKey`. Non-interactive callers (sidebar, search, programmatic navigation) use the default and auto-sync as expected.

---

## Spec Files Updated

No spec files were updated in this session.
