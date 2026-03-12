# Batch 2 — Browser-Based Test Plan

Tests for Feature 04 (Advanced API Config), Feature 23 (Resend/Duplicate/Retry), and Dexie V2 Migration. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (needed for streaming/API tests)
5. At least one conversation exists with multiple nodes (user + assistant messages)

---

## Dexie V2 Migration

### TV2-1: Existing conversations load after migration

1. Ensure you had at least one conversation created before this batch was deployed
2. Navigate to the app root, click on an existing conversation
3. Take a screenshot
4. **Verify**: The conversation loads without errors — all nodes render in the tree view
5. **Verify**: No console errors related to Dexie or IndexedDB migration

### TV2-2: New nodes have V2 fields

1. Open browser console
2. Send a new message in any conversation
3. After the response completes, run in console:
   ```js
   const db = await indexedDB.databases();
   ```
4. Or inspect the latest node via the detail panel
5. **Verify**: No errors occur during message sending — the new fields (nodeType, userModified, starred, deadEnd) are silently present

---

## Feature 04 — Advanced API Config

### T04-1: Advanced tab exists in Settings

1. Navigate to `/settings`
2. Take a screenshot
3. **Verify**: A sidebar with "General" and "Advanced" tabs is visible on the left
4. Click the "Advanced" tab
5. Take a screenshot
6. **Verify**: The Advanced section loads showing: Extended Thinking toggle, Temperature slider, Max Output Tokens slider, Top P input, Top K input

### T04-2: Extended Thinking toggle

1. Navigate to `/settings/advanced`
2. Take a screenshot
3. **Verify**: Extended Thinking toggle is OFF by default
4. **Verify**: The "Thinking Budget" slider is NOT visible when thinking is OFF
5. Click the toggle to enable thinking
6. Take a screenshot
7. **Verify**: Toggle is now ON (accent-colored)
8. **Verify**: The "Thinking Budget" slider appears below the toggle
9. **Verify**: Temperature slider shows a note "Disabled when thinking is enabled" and is visually disabled (grayed out)
10. **Verify**: Top P and Top K inputs are visually disabled

### T04-3: Thinking Budget slider

1. With thinking enabled in `/settings/advanced`
2. Locate the Thinking Budget slider
3. **Verify**: Default value shows "10,000 tokens"
4. Drag the slider to the right
5. **Verify**: The displayed value increases (step of 1,000)
6. **Verify**: Range labels show "1,000" on the left and "100,000" on the right

### T04-4: Temperature slider

1. Navigate to `/settings/advanced` with thinking disabled
2. Locate the Temperature slider
3. **Verify**: Default value shows "1.00"
4. Drag slider to the left
5. **Verify**: Value decreases in steps of 0.05
6. **Verify**: Range labels show "0.0" on the left and "1.0" on the right
7. Enable Extended Thinking
8. **Verify**: Temperature is forced to 1.00 and the slider becomes disabled

### T04-5: Max Output Tokens slider

1. Navigate to `/settings/advanced`
2. Locate the Max Output Tokens slider
3. **Verify**: Default value shows "8,192"
4. Drag slider toward the right
5. **Verify**: Value increases in steps of 256
6. **Verify**: Range labels show "256" on the left and "128,000" on the right

### T04-6: Top P input

1. Navigate to `/settings/advanced`
2. Locate the Top P input field
3. **Verify**: Placeholder text says "Leave blank to omit"
4. Type "0.9" and click away (blur)
5. **Verify**: Value persists as "0.9"
6. Clear the field and blur
7. **Verify**: Field is blank (null value, omitted from API)
8. Type "1.5" and blur
9. **Verify**: Invalid value is rejected, field reverts to previous valid value or blank

### T04-7: Top K input

1. Navigate to `/settings/advanced`
2. Locate the Top K input field
3. **Verify**: Placeholder text says "Leave blank to omit"
4. Type "40" and blur
5. **Verify**: Value persists as "40"
6. Clear the field and blur
7. **Verify**: Field is blank (null value, omitted from API)
8. Type "-5" and blur
9. **Verify**: Invalid value is rejected, field reverts

### T04-8: Advanced settings persist across page navigation

1. Navigate to `/settings/advanced`
2. Set temperature to 0.50, max tokens to 16384
3. Navigate away (click back arrow or go to a conversation)
4. Navigate back to `/settings/advanced`
5. **Verify**: Temperature still shows "0.50"
6. **Verify**: Max Output Tokens still shows "16,384"

### T04-9: Thinking toggle forces temperature to 1.0

