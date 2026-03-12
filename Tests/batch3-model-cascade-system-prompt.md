# Batch 3 — Model Cascade & System Prompt Cascade

Tests for Feature 08 Phase 1 (Model Cascade) and Feature 09 (System Prompt Cascade). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings (needed for streaming/send tests)
5. At least one conversation exists with multiple nodes (root assistant + user + assistant reply). If none exists, create one by clicking "+" in the sidebar and sending a message like "Say hello" then waiting for the response.

---

## Feature 08 — Model Cascade: UI Elements

### T08-1: Model chip appears on assistant nodes in the tree

1. Load a conversation that has at least one assistant response (not just the root greeting)
2. Take a screenshot of the tree view
3. **Verify**: Each assistant node card shows a small text chip next to the "Claude" label (e.g., "Haiku 3.5", "Sonnet 4", or similar abbreviated model name)
4. **Verify**: User nodes do NOT have a model chip — only "You" label is shown
5. **Verify**: The root assistant node (greeting "Hello! How can I help you today?") also shows a model chip

### T08-2: Model chip text matches abbreviated format

1. Open the browser console and run:
   ```js
   JSON.stringify(Object.values(__ZUSTAND_TREE_STORE__ || {}))
   ```
   If that doesn't work, check the node model value by clicking an assistant node and reading the model text in the NodeDetailPanel header.
2. Click an assistant node to open the NodeDetailPanel
3. Take a screenshot of the panel header area
4. **Verify**: Next to "Claude" in the header, the model name is shown in abbreviated form (e.g., "Haiku 3.5" not "claude-3-5-haiku-20241022")
5. **Verify**: The abbreviation matches the chip shown on the node card in the tree

### T08-3: ModelSelector dropdown in ChatInput area

1. Load any conversation
2. Look at the area between the reply target indicator and the message textarea
3. Take a screenshot of the ChatInput area
4. **Verify**: A dropdown/select element is visible showing "Default (Haiku 3.5)" or similar text with the abbreviated name of the current effective model
5. Click the dropdown to open it
6. Take a screenshot
7. **Verify**: The dropdown shows an "Inherit" option at the top AND lists all available models from the API (model display names like "Claude 3.5 Haiku", "Claude Sonnet 4", etc.)

### T08-4: ModelSelector in ChatInput resets after sending

1. In the ChatInput model selector dropdown, select a different model (e.g., pick any non-default model)
2. **Verify**: The dropdown now shows the selected model name instead of "Default (...)"
3. Type "Test message" in the message textarea and press Enter to send
4. Wait for the assistant response to complete
5. **Verify**: After sending, the model selector dropdown resets back to "Default (...)" — the per-message override is cleared

### T08-5: Branch model selector in NodeDetailPanel (non-root nodes)

1. Load a conversation with at least one user node and one assistant response
2. Click a non-root node (either the user message or assistant reply) to open the NodeDetailPanel
3. Take a screenshot of the NodeDetailPanel
4. **Verify**: Below the header, there is a section labeled "Branch model" with a dropdown selector
5. **Verify**: The dropdown shows "Inherit (Haiku 3.5)" or similar (with the abbreviated default model name)
6. Click the dropdown
7. **Verify**: It shows the same model list as the ChatInput model selector

### T08-6: Branch model selector NOT shown for root node

1. Click the root assistant node (the greeting node with no parent) to select it
2. Take a screenshot of the NodeDetailPanel
3. **Verify**: There is NO "Branch model" section — the model/system prompt override sections are hidden for the root node
4. **Verify**: The header still shows "Claude" with the model abbreviation text

### T08-7: Setting a branch model override persists

1. Click a non-root assistant node to open the NodeDetailPanel
2. In the "Branch model" dropdown, select a specific model (different from the default)
3. Take a screenshot — the dropdown should now show the selected model
4. Click a different node to deselect, then click the original node again
5. **Verify**: The "Branch model" dropdown still shows the previously selected model — the override persisted
6. In the "Branch model" dropdown, select "Inherit (...)" to clear the override
7. Click away and back
8. **Verify**: The dropdown shows "Inherit (...)" again — clearing the override also persists

---

## Feature 08 — Model Cascade: Functional (requires API key)

### T08-8: Per-message model override is used for API call

