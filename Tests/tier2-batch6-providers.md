# Tier 2 Batch 6 — Inference Providers

Tests for Feature 07 (Multi-Provider Support). All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized
3. A new tab is created and navigated to `http://localhost:5173`
4. An Anthropic API key is available for configuration
5. (Optional) An OpenAI API key, OpenRouter API key, or local Ollama instance for multi-provider tests

**Note**: Most provider tests can be verified through the Settings UI without needing actual API keys for every provider. Tests that require sending messages are marked and can be skipped if only an Anthropic key is available.

---

## Feature 07 — Provider Settings UI

### T07-1: Providers section exists in Settings

1. Open Settings (gear icon in sidebar header)
2. Look at the left sidebar navigation within Settings
3. **Verify**: There are 4 navigation items: "General", "Providers", "Advanced", "Prompts"
4. Click "Providers"
5. Take a screenshot
6. **Verify**: The Providers section loads with an intro text: "Configure inference providers. The default provider is used for new conversations."

### T07-2: Default provider selector

1. In the Providers section, look for a "Default Provider" dropdown/select
2. **Verify**: It shows "Anthropic" as the selected default (or whichever provider is enabled)
3. **Verify**: Only enabled providers appear in the dropdown options

### T07-3: Anthropic provider accordion — default state

1. In the Providers section, look at the provider list
2. **Verify**: Anthropic is listed with a green status dot (emerald, indicating enabled)
3. **Verify**: A "default" badge appears next to the Anthropic name (since it's the default provider)
4. Click the Anthropic row to expand it

### T07-4: Anthropic provider — expanded panel

1. With the Anthropic accordion expanded, take a screenshot
2. **Verify**: An "Enabled" toggle is visible and turned on (accent color)
3. **Verify**: An "API Key" field is present with type="password" and placeholder "Enter Anthropic API key"
4. **Verify**: If an API key was previously configured (in General settings), it appears here (masked)

### T07-5: Configure Anthropic API key via provider panel

1. In the expanded Anthropic panel, enter or update the API key
2. Collapse the Anthropic accordion
3. Navigate to "General" in Settings
4. **Verify**: The API key in General settings matches (they are synced)

### T07-6: Add a new provider

1. Navigate back to "Providers" section
2. Below the provider list, look for an "Add Provider" area
3. **Verify**: Buttons are shown for unconfigured providers (e.g., "Ollama", "OpenAI", "OpenRouter", "Gemini", "HuggingFace") with Plus icons
4. Click on one of the add buttons (e.g., "Ollama")
5. Take a screenshot
6. **Verify**: The provider is added to the list above
7. **Verify**: The new provider shows with a gray status dot (disabled by default or enabled)
8. **Verify**: The "Add Provider" button for that provider disappears

### T07-7: Provider accordion — expand and configure

1. Click the newly added provider row to expand it
2. **Verify**: An "Enabled" toggle is present
3. **Verify**: Appropriate fields are shown:
   - For Ollama: "Base URL" field with placeholder "http://localhost:11434" (no API key required)
   - For OpenAI: "API Key" field with placeholder "Enter OpenAI API key"
   - For OpenRouter: "API Key" field
   - For Gemini: "API Key" field
   - For HuggingFace: "API Key" field

### T07-8: Enable/disable provider toggle

1. With a provider panel expanded, click the "Enabled" toggle to disable it
2. **Verify**: The toggle switches to off state (muted color)
3. **Verify**: The status dot changes from green to gray
4. **Verify**: If this provider was in the "Default Provider" dropdown, it is removed from available options
5. Re-enable the provider
6. **Verify**: Status dot returns to green, provider reappears in default dropdown

### T07-9: Collapse/expand provider accordion

1. With a provider expanded, click the row header again
2. **Verify**: The panel collapses (fields hidden)
3. **Verify**: The chevron icon changes direction (right when collapsed, down when expanded)
4. Click again to expand
5. **Verify**: The panel re-expands showing all fields

### T07-10: Multiple providers configured

1. Add at least 2 providers (e.g., Anthropic + Ollama)
2. Enable both
3. Take a screenshot of the Providers section
4. **Verify**: Both providers show green status dots
5. **Verify**: The "Default Provider" dropdown lists both enabled providers

### T07-11: Change default provider

1. With multiple providers enabled, change the "Default Provider" dropdown to a different provider
2. **Verify**: The "default" badge moves from the old provider to the new one
3. **Verify**: The dropdown selection persists after closing and reopening Settings

---

## Provider Integration — Sending Messages

### T07-12: Send message via Anthropic provider (requires Anthropic API key)

1. Ensure Anthropic is enabled and has a valid API key configured
2. Set Anthropic as the default provider
3. Close Settings
4. Create a new conversation
5. Send a message: "Hello, what model are you?"
6. **Verify**: The message streams in successfully
7. **Verify**: The response appears in the assistant node

### T07-13: Provider ID stored on nodes

1. After sending a message via T07-12, click the user node to select it
2. Examine the NodeDetailPanel
3. **Verify**: The node was created with the correct provider information (this may not be directly visible in the UI, but the node should function correctly)

### T07-14: Send message via Ollama provider (requires local Ollama)

**Skip if Ollama is not running locally.**

1. Add and enable the Ollama provider with base URL "http://localhost:11434"
2. Set Ollama as the default provider
3. Close Settings, create a new conversation
4. Send a message
5. **Verify**: The response streams in from the Ollama model
6. **Verify**: The conversation functions normally (branching, reply target, etc.)

---

## Provider Settings Persistence

### T07-15: Provider configuration persists across reload

1. Configure multiple providers (enable, set API keys, change default)
2. Reload the page (navigate to `http://localhost:5173`)
3. Open Settings → Providers
4. **Verify**: All provider configurations are preserved (enabled state, API keys, default provider)
5. **Verify**: The status dots and "default" badge are correct

### T07-16: Legacy API key migration

1. If a legacy API key was configured (in the General tab before providers existed), check the Providers section
2. **Verify**: The legacy API key has been synced to the Anthropic provider configuration
3. **Verify**: Both the General tab API key and the Anthropic provider API key show the same value

---

## Edge Cases

### T07-E1: No providers enabled

1. Disable all providers
2. Close Settings
3. Try to send a message
4. **Verify**: An error message appears (e.g., "Error: No API key configured" or similar)
5. Re-enable at least one provider with a valid API key

### T07-E2: Provider with empty API key

1. Add a provider that requires an API key (e.g., OpenAI)
2. Enable it but leave the API key field empty
3. Set it as default provider
4. Try to send a message
5. **Verify**: The app falls back gracefully — either uses the legacy path or shows an appropriate error
6. Reset default to a working provider
