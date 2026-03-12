# Batch 2 — Test Results

**Executed**: 2026-02-19 (initial), 2026-02-19 (rerun of skipped tests with refreshed API credits)
**Environment**: Baobab dev server via Docker (`localhost:5173`), Chrome MCP automation
**Starting state**: Dark mode, three conversations ("What model are you? R...", "Say hi", "Hello, what is 2+2?"). The "Hello, what is 2+2?" conversation has a branching tree (root + 5 user branches + assistant replies including error nodes and a deeper chain). API key configured; initial run had insufficient credits, rerun had credits refreshed.

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| Dexie V2 Migration | 2 | 2 | 0 | 0 | |
| Feature 04 (Advanced API Config) | 12 | 12 | 0 | 0 | T04-10, T04-11 passed on rerun with Sonnet 4 + thinking enabled |
| Feature 23 (Resend/Duplicate/Retry) | 25 | 25 | 0 | 0 | T23-5, T23-6, T23-14, T23-15, T23-18, T23-19 passed on rerun; T23-22 tested on an edited node to preserve test data |
| Cross-cutting (Context Menu) | 4 | 4 | 0 | 0 | |
| Integration Smoke Tests | 3 | 3 | 0 | 0 | All passed on rerun |
| **Total** | **46** | **46** | **0** | **0** | |

---

## Dexie V2 Migration

### TV2-1: Existing conversations load after migration
**Result: PASS**

**Actions**: Navigated to app root, clicked "Hello, what is 2+2?" conversation. Checked console for errors.

**Observations**:
- Conversation loaded successfully with full branching tree structure (root + 5 user branches + assistant replies)
- No console errors related to Dexie or IndexedDB migration
- All nodes rendered correctly in the tree view

---

### TV2-2: New nodes have V2 fields
**Result: PASS**

**Actions**: Queried IndexedDB directly via JavaScript. Found database "baobab" (version 20). Retrieved a recently created node and inspected its fields.

**Observations**:
- New nodes contain all V2 fields: `nodeType` ("assistant"), `userModified` (false), `starred` (false), `deadEnd` (false)
- Fields are silently present with correct default values
- No errors during node creation or retrieval

---

## Feature 04 — Advanced API Config

### T04-1: Advanced tab exists in Settings
**Result: PASS**

**Actions**: Opened Settings dialog. Observed sidebar with tabs. Clicked "Advanced" tab.

**Observations**:
- Settings dialog has three tabs: "General", "Advanced", and "Prompts"
- Advanced tab loads showing: Extended Thinking toggle, Temperature slider, Max Output Tokens slider, Top P input, Top K input

---

### T04-2: Extended Thinking toggle
**Result: PASS**

**Actions**: Navigated to Advanced settings. Observed default state. Toggled Extended Thinking ON.

**Observations**:
- Extended Thinking toggle is OFF by default
- "Thinking Budget" slider is NOT visible when thinking is OFF
- After toggling ON: toggle shows accent color, Thinking Budget slider appears
- Temperature slider shows "Forced to 1.0 when thinking is enabled" note and is visually disabled (grayed out)
- Top P and Top K inputs are visually disabled with reduced opacity

---

### T04-3: Thinking Budget slider
**Result: PASS**

**Actions**: With thinking enabled, examined the Thinking Budget slider. Dragged to the right.

**Observations**:
- Default value shows "10,000 tokens"
- Range labels show "1,000" on left and "100,000" on right
- Dragging right increased value to ~49,000 tokens (step of 1,000)

---

### T04-4: Temperature slider
**Result: PASS**

**Actions**: With thinking disabled, examined Temperature slider. Dragged left. Then enabled thinking and verified force behavior.

**Observations**:
- Default value shows "1.00"
- Range labels show "0.0" on left and "1.0" on right
- Dragged to approximately 0.50 (steps of 0.05)
- After enabling Extended Thinking: temperature forced to "1.00" and slider became disabled

---

### T04-5: Max Output Tokens slider
**Result: PASS**

**Actions**: Examined Max Output Tokens slider. Dragged toward the right.

**Observations**:
- Default value shows "8,192"
- Range labels show "256" on left and "128,000" on right
- Dragged to approximately 46,848 (steps of 256)

---

### T04-6: Top P input
**Result: PASS**

**Actions**: Examined Top P input field. Typed valid and invalid values.

