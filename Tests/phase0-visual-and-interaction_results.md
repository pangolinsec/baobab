# Phase 0 — Test Results

**Executed**: 2026-02-19
**Environment**: Baobab dev server via Docker (`localhost:5173`), Chrome MCP automation
**Starting state**: Dark mode, one existing conversation ("Hello, what is 2+2?") with a branching tree (root + 4 user branches + assistant replies including errors, deeper chain)

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| Fix 14 (CSS Variables) | 14 | 12 | 0 | 2 | T14-11, T14-12 skipped (no markdown content / insufficient scrollable content in test data) |
| Fix 11 (MiniMap Dark) | 4 | 4 | 0 | 0 | |
| Fix 6 (Selection/Reply) | 10 | 9 | 0 | 1 | T6-10 skipped (destructive — would delete test data) |
| Cross-cutting | 1 | 1 | 0 | 0 | |
| **Total** | **29** | **26** | **0** | **3** | |

---

## Fix 14 — CSS Variables Refactor

### T14-1: Light mode — surfaces use correct backgrounds
**Result: PASS**

**Actions**: Opened Settings, clicked Light theme button, saved, closed dialog. Took full screenshot.

**Observations**:
- Sidebar background is a slightly darker warm beige, visually distinct from the main tree area
- Tree canvas has the lightest background (warm off-white)
- All surfaces appear cohesive in a warm-stone palette with no jarring mismatches
- Node cards: assistant nodes have white backgrounds with subtle shadows, user nodes have a warmer pinkish tint

---

### T14-2: Dark mode — surfaces use correct backgrounds
**Result: PASS**

**Actions**: Opened Settings, clicked Dark theme button, saved, closed dialog. Took full screenshot.

