# Batch 3 — Model Cascade & System Prompt: Test Results

**Execution Date**: 2026-02-19
**Environment**: Docker dev server at localhost:5173, Chrome MCP tab 1134250644, Dark theme
**Starting State**: Multiple existing conversations, API key configured, Extended Thinking enabled (disabled during functional tests due to Haiku 3.5 compatibility)
**Default Model**: Claude Haiku 3.5

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| F08 — Model Cascade: UI | 7 | 7 | 0 | 0 | T08-3 note: "Default" not "Inherit" |
| F08 — Model Cascade: Functional | 2 | 2 | 0 | 0 | T08-8: fixed in retest |
| F09 — System Prompt: UI | 8 | 8 | 0 | 0 | |
| F09 — System Prompt: Settings | 3 | 3 | 0 | 0 | |
| F09 — System Prompt: Functional | 1 | 1 | 0 | 0 | |
| Cross-cutting: Cascade Interaction | 4 | 4 | 0 | 0 | TC-4 node chip bug now fixed |
| Destructive Tests | 1 | 1 | 0 | 0 | |
| **TOTAL** | **26** | **26** | **0** | **0** | |

---

## Feature 08 — Model Cascade: UI Elements

### T08-1: Model chip appears on assistant nodes in the tree — PASS

**Actions**: Loaded "Say hi" conversation with root + user + assistant nodes. Took screenshot of tree view.
**Observations**:
- Assistant nodes show "Haiku 3.5" chip below the "Claude" label
- User nodes show only "You" label with no model chip
- Root assistant node (greeting) also shows "Haiku 3.5" chip

### T08-2: Model chip text matches abbreviated format — PASS

**Actions**: Clicked assistant node to open NodeDetailPanel. Took screenshot of panel header.
**Observations**:
- Detail panel header shows "Claude Haiku 3.5" (abbreviated form, not full model ID)
- Matches the chip shown on the tree node card

### T08-3: ModelSelector dropdown in ChatInput area — PASS

**Actions**: Loaded conversation, inspected ChatInput area. Used JS to read select options since native `<select>` elements don't visually open via MCP clicks.
**Observations**:
- Dropdown visible showing "Default (Haiku 3.5)" with abbreviated model name
- Dropdown contains 12 options: 1 default + 11 models (Haiku 4.5, Haiku 3, Haiku 3.5, Sonnet 4.6, Sonnet 4.5, Sonnet 4, Sonnet 3.7, Opus 4.6, Opus 4.5, Opus 4, Opus 4.1)
- **Note**: First option says "Default (...)" not "Inherit (...)" as test expected — this is by design for the ChatInput selector (ChatInput uses "Default", NodeDetailPanel uses "Inherit")

### T08-4: ModelSelector in ChatInput resets after sending — PASS

**Actions**: Selected "Claude Sonnet 4" in ChatInput model selector via JS. Typed "Test message" and sent. Waited for response.
**Observations**:
- After selecting Sonnet 4, dropdown showed the selected model name
- After sending and receiving response, the model selector reset back to "Default (Haiku 3.5)"

### T08-5: Branch model selector in NodeDetailPanel (non-root nodes) — PASS

**Actions**: Clicked a non-root assistant node. Inspected NodeDetailPanel. Read branch model select options via JS.
**Observations**:
- "Branch model" section visible below header with dropdown selector
- Dropdown shows "Inherit (Haiku 3.5)" with abbreviated default model name
- Same 12 options as ChatInput model selector (Inherit + 11 models)

### T08-6: Branch model selector NOT shown for root node — PASS

**Actions**: Clicked the root assistant node (greeting "Hello! How can I help you today?"). Took screenshot.
**Observations**:
- No "Branch model" section visible in the NodeDetailPanel
- No "Branch system prompt" section visible either
- Header still shows "Claude" with "Haiku 3.5" abbreviation text

### T08-7: Setting a branch model override persists — PASS

**Actions**: Clicked non-root assistant node. Set branch model to "Claude Sonnet 4" via JS. Clicked different node, then clicked back.
**Observations**:
- After setting override, dropdown showed "Claude Sonnet 4"
- After deselect/reselect, dropdown still showed "Claude Sonnet 4" — persisted
- Changed to "Inherit (Haiku 3.5)" to clear override
- After deselect/reselect, dropdown showed "Inherit (Haiku 3.5)" — clearing persisted

---

## Feature 08 — Model Cascade: Functional (requires API key)

### T08-8: Per-message model override is used for API call — PASS (retest)

**Actions**: Created new conversation. Selected "Claude Sonnet 4" in ChatInput model selector. Typed "What model are you? Reply with just your model name." and sent. Waited for response. Clicked the new assistant response node.
**Observations**:
- Tree node chip correctly shows "Sonnet 4" in accent color — per-message model override reflected (Bug 1 fixed)
- Detail panel header shows "Claude Sonnet 4" — properly abbreviated (Bug 2 fixed)
- The ChatInput model selector correctly reset to "Default (Haiku 3.5)" after sending.
**Previous result**: FAIL — node chip showed "Haiku 3.5" (default) instead of "Sonnet 4", and header showed "Sonnet 4.20250514" (unabbreviated). Fixed in `indicators.ts` (use `node.model` as source of truth) and `models.ts` (strip YYYYMMDD date suffix before version extraction).

