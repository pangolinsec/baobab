# Feature 16 — Merge Branches: Test Plan

Tests for the merge branches feature: multi-select interaction, MultiSelectPanel, MergeDialog, merge node creation, and overlay edges. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (Anthropic or any provider)
5. **Test data setup**: Create a conversation with a branching tree:
   - Send a message like "Tell me about cats" and wait for a response
   - Click the assistant response, click "Reply here", send "Tell me about their behavior"
   - Wait for the response
   - Click the **first** assistant response again, click "Reply here", send "Tell me about their breeds"
   - Wait for the response
   - You now have two branches diverging from the first assistant node, each with a user + assistant message

---

## Section 1 — Multi-Select Interaction

### T16-1: Ctrl+Click selects first node with blue ring

1. With the branching conversation loaded in tree view
2. Hold Ctrl and click the assistant node at the end of Branch 1
3. Take a screenshot
4. **Verify**: The clicked node has a blue highlight ring (not the orange selection ring)
5. **Verify**: The NodeDetailPanel is NOT shown (single-select is cleared during multi-select)

### T16-2: Second Ctrl+Click shows MultiSelectPanel

1. Continue from T16-1 (one node already Ctrl+selected)
2. Hold Ctrl and click the assistant node at the end of Branch 2
3. Take a screenshot
4. **Verify**: Both nodes have blue highlight rings
5. **Verify**: The right-side panel shows "Multi-Select" header with "2 nodes" badge
6. **Verify**: The panel shows previews of both selected nodes with role labels (User/Assistant)
7. **Verify**: The panel shows a "Common Ancestor" section with the content of the shared ancestor node
8. **Verify**: A blue "Merge" button is visible at the bottom of the panel
9. **Verify**: A "Cancel" button is visible next to the Merge button

### T16-3: Third Ctrl+Click replaces second selection

1. Continue from T16-2 (two nodes Ctrl+selected)
2. Hold Ctrl and click a different node (e.g., a user node in Branch 1)
3. Take a screenshot
4. **Verify**: The first selection remains unchanged
5. **Verify**: The second selection has been replaced by the newly clicked node
6. **Verify**: MultiSelectPanel updates to show the new pair

### T16-4: Regular click exits multi-select

1. Continue from T16-3 (in multi-select mode)
2. Click a node WITHOUT holding Ctrl
3. Take a screenshot
4. **Verify**: Multi-select is cleared — no blue rings visible
5. **Verify**: The clicked node is now selected with the normal orange ring
6. **Verify**: The NodeDetailPanel is shown (not the MultiSelectPanel)

### T16-5: Escape clears multi-select

1. Ctrl+Click two nodes to enter multi-select mode
2. Press the Escape key
3. Take a screenshot
4. **Verify**: Multi-select is cleared — no blue rings, MultiSelectPanel is gone

### T16-6: Cancel button clears multi-select

1. Ctrl+Click two nodes to enter multi-select mode
2. Click the "Cancel" button in the MultiSelectPanel
3. Take a screenshot
4. **Verify**: Multi-select is cleared

---

## Section 2 — MultiSelectPanel Validation

### T16-7: Same node selected twice shows error

1. Ctrl+Click the same node twice (Ctrl+Click, then Ctrl+Click again on the same node)
2. **Verify**: Since clicking the same node toggles it off, you should end up with 0 or 1 selected nodes
3. **Verify**: The MultiSelectPanel does not appear with an error state for this case

### T16-8: Common ancestor display

1. Ctrl+Click the last assistant node in Branch 1
2. Ctrl+Click the last assistant node in Branch 2
3. Take a screenshot of the MultiSelectPanel
4. **Verify**: The "Common Ancestor" section is visible
5. **Verify**: It shows a preview of the node where the two branches diverge (the first assistant response)
6. **Verify**: The common ancestor section has a dashed border (visually distinct from the node previews)

### T16-9: Ancestor relationship warning

1. Ctrl+Click the first assistant node (the branching point)
2. Ctrl+Click a descendant node in one of its branches
3. Take a screenshot of the MultiSelectPanel
4. **Verify**: An amber/yellow warning message appears saying one node is an ancestor of the other
5. **Verify**: The Merge button is still enabled (this is a warning, not an error)

---

## Section 3 — Merge Dialog

### T16-10: Opening the merge dialog

1. Ctrl+Click two nodes in different branches
2. Click the "Merge" button in the MultiSelectPanel
3. Take a screenshot
4. **Verify**: A modal dialog appears with title "Merge Branches"
5. **Verify**: The dialog shows branch statistics (e.g., "Branch 1: N messages", "Branch 2: M messages")
6. **Verify**: A mode toggle is visible with "Summarize" and "Full Context" options
7. **Verify**: A model selector dropdown is visible
8. **Verify**: A "Merge prompt" textarea is visible with default content
9. **Verify**: "Cancel" and "Merge" buttons are at the bottom

