# Feature 05 — Web Search Tool Test Plan

Tests for the web search tool feature: backend search endpoint, chat input toggle, settings page, tool call display in tree/thread/detail views, and provider tool_use integration. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up -V` and accessible at `localhost:5173`
2. Backend API is running at `localhost:3001` (comes up with docker compose)
3. Chrome MCP tab group is initialized (`tabs_context_mcp`)
4. A new tab is created and navigated to `http://localhost:5173`
5. An Anthropic API key has been configured in Settings > Providers (needed for tool_use streaming tests)

---

## Section 1 — Settings: Search Tab

### T1-1: Search tab exists in Settings

1. Navigate to `http://localhost:5173/settings`
2. Take a screenshot of the settings page
3. **Verify**: The left sidebar navigation shows a "Search" tab between "Prompts" and "Pricing"

### T1-2: Search tab shows provider dropdown and API key fields

1. Click the "Search" tab in the Settings sidebar
2. Take a screenshot
3. **Verify**: A "Default Search Provider" dropdown is visible with "DuckDuckGo (no API key required)" as an option
4. **Verify**: A "Tavily API Key" password input field is visible
5. **Verify**: A "Bing API Key" password input field is visible
6. **Verify**: Helper text below provider dropdown mentions DuckDuckGo doesn't need a key

### T1-3: Default search provider selection persists

1. In the Search settings tab, change the "Default Search Provider" dropdown to "Tavily"
2. Navigate away from Settings (click the back arrow)
3. Navigate back to `http://localhost:5173/settings/search`
4. **Verify**: The dropdown still shows "Tavily" as selected
5. Change it back to "DuckDuckGo (no API key required)" for subsequent tests

### T1-4: Tavily API key field saves on input

1. In the Search settings tab, click the "Tavily API Key" input
2. Type `tvly-test-key-123`
3. Click outside the input (blur)
4. Navigate away and back to `http://localhost:5173/settings/search`
5. **Verify**: The Tavily field shows dots (password masked) indicating the value was saved
6. Clear the field for subsequent tests

### T1-5: Bing API key field saves on input

1. In the Search settings tab, click the "Bing API Key" input
2. Type `bing-test-key-456`
3. Click outside the input (blur)
4. Navigate away and back to `http://localhost:5173/settings/search`
5. **Verify**: The Bing field shows dots (password masked) indicating the value was saved
6. Clear the field for subsequent tests

---

## Section 2 — Chat Input: Search Toggle

### T2-1: Web search toggle is visible

1. Navigate to `http://localhost:5173`
2. Create a new conversation by clicking the "+" button in the sidebar
3. Take a screenshot of the chat input area at the bottom
4. **Verify**: A "Web search" button with a globe icon is visible above the message textarea
5. **Verify**: The button appears in a muted/inactive style (gray-ish background)

### T2-2: Web search toggle activates with green highlight

1. In a conversation, click the "Web search" button
2. Take a screenshot
3. **Verify**: The button now has a green/emerald highlight (green-tinted background, green text)
4. **Verify**: A provider dropdown appears next to the button showing "DuckDuckGo"

### T2-3: Web search toggle deactivates

1. With web search enabled (green), click the "Web search" button again
2. Take a screenshot
3. **Verify**: The button returns to its inactive/muted style
4. **Verify**: The provider dropdown disappears

### T2-4: Provider dropdown only shows DuckDuckGo by default

1. Enable web search by clicking the toggle
2. Click the provider dropdown next to the toggle
3. Take a screenshot
4. **Verify**: Only "DuckDuckGo" appears as an option (Tavily and Bing require API keys to appear)

### T2-5: Provider dropdown shows Tavily when API key is set

1. Navigate to `http://localhost:5173/settings/search`
2. Enter `tvly-test-key` in the Tavily API Key field and blur
3. Navigate back to a conversation
4. Enable web search by clicking the toggle
5. Click the provider dropdown
6. **Verify**: Both "DuckDuckGo" and "Tavily" appear as options
7. Clean up: go back to settings and clear the Tavily key

### T2-6: Web search toggle disabled when backend is unavailable