1. Create a new conversation (click "+" in sidebar)
2. In the ChatInput model selector, select a specific model (pick a model different from the default, e.g., if default is Haiku, pick Sonnet)
3. Type "What model are you? Reply with just your model name." and send
4. Wait for the response to complete
5. Click the new assistant response node to see the detail panel
6. **Verify**: The model chip on the assistant node and the model text in the NodeDetailPanel header shows the model you selected (not the default)
7. **Verify**: The ChatInput model selector has reset back to "Default (...)"

### T08-9: Resend uses cascade-resolved model

1. In a conversation with an existing user message, click that user node to select it
2. Note the model shown on its sibling assistant node
3. Click "Resend" in the NodeDetailPanel actions
4. Wait for the new assistant response to complete
5. **Verify**: The new assistant response node shows the same model as before (cascade resolved from the same context)
6. **Verify**: A new assistant node was created as a sibling (branch) under the user node

---

## Feature 09 — System Prompt Cascade: UI Elements

### T09-1: System prompt button in ChatInput

1. Load any conversation
2. Look at the ChatInput area, in the row with the model selector
3. Take a screenshot
4. **Verify**: There is a button with a message square icon and text "System prompt" next to the model selector
5. **Verify**: The button text is in muted/default color (not accent colored)

### T09-2: System prompt editor toggle in ChatInput

1. Click the "System prompt" button in the ChatInput area
2. Take a screenshot
3. **Verify**: A textarea appears below the button row with placeholder text "Override system prompt for this message..."
4. **Verify**: The button text changes to or remains "System prompt" (stays in default color since no text has been typed yet)
5. Type "You are a pirate. Respond in pirate speak." into the system prompt textarea
6. **Verify**: The button text changes to "Custom prompt" and appears in the accent color
7. Click the "System prompt" / "Custom prompt" button again
8. **Verify**: The textarea collapses/hides (toggle behavior)
9. Click the button once more to reopen
10. **Verify**: The previously typed text is still in the textarea — it was not lost when collapsing

### T09-3: System prompt override resets after sending

1. Click the "System prompt" button to open the editor
2. Type any text in the system prompt textarea (e.g., "Be concise")
3. **Verify**: The button shows "Custom prompt" in accent color
4. Type a message in the main textarea and send it
5. Wait for the response
6. **Verify**: The system prompt button text is back to "System prompt" in default color
7. **Verify**: The system prompt editor is collapsed/hidden
8. Click the "System prompt" button to reopen
9. **Verify**: The textarea is empty — the per-message override was cleared

### T09-4: Branch system prompt section in NodeDetailPanel

1. Click a non-root node to open the NodeDetailPanel
2. Take a screenshot of the panel
3. **Verify**: Below the "Branch model" section, there is a collapsible section with a message square icon and text "Branch system prompt"
4. **Verify**: The section is collapsed by default (shows a right-pointing chevron arrow)
5. **Verify**: There is no "overridden" badge visible (since no override has been set)

### T09-5: Branch system prompt expand/collapse

1. Click the "Branch system prompt" button/header to expand it
2. Take a screenshot
3. **Verify**: A textarea appears with placeholder text "Inherit from parent (leave empty to inherit, type to override)"
4. **Verify**: The textarea is empty
5. **Verify**: The chevron arrow now points downward (expanded state)
6. Click the "Branch system prompt" header again
7. **Verify**: The textarea collapses and the chevron returns to right-pointing

### T09-6: Setting a branch system prompt override

1. Click a non-root node to open the NodeDetailPanel
2. Expand the "Branch system prompt" section
3. Type "Always respond in French" into the textarea
4. Click a different node to deselect, then click the original node again
5. **Verify**: The "Branch system prompt" section shows an "overridden" badge (small pill in accent color)
6. Expand the section
7. **Verify**: The textarea contains "Always respond in French" — the override persisted
8. **Verify**: A "Clear override (inherit from parent)" link appears below the textarea

### T09-7: Clearing a branch system prompt override