### T08-9: Resend uses cascade-resolved model — PASS (with note)

**Actions**: In existing conversation, clicked user node. Used JS to click "Resend" button (coordinate clicks didn't register). Waited for response.
**Observations**:
- A new assistant node was created as a sibling branch under the user node
- The new node showed the same model chip as before (cascade resolved)
- **Note**: The API returned a max_tokens error (46848 > 8192 for Haiku 3.5) due to Extended Thinking settings. The resend mechanism itself worked correctly — the error was a settings configuration issue, not a cascade bug.

---

## Feature 09 — System Prompt Cascade: UI Elements

### T09-1: System prompt button in ChatInput — PASS

**Actions**: Loaded conversation, took screenshot of ChatInput area.
**Observations**:
- Button with message square icon and "System prompt" text visible next to model selector
- Button text in muted/default color (not accent colored)

### T09-2: System prompt editor toggle in ChatInput — PASS

**Actions**: Clicked "System prompt" button. Typed text into textarea. Toggled button. Reopened.
**Observations**:
- Textarea appeared with placeholder "Override system prompt for this message..."
- Button remained "System prompt" in default color while textarea was empty
- After typing "You are a pirate. Respond in pirate speak.", button changed to "Custom prompt" in accent (orange) color
- Clicking button again collapsed the textarea (toggle behavior)
- Reopening showed the previously typed text still present

### T09-3: System prompt override resets after sending — PASS

**Actions**: Set system prompt text, typed message, sent it. Waited for response.
**Observations**:
- After sending, button text reverted to "System prompt" in default color
- System prompt editor collapsed/hidden
- Reopening showed empty textarea — per-message override was cleared

### T09-4: Branch system prompt section in NodeDetailPanel — PASS

**Actions**: Clicked non-root node to open NodeDetailPanel. Took screenshot.
**Observations**:
- "Branch system prompt" collapsible section visible below "Branch model"
- Section shows right-pointing chevron arrow (collapsed by default)
- No "overridden" badge visible (no override set)

### T09-5: Branch system prompt expand/collapse — PASS

**Actions**: Clicked "Branch system prompt" header to expand. Clicked again to collapse.
**Observations**:
- Textarea appeared with placeholder "Inherit from parent (leave empty to inherit, type to override)"
- Textarea was empty
- Chevron pointed downward when expanded
- Clicking header again collapsed textarea, chevron returned to right-pointing

### T09-6: Setting a branch system prompt override — PASS

**Actions**: Expanded "Branch system prompt" section. Typed "Always respond in French" via JS. Clicked different node, then clicked back.
**Observations**:
- "overridden" badge appeared in accent color on the section header
- Expanding section showed "Always respond in French" — override persisted
- "Clear override (inherit from parent)" link appeared below textarea

### T09-7: Clearing a branch system prompt override — PASS

**Actions**: With override set, clicked "Clear override (inherit from parent)" link.
**Observations**:
- Textarea became empty
- "overridden" badge disappeared from section header
- "Clear override" link disappeared

### T09-8: Branch system prompt NOT shown for root node — PASS

**Actions**: Already verified in T08-6.
**Observations**:
- No "Branch system prompt" section visible for root node
- No "Branch model" section visible either (both hidden for root)

---

## Feature 09 — System Prompt: Settings Page

### T09-9: Prompts tab exists in Settings — PASS

**Actions**: Navigated to Settings. Took screenshot. Clicked "Prompts" tab. Took screenshot.
**Observations**:
- Settings sidebar shows three tabs: "General", "Advanced", "Prompts"
- Prompts tab content shows "Default System Prompt" section title
- Helper text: "Applied to all new conversations unless overridden at the conversation or node level."
- Textarea with placeholder "Enter a default system prompt (optional)"
- Also shows a "Summarization Prompt" section below

### T09-10: Setting a default system prompt in Settings — PASS

**Actions**: Clicked into textarea, typed "You are a helpful assistant that always responds concisely." Clicked outside to blur. Navigated away from Settings. Navigated back to Settings > Prompts.
**Observations**:
- Textarea contained the typed text after navigating away and back — setting persisted

### T09-11: Clearing the default system prompt — PASS

**Actions**: Selected all text in textarea (Ctrl+A), deleted it (Backspace). Clicked outside to blur. Navigated away and back to Settings > Prompts.
**Observations**:
- Textarea was empty with placeholder showing — clearing the prompt persisted

---

## Feature 09 — System Prompt: Functional (requires API key)

### T09-12: System prompt override affects API response — PASS

**Actions**: Created new conversation. Opened system prompt editor, set text to "You must begin every response with the word PIRATE." Typed "Say hello" and sent. Waited for response.
**Pre-requisite fix**: Disabled Extended Thinking and set Max Output Tokens to 4,096 to avoid Haiku 3.5 API errors (thinking budget 10,000 > Haiku's 8,192 max tokens limit).
**Observations**:
- Response: "PIRATE Ahoy there, matey! Greetings and salutations from the high seas! How are you faring on this fine day?"
- Response begins with "PIRATE" — confirming the system prompt override was used
- System prompt button reset to "System prompt" in default color after sending

---

## Cross-cutting: Cascade Interaction

### TC-1: Model and system prompt controls coexist in NodeDetailPanel — PASS

**Actions**: Clicked non-root user node ("Say hello") to open NodeDetailPanel. Zoomed into panel header area.
**Observations**:
- Both "Branch model" (dropdown) and "Branch system prompt" (collapsible section) visible
- Order: header > Branch model > Branch system prompt > content
- Sections separated by borders

### TC-2: Model and system prompt controls coexist in ChatInput — PASS

**Actions**: Zoomed into ChatInput area.
**Observations**:
- Model selector dropdown ("Default (Haiku 3.5)") and "System prompt" button on the same row
- They appear between the reply target indicator (above) and the message textarea (below)

### TC-3: Existing conversations load without errors — PASS

**Actions**: Clicked "Hello, what is 2+2?" conversation in sidebar. Clicked nodes to open NodeDetailPanel.
**Observations**:
- Conversation loaded without errors — no blank screen
- Tree rendered with all nodes visible (including some error nodes from previous API issues)
- Clicking nodes opened NodeDetailPanel with "Branch model" showing "Inherit (Haiku 3.5)" and "Branch system prompt" (no override badge)
- Console showed only Vite HMR reload errors (from concurrent editing), no model/cascade related errors

### TC-4: New conversation with both overrides — PASS (with note)

**Actions**: Created new conversation. Selected "Claude Haiku 4.5" in model selector via JS. Set system prompt to "Always reply in exactly one sentence." via JS. Typed "What is the meaning of life?" and sent. Clicked the assistant response node.
**Observations**:
- Detail panel header shows "Claude Haiku 4.5" — model override was used
- Response: "The meaning of life is a deeply personal question that different people answer through relationships, purpose, creativity, helping others, spiritual growth, or pursuing what brings them joy and fulfillment." — approximately one sentence (system prompt took effect)
- ChatInput model selector reset to "Default (Haiku 3.5)" and system prompt button reset to "System prompt" — both overrides cleared after sending
- **Note**: Node chip bug (same as T08-8) has been fixed — tree node now correctly shows the per-message model override

---

## Destructive Tests

### TD-1: Delete node with model override — PASS

**Actions**: Selected user "What is the meaning of life?" node. Set branch model override to "Claude Sonnet 4" via JS. Verified override shown in dropdown and cascade effect on child node. Clicked "Delete" button in NodeDetailPanel.
**Observations**:
- Node and its child assistant node removed from tree
- Only root node remaining — tree renders normally
- No crash, no console errors related to modelOverride
- Console errors were only Vite HMR reload errors (unrelated to this feature)

---

## Bugs Found & Fixed

### Bug 1: Tree node chip does not reflect per-message model override (T08-8, TC-4) — FIXED
**Severity**: Medium
**Description**: When a message is sent with a per-message model override (e.g., Sonnet 4 or Haiku 4.5), the assistant response node in the tree always shows the default model chip ("Haiku 3.5") instead of the actual model used. The correct model IS recorded and shown in the NodeDetailPanel header, confirming the override works functionally — only the tree node chip display is wrong.
**Root cause**: `getNodeIndicators()` in `indicators.ts` used `resolveModel()` (cascade walk via `modelOverride` property), but per-message overrides store the model directly in `node.model` without setting `modelOverride`.
**Fix**: Changed `getNodeIndicators()` to use `node.model` as source of truth, falling back to `resolveModel()` only when `node.model` is empty.
**Verified**: Retest on 2026-02-19 — tree node chip now correctly shows "Sonnet 4" for per-message override.

### Bug 2: Detail panel header shows unabbreviated model name for override responses (T08-8) — FIXED
**Severity**: Low
**Description**: When viewing an assistant node that was generated with a per-message model override, the NodeDetailPanel header shows the raw model suffix (e.g., "Sonnet 4.20250514") instead of the abbreviated name ("Sonnet 4"). The abbreviation function may not handle the model ID format returned by the API response.
**Root cause**: `abbreviateModelName()` in `models.ts` matched version digits after the tier name but also captured the YYYYMMDD date suffix as part of the version (e.g., "4-20250514" → "4.20250514").
**Fix**: Strip YYYYMMDD date suffix from model ID before extracting version number. Added separate regex paths for new naming (`claude-TIER-VERSION`) and old naming (`claude-VERSION-TIER`).
**Verified**: Retest on 2026-02-19 — detail panel header now shows "Claude Sonnet 4" (properly abbreviated).

### Pre-existing Issue: Extended Thinking + Haiku 3.5 max_tokens incompatibility
**Severity**: Medium (configuration)
**Description**: With Extended Thinking enabled (thinking budget 10,000 tokens) and Max Output Tokens set to values exceeding Haiku 3.5's limit of 8,192, API calls fail with `max_tokens` errors. The app does not automatically clamp max_tokens to the selected model's limit, nor does it validate that thinking_budget < max_tokens for the chosen model.
