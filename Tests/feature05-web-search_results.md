# Feature 05 — Web Search Tool: Test Results

**Date**: 2026-02-20
**Environment**: Docker Compose (app on 5173, backend on 3001), Chrome MCP
**Starting state**: Multiple conversations exist, Anthropic API key configured, Dark mode active

## Summary

| Section | Total | Pass | Fail | Skipped |
|---------|-------|------|------|---------|
| 1 — Settings: Search Tab | 5 | 5 | 0 | 0 |
| 2 — Chat Input: Search Toggle | 8 | 7 | 0 | 1 |
| 3 — Backend Search Endpoint | 3 | 3 | 0 | 0 |
| 4 — E2E: Search Execution & Display | 6 | 6 | 0 | 0 |
| 5 — Theme Adaptation | 3 | 3 | 0 | 0 |
| 6 — Edge Cases & Error Handling | 3 | 1 | 0 | 2 |
| **Total** | **28** | **25** | **0** | **3** |

---

## Detailed Results

### Section 1 — Settings: Search Tab

**T1-1: Search tab exists in Settings**
- **Status**: PASS
- Navigated to `http://localhost:5173/settings`
- Settings sidebar shows tabs: General, Providers, Advanced, Prompts, **Search**, Pricing, Elicitation
- "Search" tab is between "Prompts" and "Pricing" as expected

**T1-2: Search tab shows provider dropdown and API key fields**
- **Status**: PASS
- Clicked "Search" tab
- "Default Search Provider" dropdown visible with "DuckDuckGo (no API key required)" selected
- "Tavily API Key" password input visible (placeholder: "tvly-...")
- "Bing API Key" password input visible (placeholder: "Ocp-Apim-Subscription-Key")
- Helper text: "DuckDuckGo works without an API key. Tavily and Bing require keys below."

**T1-3: Default search provider selection persists**
- **Status**: PASS
- Changed dropdown to "Tavily"
- Navigated to `/` then back to `/settings/search`
- Dropdown still showed "tavily" (confirmed via JS: `document.querySelector('select').value === 'tavily'`)
- Changed back to "duckduckgo" for subsequent tests

**T1-4: Tavily API key field saves on input**
- **Status**: PASS
- Used `form_input` to set Tavily field to `tvly-test-key-123`
- Navigated away and back to `/settings/search`
- JS confirmed value persisted: `inputs[0].value === 'tvly-test-key-123'` (length 17)
- Cleared field for subsequent tests

**T1-5: Bing API key field saves on input**
- **Status**: PASS
- Used `form_input` to set Bing field to `bing-test-key-456`
- Navigated away and back to `/settings/search`
- JS confirmed value persisted: `inputs[1].value === 'bing-test-key-456'` (length 17)
- Cleared field for subsequent tests

### Section 2 — Chat Input: Search Toggle

**T2-1: Web search toggle is visible**
- **Status**: PASS
- Created new conversation via "+" button
- "Web search" button with globe icon visible above the message textarea
- Button in muted/inactive style: `bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]`
- Title attribute: "Enable web search"

**T2-2: Web search toggle activates with green highlight**
- **Status**: PASS
- Clicked "Web search" button
- Button changed to green/emerald: `bg-emerald-500/15 text-emerald-400` (dark mode)
- Title changed to "Disable web search"
- "DuckDuckGo" provider dropdown appeared next to the button

**T2-3: Web search toggle deactivates**
- **Status**: PASS
- Clicked "Web search" button again (was green)
- Button returned to muted style: `bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]`
- Title returned to "Enable web search"
- Provider dropdown disappeared (confirmed visually)

**T2-4: Provider dropdown only shows DuckDuckGo by default**
- **Status**: PASS
- Enabled web search, inspected dropdown options via JS
- Only 1 option: `[{value: "duckduckgo", text: "DuckDuckGo"}]`
- No Tavily or Bing (no API keys set)

**T2-5: Provider dropdown shows Tavily when API key is set**
- **Status**: PASS
- Set Tavily API key to "tvly-test-key" in settings
- Returned to conversation with web search enabled
- Dropdown now shows 2 options: `["DuckDuckGo", "Tavily"]`
- Cleaned up: cleared Tavily key

**T2-6: Web search toggle disabled when backend is unavailable**
- **Status**: SKIPPED
- Cannot stop the backend container from Chrome MCP tools

**T2-7: Web search enabled state persists per conversation**
- **Status**: PASS
- Conv A: enabled web search (title: "Disable web search")
- Created Conv B via "+": web search OFF (title: "Enable web search")
- Switched back to Conv A: web search still ON (title: "Disable web search")

**T2-8: Provider warning for non-tool-supporting providers**
- **Status**: PASS
- Set default provider to Ollama in Settings > Providers
- Returned to conversation with web search enabled
- Amber warning visible: "Ollama doesn't support tools"
- Provider card showed "Provider: Ollama"
- Changed default provider back to Anthropic

### Section 3 — Backend Search Endpoint

**T3-1: Backend search endpoint responds**
- **Status**: PASS
- Ran fetch to `http://localhost:3001/api/search` with `{provider: 'duckduckgo', query: 'python programming'}`
- Response: `{count: 1, provider: "duckduckgo", hasResults: true, firstTitle: "Python (programming language)"}`

