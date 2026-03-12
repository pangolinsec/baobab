# ADR-013: Pricing Data Strategy and Model Matching

**Date**: 2026-02-20
**Status**: Accepted
**Context**: Feature 22 (Pricing Transparency) was implemented with a hardcoded pricing table in `src/lib/pricing.ts` and prefix-based model matching. During review, three architectural concerns surfaced: (1) the static table will drift from actual provider pricing over time, (2) the pricing data embedded in TypeScript is harder for maintainers to review and update than a standalone data file, and (3) prefix matching can produce false positives (e.g. `o3` matching `o3-mini`) without signaling uncertainty to the user. This ADR records the planned improvements.

---

## Decision 1: Live Pricing from OpenRouter with Static Fallback

**Problem**: Provider pricing changes over time. A hardcoded table becomes stale without manual updates. OpenRouter's `/api/v1/models` endpoint returns per-model pricing for all models it supports, covering most providers Baobab integrates with.

**Options considered**:

1. **Static table only**: Maintain a hardcoded table in source. Simple but requires code changes for every price update.
2. **Fetch from each provider's API**: Query Anthropic, OpenAI, Gemini, etc. individually for pricing. Most providers don't expose pricing APIs — only OpenRouter does reliably.
3. **Fetch from OpenRouter, fall back to static**: When OpenRouter is configured and enabled, fetch live pricing from its models endpoint. Cache the result. Use the static table as fallback for offline use, unconfigured OpenRouter, or models not on OpenRouter.

**Decision**: Option 3 — fetch live from OpenRouter when available, fall back to static table.

**Rationale**: OpenRouter aggregates pricing across providers in a single API call. This gives the most accurate data with the least integration effort. The static table remains necessary for users who don't use OpenRouter or are offline. Caching the OpenRouter response (e.g. in memory with a TTL, or in IndexedDB) avoids repeated API calls.

**Impact**: `src/lib/pricing.ts` will gain an async `fetchOpenRouterPricing()` function. The settings store or a dedicated pricing store will cache the result. `findPricing()` will check cached live data before the static table. The OpenRouter provider config (`providers` array in settings) determines whether live fetch is attempted.

---

## Decision 2: Move Static Pricing Data to a JSON Data File

**Problem**: The default pricing table is currently a TypeScript array in `src/lib/pricing.ts`. Updating prices requires editing TypeScript source, which is harder to review in diffs and less accessible to non-developer maintainers.

**Options considered**:

1. **Keep in .ts file**: Current approach. Type-safe but mixes data with logic.
2. **Move to `data/pricing.json`**: A standalone JSON file in the repo. Vite imports JSON natively. Easy to diff, easy to update manually or via automation.
3. **External config file (YAML/CSV)**: More human-readable but requires a build-time parser.

**Decision**: Option 2 — move to `data/pricing.json`, imported by `pricing.ts`.

**Rationale**: JSON is natively importable in Vite/TypeScript with no build tooling changes. A standalone data file makes price updates a pure data change — easier to review in PRs, easier to automate. The TypeScript module retains type validation at import time.

**Impact**: Create `data/pricing.json` with the current table contents. Update `src/lib/pricing.ts` to import from the JSON file. A future GitHub Action (added to CLAUDE.md TODO) can automate periodic updates to this file.

---

## Decision 3: Exact Match First, Prefix Fallback with Uncertainty Indicator

**Problem**: The current `findPricing()` uses `startsWith` matching exclusively. This can produce incorrect matches — `o3` prefix-matches `o3-mini` (different model, different price), and short patterns risk false positives. Users have no way to distinguish a confident match from a best-guess.

**Options considered**:

1. **Prefix only (current)**: Simple but ambiguous. Longest match wins mitigates some issues but not all.
2. **Exact match only**: Most precise but fails on versioned model IDs (e.g. `claude-3-5-sonnet-20241022` won't match `claude-3-5-sonnet`).
3. **Exact match first, prefix fallback**: Try case-insensitive exact match. If no hit, fall back to prefix match. Track which strategy matched and surface it to the UI.

**Decision**: Option 3 — case-insensitive exact match first, prefix fallback, with match confidence exposed to UI.

**Rationale**: Exact match gives high confidence for models whose IDs appear verbatim in the pricing table. Prefix fallback handles the common case of versioned/dated model IDs (e.g. `claude-3-5-sonnet-20241022` matching `claude-3-5-sonnet`). Exposing match confidence lets the UI show `Est. $0.0047` for exact matches and `~Est. $0.0047` (or similar indicator) for prefix matches, so users know when the price is approximate.

**Impact**: `findPricing()` return type gains a `matchType: 'exact' | 'prefix'` field. UI components (`NodeDetailPanel`, `ConversationView`) use `matchType` to conditionally show an uncertainty indicator (e.g. `~` prefix or a tooltip). The `ConversationCostResult` gains a `hasApproximatePricing` flag for the header badge.

---

## Spec Files Updated

No spec files were updated in this session.
