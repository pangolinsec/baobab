# Feature 25 — Thread View Metadata Parity: Test Plan

Tests for metadata display in thread view, verifying that thread messages show the same visual indicators, chips, badges, and action buttons as the tree view. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (Anthropic or any provider)
5. **Test data setup**: Create a conversation with varied node types:
   - Send a message and wait for the response (creates basic user + assistant nodes)
   - Star the assistant response (click star icon in detail panel)
   - Reply to the assistant, send another message and wait for a response
   - Flag one of the user messages as dead-end (right-click → Flag as dead end)
   - If you have multiple providers configured, set a model override on a node via the context menu
6. Switch to **Thread view** using the view mode toggle (tree/thread toggle button in the toolbar)

---

## Section 1 — Model & Provider Indicators

### T25-1: Assistant model chip in thread view

1. In thread view, look at an assistant message
2. Take a screenshot
3. **Verify**: The assistant message header shows a model name chip (e.g., "haiku", "sonnet") in a muted background pill
4. **Verify**: The model chip appears after the "Assistant" label

### T25-2: User model override chip in thread view

1. If a user node has a model override set (modelOverride on the node):
   - In thread view, look at that user message
   - Take a screenshot
   - **Verify**: The user message header shows the override model name in an accent-colored chip
2. If no override is set, the user message should NOT show a model chip
3. **Verify**: Only user nodes with active overrides show the accent-colored model chip

### T25-3: System prompt override chip in thread view

1. Set a system prompt override on a user node (via context menu or detail panel in tree view)
2. Switch to thread view
3. Locate that user message
4. Take a screenshot
5. **Verify**: A "system" chip appears in the user message header with accent coloring
6. **Verify**: The chip only appears on user nodes, not assistant nodes

### T25-4: Provider indicator in thread view

1. If a conversation uses a non-default provider (e.g., a node has `providerId` different from the default):
   - In thread view, look at that assistant message
   - **Verify**: A "via [Provider Name]" text appears in the message header
2. If the node uses the default provider, no provider indicator should appear

---

## Section 2 — Annotations & Badges

### T25-5: Star indicator in thread view

1. In thread view, locate the starred assistant message (starred in prerequisites)
2. Take a screenshot
3. **Verify**: A filled amber/yellow star icon appears in the message header
4. **Verify**: Non-starred messages do NOT show a star icon in the header

### T25-6: Dead-end styling in thread view

1. In thread view, locate the message flagged as dead-end
2. Take a screenshot
3. **Verify**: The message (and the thread group containing it) has reduced opacity (dimmed, approximately 40% opacity)
4. **Verify**: A flag icon appears in the message header
5. **Verify**: Non-dead-end messages have full opacity

### T25-7: Edited badge in thread view

1. In tree view, right-click an assistant node and select "Duplicate & Edit"
2. Modify the content slightly and save
3. Switch to thread view and navigate to that edited node
4. Take a screenshot
5. **Verify**: The edited assistant message shows a pencil icon and "edited" badge in amber/orange coloring
6. **Verify**: Regular (unedited) assistant messages do NOT show the edited badge

### T25-8: Summary badge in thread view

1. If a summary node exists in the conversation (from summarize branch operation):
   - In thread view, navigate to include the summary node in the current path
   - Take a screenshot
   - **Verify**: The summary node shows a "summary" badge in blue coloring
   - **Verify**: The summary message has a blue left border
2. If no summary node exists, create one:
   - Switch to tree view
   - Right-click a node with descendants, select "Summarize branch"
   - Complete the summarization
   - Switch to thread view and navigate to the summary
   - **Verify**: Summary badge and blue left border are visible

### T25-9: Reply target indicator in thread view

1. In thread view, identify which message is the current reply target
2. Take a screenshot
3. **Verify**: The reply target message has a subtle green ring/border (ring-1 with reply-target color)
4. **Verify**: The reply target message shows a "reply target" label with a corner-down-right arrow icon
5. **Verify**: Only one message in the thread has this indicator

---

