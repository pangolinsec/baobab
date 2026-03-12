# Feature 22 — Pricing Transparency Test Plan

Tests for Feature 22: token usage display, cost estimation, context token estimate, conversation cost badge, and the Settings > Pricing tab. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. An API key has been configured in Settings for at least one provider (Anthropic recommended)
5. At least one conversation exists with at least one completed assistant response (to have `tokenUsage` data)

---

## Section 1 — Node Detail Panel: Token & Cost Display

### T22-1: Assistant node shows token counts and estimated cost

1. Open a conversation that has at least one completed assistant response
2. Click on an assistant node in the tree to select it
3. The NodeDetailPanel opens on the right side
4. Take a screenshot of the detail panel
5. **Verify**: Between the message content area and the action buttons at the bottom, there is a line showing token counts in the format `X in / Y out` (e.g. `1,240 in / 856 out`)
6. **Verify**: After the token counts, there is a cost estimate shown as ` · Est. $X.XXXX` (e.g. `· Est. $0.0047`)
7. **Verify**: The text is small (xs size), muted color, separated from content and actions by border lines

### T22-2: User node does NOT show token usage

1. In the same conversation, click on a user message node
2. Take a screenshot of the detail panel
3. **Verify**: There is NO token count or cost line between the content and the action buttons
4. **Verify**: The action buttons (Resend, Copy, etc.) appear directly below the content

### T22-3: Token counts use formatted numbers

1. Click on an assistant node that has token usage
2. Inspect the token display text
3. **Verify**: Numbers are formatted with commas for thousands (e.g. `1,240` not `1240`)
4. **Verify**: If a count exceeds 10,000, it shows as `X.XK` format (e.g. `45.0K`)

### T22-4: Cost format adapts to magnitude

1. Open the browser console and run:
   ```js
   // Check what cost values are being displayed
   document.querySelectorAll('.border-t').forEach(el => {
     if (el.textContent && el.textContent.includes('Est.')) console.log('COST_TEXT:', el.textContent.trim());
   });
   ```
2. **Verify**: Costs below $0.01 show 4 decimal places (e.g. `$0.0047`)
3. **Verify**: Costs between $0.01 and $1.00 show 3 decimal places (e.g. `$0.123`)
4. **Verify**: Costs $1.00 and above show 2 decimal places (e.g. `$1.23`)

### T22-5: No token display for nodes without tokenUsage

1. If available, find or create a node that has no `tokenUsage` data (e.g. a very old conversation, or check via console):
   ```js
   // Find nodes without tokenUsage
   const store = document.querySelector('[data-testid]')?.__reactFiber$?.memoizedState;
   ```
2. Alternatively, open the browser console and check:
   ```js
   // Check if any assistant nodes lack tokenUsage
   const nodes = JSON.parse(localStorage.getItem('baobab-nodes') || '{}');
   Object.values(nodes).filter(n => n.role === 'assistant' && !n.tokenUsage).length;
   ```
3. If such a node exists, click on it
4. **Verify**: No token/cost line appears — the actions section follows the content directly

---

## Section 2 — Conversation Cost Badge (Header)

### T22-6: Cost badge appears in conversation header after sending a message

1. Open a conversation that has at least one completed assistant response
2. Look at the conversation header bar (the bar with tags, search button, and Tree/Thread toggle)
3. Take a screenshot focusing on the header area
4. **Verify**: To the left of the search (magnifying glass) button, there is a small text showing the running cost and total tokens, e.g. `$0.12 · 45K tokens`
5. **Verify**: The text is very small (11px), muted color, and uses tabular (monospaced) number formatting

### T22-7: Cost badge updates after new message

1. In a conversation with an existing cost badge, note the current values
2. Send a new message and wait for the assistant response to complete
3. Take a screenshot of the header
4. **Verify**: The cost and token count in the badge have increased from the previous values
5. **Verify**: The update happens after the response completes (no flicker during streaming)

### T22-8: Cost badge shows total tokens only when pricing is unknown

1. If using a provider/model combination not in the default pricing table (and no custom pricing set):
   - The badge should show only token count without a dollar amount, e.g. `45K tokens`
