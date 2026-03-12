# Provider Bugfixes — Browser-Based Test Plan

Tests for the 6 provider bugfixes implemented in Feature 07b: SSE line buffering, OpenAI reasoning model compatibility, HuggingFace model discovery & validation, OpenRouter model limit, registry heuristics, and shared SSE parser integration. All tests are designed to be executed by Claude Code using Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. An Anthropic API key has been configured in Settings (for baseline streaming tests)
5. At least one conversation exists with a few nodes (user + assistant messages)

**Provider-specific prerequisites** (needed for subset of tests):
- Tests marked **[OpenAI]** require an OpenAI API key
- Tests marked **[Ollama]** require Ollama running locally on port 11434
- Tests marked **[No-key]** can be run without any external provider keys — they test UI behavior and code paths that don't require live API calls

---

## Section 1 — SSE Parser Integration (Bug 1)

These tests verify that the shared SSE parser is correctly integrated and streaming works end-to-end. The underlying line-buffering fix is a code-level change that prevents token drops on slow connections; these tests verify the streaming path still works correctly after the refactor.

### T1-1: Anthropic streaming still works (regression check) [No-key: requires Anthropic key]

1. Ensure Anthropic is the default provider in Settings > Providers
2. Create a new conversation or use an existing one
3. Type "Write a short paragraph about the weather" and click Send
4. Watch the assistant response stream in
5. **Verify**: Text appears incrementally (word by word or chunk by chunk), not all at once
6. **Verify**: The final response is coherent — no missing words or garbled text
7. **Verify**: The streaming indicator (pulsing dot or similar) shows during streaming and disappears when complete

### T1-2: Streaming completes and node finalizes [No-key: requires Anthropic key]

1. Send a message: "Count from 1 to 20, each number on its own line"
2. Wait for the response to fully complete
3. Click the assistant response node in the tree view
4. **Verify**: The NodeDetailPanel shows the complete response with all 20 numbers
5. **Verify**: The node is not stuck in a "streaming" state — no spinner or loading indicator remains

### T1-3: Cancel mid-stream works [No-key: requires Anthropic key]

1. Send a message: "Write a very long story about a dragon, at least 500 words"
2. While the response is streaming (after a few words appear), click the Stop button
3. **Verify**: Streaming stops — no more text appears
4. **Verify**: The partial response is preserved in the node (not empty, not corrupted)
5. **Verify**: The app is responsive — you can send another message or click other nodes

---

## Section 2 — OpenAI Reasoning Model Compatibility (Bug 2)

### T2-1: OpenAI provider setup [OpenAI]

1. Open Settings (gear icon)
2. Navigate to the Providers tab/section
3. If OpenAI is not already configured, click the "OpenAI" button in the "Add Provider" area
4. Enter a valid OpenAI API key in the API Key field
5. Toggle the Enable switch to ON
6. Click "Test Connection"
7. **Verify**: A success message appears showing the number of available models (e.g., "X models available")
8. **Verify**: The model count includes both GPT and o-series models

### T2-2: GPT model works with all parameters [OpenAI]

1. Ensure OpenAI is enabled in Settings > Providers
2. Close Settings
3. In the model selector dropdown, select a GPT model (e.g., `gpt-4o-mini` or `gpt-3.5-turbo`) from the OpenAI optgroup
4. Type "What is 2+2?" and send
5. **Verify**: The response streams in without errors
6. **Verify**: The response is coherent (answers "4" or similar)

### T2-3: Selecting an o1/o3 model does not crash [OpenAI]

1. Open the model selector dropdown
2. Look for models starting with `o1-` or `o3-` in the OpenAI optgroup
3. If an o1 or o3 model is available, select it
4. Type "What is the capital of France?" and send
5. **Verify**: The response streams in without an error toast or error message
6. **Verify**: The response is correct ("Paris")
7. **Verify**: No red error text appears in the chat area or console

### T2-4: System prompt handled for reasoning models [OpenAI]

1. Open Settings and set a system prompt (e.g., "You are a helpful pirate. Always respond in pirate speak.")
2. Select an o1-mini or o3-mini model (if available)
3. Send a message: "Tell me about the ocean"
4. **Verify**: The response does not produce an API error about "system role not supported"
5. **Verify**: The system prompt influence is visible in the response (pirate-themed language)

