# Tier 2 Batch 2 — Summarize Branches

Tests for Feature 15 (Branch Summarization). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (required for summarization streaming)
5. At least one conversation exists with a branching tree — at least 3 levels deep (root → user → assistant → user → assistant), so summarization has meaningful content to summarize

---

## Feature 15 — Summarize Branches

### T15-1: Summarize option appears in context menu for nodes with children

1. Load a conversation with a multi-level tree
2. Right-click on a node that has children (e.g., the root assistant node or a mid-tree node)
3. **Verify**: The context menu includes a "Summarize branch" option with a file-text icon

### T15-2: Summarize option hidden for leaf nodes

1. Right-click on a leaf node (a node with no children)
2. **Verify**: The context menu does NOT include "Summarize branch"

### T15-3: SummarizeDialog opens from context menu

1. Right-click on a node that has children
2. Click "Summarize branch"
3. Take a screenshot
4. **Verify**: A modal dialog opens centered on screen
5. **Verify**: The dialog title is "Summarize Branch" with a blue-gray file icon (#7C9AB5)
6. **Verify**: A stats bar shows message count, depth, and content count (e.g., "5 messages", "3 levels deep", "4 with content")
7. **Verify**: A textarea is present labeled "Summarization prompt" pre-filled with the default prompt
8. **Verify**: "Cancel" and "Summarize" buttons are visible at the bottom

### T15-4: SummarizeDialog can be closed with Cancel

1. With the SummarizeDialog open from T15-3
2. Click "Cancel"
3. **Verify**: The dialog closes
4. **Verify**: No new nodes were created in the tree

### T15-5: SummarizeDialog can be closed with X button

1. Right-click a node with children, click "Summarize branch"
2. Click the X button in the top-right corner of the dialog
3. **Verify**: The dialog closes without creating any nodes

### T15-6: Edit summarization prompt in dialog

1. Open the SummarizeDialog for a node with children
2. Clear the textarea and type a custom prompt: "Give me a one-sentence summary."
3. **Verify**: The textarea accepts the new text
4. **Verify**: The "Summarize" button is still clickable

### T15-7: Execute summarization (requires API key)

1. Open the SummarizeDialog for a node with children (the node should have at least 2 descendant messages with content)
2. Keep the default prompt or enter a custom one
3. Click the "Summarize" button
4. Wait for streaming to complete (the dialog should close automatically)
5. Take a screenshot
6. **Verify**: Two new child nodes appear under the target node in the tree:
   - A user node with content starting with "[Summary request]"
   - An assistant node containing the generated summary
7. **Verify**: Both new nodes have summary styling: a blue-gray left border (3px, #7C9AB5 color)
8. **Verify**: Both nodes show a "summary" badge in their header (small blue-gray label)

### T15-8: Summary node styling in tree view

1. After T15-7, locate the summary nodes in the tree
2. Take a screenshot zoomed into the summary nodes
3. **Verify**: The nodes have a 3px left border in blue-gray (#7C9AB5)
4. **Verify**: A "summary" text badge is visible in the node header with blue-gray tinted background

### T15-9: Summary node in NodeDetailPanel

1. Click one of the summary nodes to select it
2. Look at the NodeDetailPanel
3. **Verify**: The full summary content is displayed
4. **Verify**: The node can be starred (star button works)
5. **Verify**: The node can be flagged as dead-end (flag button works)

### T15-10: Default summarization prompt from Settings

1. Open Settings and navigate to the "Prompts" section/tab
2. **Verify**: There is a "Summarization Prompt" textarea
3. **Verify**: It contains the default prompt text about providing a concise summary
4. Modify the prompt to "List the key topics discussed."
5. Close Settings
6. Open the SummarizeDialog for a node
7. **Verify**: The textarea is pre-filled with "List the key topics discussed." (the updated prompt from Settings)
8. Close the dialog

### T15-11: Reply target updates after summarization

1. Before summarizing, note the current reply target in the ChatInput area
2. Open SummarizeDialog and execute a summarization
3. After the summary completes
4. **Verify**: The reply target indicator in ChatInput now points to the new summary assistant node
5. **Verify**: Sending a new message from here would branch from the summary node

---

## Edge Cases

### T15-E1: Summarize a single-child branch

1. Find or create a node with exactly one child
2. Right-click it and select "Summarize branch"
3. Verify the stats in the dialog show a small count (e.g., "1 messages", "1 levels deep")
4. Click "Summarize" (if API key is available)
5. **Verify**: The summarization still works correctly for minimal content

### T15-E2: Multiple summarizations on same branch

1. Summarize a branch to create summary nodes
2. Right-click the same parent node again
3. **Verify**: "Summarize branch" is still available (the node still has children — including the new summary nodes)
4. Execute a second summarization
5. **Verify**: A second pair of summary nodes is created as additional children of the parent
6. **Verify**: Both sets of summary nodes are visible in the tree