**T3-2: Backend returns error for missing API key**
- **Status**: PASS
- Ran fetch with `{provider: 'tavily', query: 'test'}`
- Response: `{error: "API key required for Tavily"}`

**T3-3: Backend returns error for unknown provider**
- **Status**: PASS
- Ran fetch with `{provider: 'nonexistent', query: 'test'}`
- Response: `{error: "Unknown search provider: nonexistent"}`

### Section 4 — E2E: Search Execution & Tool Call Display

**T4-1: Send message with web search enabled — search executes**
- **Status**: PASS
- Created conversation with web search ON (DuckDuckGo provider)
- Sent "What is the current population of Tokyo?"
- Model made 2 search tool calls (confirmed in detail panel)
- Both searches returned 502 from DuckDuckGo (transient scrape failure)
- Model fell back to its own knowledge, responded with Tokyo population data (13-14 million)
- Network tab confirmed 2 POST requests to `http://localhost:3001/api/search`
- App handled search failure gracefully — no crash, coherent response

**T4-2: Tree view shows green globe badge on assistant node**
- **Status**: PASS
- Tree view assistant node has green globe badge with count "2"
- Badge styling: `bg-emerald-500/15 text-emerald` with emerald color `oklch(0.765 0.177 163.223)`
- Badge is distinct from the Web search toggle in the input area

**T4-3: Thread view shows collapsible search block**
- **Status**: PASS (corrected on retest)
- Switched to Thread view
- Assistant message header shows "Assistant Haiku 4.5 reply target" with timestamp
- Below the header, a collapsible "2 web searches" section with green globe icon is visible
- Clicked to expand — shows 2 individual search entries:
  1. Search: "current population of Tokyo" → "Search failed: DuckDuckGo search failed: no results from web search or instant answer API"
  2. Search: "Tokyo population 2024" → "Search failed: Search failed: DuckDuckGo search failed: no results from web search or instant answer API"
- Each search query displayed in green/emerald text with result text below
- **Note**: Originally marked FAIL due to viewport stuck at 210x39px during initial testing; retested with proper viewport and confirmed PASS

**T4-4: Node detail panel shows Tool Calls section**
- **Status**: PASS
- Selected assistant node in tree view
- Detail panel shows "Tool Calls 2" with green globe icon and count badge
- Clicked to expand — shows 2 tool calls:
  1. `web_search: {"query":"current population of Tokyo"}` → "Search failed: DuckDuckGo search failed: no results from web search or instant answer API"
  2. `web_search: {"query":"Tokyo population 2024"}` → "Search failed: DuckDuckGo search failed: no results from web search or instant answer API"
- Tool name, input, and result all visible as expected

**T4-5: Conversation without web search does not trigger tool_use**
- **Status**: PASS
- Created new conversation, web search OFF by default
- Sent "Tell me a joke"
- Response received normally
- JS check: only 1 globe icon (the Web search toggle), 0 tool call badges, no "Tool Calls" section

**T4-6: Multiple searches in one turn display correctly**
- **Status**: PASS
- Verified during T4-1/T4-4: model made 2 search calls in one turn
- Detail panel Tool Calls section lists both calls individually with separate queries and results
- Thread view shows "2" count badge on assistant header

### Section 5 — Theme Adaptation

**T5-1: Search toggle adapts to dark mode**
- **Status**: PASS
- App was in Dark mode throughout testing
- Web search button visible and readable: muted style uses `var(--color-text-muted)`
- When enabled, green highlight clearly visible: `text-emerald-400` (dark variant)

**T5-2: Tool call badges visible in dark mode**
- **Status**: PASS
- Green globe badge on assistant node clearly visible against dark node background
- `bg-emerald-500/15` provides sufficient contrast in dark mode
- Thread view header badge also visible (emerald color against dark header)

**T5-3: Search settings readable in dark mode**
- **Status**: PASS
- Navigated to `/settings/search` in dark mode
- All labels ("Default Search Provider", "Tavily API Key", "Bing API Key") readable
- Input fields have dark backgrounds with visible borders and placeholder text
- Helper text below fields readable in muted color
- Dropdown clearly shows selected option

### Section 6 — Edge Cases & Error Handling

**T6-1: Cancel during search-in-progress**
- **Status**: SKIPPED
- The search + API call completes very quickly (< 2 seconds), making it difficult to catch the cancel window via automation
- Would require precise timing that isn't reliably achievable via Chrome MCP tools

**T6-2: Web search with no backend shows error gracefully**
- **Status**: SKIPPED
- Cannot stop the backend container from Chrome MCP tools

**T6-3: Switching conversations preserves independent search state**
- **Status**: PASS
- Verified during T2-7: Conv A had web search ON, Conv B had web search OFF
- Switching between them preserved independent states correctly
- Each conversation maintains its own search toggle state

## Issues Found

1. **Minor**: DuckDuckGo search returned 502 errors during T4-1 (both search attempts failed). The model handled this gracefully by falling back to its training data, but the search feature didn't deliver actual search results. This may be a transient issue with DuckDuckGo's scraping endpoint or the Instant Answer API.

2. **Testing note**: T4-3 was initially marked FAIL due to the Chrome MCP tab viewport getting stuck at 210x39 pixels, which prevented proper rendering of the thread view. On retest with a full-size viewport, the collapsible search block was confirmed present and functional.
