# Batch 4 — Visual Indicators Test Plan

Tests for Feature 10 (Visual Indicators), UI Fix 3 (Error Node Styling), and UI Fix 15 (Active Path Highlighting). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (needed for sending messages and generating assistant nodes)
5. At least one conversation exists with 2+ assistant nodes (root + at least one reply)

---

## Feature 10 — Visual Indicators (Model & System Override Chips)

### T10-1: Model chip renders in muted style by default

1. Load a conversation with at least one assistant response node
2. Take a screenshot of the tree view, zooming into an assistant node
3. **Verify**: The assistant node shows a model chip below the header row (between header and content preview)
4. **Verify**: The chip displays an abbreviated model name (e.g., "Sonnet 4", "Haiku 3.5")
5. **Verify**: The chip has muted styling — a secondary/gray background with muted text color, NOT orange/accent colored

### T10-2: Model chip turns orange when model override is set

1. Load a conversation with at least 2 assistant nodes
2. Click on a non-root assistant node to select it
3. In the NodeDetailPanel on the right, find the "Branch model" dropdown
4. Change the model selection from "Inherit (...)" to a different model (e.g., pick any other available model)
5. Take a screenshot of the tree view, zooming into the node you just changed
6. **Verify**: The model chip on that node now has orange/accent styling — orange text with a light orange background
7. **Verify**: The chip text shows the name of the overridden model
8. **Verify**: The node now has an orange border (`border-2` in accent color)

### T10-3: Model chip reverts to muted when override is cleared

1. Continuing from T10-2, with the node still selected
2. In the NodeDetailPanel, change the "Branch model" dropdown back to "Inherit (...)"
3. Take a screenshot of the tree view, zooming into the node
4. **Verify**: The model chip returns to muted styling (no orange)
5. **Verify**: The orange border on the node disappears

### T10-4: System prompt override shows "system" chip

1. Click a non-root assistant node to select it
2. In the NodeDetailPanel, find and click "Branch system prompt" to expand it
3. Type some text into the system prompt textarea (e.g., "You are a pirate")
4. Take a screenshot of the tree view, zooming into the node
5. **Verify**: A "system" chip appears in the chips row below the header
6. **Verify**: The "system" chip has orange/accent styling (orange text, light orange background)
7. **Verify**: The node has an orange border

### T10-5: Clearing system prompt override removes "system" chip

1. Continuing from T10-4, with the node still selected
2. In the NodeDetailPanel system prompt section, click "Clear override (inherit from parent)"
3. Take a screenshot of the tree view, zooming into the node
4. **Verify**: The "system" chip is no longer visible
5. **Verify**: If no model override is set either, the orange border disappears

### T10-6: Both model and system overrides show both chips

1. Click a non-root assistant node to select it
2. Set a model override via the "Branch model" dropdown (pick a different model)
3. Expand "Branch system prompt" and type override text
4. Take a screenshot of the tree view, zooming into the node
5. **Verify**: The chips row shows two chips: the model name chip (orange) and a "system" chip (orange)
6. **Verify**: The node has an orange border
7. Clear both overrides when done

### T10-7: User nodes do NOT show chips row

1. Click a user message node in the tree to select it
2. Take a screenshot of the tree view, zooming into that user node
3. **Verify**: The user node does NOT have a chips row — no model chip, no "system" chip
4. **Verify**: User nodes show only the header ("You" label) and content preview

### T10-8: Root node has no override controls

1. Click the root assistant node (the first node at the top of the tree)
2. Look at the NodeDetailPanel
3. **Verify**: There is no "Branch model" dropdown visible
4. **Verify**: There is no "Branch system prompt" section visible
5. **Verify**: The root node's model chip is in muted style (not overridden)

### T10-9: Model chip on old header location is removed

1. Load a conversation with assistant nodes
2. Take a screenshot zoomed into an assistant node
3. **Verify**: The model name does NOT appear as a rounded-full pill in the header row next to "Claude"
4. **Verify**: The model chip appears in a separate chips row below the header, with `rounded-md` styling

---

## UI Fix 3 — Error Node Visual Distinction

### T3-1: Error node shows red border and error icon

1. Open Settings and set the API key to an invalid value (e.g., "invalid-key-12345")
2. Close Settings
3. Create a new conversation or use an existing one
4. Type a message and send it
5. Wait for the API call to fail — an error node should appear
6. Take a screenshot of the tree view, zooming into the error node
7. **Verify**: The error node has a red border (`border-2 border-red-500`)
8. **Verify**: The error node header shows a red triangle warning icon (AlertTriangle) next to "Claude"
9. **Verify**: The node content starts with "Error: ..."
10. Restore a valid API key in Settings when done

### T3-2: Error node shows model chip but NOT orange border

