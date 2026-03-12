# ADR-014: DuckDuckGo Search Strategy — Lite Backend + Instant Answer API

**Date**: 2026-02-20
**Status**: Accepted (updated)
**Context**: Feature 05 (Web Search Tool) includes DuckDuckGo as the default, no-API-key-required search provider. The original plan used `duck-duck-scrape`, an npm package that calls DDG's `links.duckduckgo.com/d.js` endpoint. This was blocked by DDG's TLS fingerprint-based bot detection (JA3/JA4 fingerprinting) — Node.js's TLS handshake is identifiable as non-browser regardless of User-Agent headers. The Python `duckduckgo_search` library avoids this via `primp`, a custom Rust TLS stack that impersonates real browser TLS handshakes. No equivalent exists for Node.js.

---

## Decision: Use DDG Lite Backend + Instant Answer API

**Problem**: DuckDuckGo has no official web search API. The main search endpoints (`links.duckduckgo.com/d.js`, `html.duckduckgo.com/html`) use TLS fingerprinting to block non-browser clients — setting a browser User-Agent is insufficient. However, DDG's **lite backend** (`lite.duckduckgo.com/lite/`) accepts simple POST requests with standard HTML responses and does not appear to employ TLS fingerprinting. DDG also has an Instant Answer API for knowledge-graph responses.

**Options considered**:

1. **`duck-duck-scrape` only**: Calls `links.duckduckgo.com/d.js` via `needle` HTTP library. Blocked by TLS fingerprinting — returns "DDG detected an anomaly" error consistently from Docker/Node.js.
2. **DDG HTML backend** (`html.duckduckgo.com/html`): Also employs bot detection — returns anomaly/captcha page.
3. **DDG Lite backend** (`lite.duckduckgo.com/lite/`): Simple HTML interface. POST with `q=query` returns result links and snippets in plain HTML tables. Works reliably from Node.js/Docker. Rate-limited at ~2-3 rapid requests (HTTP 202), but human-paced usage is fine.
4. **Instant Answer API only**: Stable and official but only returns results for entity/Wikipedia-type queries. Returns empty for natural language questions, current events, and specific queries.

**Decision**: Option 3 + Option 4 — use both together (lite backend primary, instant answer supplementary).

**Rationale**:
- The lite backend provides real ranked web results (titles, URLs, snippets) without requiring TLS fingerprint impersonation
- The Instant Answer API provides a supplementary source for factual/definitional queries
- Combined results give the model both direct knowledge (abstract) and supporting web sources
- No third-party npm dependencies required — uses native `fetch` only
- Rate limiting (HTTP 202) is handled gracefully, and human-paced usage stays well within limits

**Implementation**:

```
DuckDuckGo search flow:
1. Fire both requests in parallel:
   a. Lite backend: POST lite.duckduckgo.com/lite/ with q=query → parse HTML tables
   b. Instant Answer API: GET api.duckduckgo.com/?q=...&format=json → { Abstract, AbstractURL, ... }
2. If lite succeeds → use lite results as primary
3. Prepend Instant Answer abstract (if non-empty) as a "Direct Answer" entry
4. If lite fails (rate limit or error) but Instant Answer has content → return Instant Answer as sole result
5. If both fail → return error message (model handles gracefully)
```

**Impact**:
- `server/src/services/search/duckduckgo.ts` makes two parallel requests using native `fetch`
- Removed `duck-duck-scrape` npm dependency entirely — no third-party deps for DDG search
- `SearchResult` type has optional `isInstantAnswer?: boolean` field for display differentiation
- Browser-like User-Agent headers sent with all requests as a basic courtesy
- HTML parsing uses simple regex against DDG lite's stable table structure

---

## Supersedes

Original version of this ADR recommended `duck-duck-scrape` + Instant Answer API. Updated after discovering that `duck-duck-scrape` (and the underlying `links.duckduckgo.com/d.js` endpoint) is blocked by DDG's TLS fingerprint-based bot detection from Node.js/Docker environments.

## Spec Files Updated

- Feature 05 (`Features/05-web-search.md`): DuckDuckGo provider implementation section updated.
