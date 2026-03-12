# Tier 2 Batch 1 — Stars, Dead-Ends, Tags

Tests for Feature 11 (Stars), Feature 12 (Dead-Ends), and Feature 24 (Tags). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. At least one conversation exists with 3+ nodes (root assistant, user, assistant reply)
5. A second conversation exists (for cross-conversation tag tests)

---

## Feature 11 — Stars

### T11-1: Star icon appears on starred nodes in tree view

1. Load a conversation with multiple nodes
2. Click an assistant node to select it
3. In the NodeDetailPanel header, locate the star button (left of the X close button). It should show a `title="Star"` tooltip
4. Click the star button
5. Take a screenshot
6. **Verify**: The star button in NodeDetailPanel turns amber/gold colored
7. **Verify**: The star button tooltip changes to `title="Unstar"`
8. **Verify**: A small amber filled star icon (12px) appears in the node card header in the tree view

### T11-2: Unstar a node via NodeDetailPanel

1. With the same starred node selected from T11-1
2. Click the star button again (now showing "Unstar" tooltip)
3. Take a screenshot
4. **Verify**: The star button reverts to muted color
5. **Verify**: The tooltip reverts to "Star"
6. **Verify**: The amber star icon disappears from the tree node header

### T11-3: Star toggle via context menu

1. Right-click on an unstarred node in the tree view
2. Look for "Flag as dead end" or "Star" in the context menu
3. **Verify**: A context menu item for starring appears (look for a star-related option)
4. Click the star toggle option
5. **Verify**: The node now shows a small amber star icon in its header

### T11-4: Sidebar — All Chats tab (default)

1. Look at the sidebar below the search bar
2. **Verify**: There are two tab buttons: "All Chats" and "Starred" (with a small star icon)
3. **Verify**: "All Chats" is the active tab by default (has an accent-colored bottom border)
4. **Verify**: The conversation list is visible showing all conversations

### T11-5: Sidebar — Starred tab shows starred messages

1. Star at least 2 nodes in the current conversation (one user, one assistant)
2. Click the "Starred" tab in the sidebar
3. Take a screenshot
4. **Verify**: The tab switches, showing a list of starred messages
5. **Verify**: Each row shows a small amber filled star, a role label ("You" or "Claude"), and a content preview (truncated to ~80 chars)
6. **Verify**: The starred messages from step 1 appear in this list

### T11-6: Sidebar — Starred tab empty state

1. Create a new conversation with no starred nodes
2. Click the "Starred" tab in the sidebar
3. **Verify**: The message "No starred messages" is displayed centered in the panel

### T11-7: Clicking a starred item in sidebar selects the node

1. Switch to the "Starred" tab
2. Click on one of the starred message rows
3. **Verify**: The tree view navigates to show that node
4. **Verify**: The NodeDetailPanel opens showing the clicked node's content
5. **Verify**: The node has the star icon visible in its header

### T11-8: Star persists across conversation reload

1. Star a node in a conversation
2. Switch to a different conversation in the sidebar
3. Switch back to the original conversation
4. **Verify**: The previously starred node still shows the amber star icon
5. Click the "Starred" tab in the sidebar
6. **Verify**: The starred node still appears in the starred list

---

## Feature 12 — Dead-Ends

### T12-1: Flag a node as dead-end via NodeDetailPanel

1. Load a conversation with at least 3 levels of nodes
2. Click a non-root assistant node that has children to select it
3. In the NodeDetailPanel action bar (bottom), find the button with a flag icon labeled "Dead end"
4. Click it
5. Take a screenshot
6. **Verify**: The node card in the tree view becomes semi-transparent (opacity ~40%)
7. **Verify**: A small flag icon appears in the node header
8. **Verify**: The button label in NodeDetailPanel changes to "Unflag"
9. **Verify**: A banner appears in NodeDetailPanel content area: "This branch is flagged as a dead end" with a flag icon

### T12-2: Dead-end propagates to descendant nodes

1. With the dead-end node from T12-1, look at its child nodes in the tree
2. Take a screenshot
3. **Verify**: All descendant nodes of the flagged node also appear at reduced opacity (~40%)
4. **Verify**: The edges connecting dead-end nodes also appear dimmed

### T12-3: Unflag a dead-end node

1. With the flagged node from T12-1 still selected
2. Click the "Unflag" button in NodeDetailPanel
3. **Verify**: The node returns to full opacity
4. **Verify**: The flag icon disappears from the node header
5. **Verify**: The dead-end banner disappears from NodeDetailPanel
6. **Verify**: Descendant nodes also return to full opacity
7. **Verify**: The button label reverts to "Dead end"

### T12-4: Dead-end toggle via context menu

1. Right-click on a non-root node in the tree view
2. Look for "Flag as dead end" in the context menu
3. Click it
4. **Verify**: The node becomes semi-transparent with a flag icon
5. Right-click the same node again
6. **Verify**: The context menu now shows "Unflag dead end"
7. Click "Unflag dead end"
8. **Verify**: The node returns to full opacity

