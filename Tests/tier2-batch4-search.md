# Tier 2 Batch 4 — Search

Tests for Feature 20 (Global and Per-Chat Search). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. At least two conversations exist with known content:
   - Conversation A: contains a message with the word "quantum" and another with "photosynthesis"
   - Conversation B: contains a message with the word "quantum" (so cross-conversation search can be tested)
5. At least one node is starred and one node is flagged as dead-end (for indicator tests on search results)

---

## Global Search (Sidebar)

### T20-1: Global search bar is visible in sidebar

1. Look at the sidebar, between the header area and the All Chats/Starred tabs
2. Take a screenshot
3. **Verify**: A search input is visible with placeholder text "Search messages…"
4. **Verify**: A search icon (magnifying glass) appears on the left side of the input
5. **Verify**: No clear (X) button is visible when the input is empty

### T20-2: Typing in search bar shows "Press Enter to search"

1. Click the search input in the sidebar
2. Type "quantum"
3. **Verify**: The text "Press Enter to search" appears below the input
4. **Verify**: A clear (X) button appears on the right side of the input
5. **Verify**: The conversation list is still visible (search hasn't executed yet)

### T20-3: Execute global search with Enter

1. With "quantum" typed in the search bar, press Enter
2. Wait for results to load
3. Take a screenshot
4. **Verify**: The conversation list is replaced by search results
5. **Verify**: A result count label appears (e.g., "2 results" or similar)
6. **Verify**: Results from both Conversation A and Conversation B appear (since both contain "quantum")

### T20-4: Search result card contents

1. Examine a search result card from T20-3
2. **Verify**: Each result shows:
   - A role icon (User icon for user messages, Sparkles icon for assistant messages) with colored background
   - The conversation title in small muted text
   - A content snippet with the search term visible
3. **Verify**: Results are clickable (cursor changes to pointer on hover)

### T20-5: Search result indicators — starred and dead-end

1. Search for a term that matches a starred node
2. **Verify**: The result card for the starred node shows a small amber star icon
3. Search for a term that matches a dead-end node
4. **Verify**: The result card shows a small muted flag icon

### T20-6: Click search result navigates to conversation and node

1. Click on a search result card
2. **Verify**: The app navigates to the conversation containing that message
3. **Verify**: The matching node is selected (NodeDetailPanel shows it)
4. **Verify**: The global search is cleared and the sidebar returns to the conversation list

### T20-7: Search filters appear with results

1. Execute a global search that returns multiple results
2. **Verify**: A filter bar appears between the result count and the result list
3. **Verify**: The filter bar shows: "Filter:" label, "User" toggle, "Claude" toggle, "Starred" toggle

### T20-8: Filter by role — User only

1. With search results showing, click the "Claude" filter toggle to deactivate it (it should change from active/accent styling to muted)
2. **Verify**: Only user message results remain visible
3. **Verify**: "User" toggle remains active (accent-colored)
4. **Verify**: At least one role must always remain active — trying to deactivate "User" while "Claude" is already inactive should be prevented

### T20-9: Filter by role — Claude only

1. Re-activate "Claude" toggle
2. Deactivate "User" toggle
3. **Verify**: Only assistant/Claude message results remain visible

### T20-10: Filter by starred

1. Re-activate both role filters
2. Click the "Starred" toggle to activate it
3. **Verify**: The toggle gets amber/accent styling
4. **Verify**: Only starred messages appear in results
5. Click "Starred" again to deactivate
6. **Verify**: All matching results return

### T20-11: Clear search with X button

1. With search results showing, click the X button on the right side of the search input
2. **Verify**: The search input is cleared
3. **Verify**: The search results disappear
4. **Verify**: The conversation list returns (All Chats or Starred tab content)

### T20-12: Clear search with Escape

1. Type a search term and press Enter to get results
2. Press Escape while the search input is focused
3. **Verify**: The search is cleared and the conversation list returns

### T20-13: Search with no results

1. Type a nonsense string like "xyzzy12345" in the search bar
2. Press Enter
3. **Verify**: The message "No results found" is displayed
4. **Verify**: The result count shows "0 results"

### T20-14: Search "Searching…" state

1. Type a search term and press Enter
2. Immediately observe the UI before results load
3. **Verify**: A "Searching…" label appears briefly while the search executes

---

## Per-Chat Search (Conversation View)

### T20-15: Search icon button in conversation header

1. Load a conversation
2. Look at the top-right area of the conversation header (near the Tree/Thread toggle)
3. **Verify**: A search icon button is visible with title "Search in conversation (Ctrl+F)"
4. **Verify**: The button has muted styling when the search bar is closed

### T20-16: Open per-chat search with button click

1. Click the search icon button in the conversation header
2. Take a screenshot
3. **Verify**: A search bar appears below the header
4. **Verify**: The bar contains: search icon, input with placeholder "Search in this conversation…", and an X close button
5. **Verify**: The search icon button in the header changes to active/accent styling
6. **Verify**: The search input is auto-focused

### T20-17: Open per-chat search with Ctrl+F

1. Close the per-chat search bar if open
2. Press Ctrl+F (or Cmd+F on Mac)
3. **Verify**: The per-chat search bar opens and the input is focused
4. **Verify**: The browser's native find dialog does NOT open (the shortcut is intercepted)

### T20-18: Per-chat search — type to find matches

1. With the per-chat search bar open, type a word that exists in the conversation (e.g., "quantum")
2. Wait briefly for results
3. **Verify**: A result counter appears in the search bar showing "1 of N" (current match index of total matches)
4. **Verify**: Navigation arrows (ChevronUp and ChevronDown) appear next to the counter

### T20-19: Per-chat search — tree view highlights

1. With per-chat search active and matches found, look at the tree view
2. Take a screenshot
3. **Verify**: Matching nodes in the tree have an amber/yellow ring highlight (ring-2 ring-amber-500)
4. **Verify**: Non-matching nodes do NOT have the highlight ring

### T20-20: Per-chat search — navigate between matches

1. With multiple matches found, click the ChevronDown button (next match)
2. **Verify**: The result counter updates (e.g., "2 of 3")
3. Click ChevronDown again
4. **Verify**: Counter advances to next match
5. Click ChevronUp (previous match)
6. **Verify**: Counter goes back to previous match

### T20-21: Per-chat search — Enter and Shift+Enter navigation

1. With multiple matches and the search input focused
2. Press Enter
3. **Verify**: Navigates to the next match (same as ChevronDown)
4. Press Shift+Enter
5. **Verify**: Navigates to the previous match (same as ChevronUp)

### T20-22: Per-chat search — close with X button

1. Click the X button on the right side of the per-chat search bar
2. **Verify**: The search bar closes
3. **Verify**: The amber highlight rings disappear from tree nodes
4. **Verify**: The search icon button in the header reverts to muted styling

### T20-23: Per-chat search — close with Escape

1. Open per-chat search with Ctrl+F
2. Type a search term
3. Press Escape
4. **Verify**: The search bar closes and highlights are cleared

### T20-24: Per-chat search in thread view

1. Switch to thread view
2. Open per-chat search (Ctrl+F or button)
3. Type a word that matches messages in the thread
4. **Verify**: Matching messages in the thread view get a left border highlight in amber (border-l-[3px] border-l-amber-500)
5. **Verify**: The result counter works and navigates through matches

### T20-25: Per-chat search — no matches

1. Open per-chat search
2. Type a word that doesn't exist in this conversation
3. **Verify**: The result counter shows "0 of 0" or no counter is displayed
4. **Verify**: No nodes are highlighted in the tree

---

## Cross-cutting: Search + Other Features

### TC20-1: Global search then per-chat search

1. Execute a global search in the sidebar
2. Click a result to navigate to a conversation
3. Open per-chat search (Ctrl+F) in that conversation
4. **Verify**: Both searches work independently — global search was cleared on navigation, per-chat search works in the current conversation

### TC20-2: Search highlights coexist with star/dead-end indicators

1. In a conversation with starred and dead-end nodes, open per-chat search
2. Search for a term that matches both a starred node and a normal node
3. **Verify**: Starred nodes show BOTH the amber search ring AND the star icon
4. **Verify**: Dead-end nodes show BOTH the amber search ring AND reduced opacity/flag
