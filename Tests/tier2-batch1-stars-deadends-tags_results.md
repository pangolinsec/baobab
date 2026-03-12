# Tier 2 Batch 1 — Stars, Dead-Ends, Tags: Test Results

**Execution date**: 2026-02-19
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, multiple conversations exist, default model Haiku 3.5, thinking disabled, max output tokens 4096
**Tab ID**: 1134250658

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| Feature 11 — Stars | 8 | 8 | 0 | 0 | |
| Feature 12 — Dead-Ends | 7 | 7 | 0 | 0 | |
| Feature 24 — Tags | 12 | 12 | 0 | 0 | |
| Cross-cutting | 1 | 0 | 1 | 0 | Infinite re-render crash |
| **Total** | **28** | **27** | **1** | **0** | |

---

## Feature 11 — Stars

### T11-1: Star icon appears on starred nodes in tree view — PASS

**Actions**: Loaded "Say hi" conversation. Clicked assistant node "Hi there! How are you doing today?". Found star button in NodeDetailPanel header (left of X close button). Clicked via JS.

**Observations**:
- Star button changes to amber/gold color (`text-amber-500 fill-amber-500`) — PASS
- Tooltip changes to `title="Unstar"` — PASS
- Small amber filled star icon (12px, `fill-amber-500`) appears in the tree node card header — PASS

### T11-2: Unstar a node via NodeDetailPanel — PASS

**Actions**: With starred node selected, clicked star button again.

**Observations**:
- Star button reverts to muted color (`text-[var(--color-text-muted)]`) — PASS
- Tooltip reverts to `title="Star"` — PASS
- Amber star icon disappears from tree node header — PASS

### T11-3: Star toggle via context menu — PASS

**Actions**: Right-clicked on an unstarred user node. Found "Star" option in context menu.

**Observations**:
- Context menu contains "Star" option with a star icon — PASS
- After clicking "Star", the node shows a small amber star icon in its header — PASS

### T11-4: Sidebar — All Chats tab (default) — PASS

**Actions**: Inspected sidebar tabs below search bar.

**Observations**:
- Two tab buttons visible: "All Chats" and "Starred" (with star icon) — PASS
- "All Chats" is the active tab by default (accent-colored bottom border) — PASS
- Conversation list visible showing all conversations — PASS

### T11-5: Sidebar — Starred tab shows starred messages — PASS

**Actions**: Starred 2 nodes (user "Say hi" and assistant "Hi there!"). Clicked "Starred" tab.

**Observations**:
- Tab switches showing a list of starred messages — PASS
- Each row shows: amber filled star, role label ("You" or "Claude"), content preview — PASS
- Both starred messages appear in the list — PASS

### T11-6: Sidebar — Starred tab empty state — PASS

**Actions**: Switched to "Say hello world" conversation (no starred nodes). Clicked "Starred" tab.

**Observations**:
- Message "No starred messages" displayed centered in the panel — PASS

### T11-7: Clicking a starred item in sidebar selects the node — PASS

**Actions**: Switched to Starred tab. Clicked on "Claude - Hi there!" row.

**Observations**:
- Tree view navigates to show the node — PASS
- NodeDetailPanel opens showing the node's content — PASS
- Node has amber star icon visible in its header — PASS

### T11-8: Star persists across conversation reload — PASS

**Actions**: With starred nodes in "Say hi", switched to "Say hello world" conversation, then switched back.

**Observations**:
- Previously starred nodes still show amber star icons — PASS
- Starred tab still shows the starred nodes — PASS

---

## Feature 12 — Dead-Ends

### T12-1: Flag a node as dead-end via NodeDetailPanel — PASS

**Actions**: Loaded "Say hi" conversation. Clicked non-root assistant node "Hi there!". Found "Dead end" button with flag icon in action bar. Clicked it.

**Observations**:
- Node card becomes semi-transparent (`opacity-40`) — PASS
- Small flag icon (`lucide-flag`) appears in node header — PASS
- Button label changes to "Unflag" — PASS
- Banner "This branch is flagged as a dead end" appears in NodeDetailPanel — PASS

### T12-2: Dead-end propagates to descendant nodes — PASS