### T12-5: Root node cannot be flagged as dead-end

1. Click the root assistant node (the first node in the tree)
2. Look at the NodeDetailPanel action bar
3. **Verify**: There is no "Dead end" / flag button for the root node
4. Right-click the root node
5. **Verify**: No "Flag as dead end" option appears in the context menu

### T12-6: Dead-end edge dimming in tree view

1. Flag a mid-tree node as dead-end (one that has both parent and children)
2. Take a screenshot of the tree view, zooming into the edges
3. **Verify**: Edges connecting dead-end nodes have reduced stroke opacity (~30%)
4. **Verify**: Edges connecting normal (non-dead-end) nodes have full opacity

### T12-7: Star and dead-end can coexist on same node

1. Select a non-root node
2. Star it (click star button in NodeDetailPanel header)
3. Flag it as dead-end (click "Dead end" button in action bar)
4. Take a screenshot
5. **Verify**: The node shows both the amber star icon AND the flag icon in its header
6. **Verify**: The node is semi-transparent (dead-end)
7. **Verify**: In the "Starred" tab of the sidebar, this node still appears

---

## Feature 24 — Tags

### T24-1: Add a tag to a conversation via header

1. Load a conversation
2. In the conversation header area (above the tree/thread view), locate the tag area
3. Click the "+ tag" button
4. **Verify**: A small text input appears with placeholder "Tag name"

### T24-2: Create a new tag by typing and pressing Enter

1. From T24-1, type "important" into the tag input
2. Press Enter
3. Take a screenshot
4. **Verify**: A tag pill labeled "important" appears in the header area
5. **Verify**: The pill has accent-tinted styling (accent color background at low opacity, accent text)
6. **Verify**: The pill has a small X button to remove it

### T24-3: Add multiple tags to a conversation

1. Click "+ tag" again
2. Type "research" and press Enter
3. Click "+ tag" again
4. Type "ai" and press Enter
5. Take a screenshot
6. **Verify**: Three tags are visible in the header: "important", "research", "ai"

### T24-4: Remove a tag by clicking X

1. On the "research" tag pill, click the X button
2. **Verify**: The "research" tag disappears
3. **Verify**: Only "important" and "ai" remain

### T24-5: Tags are normalized to lowercase

1. Click "+ tag"
2. Type "UPPERCASE" and press Enter
3. **Verify**: The tag appears as "uppercase" (lowercase)

### T24-6: Duplicate tags are prevented

1. Try adding the tag "important" again (it already exists)
2. **Verify**: No duplicate tag is created — still only one "important" pill

### T24-7: Cancel tag input with Escape

1. Click "+ tag"
2. Type "temp"
3. Press Escape
4. **Verify**: The input disappears without adding any tag
5. **Verify**: No "temp" tag was created

### T24-8: Tags appear on conversation rows in sidebar

1. Look at the sidebar "All Chats" tab
2. Find the conversation that has tags
3. **Verify**: Small tag pills appear below the conversation title (up to 3 shown)
4. **Verify**: Tags use a small rounded-full style with secondary background

### T24-9: Tag autocomplete suggestions

1. Add a tag "machine-learning" to the current conversation
2. Switch to a different conversation
3. Click "+ tag" and start typing "mac"
4. **Verify**: A dropdown appears below the input suggesting "machine-learning"
5. Click the suggestion
6. **Verify**: The tag "machine-learning" is added to this conversation too

### T24-10: Tag filtering in sidebar

1. Ensure at least one conversation has the tag "important" and another does not
2. In the sidebar, look for a tag filter area (below the tab switcher, showing a tag icon and tag pills)
3. **Verify**: The tag filter only appears when tags exist
4. Click the "important" tag pill in the filter area
5. **Verify**: The conversation list filters to show only conversations with the "important" tag
6. **Verify**: Conversations without this tag are hidden
7. Click the "important" filter pill again (or its X button) to clear the filter
8. **Verify**: All conversations are shown again

### T24-11: Tag filter empty state

1. Create a tag that no conversations have (add and immediately remove it — or use the filter on a tag only one conversation has)
2. Filter by a tag that yields no conversations
3. **Verify**: The message "No conversations with this tag" is displayed

### T24-12: Tags persist across page reload

1. Add a tag "persistent-test" to a conversation
2. Reload the page (navigate to `http://localhost:5173`)
3. Load the same conversation
4. **Verify**: The "persistent-test" tag is still visible in the header

---

## Cross-cutting: Stars + Dead-Ends + Tags Together

### TC1-1: All annotations visible simultaneously

1. In a conversation with multiple nodes:
   - Star one node
   - Flag a different node as dead-end
   - Add tags to the conversation
2. Take a screenshot of the full view
3. **Verify**: The starred node shows an amber star icon
4. **Verify**: The dead-end node and its descendants are semi-transparent with flag icons
5. **Verify**: Tags are visible in the conversation header
6. **Verify**: The sidebar "All Chats" tab shows tag pills on the conversation row
7. Switch to "Starred" tab
8. **Verify**: The starred node appears in the starred list