**Observations**:
- Placeholder text shows "Leave blank to omit"
- Typing "0.9" and blurring: value persists as "0.9"
- Typing "1.5" and blurring: invalid value rejected, field reverts (Top P must be 0.0–1.0)

---

### T04-7: Top K input
**Result: PASS**

**Actions**: Examined Top K input field. Typed valid and invalid values.

**Observations**:
- Placeholder text shows "Leave blank to omit"
- Typing "40" and blurring: value persists as "40"
- Typing "-5" and blurring: invalid value rejected, field reverts (Top K must be positive)

---

### T04-8: Advanced settings persist across page navigation
**Result: PASS**

**Actions**: Set temperature to 0.50, max tokens to a modified value. Closed Settings, reopened to Advanced tab.

**Observations**:
- Temperature still shows "0.50" after round-trip
- Max Output Tokens still shows the previously set value (~46,848)
- Settings persisted correctly through Zustand/IndexedDB

---

### T04-9: Thinking toggle forces temperature to 1.0
**Result: PASS**

**Actions**: Set temperature to 0.50. Enabled Extended Thinking. Observed temperature. Disabled thinking. Checked temperature again.

**Observations**:
- Temperature snapped to "1.00" when thinking enabled
- Temperature slider became disabled
- After disabling thinking: slider became enabled again
- Temperature remained at 1.00 (did not revert to 0.50) — correct behavior

---

### T04-10: Thinking content displayed in NodeDetailPanel
**Result: PASS**

**Actions**: Enabled Extended Thinking via IndexedDB settings. Set model to Claude Sonnet 4 via the chat model dropdown. Sent message "What is 10 plus 20?" and waited for response. Clicked the assistant response node to open detail panel.

**Observations**:
- Detail panel header shows "Claude Sonnet 4.20250514"
- Collapsible "Thinking" section visible with Brain icon and "59 chars" badge
- Clicking the section header expanded it, revealing thinking content: *"This is a simple arithmetic question. 10 plus 20 equals 30."*
- Thinking content displayed with accent left border and italic/muted styling
- Response content below: "10 plus 20 equals 30."
- Clicking again collapsed the thinking section — content hidden

---

### T04-11: Thinking indicator on MessageNode
**Result: PASS**

**Actions**: With the Sonnet 4 thinking response node in the tree, inspected its DOM via JavaScript.

**Observations**:
- A `lucide-brain` SVG icon present in the node header area
- Icon uses `text-[var(--color-accent)]` class — accent color styling confirmed
- Icon is positioned in the node header alongside the "Claude" label
- Non-thinking nodes do NOT have this brain icon

---

### T04-12: Settings defaults merge fix — new settings survive reload
**Result: PASS**

**Actions**: Ran `localStorage.clear()` in console, reloaded the page. Navigated to Advanced settings.

**Observations**:
- All advanced settings show default values: thinking OFF, temperature 1.00, max tokens 8,192
- Top P and Top K fields are blank (not "undefined" or "NaN")
- No corrupted or missing values after localStorage clear

---

## Feature 23 — Resend / Duplicate & Edit / Retry

### T23-1: Context menu shows correct items for assistant nodes
**Result: PASS**

**Actions**: Right-clicked a non-error assistant node ("2 + 2 = 4"). Took screenshot of context menu.