---

## Section 3 — HuggingFace Model Discovery & Validation (Bugs 3 & 6)

### T3-1: HuggingFace provider can be added and tested [No-key: UI only]

1. Open Settings > Providers
2. Click the "HuggingFace" button in the "Add Provider" area (if not already added)
3. **Verify**: A HuggingFace provider entry appears with Enable toggle, API Key field, and Test Connection button
4. Enter an invalid API key (e.g., "invalid-key-12345")
5. Toggle Enable ON
6. Click "Test Connection"
7. **Verify**: An error message appears (connection failed or similar)
8. **Verify**: The app does not crash

### T3-2: HuggingFace valid key shows available models [HuggingFace key required]

1. Open Settings > Providers > HuggingFace
2. Enter a valid HuggingFace API token
3. Toggle Enable ON
4. Click "Test Connection"
5. **Verify**: Success message shows with a model count > 0
6. **Verify**: The count may be less than the full curated list (some models may be unavailable)
7. Close Settings
8. Open the model selector dropdown
9. **Verify**: A "HuggingFace" optgroup appears with model names like "Llama-3.3-70B-Instruct", "Mistral-7B-Instruct-v0.3", etc.

### T3-3: HuggingFace partial model availability [HuggingFace key required]

1. With HuggingFace enabled and key configured
2. Click "Test Connection" and note the model count
3. **Verify**: The count is at least 1 (at least one model from the curated list is available)
4. **Verify**: The count may be less than 6 (the total curated list size) — this is expected, as HuggingFace rotates model availability
5. Close Settings and check the model dropdown
6. **Verify**: Only available models appear in the HuggingFace optgroup — no "broken" models that would error on use

---

## Section 4 — OpenRouter Model Limit & Sorting (Bug 4)

### T4-1: OpenRouter shows sorted models [OpenRouter key required]

1. Open Settings > Providers
2. Add and configure OpenRouter with a valid API key
3. Toggle Enable ON
4. Click "Test Connection"
5. **Verify**: Success message shows a model count — it should be significantly more than 100 (up to 200)
6. Close Settings
7. Open the model selector dropdown
8. Scroll to the "OpenRouter" optgroup
9. **Verify**: Models are listed in alphabetical order by display name
10. **Verify**: Popular models like those from Anthropic, Meta, Mistral, etc. are present

### T4-2: OpenRouter model count exceeds old limit [OpenRouter key required]

1. With OpenRouter enabled, open the browser console
2. Run: `document.querySelectorAll('optgroup[label="OpenRouter"] option').length`
3. **Verify**: The count is greater than 100 (the old limit was 100; the new limit is 200)

---

## Section 5 — Provider Model Routing Heuristics (Bug 5)

### T5-1: Anthropic model selection routes correctly [No-key: requires Anthropic key]

1. Ensure Anthropic is enabled, other providers are disabled
2. Select a `claude-*` model from the model dropdown
3. Send a message: "Hello"
4. **Verify**: The message is sent successfully — no error about wrong provider
5. **Verify**: The response streams in from Anthropic

### T5-2: Model selector shows correct provider optgroups [No-key: UI check]

1. Open Settings > Providers
2. Enable at least two providers (e.g., Anthropic + Ollama, or Anthropic + OpenAI)
3. Close Settings
4. Open the model selector dropdown
5. **Verify**: Each enabled provider has its own optgroup label (e.g., "Anthropic", "Ollama")
6. **Verify**: Models are grouped under the correct provider name
7. **Verify**: The default provider's optgroup appears first

### T5-3: Ollama model with colon format works [Ollama]

1. Ensure Ollama is running locally and enabled in Settings
2. Open the model selector dropdown
3. Look for Ollama models (they use `name:tag` format, e.g., `llama3:latest`)
4. Select an Ollama model
5. Send a message: "Hello"
6. **Verify**: The message routes to Ollama and a response streams in
7. **Verify**: No error about the model not being found by the wrong provider

### T5-4: Switching between providers works [requires 2+ providers]

1. With at least two providers enabled (e.g., Anthropic and Ollama)
2. Select a model from provider A, send a message, verify it works
3. Select a model from provider B, send a message, verify it works
4. **Verify**: Each message was handled by the correct provider (check response style/content)
5. **Verify**: No errors during switching

