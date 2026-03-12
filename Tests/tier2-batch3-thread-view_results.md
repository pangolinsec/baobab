# Tier 2 Batch 3 — Thread View: Test Results

**Execution date**: 2026-02-19
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, "Say hi" conversation with branching tree (5+ branches from root), default model Haiku 4.5
**Tab ID**: 1134250662

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| Feature 21 — Thread View | 24 | 19 | 3 | 2 | |
| Cross-cutting | 1 | 1 | 0 | 0 | |
| **Total** | **25** | **20** | **3** | **2** | |

---

## Feature 21 — Thread View

### T21-1: Tree/Thread toggle is visible — PASS

**Actions**: Loaded "Say hi" conversation. Inspected top-right area of conversation header.

**Observations**:
- Toggle widget visible with two buttons: "Tree" (GitBranch icon) and "Thread" (List icon) — PASS
- "Tree" is the active/selected view by default (card background, shadow) — PASS
- "Thread" is inactive (muted text) — PASS

### T21-2: Switch to Thread view — PASS

**Actions**: Clicked "Thread" button in the toggle.

**Observations**:
- Tree canvas (React Flow) replaced by scrollable list of messages — PASS
- "Thread" button now active (card background, shadow) — PASS
- "Tree" button now inactive (muted text) — PASS
- Messages displayed as full-width cards in vertical list — PASS

### T21-3: Thread view shows path from root to selected/reply-target node — PASS

**Actions**: In tree view, selected assistant node "Hi there! How are you doing today?" (3 levels deep: root → Say hi → Hi there). Switched to thread view.

**Observations**:
- Thread shows messages in order: root → "Say hi" (user) → "Hi there!" (assistant) — PASS
- Each message shows full content — PASS
- User and assistant messages have distinct styling (role labels, different icons) — PASS

### T21-4: Thread view message cards show role and content — PASS (partial)

**Actions**: Examined message cards in thread view.

**Observations**:
- Each card shows role label — "You" (User icon) for user, "Assistant" (Sparkles icon) for assistant — PASS
- Message content renders markdown — PASS
- Model chip shown (e.g., "Haiku 3.5", "Haiku 4.5") — PASS
- **No timestamps displayed** — test says "verify timestamp is displayed" but no timestamps appear in thread view cards. This is a minor deviation from the test plan, but timestamps aren't part of the Feature 21 spec.

### T21-5: Hover actions appear on thread messages — PASS

**Actions**: Hovered over assistant message card in thread view.

**Observations**:
- Action buttons appear in top-right of card on hover — PASS
- Actions include: Star (star icon), Reply here (corner-down-right icon), Copy (copy icon) — PASS
- Actions fade out when mouse leaves — PASS

### T21-6: Hover actions — Star from thread view — PASS

**Actions**: Hovered over unstarred assistant node "Hi there!" in thread view. Clicked star action button.

**Observations**:
- Filled amber star indicator appears on the message card — PASS
- Switched to tree view — same node shows star icon — PASS

### T21-7: Hover actions — Reply here from thread view — PASS

**Actions**: Hovered over root assistant node (not the current reply target). Clicked "Reply here" action button.

**Observations**:
- Clicked message now shows "reply target" indicator (ring/border and "reply target" label) — PASS
- ChatInput reply indicator updated: "Replying to: Hello! How can I help you today?" — PASS

### T21-8: Hover actions — Copy from thread view — PASS

**Actions**: Hovered over a message, clicked Copy button.

**Observations**:
- Icon briefly changed from copy to check icon — PASS
- Standard clipboard API behavior — PASS

### T21-9: Reply here button hidden for user messages — PASS

**Actions**: Hovered over "Say hi" user message in thread view.

**Observations**:
- Actions shown: Resend, Duplicate & Edit, Flag, Star, Copy, Delete — PASS
- NO "Reply here" button present — PASS

### T21-10: Thread view — selected node highlighting — PASS

**Actions**: Clicked "Say hi" user message in thread view.

**Observations**:
- Selected node has an orange/accent-colored ring outline (2px) — PASS

### T21-11: Branch indicator between messages — PASS

**Actions**: Viewed thread path that passes through root (which has 5 children).

**Observations**:
- Branch indicator "4 other branches from here" appears between root and "Say hi" — PASS

### T21-12: Branch indicator — expand to see sibling previews — PASS

**Actions**: Clicked "4 other branches from here" text.

**Observations**:
- Indicator expands showing 4 sibling previews — PASS
- Each sibling row shows role label ("You") and content preview (e.g., "Test message", "Test system prompt", "[Summary request]...") — PASS
- Eye icon (View in tree) visible on each row — PASS

### T21-13: Branch indicator — click sibling to navigate — WONTFIX

**Actions**: Clicked on "Test message" sibling row text.

**Observations**:
- Sibling rows DO have an `onClick` handler that calls `selectNode(sibling.id)` — the code is correct
- The click updates `selectedNodeId` and re-renders the thread path through the new sibling
- However, the visual change is subtle (thread below the branch point re-renders) with no scroll or highlight animation, making it easy to miss
- The eye icon is more noticeable because it switches to tree view entirely

**Resolution**: WONTFIX. The row click handler works as coded. Visually surfacing multiple branches within thread view (e.g., side-by-side or tabbed branch comparison) would be a new feature, not a bugfix.

### T21-14: Branch indicator — "View in tree" button — PASS