2. **Verify**: No `$` amount is shown when pricing data is unavailable
3. **Verify**: The token count is still displayed

### T22-9: Cost badge not shown on empty conversation

1. Create a new conversation (click the "+" button in the sidebar)
2. Look at the conversation header
3. **Verify**: No cost badge is visible (it only appears after at least one response with token data)

---

## Section 3 — Context Estimate (Chat Input)

### T22-10: Context estimate appears above textarea

1. Open a conversation with several messages (at least 3-4 exchanges)
2. Look at the chat input area at the bottom of the screen, just above the textarea
3. Take a screenshot
4. **Verify**: There is a line showing `~X tokens in context` (e.g. `~4.2K tokens in context`)
5. **Verify**: The text is small (11px), muted color
6. **Verify**: The `~X tokens in context` text has a dotted underline indicating it has a tooltip

### T22-11: Context estimate tooltip on hover

1. Hover over the `~X tokens in context` text
2. Take a screenshot or observe the tooltip
3. **Verify**: A native browser tooltip appears with the text: "Rough estimate using ~4 characters per token. English prose averages ~3.5 chars/token, code averages ~5. Actual token count comes from the API response."

### T22-12: Context estimate grows with conversation depth

1. In a conversation with few messages, note the context estimate
2. Send a message and wait for the response
3. **Verify**: The context estimate has increased (more tokens in context now)
4. Send another message and wait
5. **Verify**: The estimate increases again with each exchange

### T22-13: Context estimate not shown on new/empty conversation

1. Create a new conversation
2. Look at the chat input area
3. **Verify**: No `~X tokens in context` line is visible (estimate is below 100 tokens threshold)

### T22-14: Context estimate reflects reply target path

1. In a conversation with branching (multiple children from one node), set the reply target to a node on a shorter branch
2. Note the context estimate
3. Change the reply target to a node on a longer/deeper branch (click that node, then "Reply here")
4. **Verify**: The context estimate changes to reflect the different path length to root

---

## Section 4 — Settings: Pricing Tab

### T22-15: Pricing tab exists in Settings

1. Navigate to Settings (click the gear icon in the sidebar)
2. Look at the tab sidebar on the left side of the Settings page
3. Take a screenshot
4. **Verify**: There are 5 tabs: General, Providers, Advanced, Prompts, and **Pricing**
5. Click the "Pricing" tab
6. **Verify**: The Pricing section content loads on the right side

### T22-16: Default pricing reference table is visible

1. In Settings > Pricing, scroll down to the "Default Pricing Reference" section
2. Take a screenshot
3. **Verify**: There is a description mentioning "Built-in pricing table. Ollama models are always free."
4. **Verify**: There are grouped tables for each provider: **Anthropic**, **OpenAI**, **Gemini**
5. **Verify**: Each table has columns: Model, Input/M, Output/M
6. **Verify**: Anthropic section shows entries including "Claude Opus 4", "Claude Sonnet 4", "Claude Haiku 4", "Claude 3.5 Sonnet", "Claude 3.5 Haiku"
7. **Verify**: OpenAI section shows entries including "GPT-4o Mini", "GPT-4o", "o1", "o3"
8. **Verify**: Gemini section shows entries including "Gemini 2.5 Flash", "Gemini 2.5 Pro", "Gemini 2.0 Flash"

### T22-17: Add a custom pricing entry

1. In Settings > Pricing, locate the "Custom Pricing" section at the top
2. In the "Add" form row at the bottom of the Custom Pricing section:
   - Type `mistral-large` in the model pattern input (placeholder: "Model pattern (e.g. mistral-large)")
   - Select "OpenRouter" from the provider dropdown
   - Type `2` in the "In $/M" input
   - Type `6` in the "Out $/M" input
3. Click the "Add" button
4. Take a screenshot
5. **Verify**: A new row appears above the Add form showing the entry: `mistral-large`, `OpenRouter`, `2`, `6`
6. **Verify**: The Add form inputs have been cleared (ready for another entry)
7. **Verify**: A "Reset to Defaults" button has appeared at the bottom of the section

### T22-18: Edit a custom pricing entry inline