## Section 3 — Timestamps

### T25-10: Timestamps on messages

1. In thread view, look at any message
2. Take a screenshot
3. **Verify**: Each message shows a timestamp in the header area (right-aligned)
4. **Verify**: The timestamp format is a short time (e.g., "2:35 PM" or "14:35")
5. **Verify**: Timestamps appear on both user and assistant messages

---

## Section 4 — Action Buttons (Hover)

### T25-11: Assistant message hover actions

1. In thread view, hover over an assistant message
2. Take a screenshot showing the hover state
3. **Verify**: Action buttons appear on hover, including:
   - Reply here (corner-down-right icon)
   - Duplicate & Edit (copy-plus icon) — for non-root nodes
   - Dead-end flag toggle (flag icon) — for non-root nodes
   - Star toggle (star icon)
   - Copy (copy icon)
   - Delete (trash icon, in red) — for non-root nodes

### T25-12: User message hover actions

1. In thread view, hover over a user message (not the root)
2. Take a screenshot showing the hover state
3. **Verify**: Action buttons appear on hover, including:
   - Resend (send icon)
   - Duplicate & Edit (copy-plus icon)
   - Dead-end flag toggle (flag icon)
   - Star toggle (star icon)
   - Copy (copy icon)
   - Delete (trash icon, in red)

### T25-13: Error message hover actions

1. If an error node exists (assistant node starting with "Error:"):
   - In thread view, hover over it
   - **Verify**: Action buttons include: Retry (refresh icon), Copy, Delete
   - **Verify**: The message has a red left border
2. If no error node exists, SKIP this test

### T25-14: Star toggle works in thread view

1. In thread view, hover over an un-starred message
2. Click the star button
3. **Verify**: The star icon becomes filled/amber in the message header
4. Click the star button again
5. **Verify**: The star icon returns to the unfilled/muted state

### T25-15: Dead-end toggle works in thread view

1. In thread view, hover over a non-root message
2. Click the flag (dead-end) button
3. **Verify**: The message becomes dimmed (reduced opacity)
4. **Verify**: A flag icon appears in the header
5. Click the flag button again to unflag
6. **Verify**: Opacity returns to normal, flag disappears

---

## Section 5 — Content Features

### T25-16: System prompt collapsible in thread view

1. In thread view, look for a message that has an effective system prompt
2. **Verify**: A collapsible "System prompt" section appears above the message content
3. Click to expand it
4. Take a screenshot
5. **Verify**: The system prompt text is displayed in a bordered section
6. **Verify**: If the prompt is overridden on this node, an "overridden" pill appears next to the label
7. Click to collapse
8. **Verify**: The system prompt content is hidden

### T25-17: Thinking block collapsible in thread view

1. If thinking mode is enabled and an assistant response has thinking content:
   - In thread view, locate that message
   - **Verify**: A collapsible "Thinking" section appears with a character count badge
   - Click to expand
   - Take a screenshot
   - **Verify**: The thinking content is displayed in italics with markdown rendering
   - Click to collapse
   - **Verify**: The thinking content is hidden
2. If no thinking content exists, SKIP this test

---

## Section 6 — Parity Cross-Check

### T25-18: Compare tree view and thread view for same node

1. In tree view, click an assistant node that has: a model chip, starred status, and is the reply target
2. Take a screenshot of the node in tree view (both the tree node and the detail panel)
3. Note what indicators are visible: model chip text, star, reply target ring, any badges
4. Switch to thread view
5. Navigate to the same node's path
6. Take a screenshot of that message in thread view
7. **Verify**: The same indicators are present in thread view:
   - Model chip shows the same model name
   - Star icon is present and filled
   - Reply target indicator is visible
   - Timestamp is shown (thread view addition, not in tree nodes)

### T25-19: Branch indicator appears at branching points

1. In thread view, navigate to a message that has multiple children (a branching point)
2. Take a screenshot
3. **Verify**: A branch indicator appears showing the number of other branches
4. **Verify**: The branch indicator shows a preview of the first message in each alternate branch