1. Using the error node from T3-1 (or create a new one with invalid API key)
2. Take a screenshot zoomed into the error node
3. **Verify**: If the error node has a model chip in the chips row, it uses muted styling (not orange)
4. **Verify**: The border is red, NOT orange — red border takes precedence over any override border

### T3-3: Error node detail panel shows error actions

1. Click the error node to select it
2. Look at the NodeDetailPanel
3. **Verify**: The detail panel shows error-specific actions: "Retry", "Copy error", and "Delete"
4. **Verify**: No "Reply here" button is shown for error nodes

### T3-4: Error icon does not appear on user nodes

1. Look at user message nodes in the tree
2. **Verify**: User nodes never show the AlertTriangle error icon, even if they were sent before an error

---

## UI Fix 15 — Active Path Highlighting

### T15-1: Selecting a node highlights path from root

1. Load a conversation with at least 3 levels deep (root → user → assistant → user → assistant)
2. Click the deepest assistant node to select it
3. Take a screenshot of the full tree view
4. **Verify**: The edges (connecting lines) from the root node down to the selected node are highlighted in orange/accent color
5. **Verify**: The highlighted edges appear thicker than normal edges (stroke-width 3 vs 2)

### T15-2: Non-active-path edges remain default

1. Using the same conversation from T15-1, with a node selected
2. If there are branching paths, look at edges on branches NOT leading to the selected node
3. Take a screenshot
4. **Verify**: Edges not on the active path use the default muted color (warm beige/brown)
5. **Verify**: Only edges between root and the selected node are highlighted

### T15-3: Changing selection updates active path

1. Click a different node in the tree (on a different branch if possible)
2. Take a screenshot
3. **Verify**: The active path highlights shift to the new path from root to the newly selected node
4. **Verify**: The previously highlighted edges return to default styling

### T15-4: Active path with branching tree

1. Create a branching conversation: send a message, get a reply, then go back to an earlier node and branch
2. Select a node on one branch
3. Take a screenshot
4. **Verify**: Only the edges on the path from root to the selected node are highlighted
5. Select a node on the other branch
6. Take a screenshot
7. **Verify**: The active path now follows the other branch — edges on the first branch are no longer highlighted

### T15-5: No active path when no node is selected

1. If possible, navigate to a state where no node is selected (e.g., create a new conversation)
2. Take a screenshot of the tree view
3. **Verify**: All edges use the default muted color — no edges are highlighted in accent color

### T15-6: Active path works with streaming node

1. Set a reply target and send a message
2. While the assistant is streaming a response, take a screenshot
3. **Verify**: The streaming node's edge still shows the animated dashed pattern
4. **Verify**: If the streaming node is selected, edges on the path to root are highlighted with accent color

### T15-7: Active path coexists with selection ring

1. Click a node to select it
2. Take a screenshot zoomed into the selected node
3. **Verify**: The selected node has its selection ring (accent `ring-2`)
4. **Verify**: The edge leading into the selected node is highlighted in accent color
5. **Verify**: Both visual treatments (node ring and edge highlight) are visible simultaneously

---

## Cross-cutting: Combined Visual Indicators

### TC4-1: Override border + selection ring stack correctly

1. Click a non-root assistant node to select it (should show selection ring)
2. Set a model override on it via "Branch model" dropdown
3. Take a screenshot zoomed into the node
4. **Verify**: The node has BOTH an orange border (from override) AND a selection ring — they are both visible
5. **Verify**: The border is inside the ring, the ring is outside the border

### TC4-2: Error + override node — red border wins

1. Set a model override on a non-root assistant node
2. Then trigger an error on that subtree (set invalid API key, send from that branch)
3. Take a screenshot of the error node
4. **Verify**: The error node has a RED border, not orange
5. **Verify**: The chips row (model chip) is still visible for diagnostic context

### TC4-3: Dark mode — indicators render correctly

1. Switch to Dark mode via Settings
2. Load a conversation with override indicators (model override on a node)
3. Take a screenshot
4. **Verify**: Orange accent chips and border remain visible and properly contrasted against the dark background
5. **Verify**: Muted model chips have appropriate dark-mode styling
6. **Verify**: Active path edge highlighting is visible in accent color on dark background
7. **Verify**: Error node red border is visible in dark mode

### TC4-4: Full visual smoke test

1. Create a new conversation, send a message, wait for response
2. Take a screenshot — baseline: model chip in muted style, active path highlighting to selected node
3. Set a model override on the assistant node
4. Take a screenshot — model chip turns orange, orange border appears
5. Set a system prompt override on the same node
6. Take a screenshot — "system" chip appears alongside model chip
7. Clear both overrides
8. Take a screenshot — back to baseline muted styling, no orange border
9. **Verify**: All transitions were smooth and no visual artifacts remain after clearing overrides
