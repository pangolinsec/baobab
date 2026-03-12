# Tier 2 Batch 3 — Thread View

Tests for Feature 21 (Thread View). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (needed for sending messages)
5. At least one conversation exists with a branching tree — minimum 4 nodes deep with at least one branch point (a node with 2+ children)

---

## Feature 21 — Thread View

### T21-1: Tree/Thread toggle is visible

1. Load a conversation
2. Look at the top-right area of the conversation header (above the tree canvas)
3. Take a screenshot
4. **Verify**: A toggle widget with two buttons is visible: "Tree" (with GitBranch icon) and "Thread" (with List icon)
5. **Verify**: "Tree" is the active/selected view by default (has card background, darker text, shadow)
6. **Verify**: "Thread" is inactive (muted text)

### T21-2: Switch to Thread view

1. Click the "Thread" button in the toggle
2. Take a screenshot
3. **Verify**: The tree canvas (React Flow) is replaced by a scrollable list of messages
4. **Verify**: "Thread" button is now active (card background, shadow)
5. **Verify**: "Tree" button is now inactive (muted text)
6. **Verify**: Messages are displayed as full-width cards in a vertical list

### T21-3: Thread view shows path from root to selected/reply-target node

1. In tree view, click "Reply here" on an assistant node that is several levels deep
2. Switch to thread view
3. **Verify**: The thread shows messages in order from the root node down to the reply target node
4. **Verify**: Each message shows the full content (not truncated like in tree view)
5. **Verify**: User messages and assistant messages have distinct styling (role labels, different accent treatment)

### T21-4: Thread view message cards show role and content

1. In thread view, examine a message card
2. Take a screenshot
3. **Verify**: Each card shows a role label — "You" (with User icon) for user messages, "Claude" (with Sparkles icon) for assistant messages
4. **Verify**: The message content renders markdown (code blocks, formatting)
5. **Verify**: The timestamp is displayed

### T21-5: Hover actions appear on thread messages

1. In thread view, hover over an assistant message card
2. Take a screenshot during hover
3. **Verify**: Action buttons appear in the top-right of the card (initially hidden, visible on hover)
4. **Verify**: Actions include: Star button (star icon), Reply here (corner-down-right icon), Copy (copy icon)
5. Move mouse away from the card
6. **Verify**: Actions fade out

### T21-6: Hover actions — Star from thread view

1. Hover over an unstarred message in thread view
2. Click the star action button
3. **Verify**: A filled amber star indicator appears on the message card
4. Switch to tree view
5. **Verify**: The same node also shows the star icon in the tree

### T21-7: Hover actions — Reply here from thread view

1. Switch to thread view
2. Hover over an assistant message that is NOT the current reply target
3. Click the "Reply here" action button (corner-down-right icon)
4. **Verify**: The clicked message now shows a "reply target" indicator (ring/border and label text "reply target")
5. **Verify**: The ChatInput reply indicator updates to reflect the new reply target

### T21-8: Hover actions — Copy from thread view

1. Hover over a message in thread view
2. Click the Copy button
3. **Verify**: The icon briefly changes from a copy icon to a check icon
4. **Verify**: The message content is copied to the clipboard

### T21-9: Reply here button hidden for user messages

1. Hover over a user message ("You") in thread view
2. **Verify**: The star and copy buttons appear, but NO "Reply here" button is shown

### T21-10: Thread view — selected node highlighting

1. In tree view, click on a specific node to select it
2. Switch to thread view
3. **Verify**: The selected node in the thread has a ring/outline highlight (accent colored ring, 2px)

### T21-11: Branch indicator between messages

1. In a conversation with a branch point (a node that has 2+ children), switch to thread view
2. Navigate to the path that passes through the branch point
3. **Verify**: A branch indicator appears between the branching parent and the current child, showing something like "N other branch(es) from here"
4. Take a screenshot

### T21-12: Branch indicator — expand to see sibling previews

