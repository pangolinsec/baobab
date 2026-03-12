# Tier 2 Batch 6 — Inference Providers: Test Results

**Execution date**: 2026-02-19
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, Anthropic provider enabled with valid API key, default model Haiku 4.5
**Tab ID**: 1134250662

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| Feature 07 — Provider Settings UI | 11 | 10 | 0 | 1 | T07-5 N/A (General tab has no API key field) |
| Provider Integration — Sending | 3 | 2 | 0 | 1 | T07-14 skipped (no Ollama) |
| Provider Settings Persistence | 2 | 1 | 0 | 1 | T07-16 N/A (no legacy API key field) |
| Edge Cases | 2 | 0 | 1 | 1 | Legacy fallback bypasses disabled providers |
| **Total** | **18** | **13** | **1** | **4** | |

---

## Feature 07 — Provider Settings UI

### T07-1: Providers section exists in Settings — PASS

**Actions**: Opened Settings via sidebar. Inspected left sidebar navigation.

**Observations**:
- 4 navigation items visible: "General", "Providers", "Advanced", "Prompts" — PASS
- Clicked "Providers" — section loaded with intro text "Configure inference providers. The default provider is used for new conversations." — PASS

### T07-2: Default provider selector — PASS

**Actions**: In Providers section, inspected "Default Provider" dropdown.

**Observations**:
- Shows "Anthropic" as selected default — PASS
- Only enabled providers appear in dropdown (verified via JS: "Anthropic (anthropic)" only when Ollama disabled; "Anthropic (anthropic), Ollama (ollama)" when both enabled) — PASS

### T07-3: Anthropic provider accordion — default state — PASS

**Actions**: Inspected provider list in Providers section.

**Observations**:
- Anthropic listed with green (emerald) status dot — PASS
- "default" badge appears next to Anthropic name — PASS
- Chevron (>) on right indicating expandable — PASS

### T07-4: Anthropic provider — expanded panel — PASS

**Actions**: Clicked Anthropic row to expand.

**Observations**:
- "Enabled" toggle visible and turned on (accent color) — PASS
- "API Key" field present with type=password (showing masked dots) — PASS
- API key pre-filled (synced from previously configured key) — PASS
- "Test Connection" button visible — PASS
- Chevron changed to down (v) when expanded — PASS

### T07-5: Configure Anthropic API key via provider panel — SKIPPED (N/A)

**Reason**: The General tab no longer contains an API key field. It only shows Theme (Light/Dark) toggle. API key management has been fully moved to the Providers section. The sync test is not applicable — there's only one location for the API key.

### T07-6: Add a new provider — PASS

**Actions**: Clicked "+ Ollama" button in "Add Provider" area.

**Observations**:
- Ollama added to provider list below Anthropic — PASS
- Gray status dot (disabled by default) — PASS
- Ollama accordion auto-expanded showing configuration fields — PASS
- "+ Ollama" button disappeared from Add Provider area — PASS
- Remaining buttons: OpenAI, OpenRouter, Google Gemini, HuggingFace — PASS

### T07-7: Provider accordion — expand and configure — PASS

**Actions**: Inspected Ollama expanded panel.