1. Stop the backend: note this test requires the backend to be down. If you cannot stop it, **SKIP** this test.
2. Reload the page
3. Look at the "Web search" button
4. **Verify**: The button appears with reduced opacity (opacity-40) and cursor-not-allowed
5. **Verify**: Hovering shows title "Backend required for web search"
6. Restart the backend for remaining tests

### T2-7: Web search enabled state persists per conversation

1. Create a new conversation (call it Conv A)
2. Enable web search in Conv A
3. Create another new conversation (call it Conv B)
4. **Verify**: Web search toggle in Conv B is OFF (default state)
5. Switch back to Conv A
6. **Verify**: Web search toggle is still ON (green)

### T2-8: Provider warning for non-tool-supporting providers

1. In Settings > Providers, if any provider other than Anthropic/OpenAI is set as default (e.g., Gemini or Ollama), set it as default provider
2. Go to a conversation and enable web search
3. **Verify**: An amber warning message appears: "[Provider name] doesn't support tools"
4. If you changed the default provider, change it back to Anthropic for remaining tests

---

## Section 3 — Backend Search Endpoint

These tests use the browser's developer tools or JavaScript execution to verify the backend.

### T3-1: Backend search endpoint responds

1. In the browser console (via `javascript_tool`), run:
   ```js
   fetch('http://localhost:3001/api/search', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ provider: 'duckduckgo', query: 'python programming' })
   }).then(r => r.json()).then(d => JSON.stringify({ count: d.results?.length, provider: d.provider, hasResults: d.results?.length > 0 }))
   ```
2. Read the console output
3. **Verify**: The response contains `provider: "duckduckgo"` and `hasResults: true`
4. **Verify**: At least 1 result is returned (Instant Answer API fallback if scrape fails)

### T3-2: Backend returns error for missing API key

1. Run in browser console:
   ```js
   fetch('http://localhost:3001/api/search', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ provider: 'tavily', query: 'test' })
   }).then(r => r.json()).then(d => JSON.stringify(d))
   ```
2. **Verify**: Response contains `error` field mentioning "API key required for Tavily"

### T3-3: Backend returns error for unknown provider

1. Run in browser console:
   ```js
   fetch('http://localhost:3001/api/search', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ provider: 'nonexistent', query: 'test' })
   }).then(r => r.json()).then(d => JSON.stringify(d))
   ```
2. **Verify**: Response contains `error` field mentioning "Unknown search provider: nonexistent"

---

## Section 4 — End-to-End: Search Execution & Tool Call Display

These tests require a valid Anthropic API key configured. They send actual messages that trigger web search tool_use.

### T4-1: Send message with web search enabled — search executes

1. Create a new conversation
2. Enable web search (click the "Web search" toggle — it should turn green)
3. Ensure provider is set to DuckDuckGo
4. Type the message: `What is the current population of Tokyo?` and press Enter
5. Wait for the response to finish streaming (the streaming dots disappear and final text appears)
6. **Verify**: The assistant response contains information that appears to be sourced from a web search (mentions specific numbers or recent data)
7. Monitor the network tab or check the backend logs — **Verify**: A POST request was made to `http://localhost:3001/api/search`

### T4-2: Tree view shows green globe badge on assistant node

1. After T4-1 completes, switch to Tree view if not already there (click the tree icon in the view mode switcher)
2. Take a screenshot of the tree
3. Find the assistant node that just responded
4. **Verify**: The assistant node has a small green badge with a globe icon, indicating tool calls were made
5. Zoom into the badge area for confirmation

### T4-3: Thread view shows collapsible search block

1. Switch to Thread view (click the thread/chat icon in the view mode switcher)
2. Take a screenshot
3. Find the assistant message that used web search
4. **Verify**: Above the message content, there is a collapsible section with a green globe icon showing text like `Searched: "current population of Tokyo"` (or similar query text)
5. Click the collapsible section header to expand it
6. Take a screenshot
7. **Verify**: The expanded section shows search results with titles, URLs, and snippets

### T4-4: Node detail panel shows Tool Calls section