1. Click the branch indicator text (e.g., "2 other branches from here")
2. Take a screenshot
3. **Verify**: The indicator expands to show a list of sibling branches
4. **Verify**: Each sibling row shows a role label ("You" or "Claude") and a content preview (truncated)

### T21-13: Branch indicator — click sibling to navigate

1. With the branch indicator expanded, click on one of the sibling rows
2. **Verify**: The node is selected (thread view may update to show the path through this sibling)

### T21-14: Branch indicator — "View in tree" button

1. Expand the branch indicator
2. Hover over a sibling row
3. **Verify**: A small eye icon button appears on hover with title "View in tree"
4. Click it
5. **Verify**: The view switches to tree mode and the sibling node is selected/visible

### T21-15: Switch back to Tree view

1. While in thread view, click the "Tree" button in the toggle
2. **Verify**: The scrollable message list is replaced by the React Flow tree canvas
3. **Verify**: The previously selected node is visible in the tree

### T21-16: Keyboard navigation — ArrowUp/ArrowDown

1. Switch to thread view
2. Click somewhere in the thread area to ensure focus
3. Press the Down arrow key
4. **Verify**: The next message in the thread becomes selected (highlighted with ring)
5. Press Down arrow again
6. **Verify**: Selection moves to the next message
7. Press Up arrow
8. **Verify**: Selection moves back to the previous message
9. Continue pressing Up to the first message
10. **Verify**: Selection stops at the first message (doesn't wrap)

### T21-17: Keyboard navigation — Enter to set reply target

1. In thread view, use arrow keys to navigate to an assistant message
2. Press Enter
3. **Verify**: The reply target updates to the currently selected assistant message
4. **Verify**: The "reply target" indicator appears on that message

### T21-18: Dead-end styling in thread view

1. In tree view, flag a node as dead-end
2. Switch to thread view on a path that includes the dead-end node
3. **Verify**: The dead-end message card appears at reduced opacity (~40%)
4. **Verify**: A flag icon is visible on the dead-end message

### T21-19: Summary node styling in thread view

1. If summary nodes exist (from Feature 15 tests), navigate to a path that includes them
2. Switch to thread view
3. **Verify**: Summary messages have a blue-gray left border (3px, #7C9AB5)
4. **Verify**: Summary messages show a "summary" badge

### T21-20: Error node styling in thread view

1. If any error nodes exist (content starting with "Error: "), navigate to them
2. Switch to thread view
3. **Verify**: Error messages have a red left border (3px)

### T21-21: Reply target indicator in thread view

1. In thread view, identify the current reply target node
2. **Verify**: It has a ring/border in the reply-target color
3. **Verify**: A small label "reply target" with a corner-down-right icon is visible

### T21-22: Mid-thread reply notice in ChatInput

1. Switch to thread view
2. Use "Reply here" on a message that already has children (a mid-tree node, not a leaf)
3. Look at the ChatInput area at the bottom
4. **Verify**: A notice appears indicating this will create a branch (look for GitBranch icon and text about creating a branch)

### T21-23: Auto-scroll during streaming

1. In thread view, set the reply target to the last node
2. Send a message that will generate a long response
3. During streaming, observe the scroll behavior
4. **Verify**: The thread view automatically scrolls down to keep the streaming response visible

### T21-24: Thread view empty state

1. Create a brand new conversation (no messages sent yet)
2. Switch to thread view
3. **Verify**: The root assistant node ("Hello! How can I help you today?" or similar) is displayed
4. **Verify**: The view is functional — you can send a message from this state

---

## Cross-cutting: View Mode Persistence

### TC21-1: View mode persists within session

1. Switch to thread view
2. Navigate to a different conversation via the sidebar
3. Navigate back to the original conversation
4. **Verify**: The view mode may reset to tree (this is the expected default per conversation load) OR persist — verify whichever behavior is implemented
5. Take a screenshot for documentation
