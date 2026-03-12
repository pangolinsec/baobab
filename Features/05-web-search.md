# 05 — Web Search Tool

## Summary

Give Claude (and other models via feature 07) the ability to search the web during conversations. Implemented via the Claude API's `tool_use` feature — the model requests a search, the app executes it through the backend, and returns results. Supports DuckDuckGo (no key required), Tavily, and Bing as search providers. Toggleable per-conversation.

## Priority

Tier 3 — requires backend (feature 00).

## Dependencies

- **00 Backend Architecture**: search requests route through the backend API to avoid CORS.
- **07 Inference Providers**: tool_use support varies by provider; the tool definition needs to be provider-agnostic.

## Data Model Changes

### `Conversation` (types/index.ts)

```typescript
interface Conversation {
  // ... existing fields
  webSearchEnabled: boolean;        // default false
  searchProvider: 'duckduckgo' | 'tavily' | 'bing';  // default 'duckduckgo'
}
```

### `AppSettings` (types/index.ts)

```typescript
interface AppSettings {
  // ... existing fields
  tavilyApiKey?: string;
  bingApiKey?: string;
  defaultSearchProvider: 'duckduckgo' | 'tavily' | 'bing';
}
```

### `TreeNode` (types/index.ts)

Tool calls are stored as metadata on the **assistant node** that made them, not as separate tree nodes. See ADR-001 Decision 2. `MessageRole` stays as `'user' | 'assistant'`.

```typescript
interface TreeNode {
  // ... existing fields
  toolCalls?: Array<{
    toolName: string;
    input: Record<string, unknown>;
    result?: string;
  }>;
}
```

## Tool Definition

The search tool presented to the model:

```typescript
const webSearchTool = {
  name: 'web_search',
  description: 'Search the web for current information. Use this when you need up-to-date facts, recent events, or information you are uncertain about.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return (1-10, default 5)',
      },
    },
    required: ['query'],
  },
};
```

## Tool Use Flow

1. User sends a message with web search enabled for the conversation.
2. The `sendMessage` call includes `tools: [webSearchTool]` in the API request.
3. If the model responds with a `tool_use` content block:
   a. Extract the tool name and input.
   b. Call the backend: `POST /api/search` with the query and provider.
   c. Send a follow-up API call with the `tool_result` content block containing the search results.
   d. The model then produces its final text response incorporating the search results.
   e. Create the assistant node with the final response. The `toolCalls` array on this node stores all tool invocations that occurred during this turn:
      ```typescript
      assistantNode.toolCalls = [
        { toolName: 'web_search', input: { query: 'latest climate report' }, result: '...' },
      ];
      ```
4. Tool calls are NOT separate tree nodes. They are displayed as colored **nodules** on the side of the assistant node (see "Tool Use Display" below).

## Backend Endpoints

### `POST /api/search`

```typescript
interface SearchRequest {
  provider: 'duckduckgo' | 'tavily' | 'bing';
  query: string;
  numResults?: number;  // default 5
  apiKey?: string;      // for tavily/bing — passed from frontend settings
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  isInstantAnswer?: boolean;  // true for DDG Instant Answer API results (ADR-014)
}

interface SearchResponse {
  results: SearchResult[];
  provider: string;
  query: string;
}
```

### Provider Implementations

**DuckDuckGo** (`server/src/services/search/duckduckgo.ts`):
- Uses two sources in parallel (see ADR-014):
  1. `duck-duck-scrape` npm package for full web search results (titles, URLs, snippets). Scrapes DDG HTML — no API key required but inherently fragile.
  2. DDG Instant Answer API (`GET https://api.duckduckgo.com/?q=...&format=json`) for structured knowledge-graph responses (Wikipedia abstracts, definitions). Stable official endpoint, no key required.
- Instant Answer abstract (if present) is prepended as a "Direct Answer" entry to the search results.
- If scraping fails, falls back to Instant Answer API results alone.
- No API key required.

**Tavily** (`server/src/services/search/tavily.ts`):
- `POST https://api.tavily.com/search` with the Tavily API key.
- Returns structured search results with relevance scores.

**Bing** (`server/src/services/search/bing.ts`):
- `GET https://api.bing.microsoft.com/v7.0/search` with `Ocp-Apim-Subscription-Key` header.
- Returns structured web search results.

## UI — Search Toggle

### Per-Conversation Toggle

In the chat input area or a conversation header bar, a small toggle:

```
🔍 Web Search [on/off]   Provider: [DuckDuckGo ▾]
```

- When on, the search tool is included in API calls.
- Provider selector only shows providers that have valid API keys configured (DuckDuckGo always available).

### Settings — Search API Keys

In the Settings dialog, below the Anthropic API key:

```
Search Providers
  Default Provider: [DuckDuckGo ▾]

  Tavily API Key
  [                           ]

  Bing API Key
  [                           ]
```

### Tool Use Display in Tree

Tool calls appear as **colored nodules** on the side of the assistant message node that made them, not as separate tree nodes. See ADR-001 Decision 2.

- A small **green circle/badge** on the left or right edge of the assistant node indicates tool use occurred.
- The number of tool calls is shown if more than one (e.g., a badge with "3").
- **Clicking the nodule** expands a panel/popover showing the tool call details: tool name, input query, and search results (titles, URLs, snippets).
- **Clicking again** (or clicking elsewhere) collapses it.
- In the **detail panel**, when the assistant node is selected, tool calls are shown in a collapsible "Tool Use" section with full details.

### Tool Use Display in Thread View (feature 21)

In thread/chat view, tool use appears as a collapsible inline block:

```
┌─ 🔍 Searched: "latest climate report 2026" ────┐
│ ▶ 5 results (click to expand)                   │
└─────────────────────────────────────────────────┘
```

## Multi-Turn Tool Use

The model may request multiple searches in a single response (sequential tool calls). The flow handles this by looping:

1. Send message with tools.
2. If response contains `tool_use` → execute tool → send `tool_result` → repeat.
3. When response contains only `text` → done, finalize the assistant node.

All tool calls from a single turn are stored in the `toolCalls` array on the final assistant node. Each entry records the tool name, input, and result.

## Error Handling

- If the backend is unavailable, the search toggle is disabled with a tooltip: "Backend required for web search."
- If a search fails (network error, rate limit), the tool result returns an error message that the model can handle gracefully.
- API key validation for Tavily/Bing happens in Settings (like the Anthropic key validation).

## Browser-Only Mode

Web search is entirely disabled in the browser-only build. The toggle is hidden.