**Observations**:
- Menu contains: "Reply here", "Duplicate & Edit", "Copy", "Delete"
- "Resend" is NOT shown (correct — that's user-only)
- "Delete" text appears in red
- Each item has an appropriate icon

---

### T23-2: Context menu shows correct items for user nodes
**Result: PASS**

**Actions**: Right-clicked the "Hello, what is 2+2?" user node. Took screenshot of context menu.

**Observations**:
- Menu contains: "Resend", "Duplicate & Edit", "Copy", "Delete"
- "Reply here" is NOT shown (correct — that's assistant-only)
- "Delete" text appears in red

---

### T23-3: Context menu shows correct items for root node
**Result: PASS**

**Actions**: Right-clicked the root node ("Hello! How can I help you today?"). Took screenshot of context menu.

**Observations**:
- Menu contains: "Reply here" and "Copy" only
- "Delete" is NOT shown (correct — root nodes cannot be deleted)
- "Duplicate & Edit" is NOT shown (correct — root nodes cannot be duplicated)

---

### T23-4: Context menu shows correct items for error nodes
**Result: PASS**

**Actions**: Right-clicked an error node (Error 404 not_found_error). Took screenshot of context menu.

**Observations**:
- Menu contains: "Retry", "Copy error", "Delete"
- "Reply here", "Resend", and "Duplicate & Edit" are NOT shown
- "Delete" text appears in red

---

### T23-5: Resend creates a new sibling assistant node
**Result: PASS**

**Actions**: Right-clicked user node "Now what is 3+3?" and selected "Resend". Waited for API response.

**Observations**:
- New sibling assistant node created (node count 14 → 15)
- The user node now shows branch indicator "2 >" (two children)
- New response appeared alongside the original "3 + 3 = 6" response
- Reply target auto-updated to "Replying to: 3 + 3 = 6" (the new response)

---

### T23-6: Resend via NodeDetailPanel button
**Result: PASS**

**Actions**: Clicked user node "Now what is 3+3?" to open detail panel. Clicked the "Resend" button (orange accent with Send icon) in the action bar.

**Observations**:
- New sibling assistant node created (node count 15 → 16)
- Third response branch created under the same user node
- Reply target updated to the newest response
- Resend via NodeDetailPanel behaves identically to context menu Resend

---

### T23-7: Duplicate & Edit user message (prefills ChatInput)
**Result: PASS**

**Actions**: Right-clicked user node "Hello, what is 2+2?" and selected "Duplicate & Edit".

**Observations**:
- ChatInput textarea prefilled with "Hello, what is 2+2?"
- Reply target indicator changed to "Replying to: Hello! How can I help you today?" (the parent root node)
- Textarea was focused and ready for editing

---

### T23-8: Duplicate & Edit user message via NodeDetailPanel button
**Result: PASS**

**Actions**: Clicked user node "Hello, what is 2+2?" to open detail panel. Clicked "Duplicate & Edit" button in the action bar.

**Observations**:
- "Duplicate & Edit" button with CopyPlus icon visible in action bar
- ChatInput prefilled with "Hello, what is 2+2?"
- Reply target changed to parent node (root)

---

### T23-9: Duplicate & Edit assistant message (opens modal)
**Result: PASS**

**Actions**: Right-clicked assistant node "2 + 2 = 4" and selected "Duplicate & Edit".

**Observations**:
- Modal overlay appeared with title "Duplicate & Edit"
- Textarea pre-filled with "2 + 2 = 4"
- Cancel and Save buttons visible at the bottom
- Save button uses accent color styling

---

### T23-10: Duplicate & Edit modal — cancel
**Result: PASS**

**Actions**: Opened Duplicate & Edit modal for "2 + 2 = 4" assistant node. Modified text to "Modified text that should not be saved". Clicked Cancel.

**Observations**:
- Modal closed immediately
- Node count unchanged (13 → 13) — no new node created
- Tree structure identical to before opening the modal

---

### T23-11: Duplicate & Edit modal — save creates sibling with edited badge
**Result: PASS**

**Actions**: Opened Duplicate & Edit modal for "2 + 2 = 4" assistant node. Changed text to "The answer is four (4)". Clicked Save.

**Observations**:
- Modal closed
- New node created (node count 13 → 14), appearing as a sibling of the original "2 + 2 = 4"
- Tree node shows "edited" badge in the header (confirmed via DOM: `ClaudeHaiku 3.5editedThe answer is four (4)`)
- Detail panel header shows "Claude Haiku 3.5 (edited)" with pencil icon
- Info banner reads "This message was edited by you"
- Content matches "The answer is four (4)"

---

### T23-12: Duplicate & Edit modal — Escape closes
**Result: PASS**

**Actions**: Opened Duplicate & Edit modal for an assistant node. Pressed Escape.

**Observations**:
- Modal closed without creating a new node
- Node count unchanged (14 → 14)

---

### T23-13: Duplicate & Edit modal — Ctrl+Enter saves
**Result: PASS**

**Actions**: Opened Duplicate & Edit modal for "2 + 2 = 4". Modified text to "Ctrl+Enter save test". Pressed Ctrl+Enter.

**Observations**:
- Modal closed
- New node created (node count 14 → 15)
- Ctrl+Enter keyboard shortcut correctly triggers Save

---

### T23-14: Retry error node
**Result: PASS**

**Actions**: Right-clicked an error node (Error 404 not_found_error for "test" branch). Selected "Retry" from context menu. Waited for API response.

**Observations**:
- Error node replaced with a successful assistant response
- Node count unchanged (16 → 16) — Retry replaces the error node in-place rather than creating a new sibling
- New response content: "It seems like you sent a test message. Is there something specific I can help you with today?"
- Reply target updated to the new successful response
- Red border removed — node now renders as a normal assistant node

---

### T23-15: Retry via NodeDetailPanel button
**Result: PASS**

**Actions**: Clicked error node (Error 400 "credit balance too low") to open detail panel. Detail panel showed error content with "Retry" button (orange accent with RefreshCw icon), "Copy error", and "Delete" buttons. Clicked "Retry" button.

**Observations**:
- Error node replaced with a successful response ("PONG")
- Detail panel updated to show the parent user node ("Say just the word PONG")
- Reply target updated to "Replying to: PONG"
- Retry via NodeDetailPanel behaves identically to context menu Retry

---

### T23-16: Error node has red border
**Result: PASS**

**Actions**: Zoomed into error nodes in the tree view. Compared with non-error nodes.

**Observations**:
- Error nodes (Error 404, Error 400) have visible red borders
- Non-error nodes (assistant "2 + 2 = 4", user nodes) do NOT have red borders
- Red border is clearly distinct and serves as a visual indicator of error state

---

### T23-17: Error node cannot be set as reply target
**Result: PASS**

**Actions**: Right-clicked error node. Examined context menu.

**Observations**:
- Error node context menu shows: "Retry", "Copy error", "Delete"
- "Reply here" is NOT present in the menu
- No mechanism exists to set an error node as reply target

---

### T23-18: Resend button disabled during streaming
**Result: PASS**

**Actions**: Set up a 100ms interval to capture button states during streaming. Triggered Resend on user node "Hello, what is 2+2?" and clicked the node to open detail panel. Analyzed captured states after streaming completed.

**Observations**:
- 186 state captures total; 65 captured during streaming showed disabled state
- During streaming: "Resend" button had `hasDisabledClass: true` (CSS class-based disabling)
- After streaming completed: "Resend" button returned to fully enabled (opacity: 1, pointerEvents: auto)
- Disabled state prevents double-Resend during active streaming

---

### T23-19: Duplicate & Edit button disabled during streaming
**Result: PASS**

**Actions**: Same interval-based capture as T23-18. Analyzed "Duplicate & Edit" button state during streaming.

**Observations**:
- During streaming: "Duplicate & Edit" button had `hasDisabledClass: true` (CSS class-based disabling)
- After streaming completed: button returned to fully enabled (opacity: 1, pointerEvents: auto)
- Other buttons (Copy, Dead end, Delete) were NOT disabled during streaming — only action buttons that trigger API calls were disabled

---

### T23-20: Copy from context menu
**Result: PASS**

**Actions**: Right-clicked assistant node "2 + 2 = 4". Selected "Copy". Pasted into ChatInput textarea via Ctrl+V.

**Observations**:
- Clipboard contained "2 + 2 = 4" — confirmed by pasting into the textarea
- Copy function correctly writes node content to system clipboard

---

### T23-21: Copy error from context menu
**Result: PASS**

**Actions**: Right-clicked error node (Error 404). Selected "Copy error" via ref click. Pasted into ChatInput textarea.

**Observations**:
- Clipboard contained the full error message: `Error: 404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-haiku-4-5-20241022"},"request_id":"req_011CYH8dV5Qk6zAN6K1hswZj"}`
- "Copy error" correctly copies the full error content including the "Error: " prefix

---

### T23-22: Delete from context menu
**Result: PASS**

**Actions**: Right-clicked the "Ctrl+Enter save test" edited node (created during T23-13). Selected "Delete".

**Observations**:
- Node removed from tree (node count 15 → 14)
- Tree re-rendered correctly without the deleted node
- Used a test-created node to avoid destroying original test data

---

### T23-23: NodeDetailPanel user node actions
**Result: PASS**

**Actions**: Clicked user node "Hello, what is 2+2?" to open detail panel. Examined action buttons.

**Observations**:
- Header shows "You"
- Buttons present: "Resend" (primary accent with Send icon), "Duplicate & Edit" (with CopyPlus icon), "Copy" (with Copy icon), "Delete" (red, far right, with Trash2 icon)
- Layout matches expected order: primary action on left, destructive action on far right

---

### T23-24: NodeDetailPanel assistant node actions
**Result: PASS**

**Actions**: Clicked assistant node "2 + 2 = 4" to open detail panel. Examined action buttons.

**Observations**:
- Header shows "Claude Haiku 3.5"
- Buttons present: "Reply here" (primary accent), "Duplicate & Edit", "Copy", "Delete" (red, far right)
- Layout matches expected order

---

### T23-25: Duplicate & Edit button in NodeDetailPanel opens modal for assistant
**Result: PASS**

**Actions**: With assistant node "2 + 2 = 4" selected in detail panel, clicked "Duplicate & Edit" button.

**Observations**:
- Duplicate & Edit modal opened
- Textarea pre-filled with "2 + 2 = 4"
- Title shows "Duplicate & Edit", Cancel and Save buttons visible
- Same modal as opened via context menu

---

## Cross-cutting: Context Menu Icons & Styling

### TC-1: Context menu has correct icons
**Result: PASS**

**Actions**: Right-clicked user, assistant, and error nodes. Zoomed into each context menu to inspect icons.

**Observations**:
- "Resend" — Send icon (paper airplane arrow)
- "Reply here" — corner-down-right arrow icon
- "Retry" — RefreshCw icon (circular arrows)
- "Duplicate & Edit" — CopyPlus icon
- "Copy" — Copy icon (two overlapping squares)
- "Copy error" — ClipboardCopy icon
- "Delete" — Trash2 icon in red
- All icons are appropriately sized and colored (muted for normal items, red for delete)

---

### TC-2: Context menu separator lines
**Result: PASS**

**Actions**: Examined context menus across different node types.

**Observations**:
- Thin separator lines visible dividing action groups (actions | copy | delete)
- Separators match the border color of the menu card (subtle dark lines in dark mode)

---

### TC-3: Context menu positioning
**Result: PASS**

**Actions**: Right-clicked error node positioned toward the right side of the viewport.

**Observations**:
- Context menu repositioned to the left of the click point to avoid overflowing outside the viewport
- All menu items fully visible and clickable
- Menu stays within viewport bounds

---

### TC-4: Context menu dismiss behaviors
**Result: PASS**

**Actions**: Tested all three dismiss methods:
1. Opened context menu, pressed Escape → menu closed
2. Opened context menu, clicked elsewhere on canvas → menu closed
3. Opened context menu, scrolled the tree view → menu closed

**Observations**:
- All three dismiss methods work correctly
- Menu cleanup is immediate — no residual menu elements in the DOM after dismissal

---

## Full Integration Smoke Tests

### TI-1: Complete resend + duplicate workflow
**Result: PASS**

**Actions**: Executed Resend on user node "Now what is 3+3?" (T23-5), creating a new sibling response. Then executed Resend via NodeDetailPanel (T23-6), creating a third sibling. Verified Duplicate & Edit on assistant node creates an edited sibling (T23-11). The complete workflow — Resend to generate alternatives, Duplicate & Edit to manually modify — works end-to-end.

**Observations**:
- Resend created new sibling assistant nodes (14 → 15 → 16)
- User node branch indicator updated correctly ("2 >" then "3 >")
- Reply target auto-updated to the newest response after each Resend
- Duplicate & Edit creates separate edited siblings with "edited" badge
- All operations are non-destructive — original nodes preserved

---

### TI-2: Error → Retry → Success workflow
**Result: PASS**

**Actions**: Retried Error 404 node via context menu (T23-14) — error replaced with successful response. Retried Error 400 "credit balance" node via NodeDetailPanel button (T23-15) — error replaced with "PONG" response.

**Observations**:
- Error nodes with red borders replaced in-place with successful assistant responses
- Red border removed after successful retry
- Reply target updated to the new successful response
- Node count unchanged — Retry replaces rather than creates
- Both context menu and NodeDetailPanel Retry paths work correctly

---

### TI-3: Advanced settings affect API calls
**Result: PASS**

**Actions**: Set max_tokens to 256 and temperature to 0 via IndexedDB. Reloaded page. Sent message "Write a very long essay about the history of mathematics, at least 2000 words". Examined the response.

**Observations**:
- Response was clearly truncated — started the essay but cut off mid-sentence after approximately 150 words
- With max_tokens=8192 (default), similar requests produce much longer responses
- The max_tokens=256 setting was respected by the API call, confirming advanced settings propagate correctly
- Also confirmed Extended Thinking settings affect API calls (T04-10): Sonnet 4 with thinking enabled produced a response with thinking content