1. Switch to Tree view
2. Click the assistant node that used web search to select it
3. Look at the detail panel on the right
4. Take a screenshot
5. **Verify**: A "Tool Calls" section with a green globe icon is visible, showing a count badge (e.g., "1")
6. Click the "Tool Calls" section header to expand it
7. **Verify**: The expanded section shows: tool name (web_search), input (the query), and result (the search results text)

### T4-5: Conversation without web search does not trigger tool_use

1. Create a new conversation (web search toggle should be OFF by default)
2. Send the message: `Tell me a joke`
3. Wait for the response
4. **Verify**: The assistant response appears normally without any search-related badges or collapsible blocks
5. **Verify**: No globe badge appears on the assistant node in tree view

### T4-6: Multiple searches in one turn display correctly

1. Create a new conversation, enable web search
2. Send a message that is likely to trigger multiple searches, e.g.: `Compare the current weather in London vs Tokyo and tell me which is warmer right now`
3. Wait for the response to complete
4. Check the thread view
5. **Verify**: If the model made multiple search calls, the collapsible block shows "N web searches" (where N > 1). If only one search was made, verify the single search is displayed correctly.
6. In the detail panel, expand Tool Calls
7. **Verify**: All tool calls are listed with their individual queries and results

---

## Section 5 — Theme Adaptation

### T5-1: Search toggle adapts to dark mode

1. Switch to Dark mode via Settings > General > Dark
2. Navigate to a conversation
3. Take a screenshot of the chat input area
4. **Verify**: The "Web search" button is visible and readable in dark mode
5. Enable web search
6. **Verify**: The green/emerald highlight is visible in dark mode (emerald-400 text)

### T5-2: Tool call badges visible in dark mode

1. In Dark mode, view a conversation that has tool call data (from Section 4 tests)
2. Take a screenshot of the tree view
3. **Verify**: The green globe badge on assistant nodes is visible against the dark node background
4. Switch to thread view
5. **Verify**: The collapsible search block header text (green) is readable against the dark message background

### T5-3: Search settings readable in dark mode

1. In Dark mode, navigate to `http://localhost:5173/settings/search`
2. Take a screenshot
3. **Verify**: All labels, inputs, and helper text are readable
4. **Verify**: Input fields have dark backgrounds with visible borders
5. Switch back to Light mode for cleanliness

---

## Section 6 — Edge Cases & Error Handling

### T6-1: Cancel during search-in-progress

1. Create a new conversation, enable web search
2. Send a message that will trigger a search: `What happened in the news today?`
3. Immediately click the red cancel button (X icon) while the response is streaming
4. **Verify**: The streaming stops
5. **Verify**: The app does not crash or show an error state
6. **Verify**: The partially completed text (if any) remains visible in the node

### T6-2: Web search with no backend shows error gracefully

1. This test requires stopping the backend temporarily. If you cannot stop the backend, **SKIP** this test.
2. Stop the backend container
3. In a conversation with web search enabled, send a message
4. **Verify**: The response includes an error message (from the provider or from the search failing), not a crash
5. Restart the backend

### T6-3: Switching conversations preserves independent search state

1. Create Conv A, enable web search, set provider to DuckDuckGo
2. Create Conv B, leave web search disabled
3. Switch to Conv A — **Verify**: web search is ON
4. Switch to Conv B — **Verify**: web search is OFF
5. Switch back to Conv A — **Verify**: web search is still ON

---

## Summary

| Section | Tests | Description |
|---------|-------|-------------|
| 1 — Settings | T1-1 to T1-5 | Search tab UI, provider/key persistence |
| 2 — Chat Toggle | T2-1 to T2-8 | Search toggle behavior, provider selector, state |
| 3 — Backend | T3-1 to T3-3 | Search endpoint responses and error handling |
| 4 — E2E Display | T4-1 to T4-6 | Full search flow, tool call display in all views |
| 5 — Theme | T5-1 to T5-3 | Dark mode adaptation for all search UI |
| 6 — Edge Cases | T6-1 to T6-3 | Cancel, error handling, state isolation |