**Actions**: Flagged user node "Say hi" as dead-end (it has child "Hi there!"). Inspected child node.

**Observations**:
- Child node "Hi there!" also shows `opacity-40` class — PASS
- Edges connecting dead-end nodes appear dimmed — PASS

### T12-3: Unflag a dead-end node — PASS

**Actions**: With flagged node selected, clicked "Unflag" button.

**Observations**:
- Node returns to full opacity (no `opacity-40`) — PASS
- Flag icon disappears from node header — PASS
- Dead-end banner disappears from NodeDetailPanel — PASS
- Descendant nodes return to full opacity — PASS
- Button label reverts to "Dead end" — PASS

### T12-4: Dead-end toggle via context menu — PASS

**Actions**: Right-clicked non-root user node. Found "Flag as dead end" option. Clicked it.

**Observations**:
- Node becomes semi-transparent with flag icon — PASS
- Right-clicking again shows "Unflag dead end" — PASS
- Clicking "Unflag dead end" returns node to full opacity — PASS

### T12-5: Root node cannot be flagged as dead-end — PASS

**Actions**: Clicked root assistant node. Inspected NodeDetailPanel and context menu.

**Observations**:
- No "Dead end" button in NodeDetailPanel action bar — PASS
- Right-click context menu has no "Flag as dead end" option — PASS

### T12-6: Dead-end edge dimming in tree view — PASS

**Actions**: Flagged a mid-tree node as dead-end. Inspected edge styles via JavaScript.

**Observations**:
- Dead-end edges have `dead-end-edge` class with `strokeOpacity: 0.3` — PASS
- Normal edges have full opacity stroke — PASS

### T12-7: Star and dead-end can coexist on same node — PASS

**Actions**: Starred a node, then flagged it as dead-end.

**Observations**:
- Node shows both amber star icon AND flag icon in header — PASS
- Node is semi-transparent (dead-end) — PASS
- Node appears in Starred sidebar tab — PASS

---

## Feature 24 — Tags

### T24-1: Add a tag to a conversation via header — PASS

**Actions**: Loaded "Say hi" conversation. Found "+ tag" button in header area. Clicked it.

**Observations**:
- Small text input appears with placeholder "Tag name" — PASS

### T24-2: Create a new tag by typing and pressing Enter — PASS

**Actions**: Typed "important" into tag input, pressed Enter.

**Observations**:
- Tag pill labeled "important" appears in header area — PASS
- Pill has accent-tinted styling (`bg-[var(--color-accent)]/15 text-[var(--color-accent)]`) — PASS
- Pill has small X button to remove it — PASS

### T24-3: Add multiple tags to a conversation — PASS

**Actions**: Added "research" and "ai" tags using the "+ tag" button.

**Observations**:
- Three tags visible in header: "important", "research", "ai" — PASS

### T24-4: Remove a tag by clicking X — PASS

**Actions**: Found the "research" tag pill, clicked its X button.

**Observations**:
- "research" tag disappears — PASS
- Only "important" and "ai" remain — PASS

### T24-5: Tags are normalized to lowercase — PASS

**Actions**: Added tag "UPPERCASE" via tag input.

**Observations**:
- Tag appears as "uppercase" (lowercase) — PASS

### T24-6: Duplicate tags are prevented — PASS

**Actions**: Attempted to add "important" again (already exists).

**Observations**:
- No duplicate tag created — still only one "important" pill — PASS

### T24-7: Cancel tag input with Escape — PASS

**Actions**: Clicked "+ tag", typed "temp", pressed Escape.

**Observations**:
- Input disappears without adding any tag — PASS
- No "temp" tag was created — PASS

### T24-8: Tags appear on conversation rows in sidebar — PASS

**Actions**: Looked at sidebar "All Chats" tab for conversations with tags.

**Observations**:
- Small tag pills appear below conversation title — PASS
- Tags use small rounded-full style with secondary background — PASS
- "Say hi" shows: important, ai, uppercase, +1 (machine-learning truncated) — PASS

### T24-9: Tag autocomplete suggestions — PASS

**Actions**: Added "machine-learning" tag to "Say hi". Switched to "Say hello world" conversation. Clicked "+ tag" and typed "mac".