1. With a node that has a system prompt override set (from T09-6), expand the "Branch system prompt" section
2. Click the "Clear override (inherit from parent)" link
3. **Verify**: The textarea becomes empty
4. **Verify**: The "overridden" badge disappears from the section header
5. **Verify**: The "Clear override" link disappears (since there's no override to clear)

### T09-8: Branch system prompt NOT shown for root node

1. Click the root assistant node (greeting node, parentId is null)
2. Take a screenshot of the NodeDetailPanel
3. **Verify**: There is NO "Branch system prompt" section visible
4. **Verify**: There is also NO "Branch model" section visible (both are hidden for root)

---

## Feature 09 — System Prompt: Settings Page

### T09-9: Prompts tab exists in Settings

1. Navigate to Settings (click the gear icon or navigate to `/settings`)
2. Take a screenshot
3. **Verify**: The left sidebar/tab navigation shows three tabs: "General", "Advanced", and "Prompts"
4. Click the "Prompts" tab
5. Take a screenshot
6. **Verify**: The content area shows a section titled "Default System Prompt"
7. **Verify**: Below the title there is helper text: "Applied to all new conversations unless overridden at the conversation or node level."
8. **Verify**: There is a textarea with placeholder "Enter a default system prompt (optional)"

### T09-10: Setting a default system prompt in Settings

1. Navigate to Settings > Prompts tab
2. Click into the "Default System Prompt" textarea
3. Type "You are a helpful assistant that always responds concisely."
4. Click outside the textarea (blur) to trigger save
5. Navigate away from Settings (click the back arrow)
6. Navigate back to Settings > Prompts tab
7. **Verify**: The textarea still contains "You are a helpful assistant that always responds concisely." — the setting persisted

### T09-11: Clearing the default system prompt

1. Navigate to Settings > Prompts tab
2. Select all text in the textarea and delete it (clear it completely)
3. Click outside to trigger save
4. Navigate away and back to Settings > Prompts tab
5. **Verify**: The textarea is empty with the placeholder showing — clearing the prompt persists

---

## Feature 09 — System Prompt: Functional (requires API key)

### T09-12: System prompt override affects API response

1. Create a new conversation (click "+" in sidebar)
2. In the ChatInput area, click the "System prompt" button to open the editor
3. Type "You must begin every response with the word PIRATE."
4. Type "Say hello" in the message textarea and send
5. Wait for the response to complete
6. **Verify**: The assistant response begins with or contains the word "PIRATE" (confirming the system prompt was used)

---

## Cross-cutting: Cascade Interaction

### TC-1: Model and system prompt controls coexist in NodeDetailPanel

1. Click a non-root node (user or assistant) to open the NodeDetailPanel
2. Take a screenshot showing the full panel
3. **Verify**: Both "Branch model" (dropdown) and "Branch system prompt" (collapsible section) are visible
4. **Verify**: They appear in order: header, then Branch model, then Branch system prompt, then content
5. **Verify**: Each section has a bottom border separating it from the next

### TC-2: Model and system prompt controls coexist in ChatInput

1. Look at the ChatInput area
2. Take a screenshot
3. **Verify**: The model selector dropdown and "System prompt" button are on the same row
4. **Verify**: They appear between the reply target indicator (above) and the message textarea (below)

### TC-3: Existing conversations load without errors

1. If there are existing conversations from before this feature was added, click one in the sidebar
2. **Verify**: The conversation loads without errors — no console errors, no blank screen
3. **Verify**: The tree renders normally with all nodes visible
4. **Verify**: Clicking nodes opens the NodeDetailPanel with the new sections (Branch model shows "Inherit", Branch system prompt has no override badge)
5. Take a screenshot to confirm normal rendering

### TC-4: New conversation with both overrides

1. Create a new conversation
2. In the ChatInput, select a specific model from the model selector dropdown (not the default)
3. Click the "System prompt" button and type "Always reply in exactly one sentence."
4. Type "What is the meaning of life?" and send
5. Wait for the response
6. Click the new assistant response node
7. **Verify**: The model chip on the node and the model text in the detail panel header match the model you selected
8. **Verify**: The response is approximately one sentence (confirming the system prompt took effect)
9. **Verify**: Both the model selector and system prompt button in ChatInput have reset to defaults

---

## Destructive Tests (run these last)

### TD-1: Delete node with model override

1. Click a non-root node and set a model override in the "Branch model" dropdown (select a specific model)
2. Take a screenshot showing the override is set
3. Click the "Delete" button in the NodeDetailPanel actions
4. **Verify**: The node is removed from the tree
5. **Verify**: The app does not crash — tree continues to render normally
6. **Verify**: No console errors related to the deleted node's modelOverride
