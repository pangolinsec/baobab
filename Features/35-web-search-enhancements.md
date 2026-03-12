# 35 — Web Search Enhancements

## Summary

Extend the web search system (Feature 05) with additional search providers (SearXNG, Brave Search), citation tracking on assistant responses, and a `fetch_url` tool that retrieves and extracts text content from web pages. These enhancements bring Baobab's web research capabilities closer to parity with full-featured AI platforms.

## Priority

Tier 3 — extends existing backend infrastructure.

## Dependencies

- **00 Backend Architecture**: new search providers and URL fetching route through the backend.
- **05 Web Search Tool**: this feature extends 05's provider system, tool dispatch, and data model.

## Phasing

| Phase | Scope | Prerequisites | Status |
|-------|-------|---------------|--------|
| **A** | New search providers: SearXNG and Brave Search backend implementations. Settings UI for new provider API keys/endpoints. | 00, 05 | — |
| **B** | Citation tracking: detect URLs referenced in assistant responses, store citations on nodes, render as footnote links. | 05 | — |
| **C** | URL fetching tool: `fetch_url` tool that retrieves a web page, extracts readable text, and returns it to the model. | 00, 05 | — |

---

## Phase A — New Search Providers

### SearXNG

[SearXNG](https://docs.searxng.org/) is a self-hosted meta-search engine. Users who self-host Baobab often also self-host SearXNG for privacy.

**Backend implementation** (`server/src/services/search/searxng.ts`):

```typescript
// GET {baseUrl}/search?q={query}&format=json&categories=general&engines=google,bing,duckduckgo
interface SearXNGConfig {
  baseUrl: string;    // e.g. 'http://searxng:8080' or 'https://search.example.com'
  // No API key — SearXNG uses instance-level auth if any
}
```

- No API key required (SearXNG is self-hosted).
- User configures the instance URL in Settings.
- Returns structured results with title, URL, snippet, engine source.
- If the instance is unreachable, fall back to the next configured provider (or show error).

**Search result mapping**:
```typescript
interface SearXNGResult {
  url: string;
  title: string;
  content: string;       // snippet
  engine: string;        // which engine provided this result
  score: number;         // relevance score
}
// Maps to existing SearchResult: { title, url, snippet }
```

### Brave Search

[Brave Search API](https://brave.com/search/api/) provides high-quality results with a generous free tier (2,000 queries/month).

**Backend implementation** (`server/src/services/search/brave.ts`):

```typescript
// GET https://api.search.brave.com/res/v1/web/search?q={query}&count={numResults}
// Header: X-Subscription-Token: {apiKey}
```

- Requires API key (free tier available).
- Returns structured results with title, URL, description, extra snippets.
- Supports `count` parameter for number of results.

### Data Model Changes

```typescript
// types/index.ts — extend provider union
interface Conversation {
  // ... existing
  searchProvider: 'duckduckgo' | 'tavily' | 'bing' | 'searxng' | 'brave';
}

interface AppSettings {
  // ... existing
  defaultSearchProvider: 'duckduckgo' | 'tavily' | 'bing' | 'searxng' | 'brave';
  braveApiKey?: string;
  searxngBaseUrl?: string;
}
```

### Settings UI Update

In the Settings Search tab, add new provider options:

```
Search Providers
  Default Provider: [DuckDuckGo ▾]
    DuckDuckGo (no key required)
    Tavily
    Bing
    SearXNG (self-hosted)     ← new
    Brave Search              ← new

  SearXNG Instance URL
  [http://localhost:8080              ]
  [Test Connection]  → pings {baseUrl}/search?q=test&format=json

  Brave Search API Key
  [                                   ]

  Tavily API Key
  [                                   ]

  Bing API Key
  [                                   ]
```

Provider selector only shows providers with valid configuration (DuckDuckGo always available, SearXNG requires URL, Brave/Tavily/Bing require API key).

### Backend Route Changes

No new routes — the existing `POST /api/search` accepts the provider field. Add `'searxng'` and `'brave'` to the provider dispatch in `server/src/routes/search.ts`.

For SearXNG, the backend needs the instance URL. The frontend passes it in the request:

```typescript
interface SearchRequest {
  provider: 'duckduckgo' | 'tavily' | 'bing' | 'searxng' | 'brave';
  query: string;
  numResults?: number;
  apiKey?: string;           // for tavily/bing/brave
  baseUrl?: string;          // for searxng
}
```

---

## Phase B — Citation Tracking

### Concept

When a model uses web search results in its response, track which URLs it referenced. Store citations on the assistant node and render them as clickable footnote links at the bottom of the message.

### Detection Strategy

After the model's final response is complete (all tool calls resolved, final text produced):

1. Extract all URLs from the search results that were returned as tool_result content during this turn.
2. For each URL, check if the assistant's response text contains:
   - The exact URL.
   - The domain name (e.g., "according to Wikipedia" + a wikipedia.org result).
   - The title of the search result (fuzzy: case-insensitive substring match).
3. If any match is found, the URL is considered "cited."

This is a best-effort heuristic — it catches most citations without requiring the model to use a specific citation format.

### Data Model Changes

```typescript
interface TreeNode {
  // ... existing fields
  citations?: Citation[];
}

interface Citation {
  url: string;
  title: string;
  matchType: 'url' | 'domain' | 'title';  // How the citation was detected
}
```

### Storage

Citations are computed post-streaming and stored on the assistant node alongside the response. They are derived from the `toolCalls` data (search results) and the final response text.

```typescript
// In useStreamingResponse.ts, onComplete callback:
function extractCitations(responseText: string, toolCalls: ToolCallRecord[]): Citation[] {
  const citations: Citation[] = [];
  const searchResults = toolCalls
    .filter(tc => tc.toolName === 'web_search' && tc.result)
    .flatMap(tc => JSON.parse(tc.result!).results as SearchResult[]);

  for (const result of searchResults) {
    const matchType = detectCitation(responseText, result);
    if (matchType) {
      citations.push({ url: result.url, title: result.title, matchType });
    }
  }
  return deduplicateByUrl(citations);
}
```

### UI — Citation Display

Citations appear as footnote-style links at the bottom of the assistant message:

**Tree view (detail panel)**:
```
┌─────────────────────────────────────────────────────────┐
│ Claude                                                   │
│                                                          │
│ Based on recent research, quantum computers have         │
│ achieved significant milestones in error correction...   │
│                                                          │
│ ─── Sources ─────────────────────────────────────────── │
│ [1] IBM achieves quantum error correction milestone      │
│     nature.com                                           │
│ [2] Quantum Computing Progress Report 2026               │
│     arxiv.org                                            │
└─────────────────────────────────────────────────────────┘
```

Source links are clickable (open in new tab). The domain is shown below the title for context.

**Thread view**: Same layout, rendered below the message content.

**Node preview (tree)**: A small "2 sources" badge next to the tool call nodule indicates citations were found.

---

## Phase C — URL Fetching Tool

### Concept

A `fetch_url` tool that retrieves a web page, extracts its readable text content (stripping HTML, ads, navigation), and returns it to the model. This lets the model "read" specific pages discovered via search or mentioned by the user.

### Tool Definition

```typescript
const fetchUrlTool = {
  name: 'fetch_url',
  description: 'Fetch a web page and extract its readable text content. Use this to read the full content of a URL found via web search or provided by the user.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
    },
    required: ['url'],
  },
};
```

### Backend Route

```typescript
// POST /api/fetch
// Request: { url: string, maxLength?: number }
// Response: { content: string, title?: string, byline?: string, length: number, truncated: boolean }
```

**Implementation** (`server/src/services/fetch.ts`):

1. Validate URL (reject private IPs — same SSRF protection as Feature 33).
2. Fetch the page with a browser-like User-Agent.
3. Extract readable content using Mozilla's `@mozilla/readability` (or `cheerio` + custom extraction):
   - Strip HTML tags, scripts, styles, navigation, ads.
   - Preserve paragraph structure and headings.
   - Extract title and byline.
4. Truncate to `maxLength` (default 50,000 characters — roughly 12K tokens).
5. Return extracted text.

**Dependencies**: `@mozilla/readability`, `jsdom` (for parsing HTML into DOM for Readability).

### Tool Integration

The `fetch_url` tool is automatically included when web search is enabled — if the model can search, it should also be able to read the results. It registers alongside `web_search` in the tool dispatch:

```typescript
registerToolHandler('fetch_url', async (input) => {
  const { url } = input as { url: string };
  const result = await backendFetch('/api/fetch', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return `Title: ${result.title}\n\n${result.content}`;
});
```

### Tool Call Display

```
Tool Use
  ┌─────────────────────────────────────────────────────────┐
  │ 🌐 fetch_url                                             │
  │ URL: nature.com/articles/quantum-error-correction        │
  │ ▶ Content (12,450 chars — click to expand)               │
  └─────────────────────────────────────────────────────────┘
```

### Interaction with Citations

When the model uses `fetch_url`, the fetched URL is automatically added to citations (if not already present from a search result). The match type is `'url'` (exact match — the model explicitly read this page).

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/services/search/searxng.ts` | SearXNG search provider |
| `server/src/services/search/brave.ts` | Brave Search provider |
| `server/src/services/fetch.ts` | URL fetching and text extraction |
| `server/src/routes/fetch.ts` | Fastify route for `/api/fetch` |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `Citation` type; add `citations` to `TreeNode`; extend search provider unions; add `braveApiKey`, `searxngBaseUrl` to `AppSettings` |
| `server/src/routes/search.ts` | Add `searxng` and `brave` provider dispatch |
| `src/api/tools.ts` | Add `fetch_url` tool definition and executor |
| `src/hooks/useStreamingResponse.ts` | Add citation extraction in `onComplete`; include `fetch_url` in tool resolution when web search is enabled |
| `src/store/useSettingsStore.ts` | Add `braveApiKey`, `searxngBaseUrl` fields |
| `src/components/settings/SettingsDialog.tsx` | Add SearXNG and Brave configuration fields in Search tab |
| `src/components/tree/NodeDetailPanel.tsx` | Render citations section |
| `src/components/thread/ThreadMessage.tsx` | Render citations section |
| `src/components/tree/MessageNode.tsx` | Add "N sources" badge |
| `server/src/index.ts` | Register fetch route |
| `server/package.json` | Add `@mozilla/readability`, `jsdom` dependencies |

## Implementation Order

1. **Phase A**: SearXNG backend → Brave backend → settings UI → provider selector update.
2. **Phase B**: Citation extraction logic → data model → detail panel rendering → thread view rendering → badge.
3. **Phase C**: URL fetch backend service → route → SSRF protection → tool definition → tool dispatch → display.

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty search query → existing behavior (provider returns empty results). Empty URL for fetch_url → return error "No URL provided". |
| What if the external dependency is unavailable? | SearXNG instance down → error returned to model as tool_result. Brave API returns 429 → error message. fetch_url target returns 404/500 → error string to model. |
| What if this runs concurrently with itself? | Multiple searches or fetches in same turn → parallel execution via existing `Promise.all`. Each is independent. |
| What happens on the second invocation? | Citations are recomputed on resend (they depend on the response text and tool results, which may differ). |
| What if the user's data is larger than expected? | fetch_url content truncated to 50K chars. Search results already limited by `numResults`. Citations array has no hard limit but is bounded by search results (max ~10 URLs per search call). |
| What state persists vs. resets across page reload? | Citations persist on TreeNode in IndexedDB. Search provider config persists in AppSettings. |

## Browser-Only Mode

- **Phase A**: Search providers are disabled (all require backend proxy). No change from current behavior.
- **Phase B**: Citations still work if the model was able to use web search (backend was available when the message was created). Citation data persists on the node even if the backend becomes unavailable later.
- **Phase C**: fetch_url is disabled (requires backend proxy).