**Observations**:
- Dropdown appears below input suggesting "machine-learning" — PASS
- Clicked suggestion — tag "machine-learning" added to this conversation — PASS

### T24-10: Tag filtering in sidebar — PASS

**Actions**: Found tag filter area below tab switcher (shows ai, important, machine-learning, uppercase pills). Clicked "important" filter pill.

**Observations**:
- Conversation list filters to show only conversations with "important" tag — PASS
- Only "Say hi" shown (only conversation with "important") — PASS
- Clicked "important" filter pill again to clear — PASS
- All conversations shown again (10 total) — PASS

### T24-11: Tag filter empty state — PASS

**Actions**: Filtered by "uppercase" tag (only "Say hi" has it). Then removed "uppercase" tag from "Say hi" while filter was still active.

**Observations**:
- Message "No conversations with this tag" displayed centered in panel — PASS
- Filter pill "uppercase x" still active but no matching conversations — PASS

### T24-12: Tags persist across page reload — PASS

**Actions**: Added "persistent-test" tag to "Say hi". Navigated to `http://localhost:5173`. Clicked "Say hi" conversation.

**Observations**:
- "persistent-test" tag still visible in header — PASS
- Tag also appears in sidebar filter area — PASS
- Cleaned up: removed "persistent-test" tag after verification

---

## Cross-cutting: Stars + Dead-Ends + Tags Together

### TC1-1: All annotations visible simultaneously — FAIL

**Actions**: In "Say hi" conversation:
- Starred "Say hi" (user) and "Hi there!" (assistant) — amber stars visible
- Added tags: important, ai, machine-learning
- Flagged "Test message" (user) node as dead-end via NodeDetailPanel

**Observations**:
- Starred nodes show amber star icons in tree — PASS
- Tags visible in conversation header (important, ai, machine-learning) — PASS
- Tags visible on sidebar conversation row — PASS
- Starred tab shows starred nodes — PASS
- Dead-end flag icon appears on flagged node — PASS
- **FAIL**: Dead-end `opacity-40` NOT applied to flagged node or descendants
- **CRITICAL BUG**: Selecting (clicking) the dead-end node causes app crash — white screen with React error: "Maximum update depth exceeded" and "The result of getSnapshot should be cached to avoid an infinite loop"
- App requires page reload to recover; the `deadEnd: true` flag persists in IndexedDB, causing the crash to recur on every selection

**Note**: T12-1 through T12-7 all passed when tested individually (flag, verify opacity, unflag within same interaction). The crash occurs specifically when:
1. A node has `deadEnd: true` persisted
2. The conversation is reloaded (switch away and back, or page reload)
3. The dead-end node is selected (clicked)

This suggests a Zustand selector caching issue in the `NodeDetailPanel` or related component — `getSnapshot` returns a new object reference on every render when the dead-end node is selected, causing an infinite update loop.

---

## Bugs Found

### Bug 1: Selecting a persisted dead-end node crashes the app — FIXED
**Severity**: Critical
**Fix commit**: `2112510` — "Fix infinite re-render loop in NodeDetailPanel provider selector"
**Root cause**: A `.filter()` call inside a Zustand selector in `NodeDetailPanel` created a new array reference on every invocation, causing `useSyncExternalStore` to see a perpetual state change and loop infinitely.
**Fix**: Replaced inline `.filter()` in the selector with a stable `useSettingsStore((s) => s.providers)` selector + `useMemo` for the filtering, keyed on the stable providers array.

### Bug 2: Dead-end opacity-40 not applied after initial flag — FIXED
**Severity**: Medium
**Fix commit**: `ad703db` — "Bubble dead-end status upward to branch points via two-pass computation"
**Root cause**: The original `computeDeadEnd()` was a simple top-down pass that only propagated `deadEnd` downward. It failed to handle nodes whose descendants were all dead — the node itself wouldn't be marked, so `opacity-40` was never applied.
**Fix**: Replaced with a two-pass algorithm: Pass 1 (bottom-up) determines if all paths from a node lead to dead ends. Pass 2 (top-down) propagates dead-end status to descendants. The new `computeDeadEndMap()` returns a fully computed `deadEndIds` Set.