1. Navigate to `/settings/advanced`
2. Set temperature to 0.50
3. Enable Extended Thinking
4. **Verify**: Temperature value snaps to "1.00"
5. **Verify**: Temperature slider is disabled
6. Disable Extended Thinking
7. **Verify**: Temperature slider becomes enabled again
8. **Verify**: Temperature value remains at 1.00 (does not revert to 0.50)

### T04-10: Thinking content displayed in NodeDetailPanel

1. Navigate to `/settings/advanced`, enable Extended Thinking
2. Ensure a model that supports thinking is selected (e.g., claude-sonnet-4-6-20250514)
3. Go to a conversation, send a message
4. Wait for the response to complete
5. Click the assistant response node to open the detail panel
6. Take a screenshot
7. **Verify**: If the model returned thinking content, a collapsible "Thinking" section appears above the main content
8. **Verify**: The thinking section shows a Brain icon, "Thinking" label, and a character count badge
9. Click the thinking section header to expand it
10. Take a screenshot
11. **Verify**: Thinking content is displayed with an accent left border, italic/muted styling
12. Click again to collapse
13. **Verify**: Thinking content is hidden

### T04-11: Thinking indicator on MessageNode

1. With a conversation that has an assistant node with thinking content
2. Look at the assistant node in the tree view
3. Take a screenshot
4. **Verify**: A small Brain icon appears in the node header next to "Claude"
5. **Verify**: The Brain icon has accent color styling

### T04-12: Settings defaults merge fix — new settings survive reload