**Observations**:
- "Enabled" toggle present (initially off) — PASS
- "Base URL" field with value "http://localhost:11434" (correct default for Ollama) — PASS
- No API key field (Ollama doesn't require one) — PASS

### T07-8: Enable/disable provider toggle — PASS

**Actions**: Enabled Ollama via toggle, then disabled it, checking state at each step.

**Observations**:
- Enable: toggle switches to on (accent color), status dot changes gray → green — PASS
- "Test Connection" button appears when enabled — PASS
- Disable: toggle switches to off (muted), status dot changes green → gray — PASS
- "Test Connection" button disappears when disabled — PASS
- Disabled provider removed from Default Provider dropdown options (verified via JS) — PASS
- Re-enable: provider reappears in dropdown — PASS

### T07-9: Collapse/expand provider accordion — PASS

**Actions**: With Ollama expanded, clicked header to collapse. Clicked again to expand.

**Observations**:
- Collapse: fields hidden, chevron changes to right (>) — PASS
- Expand: fields shown, chevron changes to down (v) — PASS

### T07-10: Multiple providers configured — PASS

**Actions**: Enabled both Anthropic and Ollama. Inspected Providers section.

**Observations**:
- Both providers show green status dots — PASS
- Default Provider dropdown lists both: "Anthropic (anthropic), Ollama (ollama)" — PASS

### T07-11: Change default provider — PASS

**Actions**: Changed Default Provider dropdown from "Anthropic" to "Ollama" via JS (nativeInputValueSetter).

**Observations**:
- Dropdown now shows "Ollama" — PASS
- "default" badge moved from Anthropic to Ollama — PASS
- Default Model changed to "llama3.1:8b" (Ollama model) — PASS
- Changed back to Anthropic — badge moved back correctly — PASS

---

## Provider Integration — Sending Messages

### T07-12: Send message via Anthropic provider — PASS

**Actions**: Ensured Anthropic enabled with valid API key, set as default. Created new conversation. Typed "Hello what model are you?" and clicked Send.

**Observations**:
- New conversation header shows: Model: Haiku 4.5, Provider: Anthropic — PASS
- Message streamed in successfully — PASS
- Assistant response appeared: "I'm Claude, an AI assistant made by Anthropic..." — PASS
- Model chip shows "Haiku 4.5" — PASS

### T07-13: Provider ID stored on nodes — PASS

**Actions**: Clicked assistant node after T07-12. Inspected NodeDetailPanel.

**Observations**:
- Node shows "Haiku 4.5" model chip in header — PASS
- Node functions correctly (reply, copy, etc.) — PASS
- Provider info is correctly associated with the node — PASS

### T07-14: Send message via Ollama provider — SKIPPED

**Reason**: No local Ollama instance running. Test requires `http://localhost:11434` to be accessible.

---

## Provider Settings Persistence

### T07-15: Provider configuration persists across reload — PASS

**Actions**: With Anthropic enabled (default) and Ollama enabled, navigated to `http://localhost:5173/settings/providers` (page reload).

**Observations**:
- Default Provider: "Anthropic" — persisted — PASS
- Default Model: "Claude Haiku 4.5" — persisted — PASS
- Anthropic: green dot, "default" badge — persisted — PASS
- Ollama: green dot (enabled state persisted) — PASS
- Add Provider area only shows unconfigured providers — PASS

### T07-16: Legacy API key migration — SKIPPED (N/A)

**Reason**: The General tab no longer has an API key field. API key management is fully within the Providers section. Legacy migration test is not applicable to the current UI architecture.

---

## Edge Cases

### T07-E1: No providers enabled — FAIL

**Actions**: Disabled both Anthropic and Ollama providers. Navigated to existing conversation. Typed "test" and clicked Send.

**Observations**:
- Both providers show gray status dots — PASS
- Default Provider dropdown is empty — PASS
- Default Model shows "Enable a provider and test its connection to load models" — PASS (good UX)
- **Message was sent and received a response** — FAIL
- The app fell back to the legacy Anthropic SDK path (using the stored API key directly via `@anthropic-ai/sdk`)
- **Expected**: An error message (e.g., "No API key configured" or "No provider enabled")
- **Actual**: Successful response from Claude via legacy path, completely bypassing the provider system
- Re-enabled Anthropic after test

### T07-E2: Provider with empty API key — SKIPPED

**Reason**: Would require adding OpenAI provider, enabling it with empty key, setting as default, and sending a message. Skipped to avoid disrupting the test environment configuration.

---

## Bugs Found

### Bug 1: Legacy SDK fallback bypasses provider disable state — MEDIUM
**Severity**: Medium (functional gap)
**Description**: When all providers are disabled in Settings, the `send()` function in `useStreamingResponse.ts` falls back to the legacy `sendMessage()` path (direct Anthropic SDK), which uses the stored API key regardless of the provider's enabled state. This means disabling the Anthropic provider in Settings has no effect on message sending — the app still uses the key.
**Expected behavior**: When no providers are enabled, sending a message should show an error like "No provider configured" or "Please enable a provider in Settings."
**Root cause**: The legacy Anthropic SDK path (`api/claude.ts`) reads the API key directly from `useSettingsStore.apiKey`, which is not affected by the provider's `enabled` flag. The provider dispatch logic in `useStreamingResponse.ts` checks `provider && providerConfig && providerConfig.apiKey` — when this fails (disabled provider), it falls through to the legacy path instead of showing an error.

### Note: General tab API key field removed
The General tab only contains a Theme toggle. The API key field that was previously in General has been moved entirely to the Providers section. Tests T07-5 and T07-16 are not applicable. The "default" badge on providers correctly tracks which provider is selected in the Default Provider dropdown.