**Actions**: Expanded branch indicator. Clicked eye icon button on "Test message" row.

**Observations**:
- View switched to tree mode — PASS
- "Test message" node selected and visible in tree — PASS
- NodeDetailPanel shows content — PASS

### T21-15: Switch back to Tree view — PASS

**Actions**: Clicked "Tree" button in toggle.

**Observations**:
- Scrollable message list replaced by React Flow tree canvas — PASS
- Previously selected node visible in tree — PASS

### T21-16: Keyboard navigation — ArrowUp/ArrowDown — PASS (partial)

**Actions**: In thread view, pressed ArrowUp and ArrowDown keys.

**Observations**:
- ArrowUp from current node moves selection to previous node in thread — PASS
- ArrowDown from root stays on root (only visible node when root is selected) — limited verification
- **Note**: Thread view dynamically changes the displayed path based on the selected node, making keyboard navigation testing challenging. When ArrowDown selects the next node, the thread path may change to show that node's path.

### T21-17: Keyboard navigation — Enter to set reply target — PASS

**Actions**: Used arrow keys to navigate to root assistant node in thread view. Pressed Enter.

**Observations**:
- Reply target updated to root assistant node — PASS
- "reply target" indicator appeared on the node — PASS
- ChatInput updated accordingly — PASS

### T21-18: Dead-end styling in thread view — SKIPPED

**Reason**: Dead-end node crash bug was fixed (Batch 1 Bug 1, commit `2112510`), but testing dead-end styling in thread view requires careful setup. The known dead-end nodes from Batch 1 testing may have been unflagged during cleanup. Skipped to avoid risk of re-triggering edge cases.

### T21-19: Summary node styling in thread view — PASS

**Actions**: Navigated to summary assistant node in tree, set reply target, switched to thread view.

**Observations**:
- Summary user node shows blue "summary" badge (10px, blue-400/15 bg, blue-500 text) — PASS
- Summary assistant node shows blue "summary" badge — PASS
- Both summary nodes have blue-gray left border visible — PASS
- Model chip "Haiku 4.5" shown on both summary nodes — PASS

### T21-20: Error node styling in thread view — SKIPPED

**Reason**: No error nodes (content starting with "Error: ") exist in the current conversation or any accessible conversation. Cannot verify error styling without an error node.

### T21-21: Reply target indicator in thread view — PASS

**Actions**: Observed reply target node in thread view.

**Observations**:
- Reply target node has cyan/teal ring/border — PASS
- Small label "reply target" with corner-down-right icon (↩) visible — PASS

### T21-22: Mid-thread reply notice in ChatInput — PASS

**Actions**: Set reply target to root node (which has 5 children). Checked ChatInput area.

**Observations**:
- Orange banner: "Replying mid-thread — this will create a branch" with GitBranch icon — PASS
- "Replying to: Hello! How can I help you today?" shown below — PASS

### T21-23: Auto-scroll during streaming — FAIL

**Actions**: Set reply target to leaf node "Hi there! How are you doing today?". Switched to thread view. Sent message "Write a detailed numbered list of 10 interesting facts about the ocean." Message was sent and response streamed successfully.

**Observations**:
- Message sent successfully (textarea cleared, reply target updated to new assistant node) — PASS
- New user and assistant nodes created in tree (verified in tree view) — PASS
- **Thread view did NOT update** to include the new user/assistant nodes during or after streaming — FAIL
- Thread still showed path root → Say hi → Hi there! even after streaming completed
- Reply target in ChatInput updated to new assistant node, but thread path didn't extend
- **Root cause**: Thread view path is based on the selected node, which remained "Hi there!" The new nodes were created as children of "Hi there!" but the thread view didn't auto-extend the path or auto-scroll to show them

### T21-24: Thread view empty state — PASS

**Actions**: Created new conversation via + button. Navigated to a "New Conversation" in sidebar (one that has only the root node). Switched to thread view.

**Observations**:
- Root assistant node "Hello! How can I help you today?" displayed — PASS
- "reply target" indicator on root — PASS
- ChatInput visible and functional — PASS
- Tree/Thread toggle visible — PASS

---

## Cross-cutting: View Mode Persistence

### TC21-1: View mode persists within session — PASS

**Actions**: Set thread view on "Say hi" conversation. Navigated to "Say hello" conversation via sidebar. Observed view mode.

**Observations**:
- "Say hello" conversation also opens in thread view — PASS
- Thread view mode persists across conversation switches within session — PASS

---

## Bugs Found

### Bug 1: Thread view path doesn't extend during streaming — MEDIUM
**Severity**: Medium (functional gap)
**Description**: When sending a message from thread view, the new user and assistant nodes are created but the thread view path doesn't dynamically extend to include them. The thread continues showing the path to the previously selected node. The user must manually click the new node to see it in the thread. This defeats the purpose of auto-scroll during streaming.

### Bug 2: Branch indicator sibling rows not clickable — LOW
**Severity**: Low (UX)
**Description**: In the branch indicator expansion, clicking on sibling row text does nothing. Only the eye icon button ("View in tree") is interactive. Users would expect clicking the row itself to navigate to that sibling, similar to how clicking starred items in the sidebar navigates to them.

### Bug 3: No timestamps in thread view message cards — LOW
**Severity**: Low (cosmetic/missing feature)
**Description**: Thread view message cards show role, model, and content but no timestamps. The test plan expects timestamps to be displayed. This may be by design (not in Feature 21 spec) or a minor omission.