1. After adding a custom entry (from T22-17), locate the entry row
2. Click into the model pattern input field and change `mistral-large` to `mistral-large-2`
3. Click somewhere else to deselect
4. **Verify**: The entry now shows `mistral-large-2` as its pattern
5. Change the input price from `2` to `3`
6. **Verify**: The price field updates to `3`

### T22-19: Delete a custom pricing entry

1. After adding at least one custom entry, locate the red trash icon button on the right side of the entry row
2. Click the trash icon button
3. Take a screenshot
4. **Verify**: The entry row is removed
5. **Verify**: If no custom entries remain, the "Reset to Defaults" button disappears

### T22-20: Add button is disabled with incomplete fields

1. In the Add form, clear all inputs
2. **Verify**: The "Add" button appears disabled (opacity reduced, not clickable)
3. Type only a model pattern, leave price fields empty
4. **Verify**: The "Add" button is still disabled
5. Fill in all three fields (pattern, input price, output price)
6. **Verify**: The "Add" button becomes enabled (full opacity, clickable)

### T22-21: Reset to Defaults clears all custom entries

1. Add two or three custom pricing entries (any patterns/values)
2. Take a screenshot showing the entries
3. Scroll down and click "Reset to Defaults"
4. Take a screenshot
5. **Verify**: All custom entries are removed
6. **Verify**: The "Reset to Defaults" button is no longer visible
7. **Verify**: The default pricing reference tables are still displayed (unchanged)

### T22-22: Custom pricing persists across page reload

1. Add a custom pricing entry (e.g. pattern: `test-model`, provider: Anthropic, input: `1`, output: `5`)
2. Reload the page (navigate away and back to Settings > Pricing)
3. **Verify**: The custom entry is still present after reload
4. **Verify**: The values match what was entered

---

## Section 5 — Integration & Cross-cutting

### T22-23: Send a message and verify all three displays update

1. Create a new conversation or open one with no prior messages
2. Send a message (e.g. "Hello, tell me a joke") and wait for the assistant response to complete
3. Take a screenshot of the full page
4. **Verify (Detail Panel)**: Click the assistant response node — the detail panel shows token counts and estimated cost
5. **Verify (Header Badge)**: The conversation header now shows a cost badge (e.g. `$0.0047 · 1,240 tokens`)
6. **Verify (Context Estimate)**: The chat input area shows a context estimate (e.g. `~312 tokens in context`)

### T22-24: Multiple messages accumulate in conversation badge

1. In a conversation, note the header badge cost value
2. Send 2-3 more messages, waiting for each response
3. After the last response completes, check the header badge
4. **Verify**: The cost value has increased with each response
5. **Verify**: The token count has increased with each response
6. **Verify**: The cost shown in the badge is the sum of all individual node costs (not just the latest)

### T22-25: Pricing display adapts to theme

1. In Light mode, with a conversation loaded:
   - Take a screenshot of the detail panel token/cost line
   - Take a screenshot of the header cost badge
   - Take a screenshot of the context estimate
2. Switch to Dark mode
3. Take screenshots of the same three elements
4. **Verify**: All pricing text remains readable in both themes
5. **Verify**: The text uses muted colors appropriate to each theme (no low-contrast issues)

---

## Section 6 — Edge Cases (Destructive / Data-dependent)

> These tests may require specific provider configurations or conversation data. Run them last.

### T22-26: Custom pricing overrides default pricing

1. Go to Settings > Pricing
2. Add a custom entry: pattern `claude-3-5-haiku`, provider `Anthropic`, input price `99`, output price `99`
3. Go back to a conversation that used the `claude-3-5-haiku` model
4. Click on an assistant node from that model
5. **Verify**: The estimated cost in the detail panel is much higher than normal (reflecting the $99/M override price)
6. Go back to Settings > Pricing and delete the custom entry or click "Reset to Defaults" to clean up

### T22-27: Provider dropdown in custom pricing has all options

1. Go to Settings > Pricing
2. Click the provider dropdown in the Add form
3. Take a screenshot
4. **Verify**: The dropdown contains: Anthropic, OpenAI, Gemini, Ollama, OpenRouter, HuggingFace