### T16-11: Mode toggle — Summarize vs Full Context

1. Open the merge dialog (Ctrl+Click two nodes, click Merge)
2. **Verify**: "Summarize" mode is selected by default
3. Click "Full Context"
4. Take a screenshot
5. **Verify**: "Full Context" mode is now highlighted/active
6. **Verify**: An amber warning appears about higher token usage
7. Click "Summarize" again
8. **Verify**: Warning disappears, Summarize is active again

### T16-12: Merge prompt is editable

1. Open the merge dialog
2. Clear the merge prompt textarea and type "Combine the key insights from both branches into a structured summary."
3. **Verify**: The textarea accepts the new text
4. **Verify**: The Merge button remains enabled

### T16-13: Cancel closes dialog without merging

1. Open the merge dialog
2. Click "Cancel"
3. **Verify**: The dialog closes
4. **Verify**: No new nodes have been added to the tree
5. **Verify**: Multi-select is still active (both nodes still have blue rings)

### T16-14: Close button (X) closes dialog

1. Open the merge dialog
2. Click the X button in the top-right corner of the dialog
3. **Verify**: The dialog closes without performing a merge

---

## Section 4 — Merge Execution

### T16-15: Execute a merge (summarize mode)

1. Ctrl+Click the last assistant node in Branch 1
2. Ctrl+Click the last assistant node in Branch 2
3. Click "Merge" in the MultiSelectPanel
4. In the merge dialog, ensure "Summarize" mode is selected
5. Click "Merge"
6. Wait for the streaming response to complete
7. Take a screenshot of the tree
8. **Verify**: The merge dialog has closed
9. **Verify**: Two new nodes appear in the tree, attached as children of the common ancestor:
   - A user node with dashed border and blue-gray color (the synthetic merge request)
   - An assistant node below it (the merge response)
10. **Verify**: The synthetic user node shows a "merge" badge
11. **Verify**: Multi-select has been cleared

### T16-16: Merge node visual styling

1. After completing T16-15, click the synthetic merge user node
2. Take a screenshot
3. **Verify**: The node has a dashed border (not solid)
4. **Verify**: The node has a blue-gray border color (#7C9AB5 range)
5. **Verify**: A merge icon is visible in the node header
6. **Verify**: The node shows a "merge" badge/chip

### T16-17: Merge response node styling

1. Click the assistant node that was generated by the merge
2. Take a screenshot
3. **Verify**: The node has a solid border with blue-gray color (border-2 border-blue-400)
4. **Verify**: The node shows a "merge" badge/chip
5. **Verify**: The node detail panel shows the synthesized content

### T16-18: Merge overlay edges

1. After a merge has been performed, take a screenshot of the full tree
2. **Verify**: Dashed blue-gray overlay edges connect from the merge user node back to the two source branches
3. **Verify**: These overlay edges are visually distinct from the normal solid tree edges (they should be dashed, lighter, and semi-transparent)

### T16-19: Merge overlay edge highlighting on active path

1. Click the merge response (assistant) node to select it
2. Take a screenshot
3. **Verify**: The active path from root to the merge node is highlighted with the accent color
4. **Verify**: The merge overlay edges are also highlighted (thicker, fully opaque) when the merge node is on the active path

---

## Section 5 — Edge Cases

### T16-20: Merge preserves tree structure

1. After performing a merge, verify the original branches are intact
2. Click nodes in Branch 1 — they should still be navigable
3. Click nodes in Branch 2 — they should still be navigable
4. **Verify**: The merge did not delete or modify any existing nodes
5. **Verify**: The merge added nodes at the common ancestor level, not replacing anything

### T16-21: Reply to merge result

1. Click the merge response (assistant) node
2. Click "Reply here" in the detail panel
3. Type "Can you elaborate on the first point?" and send
4. Wait for the response
5. **Verify**: A new branch extends from the merge response node
6. **Verify**: The context for this new response includes the merge synthesis (walk to root passes through the merge)

### T16-22: Switching conversations clears multi-select

1. Ctrl+Click two nodes to enter multi-select mode
2. Click a different conversation in the sidebar (or create a new one)
3. **Verify**: Multi-select is cleared when switching conversations

---

## Section 6 — Destructive Tests

### T16-23: Delete a merge node

1. Right-click the synthetic merge user node
2. Select "Delete" from the context menu
3. **Verify**: The merge user node AND its assistant response child are deleted
4. **Verify**: The original branches remain intact
5. **Verify**: The overlay edges disappear