---

## Section 6 — Provider Settings UI Robustness

### T6-1: Adding and removing providers [No-key]

1. Open Settings > Providers
2. Note which providers are currently configured
3. Click an unconfigured provider button (e.g., "Gemini") to add it
4. **Verify**: The provider appears in the list with Enable toggle OFF
5. **Verify**: API Key and Base URL fields are shown as appropriate for that provider
6. Toggle Enable ON without entering an API key
7. Close and reopen Settings
8. **Verify**: The provider is still listed and enabled (persisted)

### T6-2: Test Connection with no API key shows error [No-key]

1. Open Settings > Providers
2. Add a provider that requires an API key (e.g., OpenAI) if not already added
3. Leave the API Key field empty
4. Click "Test Connection"
5. **Verify**: An error message appears (not a success)
6. **Verify**: The app does not crash or hang

### T6-3: Default provider selector shows only enabled providers [No-key]

1. Open Settings > Providers
2. Enable two providers (e.g., Anthropic + Ollama)
3. Look at the Default Provider dropdown
4. **Verify**: Only the enabled providers appear as options
5. Disable one provider
6. **Verify**: The disabled provider is no longer in the Default Provider dropdown
7. **Verify**: If the disabled provider was the default, the default switches to another enabled provider

### T6-4: Provider settings persist across page reload [No-key]

1. Open Settings > Providers
2. Add and configure a provider (e.g., add Ollama with base URL `http://localhost:11434`)
3. Close Settings
4. Reload the page (F5 or navigate to `localhost:5173`)
5. Open Settings > Providers
6. **Verify**: The provider is still configured with the same settings (enabled state, base URL)

---

## Section 7 — Cross-Provider Streaming Smoke Tests

These tests verify end-to-end streaming for each available provider after the SSE refactor.

### T7-1: OpenAI streaming smoke test [OpenAI]

1. Select an OpenAI GPT model
2. Send "List 5 colors"
3. **Verify**: Response streams in incrementally
4. **Verify**: Response contains 5 colors when complete
5. **Verify**: No error messages appear

### T7-2: Ollama streaming smoke test [Ollama]

1. Select an Ollama model
2. Send "List 5 animals"
3. **Verify**: Response streams in incrementally
4. **Verify**: Response contains 5 animals when complete
5. **Verify**: No error messages appear

### T7-3: Multiple messages in sequence across providers [requires 2+ providers]

1. Select provider A's model, send a message, wait for completion
2. Select provider B's model, send a follow-up message, wait for completion
3. **Verify**: Both responses are in the conversation tree
4. **Verify**: The tree structure is correct (parent-child relationships intact)
5. **Verify**: Clicking each node shows the correct content in the detail panel

### T7-4: Branching works with non-Anthropic providers [requires non-Anthropic provider]

1. With a non-Anthropic provider model selected
2. Send a message and wait for the response
3. Click the "Reply here" button on the root assistant node (not the latest response)
4. Send a different message
5. **Verify**: A branch is created in the tree — the root node now has two children
6. **Verify**: The second response streamed in correctly
7. **Verify**: Both branches are visible in the tree view

---

## Section 8 — Error Handling

### T8-1: Invalid API key shows clear error [No-key]

1. Open Settings > Providers
2. Add OpenAI (or another provider that requires a key)
3. Enter an obviously invalid API key (e.g., "bad-key")
4. Enable the provider and close Settings
5. Select a model from that provider
6. Send a message
7. **Verify**: An error message appears (e.g., "OpenAI error: 401 - ...")
8. **Verify**: The error is shown in the chat area, not silently swallowed
9. **Verify**: The app remains functional — you can switch to a different provider and send messages

### T8-2: Network error during streaming is handled [No-key]

1. Select a working provider and model
2. Open browser DevTools > Network tab
3. Send a long message that will generate a long response
4. While streaming, set the browser to Offline mode (DevTools > Network > Offline checkbox)
5. **Verify**: An error message appears or the stream stops gracefully
6. **Verify**: The app does not crash or freeze
7. Disable Offline mode
8. **Verify**: You can send new messages after reconnecting