1. Open browser console
2. Run: `localStorage.clear()` and then reload the page (this won't clear IndexedDB but tests the flow)
3. Navigate to `/settings/advanced`
4. **Verify**: All advanced settings show their default values (thinking off, temp 1.00, max tokens 8,192, top-p/k blank)
5. **Verify**: No fields show "undefined" or "NaN"

---

## Feature 23 — Resend / Duplicate & Edit / Retry

### T23-1: Context menu shows correct items for assistant nodes

1. Load a conversation with at least one assistant response (non-error)
2. Right-click on the assistant node
3. Take a screenshot of the context menu
4. **Verify**: Menu contains "Reply here", "Duplicate & Edit", "Copy", and "Delete" items
5. **Verify**: "Resend" is NOT shown (that's user-only)
6. **Verify**: "Delete" text appears in red

### T23-2: Context menu shows correct items for user nodes

1. Right-click on a user message node
2. Take a screenshot of the context menu
3. **Verify**: Menu contains "Resend", "Duplicate & Edit", "Copy", and "Delete" items
4. **Verify**: "Reply here" is NOT shown (that's assistant-only)

### T23-3: Context menu shows correct items for root node

1. Right-click on the root node (the initial "Hello! How can I help you today?" node)
2. Take a screenshot of the context menu
3. **Verify**: Menu contains "Reply here" and "Copy"
4. **Verify**: "Delete" is NOT shown (root nodes cannot be deleted)
5. **Verify**: "Duplicate & Edit" is NOT shown (root nodes cannot be duplicated)

### T23-4: Context menu shows correct items for error nodes

1. Trigger an error by temporarily setting an invalid model name or bad API key, then send a message
2. After the error node appears, right-click on it
3. Take a screenshot of the context menu
4. **Verify**: Menu contains "Retry", "Copy error", and "Delete"
5. **Verify**: "Reply here", "Resend", and "Duplicate & Edit" are NOT shown

### T23-5: Resend creates a new sibling assistant node

1. Load a conversation with a user message that has one assistant response
2. Note the current tree structure (user node should have 1 child)
3. Right-click the user node and select "Resend"
4. Wait for the new response to stream in
5. Take a screenshot
6. **Verify**: The user node now has 2 children (the original response + the new one)
7. **Verify**: A branch indicator appears on the user node showing "2"
8. **Verify**: The reply target automatically updates to the new response

### T23-6: Resend via NodeDetailPanel button

1. Click a user message node to open the detail panel
2. Take a screenshot of the action buttons
3. **Verify**: A "Resend" button with Send icon is visible
4. Click the "Resend" button
5. Wait for the response to complete
6. **Verify**: A new assistant sibling node appears in the tree

### T23-7: Duplicate & Edit user message (prefills ChatInput)

1. Load a conversation with a user message
2. Right-click the user node and select "Duplicate & Edit"
3. Take a screenshot of the ChatInput area
4. **Verify**: The ChatInput textarea is prefilled with the user message content
5. **Verify**: The reply target indicator changes to the parent of the original user node
6. **Verify**: The textarea is focused and ready for editing
7. Modify the prefilled text and send
8. **Verify**: A new user node appears as a sibling of the original, with the modified content

### T23-8: Duplicate & Edit user message via NodeDetailPanel button

1. Click a user message node (not root) to open the detail panel
2. **Verify**: A "Duplicate & Edit" button with CopyPlus icon is visible
3. Click "Duplicate & Edit"
4. **Verify**: ChatInput is prefilled with the user message content
5. **Verify**: Reply target changes to the parent node

### T23-9: Duplicate & Edit assistant message (opens modal)

1. Load a conversation with at least one assistant response
2. Right-click the assistant node and select "Duplicate & Edit"
3. Take a screenshot
4. **Verify**: A modal overlay appears with the title "Duplicate & Edit"
5. **Verify**: The modal contains a textarea pre-filled with the assistant message content
6. **Verify**: Cancel and Save buttons are visible at the bottom

### T23-10: Duplicate & Edit modal — cancel

1. Open the Duplicate & Edit modal for an assistant node
2. Modify the text in the textarea
3. Click "Cancel"
4. **Verify**: The modal closes
5. **Verify**: No new node is created — the tree is unchanged

### T23-11: Duplicate & Edit modal — save creates sibling with edited badge

1. Open the Duplicate & Edit modal for an assistant node
2. Modify the text in the textarea to something different
3. Click "Save"
4. Take a screenshot
5. **Verify**: The modal closes
6. **Verify**: A new assistant node appears as a sibling of the original (same parent)
7. **Verify**: The new node shows a "edited" badge with a Pencil icon in the tree view
8. Click the new node to open the detail panel
9. Take a screenshot
10. **Verify**: The detail panel shows "(edited)" next to "Claude" in the header
11. **Verify**: An info banner reads "This message was edited by you"
12. **Verify**: The content matches what you typed in the modal

### T23-12: Duplicate & Edit modal — Escape closes

1. Open the Duplicate & Edit modal for an assistant node
2. Press the Escape key
3. **Verify**: The modal closes without creating a new node

### T23-13: Duplicate & Edit modal — Ctrl/Cmd+Enter saves

1. Open the Duplicate & Edit modal for an assistant node
2. Modify the text
3. Press Ctrl+Enter (or Cmd+Enter on Mac)
4. **Verify**: The modal closes and a new sibling node is created with the modified content

### T23-14: Retry error node

1. Trigger an error (e.g., temporarily use an invalid API key, send a message)
2. An error node should appear with red border and "Error: ..." content
3. Right-click the error node and select "Retry"
4. **Verify**: The error node is deleted
5. **Verify**: A new assistant node appears in its place, streaming a fresh response
6. Fix the API key if needed before retrying, so the retry succeeds

### T23-15: Retry via NodeDetailPanel button

1. Click an error node to open the detail panel
2. Take a screenshot of the action buttons
3. **Verify**: A "Retry" button with RefreshCw icon is the primary action
4. **Verify**: A "Copy error" button is available
5. **Verify**: A "Delete" button in red is available
6. Click "Retry"
7. **Verify**: Error node is deleted and a new response streams in

### T23-16: Error node has red border

1. Trigger an error to create an error node
2. Take a screenshot of the tree view
3. **Verify**: The error node has a visible red border (border-2 border-red-500)
4. **Verify**: Other nodes do NOT have red borders

### T23-17: Error node cannot be set as reply target

1. Trigger an error to create an error node
2. Try to set the error node as a reply target:
   - Right-click the error node — the context menu should NOT have "Reply here"
   - There should be no way to set an error node as the reply target
3. **Verify**: The reply target does not change to the error node
4. **Verify**: The reply target indicator in ChatInput still shows the previous valid target

### T23-18: Resend button disabled during streaming

1. Send a message and while the response is streaming:
2. Right-click a user node
3. **Verify**: "Resend" does NOT appear in the context menu (it's hidden during streaming)
4. Click a user node to open the detail panel
5. **Verify**: The "Resend" button is visually disabled (grayed out, not clickable)

### T23-19: Duplicate & Edit button disabled during streaming

1. While a response is streaming:
2. Right-click any non-root node
3. **Verify**: "Duplicate & Edit" does NOT appear in the context menu (hidden during streaming)
4. Open the detail panel for any node
5. **Verify**: "Duplicate & Edit" button is disabled/grayed out

### T23-20: Copy from context menu

1. Right-click any node and select "Copy"
2. Paste into any text field
3. **Verify**: The clipboard contains the full content of the node

### T23-21: Copy error from context menu

1. Right-click an error node and select "Copy error"
2. Paste into any text field
3. **Verify**: The clipboard contains the error message content (including the "Error: " prefix)

### T23-22: Delete from context menu

1. Note the tree structure before deletion
2. Right-click a non-root node and select "Delete"
3. **Verify**: The node and all its children are removed from the tree
4. **Verify**: The parent node's branch count updates accordingly
5. **Verify**: If the deleted node was the reply target, the reply target falls back to its parent

### T23-23: NodeDetailPanel user node actions

1. Click a user message node (not root) to open the detail panel
2. Take a screenshot of the action buttons area
3. **Verify**: Buttons present: "Resend" (primary accent), "Duplicate & Edit", "Copy", "Delete" (red, far right)
4. **Verify**: If the node is root, "Duplicate & Edit" and "Delete" are not shown

### T23-24: NodeDetailPanel assistant node actions

1. Click an assistant message node (not root) to open the detail panel
2. Take a screenshot of the action buttons area
3. **Verify**: Buttons present: "Reply here" (primary accent), "Duplicate & Edit", "Copy", "Delete" (red, far right)

### T23-25: Duplicate & Edit button in NodeDetailPanel opens modal for assistant

1. Click an assistant node to open the detail panel
2. Click the "Duplicate & Edit" button in the action area
3. **Verify**: The Duplicate & Edit modal opens with the assistant's content pre-filled

---

## Cross-cutting: Context Menu Icons & Styling

### TC-1: Context menu has correct icons

1. Right-click various node types and take screenshots of each context menu
2. **Verify**: "Reply here" has a corner-down-right arrow icon
3. **Verify**: "Resend" has a Send icon
4. **Verify**: "Retry" has a RefreshCw icon
5. **Verify**: "Duplicate & Edit" has a CopyPlus icon
6. **Verify**: "Copy" has a Copy icon
7. **Verify**: "Copy error" has a ClipboardCopy icon
8. **Verify**: "Delete" has a Trash2 icon
9. **Verify**: All icons are appropriately sized and colored (muted for normal items, red for delete)

### TC-2: Context menu separator lines

1. Right-click a user node with children (has all menu sections)
2. **Verify**: Thin separator lines divide the action groups (actions | copy | delete)
3. **Verify**: Separators match the border color of the card

### TC-3: Context menu positioning

1. Right-click a node near the bottom-right corner of the viewport
2. **Verify**: The menu repositions so it doesn't overflow outside the viewport
3. **Verify**: All menu items are visible and clickable

### TC-4: Context menu dismiss behaviors

1. Right-click a node to open the context menu
2. Press Escape
3. **Verify**: Menu closes
4. Right-click again to reopen
5. Click somewhere else on the canvas
6. **Verify**: Menu closes
7. Right-click again to reopen
8. Scroll the tree view
9. **Verify**: Menu closes

---

## Full Integration Smoke Test

### TI-1: Complete resend + duplicate workflow

1. Create a new conversation
2. Send "What is 2+2?"
3. Wait for the response
4. Right-click the user message → "Resend"
5. Wait for the second response
6. **Verify**: The user node now has 2 assistant children, branch indicator shows "2"
7. Right-click the user message → "Duplicate & Edit"
8. **Verify**: ChatInput is prefilled with "What is 2+2?"
9. Change it to "What is 3+3?" and send
10. **Verify**: A new user node appears as a sibling, with its own assistant response
11. Right-click one of the assistant responses → "Duplicate & Edit"
12. **Verify**: Modal opens with the response text
13. Change the text and save
14. **Verify**: A new "(edited)" assistant sibling appears

### TI-2: Error → Retry → Success workflow

1. Go to Settings, temporarily change the API key to something invalid (e.g., "sk-invalid")
2. Send a message
3. **Verify**: An error node appears with red border
4. Go to Settings, restore the correct API key
5. Right-click the error node → "Retry"
6. **Verify**: The error node is removed and a new assistant response streams in successfully
7. **Verify**: Reply target updates to the new response

### TI-3: Advanced settings affect API calls

1. Navigate to `/settings/advanced`
2. Set temperature to 0.00 (minimum creativity)
3. Go to a conversation, send "Reply with exactly: HELLO WORLD"
4. **Verify**: Response completes successfully (low temperature should make it more deterministic)
5. Navigate to `/settings/advanced`
6. Set max output tokens to 256
7. Send a message asking for a long response
8. **Verify**: Response is truncated/shorter than usual due to the low token limit
