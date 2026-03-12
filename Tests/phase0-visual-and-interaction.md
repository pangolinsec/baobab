# Phase 0 — Browser-Based Test Plan

Tests for Fix 14 (CSS Variables Refactor), Fix 11 (MiniMap Dark Mode), and Fix 6 (Selection/Reply Decoupling). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (needed for Fix 6 streaming tests)
5. At least one conversation exists with multiple nodes (user + assistant messages)

---

## Fix 14 — CSS Variables Refactor

### T14-1: Light mode — surfaces use correct backgrounds

1. Open Settings, set theme to Light, close Settings
2. Take a screenshot
3. **Verify**: Sidebar background is visually distinct from the main tree area (slightly darker warm tone)
4. **Verify**: The tree canvas area has the lightest background
5. **Verify**: No jarring color mismatches — all surfaces appear cohesive warm-stone palette

### T14-2: Dark mode — surfaces use correct backgrounds

1. Open Settings, set theme to Dark, close Settings
2. Take a screenshot
3. **Verify**: Sidebar background is the darkest surface (matches main bg in dark)
4. **Verify**: Tree canvas is dark (#1C1917-range)
5. **Verify**: Card surfaces (nodes, settings dialog) are slightly lighter than the background
6. **Verify**: No light-mode colors bleeding through (white patches, light borders)

### T14-3: Theme toggle — all elements switch

1. Start in Light mode, take a screenshot
2. Open Settings, switch to Dark, close Settings, take a screenshot
3. Open Settings, switch back to Light, close Settings, take a screenshot
4. **Verify**: Compare screenshot 1 vs screenshot 3 — they should be visually identical
5. **Verify**: Screenshot 2 shows complete dark mode — no elements stuck in light colors

### T14-4: Borders and dividers adapt to theme

1. In Light mode, take a screenshot and zoom into the sidebar border area
2. Switch to Dark mode, take a screenshot and zoom into the same area
3. **Verify (Light)**: Borders between sidebar/tree, header/content, footer/content are visible but subtle (warm beige tones)
4. **Verify (Dark)**: Same borders are visible as darker dividers, not bright lines

### T14-5: Text readability in both themes

1. With a conversation loaded showing both user and assistant nodes:
2. In Light mode, take a screenshot
3. **Verify**: All text (node content, sidebar titles, labels) is dark-on-light and legible
4. Switch to Dark mode, take a screenshot
5. **Verify**: All text is light-on-dark and legible — no low-contrast "invisible" text

### T14-6: Accent color consistency

1. In Light mode, locate the Send button, "Reply here" button, and any accent-colored elements
2. Take a screenshot
3. **Verify**: All accent elements use the same warm orange (#D97757-range)
4. Switch to Dark mode, repeat
5. **Verify**: Accent color remains consistent in dark mode

### T14-7: Hover states in sidebar

1. In Light mode, hover over a non-selected conversation in the sidebar
2. Take a screenshot during hover
3. **Verify**: Hover background is a subtle warm tone, text remains readable
4. Switch to Dark mode, repeat
5. **Verify**: Hover state is visible but subtle in dark mode

### T14-8: Zoom controls adapt to theme

1. With a conversation loaded, locate the zoom controls (bottom-left of tree view)
2. In Light mode, take a screenshot zoomed into the controls
3. **Verify**: Buttons have a semi-transparent white background with visible borders
4. Switch to Dark mode, take a screenshot
5. **Verify**: Buttons have a semi-transparent dark background, borders visible

### T14-9: ChatInput textarea adapts to theme

1. Click into the message textarea at the bottom
2. In Light mode, take a screenshot
3. **Verify**: Input has white background, warm-stone border, readable placeholder text
4. Switch to Dark mode, take a screenshot
5. **Verify**: Input has dark background, dark border, muted placeholder text

### T14-10: Settings dialog adapts to theme

1. Open Settings in Light mode, take a screenshot
2. **Verify**: Dialog has white card background, warm borders, readable labels
3. Close, switch to Dark mode via some other method (or re-open)
4. Open Settings in Dark mode, take a screenshot
5. **Verify**: Dialog has dark card background, dark borders, readable labels
6. **Verify**: Theme toggle buttons show the active theme highlighted with accent color
7. **Verify**: Inactive theme button has appropriate muted styling

### T14-11: Prose/markdown content in NodeDetailPanel

1. Select an assistant node with markdown content (code blocks, links)
2. In Light mode, take a screenshot of the detail panel
3. **Verify**: Code blocks have a secondary background, borders are visible
4. **Verify**: Links use accent color
5. Switch to Dark mode, take a screenshot
6. **Verify**: Code blocks have dark background, links still use accent color

### T14-12: Scrollbar adapts to theme

1. Load a conversation with enough nodes to cause scrolling in the sidebar or detail panel
2. Scroll to reveal the scrollbar in Light mode
3. **Verify**: Scrollbar thumb is a warm muted tone, not default browser gray
4. Switch to Dark mode, scroll again
5. **Verify**: Scrollbar thumb is a dark muted tone

### T14-13: Edge strokes adapt to theme

1. With a multi-node conversation loaded in the tree view
2. In Light mode, take a screenshot and zoom into an edge between nodes
3. **Verify**: Edge strokes are a warm muted tone (brownish-beige)
4. Switch to Dark mode, take a screenshot and zoom
5. **Verify**: Edge strokes are a darker muted tone, still visible against the dark background

### T14-14: No inline edge styles on nodes

1. Open browser console, run:
   ```js
   document.querySelectorAll('.react-flow__edge-path').forEach(el => console.log('EDGE_STYLE:', el.getAttribute('style')))
   ```
2. Read console messages filtered for `EDGE_STYLE`
3. **Verify**: No edge path elements have inline `stroke` or `stroke-width` styles (the CSS rule handles it)

---

## Fix 11 — MiniMap Dark Mode

### T11-1: MiniMap mask color in Light mode

1. Load a conversation with several nodes, ensure MiniMap is visible (bottom-right)
2. Set theme to Light
3. Take a screenshot, zoom into the MiniMap area
4. **Verify**: The MiniMap mask (the area outside the current viewport) is a translucent warm-white overlay — it blends with the light background

### T11-2: MiniMap mask color in Dark mode

1. Same conversation as above
2. Switch to Dark mode
3. Take a screenshot, zoom into the MiniMap area
4. **Verify**: The MiniMap mask is a translucent dark overlay — it blends with the dark background
5. **Verify**: The mask is NOT a light/white overlay (this was the original bug)

### T11-3: MiniMap theme toggle round-trip

1. Start in Light mode, zoom into MiniMap, take screenshot A
2. Switch to Dark mode, zoom into MiniMap, take screenshot B
3. Switch back to Light mode, zoom into MiniMap, take screenshot C
4. **Verify**: Screenshot A and C show the same light mask
5. **Verify**: Screenshot B shows a distinctly different dark mask

### T11-4: MiniMap node colors remain correct

1. With a conversation loaded, zoom into MiniMap in Light mode
2. **Verify**: User message nodes appear as orange dots, assistant nodes appear as muted brown/beige dots
3. Switch to Dark mode, repeat
4. **Verify**: Same node coloring (these are JS props, not affected by CSS variable refactor)

---

## Fix 6 — Selection/Reply Decoupling

### T6-1: Clicking a node selects it without changing reply target

1. Load a conversation with at least 3 nodes (root assistant, user, assistant-reply)
2. Read the current reply target shown in the ChatInput area ("Replying to: ...")
3. Click a different assistant node in the tree
4. **Verify**: The NodeDetailPanel opens/updates showing the clicked node's content
5. **Verify**: The "Replying to: ..." indicator in ChatInput has NOT changed — it still shows the previous reply target

### T6-2: Clicking a user node does not set reply target

1. With a conversation loaded, note the current reply target
2. Click a user message node in the tree
3. **Verify**: The node is selected (detail panel shows it)
4. **Verify**: Reply target indicator in ChatInput is unchanged

### T6-3: Clicking multiple nodes in sequence preserves reply target

1. Note the initial reply target
2. Click node A (assistant), then node B (user), then node C (assistant)
3. After each click, check the reply target indicator
4. **Verify**: Reply target remains unchanged through all three clicks

### T6-4: "Reply here" button updates the reply target

1. Click an assistant node to select it
2. In the NodeDetailPanel, click the "Reply here" button
3. **Verify**: The "Replying to: ..." indicator in ChatInput now shows the content of the node you clicked "Reply here" on
4. **Verify**: This is the ONLY way to change the reply target via UI interaction (besides sending a message)

### T6-5: "Reply here" button not shown for user nodes

1. Click a user message node to select it
2. Look at the NodeDetailPanel actions area
3. **Verify**: There is no "Reply here" button — only Copy and Delete are available

### T6-6: Sending a message auto-updates reply target to new response

1. Set a specific reply target using "Reply here" on some assistant node
2. Type a message in the ChatInput and send it
3. Wait for the assistant response to complete streaming
4. **Verify**: The reply target indicator now shows the beginning of the NEW assistant response
5. **Verify**: The reply target automatically updated to the latest response

### T6-7: Loading a conversation defaults reply target to root

1. Have two conversations in the sidebar
2. Click to load a different conversation
3. **Verify**: The reply target indicator shows the root node's content ("Hello! How can I help you today?" or similar)
4. **Verify**: No node is selected (detail panel is not shown)

### T6-8: Creating a new conversation sets reply target to root

1. Click the "+" button to create a new conversation
2. **Verify**: The reply target indicator shows the root assistant node's content
3. **Verify**: The root node is selected

### T6-9: Collapse/expand does not affect reply target

1. Set a specific reply target using "Reply here"
2. Click a node that has children to select it
3. Click the same node again to collapse it
4. Click again to expand
5. **Verify**: Reply target remains unchanged through collapse/expand cycles

### T6-10: Delete node updates reply target if deleted node was target

1. Set the reply target to a specific assistant node using "Reply here"
2. Select that same node, click the Delete button in the detail panel
3. **Verify**: The reply target falls back to the parent node (the store's deleteSubtree handles this)
4. **Verify**: The app does not crash or show "Replying to: undefined"

---

## Cross-cutting: Full Theme Round-trip Smoke Test

### TC-1: Complete visual smoke test

1. Create a new conversation
2. Send a message to generate a tree with user + assistant nodes
3. In Light mode, take a full-page screenshot (screenshot L1)
4. Click various nodes, hover sidebar items, open/close Settings
5. Switch to Dark mode
6. Take a full-page screenshot (screenshot D1)
7. Repeat the same interactions (click nodes, hover, open Settings)
8. Switch back to Light mode
9. Take a full-page screenshot (screenshot L2)
10. **Verify**: L1 and L2 are visually consistent
11. **Verify**: D1 shows a fully dark interface with no light-mode remnants
12. **Verify**: All interactive elements (buttons, inputs, nodes) responded correctly in both themes