**Observations**:
- Sidebar background is the darkest surface, matching the main bg in dark mode
- Tree canvas is dark (#1C1917 range)
- Card surfaces (nodes, settings dialog) are slightly lighter than the dark background
- No light-mode colors bleeding through — all surfaces are consistently dark
- User nodes have a distinct warmer-brown tint, assistant nodes have a slightly lighter dark surface

---

### T14-3: Theme toggle — all elements switch
**Result: PASS**

**Actions**: Started in light mode (screenshot L1), switched to dark (screenshot D1), switched back to light (screenshot L2). Compared visually.

**Observations**:
- L1 and L2 are visually identical — all elements return to their light mode appearance
- D1 shows complete dark mode with no elements stuck in light colors
- Theme transitions are immediate with no visual glitches

---

### T14-4: Borders and dividers adapt to theme
**Result: PASS**

**Actions**: Zoomed into sidebar border area in both light and dark modes.

**Observations**:
- Light mode: Sidebar/tree border is a subtle warm beige vertical line, header/content and footer/content borders visible as light dividers
- Dark mode: Same borders visible as darker dividers, not bright lines — they blend naturally with the dark surfaces

---

### T14-5: Text readability in both themes
**Result: PASS**

**Actions**: Examined conversation loaded state in both light and dark modes.

**Observations**:
- Light mode: All text (header "Baobab", conversation titles, node labels "You"/"Claude", node content, muted labels) is dark-on-light and fully legible
- Dark mode: All text is light-on-dark and fully legible. Muted text ("You", "Claude" labels, branch counts) uses a softer tone that's still readable

---

### T14-6: Accent color consistency
**Result: PASS**

**Actions**: Examined accent-colored elements in both themes: Send button, user icon circles, "Reply here" button, "Replying to:" icon, streaming dots.

**Observations**:
- All accent elements use the same warm orange (#D97757 range) in both light and dark modes
- Send button, user avatar circles, reply indicator icon, "Reply here" button all consistently use the accent color
- No accent color variation between themes

---

### T14-7: Hover states in sidebar
**Result: PASS**

**Actions**: Hovered over the selected conversation item in the sidebar in dark mode. Zoomed into the sidebar area.

**Observations**:
- Selected conversation item has a warm beige/dark background with readable text and a visible delete icon on hover
- The hover state is visually distinct but subtle
- Note: Only one conversation existed initially, so testing non-selected hover was limited. After creating a second conversation, both selected and non-selected states were visible and correctly styled

---

### T14-8: Zoom controls adapt to theme
**Result: PASS**

**Actions**: Zoomed into the zoom controls (bottom-left of tree view) in both light and dark modes.

**Observations**:
- Light mode: Buttons have semi-transparent white/light backgrounds with visible warm-beige borders and muted icon color
- Dark mode: Buttons have semi-transparent dark backgrounds with visible dark borders and muted icon color
- Both modes show proper backdrop blur effect

---

### T14-9: ChatInput textarea adapts to theme
**Result: PASS**

**Actions**: Zoomed into the ChatInput area in both light and dark modes.

**Observations**:
- Light mode: Input has white background, warm-stone border, readable muted placeholder "Send a message...", orange accent send button
- Dark mode: Input has dark background, dark border, muted placeholder text, orange accent send button
- Reply target indicator properly styled in both modes with secondary background and muted text

---

### T14-10: Settings dialog adapts to theme
**Result: PASS**

**Actions**: Opened Settings dialog in both dark mode and light mode, took screenshots of each.

**Observations**:
- Dark mode: Dialog has dark card background (#2A2520 range), dark borders, light readable text, "Dark" button highlighted with accent orange, "Light" button muted, Save button accent orange
- Light mode: Dialog has white card background, warm borders, dark readable text, "Light" button highlighted with accent orange, "Dark" button muted with beige background
- Labels ("Anthropic API Key", "Default Model", "Theme") are readable secondary text in both modes
- Validation indicators (green checkmark, emerald text) correctly visible in both modes
- Inactive theme button uses appropriate muted styling with correct background/text variables

---

### T14-11: Prose/markdown content in NodeDetailPanel
**Result: SKIPPED**

**Reason**: No assistant nodes in the test data contained markdown with code blocks or links. The conversation data had plain text and error messages only. The prose CSS rules were verified correct in `index.css` (using `var(--color-bg-secondary)` and `var(--color-border)` and `var(--color-accent)`), but visual rendering could not be confirmed with available test data.

---

### T14-12: Scrollbar adapts to theme
**Result: SKIPPED**

**Reason**: Neither the sidebar nor the detail panel had enough content to trigger visible scrollbars during testing. The CSS rules were verified correct in `index.css` (using `var(--color-scrollbar)` with no `.dark` override needed), but visual rendering could not be confirmed.

---

### T14-13: Edge strokes adapt to theme
**Result: PASS**

**Actions**: Zoomed into edge connections between nodes in both light and dark modes.

**Observations**:
- Light mode: Edge strokes are warm beige/brown, visible against the light background
- Dark mode: Edge strokes are a darker muted brown, still visible against the dark background
- CSS rule uses `var(--color-edge)` which switches correctly between themes

---

### T14-14: No inline edge styles on nodes
**Result: PASS**

**Actions**: Executed JavaScript to query all `.react-flow__edge-path` elements and check for inline `style` attributes.

**Observations**:
- 10 edge elements found in the DOM
- All 10 returned `style: "none"` — zero inline stroke or strokeWidth styles
- Edge styling is entirely handled by the CSS rule `.react-flow__edge-path { stroke: var(--color-edge) }`

---

## Fix 11 — MiniMap Dark Mode

### T11-1: MiniMap mask color in Light mode
**Result: PASS**

**Actions**: Loaded conversation, set light mode, zoomed into the MiniMap area (bottom-right).

**Observations**:
- MiniMap background uses secondary color (slightly darker warm beige)
- The mask (area outside current viewport) is a translucent warm-white overlay
- Blends naturally with the light background — no visual clash

---

### T11-2: MiniMap mask color in Dark mode
**Result: PASS**

**Actions**: Switched to dark mode, zoomed into the MiniMap area.

**Observations**:
- MiniMap background uses dark secondary color
- The mask is a translucent dark overlay that blends with the dark background
- The mask is NOT a light/white overlay — the original bug (Fix 11) is confirmed fixed
- Viewport area within the minimap is visually distinct from the masked area

---

### T11-3: MiniMap theme toggle round-trip
**Result: PASS**

**Actions**: Toggled Light -> Dark -> Light, zooming into MiniMap each time.

**Observations**:
- Light mode mask: translucent warm-white
- Dark mode mask: translucent dark — distinctly different from light
- Return to light mode: mask returns to translucent warm-white, matching original
- The theme-conditional `maskColor` prop switches correctly

---

### T11-4: MiniMap node colors remain correct
**Result: PASS**

**Actions**: Examined MiniMap node dots in both light and dark modes.

**Observations**:
- User message nodes appear as orange/red dots (accent color #D97757)
- Assistant message nodes appear as muted brown/beige dots (#C4B5A6)
- Colors remain consistent across theme switches (these are JS props, not CSS variable-driven)

---

## Fix 6 — Selection/Reply Decoupling

### T6-1: Clicking a node selects it without changing reply target
**Result: PASS**

**Actions**: With conversation loaded (reply target = root "Hello! How can I help you today?"), clicked the "2 + 2 = 4" assistant node.

**Observations**:
- NodeDetailPanel opened on the right showing "Claude" header and "2 + 2 = 4" content
- The clicked node displayed an orange selection ring
- Reply target indicator in ChatInput remained "Replying to: Hello! How can I help you today?" — UNCHANGED
- Selection and reply target are fully decoupled

---

### T6-2: Clicking a user node does not set reply target
**Result: PASS**

**Actions**: Clicked the "Hello, what is 2+2?" user message node.

**Observations**:
- Node selected — detail panel shows "You" with content "Hello, what is 2+2?"
- Reply target indicator unchanged — still "Replying to: Hello! How can I help you today?"

---

### T6-3: Clicking multiple nodes in sequence preserves reply target
**Result: PASS**

**Actions**: Clicked three nodes in sequence: (1) "Tell me about DnD Classes" user node, (2) Error 404 assistant node, (3) "3 + 3 = 6" assistant node. Checked reply target after each click.

**Observations**:
- After each click, the detail panel updated to show the newly selected node
- After all three clicks, reply target remained "Replying to: Hello! How can I help you today?" — unchanged throughout

---

### T6-4: "Reply here" button updates the reply target
**Result: PASS**

**Actions**: With the Error 404 assistant node selected, clicked the "Reply here" button in the NodeDetailPanel.

**Observations**:
- Reply target indicator changed from "Replying to: Hello! How can I help you today?" to "Replying to: Error: 404 {\"type\":\"error\"..."
- The "Reply here" button correctly updates the reply target
- This confirms it is the only UI mechanism (besides sending a message) to change the reply target

---

### T6-5: "Reply here" button not shown for user nodes
**Result: PASS**

**Actions**: Clicked a user message node ("Hello, what is 2+2?") and examined the NodeDetailPanel actions.

**Observations**:
- Only "Copy" and "Delete" buttons visible in the action bar
- No "Reply here" button present — correct, since replying to a user message doesn't make sense

---

### T6-6: Sending a message auto-updates reply target to new response
**Result: PASS**

**Actions**: On the "New Conversation" (reply target was root), typed "Say hi" in the textarea, clicked Send, waited 8 seconds for response.

**Observations**:
- Message sent successfully, tree updated with user node "Say hi" and assistant response "Hi there! How are you doing today?"
- Reply target auto-updated to "Replying to: Hi there! How are you doing today?" — the new assistant response
- Conversation title auto-renamed to "Say hi" in the sidebar

---

### T6-7: Loading a conversation defaults reply target to root
**Result: PASS**

**Actions**: From the "Say hi" conversation, clicked "Hello, what is 2+2?" in the sidebar to load a different conversation.

**Observations**:
- Tree loaded with the full branching structure
- Reply target shows "Replying to: Hello! How can I help you today?" — defaulted to root node
- No node is selected (no detail panel visible, no orange ring on any node)

---

### T6-8: Creating a new conversation sets reply target to root
**Result: PASS**

**Actions**: Clicked the "+" button in the sidebar header to create a new conversation.

**Observations**:
- New conversation "New Conversation" created and loaded
- Only the root node "Hello! How can I help you today?" is visible in the tree, selected with orange ring
- Detail panel shows the root node content
- Reply target shows "Replying to: Hello! How can I help you today?" — correctly set to root

---

### T6-9: Collapse/expand does not affect reply target
**Result: PASS**

**Actions**: Set reply target to the Error 404 node via "Reply here". Then clicked root node to select it, clicked again to collapse (tree collapsed to just root with "4 >" indicator), clicked again to expand.

**Observations**:
- Before collapse: Reply target = "Replying to: Error: 404..."
- After collapse: Reply target = "Replying to: Error: 404..." — unchanged
- After expand: Reply target = "Replying to: Error: 404..." — unchanged
- Collapse/expand cycles have no effect on the reply target

---

### T6-10: Delete node updates reply target if deleted node was target
**Result: SKIPPED**

**Reason**: This test is destructive — it would permanently delete nodes from the test conversation data. The store code (`deleteSubtree`) handles this case by falling back `replyTargetNodeId` to the parent node when the target is in the deleted subtree. Code inspection confirms the logic is correct at `useTreeStore.ts:263-264`, but the visual test was not executed to preserve test data.

---

## Cross-cutting: Full Theme Round-trip Smoke Test

### TC-1: Complete visual smoke test
**Result: PASS**

**Actions**: Created new conversation, sent message "Say hi" to generate user + assistant nodes. In light mode took full screenshot (L1). Clicked nodes, opened/closed Settings. Switched to dark mode, took screenshot (D1). Repeated interactions. Switched back to light, took screenshot (L2).

**Observations**:
- L1 and L2 are visually consistent — same light surfaces, borders, text, accent colors
- D1 shows fully dark interface: dark backgrounds, light text, dark borders, dark node cards, dark input areas — no light-mode remnants anywhere
- All interactive elements responded correctly in both themes:
  - Node clicks: selected node shows orange ring, detail panel opens
  - Settings dialog: opens/closes correctly, theme buttons highlight correctly
  - Send message: works, tree updates, reply target updates
  - Conversation switching: loads correctly with proper defaults
- Theme variable system works end-to-end with zero visual regressions observed
