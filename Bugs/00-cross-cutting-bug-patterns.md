# Cross-Cutting Bug Pattern Analysis

**Date**: 2026-02-21
**Scope**: All bugdocs in `Bugs/` — feature14a (30 items), feature14b (11 items), feature14c (8 items), feature22 (23 items) — 72 total items across 4 code reviews.

**Purpose**: Identify recurring patterns across individual feature reviews to inform systemic fixes, lint rules, and review checklists.

---

## Pattern 1: Zustand Selector Reference Instability

**Severity**: Critical (causes crashes)
**Occurrences**: 14a I5/I8/I11, 22 P1/P2/P3/P4, plus a standalone ChatInput infinite loop crash
**Fix effort**: Low

The single most recurring bug category. Three anti-patterns:

1. **Inline `|| []` / `?? []` fallback** — creates a new array reference every render, triggers infinite re-render via `useSyncExternalStore`.
2. **`useStore()` full-state destructure** — subscribes to every field, re-renders on any mutation.
3. **Selector returning computed objects** — `(s) => ({ a: s.x, b: s.y })` creates new object refs each call.

**Systemic fix**: Module-level `EMPTY_*` constants for fallback arrays/objects. A code review checklist item: "every Zustand selector must return a stable reference (primitive, existing object, or memoized value)." Consider a lint rule flagging `|| []` inside `useStore()` calls.

---

## Pattern 2: O(n) / O(n^2) Tree Traversals

**Severity**: Performance
**Occurrences**: 14b O1 (full subtree scan every exchange), 14c B1 (O(n^2) dead-end check), 14c P1 (4 redundant BFS traversals)
**Fix effort**: Medium

The tree data model invites repeated BFS/DFS walks. Each feature independently writes its own traversal, often scanning the full subtree multiple times per operation.

**Systemic fix**: Single-pass BFS pattern (as applied in 14c fix). Consider caching subtree stats on the session object, invalidated on node add/remove. The incremental scoring fix in 14b (only scan new nodes against uncovered terms) is the right direction for hot paths.

---

## Pattern 3: Missing Input Validation / NaN Propagation

**Severity**: Bug (silent corruption)
**Occurrences**: 14a I7 (NaN from invalid number inputs), 22 B1 (empty string -> NaN pricing), 22 B6 (negative token counts)
**Fix effort**: Low

Numeric inputs from users or API responses are trusted without validation. `parseFloat("")` returns `NaN` which propagates silently through calculations, producing incorrect UI output without any error.

**Systemic fix**: Validate at system boundaries. A small `safeParseNumber(value, fallback)` utility would cover most cases. For API responses, clamp counts to `Math.max(0, n)`.

---

## Pattern 4: UI-Only Validation Without Backend Enforcement

**Severity**: Bug (silent failure on non-UI paths)
**Occurrences**: 14c B2 (provider `supportsToolUse` only checked in dialog), 14a S4 (maxTokens only enforced in UI), 22 S3 (pricing format validated only at import)
**Fix effort**: Low

The UI catches invalid states, but if the same operation is triggered programmatically (session resume, provider config change between sessions, API call), there's no backend guard. The orchestrator's tool-use check is the clearest example — the dialog validated it, but resuming a session after the provider lost tool support would silently fail.

**Systemic fix**: Validate at the point of use, not just the point of entry. If a feature requires a capability, check it when the feature runs.

---

## Pattern 5: Abort/Cancellation Gaps

**Severity**: Bug (resource leaks, uncancellable requests)
**Occurrences**: 14b B3 (orphan AbortController), 22 B2 (abort not wired to fetch), 14a B1 (race between streaming abort and node finalization)
**Fix effort**: Low

AbortControllers are created but not stored for later cancellation, or signals aren't plumbed through to the actual fetch call. The 14b case was particularly clear: `signal: new AbortController().signal` creates a controller that's immediately garbage-collected.

**Systemic fix**: Any `fetch`/`sendMessage` call should receive its signal from a ref or control object that the parent can access. Standard pattern: `const abortRef = useRef(new AbortController())` + abort in cleanup/close handler.

---

## Pattern 6: Regex Fragility on LLM Output

**Severity**: Bug (false positives/negatives)
**Occurrences**: 14b B2 (non-greedy bracket matching), 14a I2 (refusal detection false positives on short patterns), 14b I1 (substring "AI" matching "wait")
**Fix effort**: Medium

LLM output is unpredictable. Simple regex or `.includes()` matching breaks on nested structures, short terms, and unexpected formatting.

**Systemic fix**:
- For JSON extraction: bracket-depth parsing, not regex (as applied in 14b).
- For term matching: word-boundary regex (`\b`), not substring.
- For refusal detection: minimum confidence thresholds and multi-signal confirmation.

---

## Pattern 7: Dead Code / Unused Computations

**Severity**: Maintenance / performance
**Occurrences**: 14a B2 (dead store), 14c P1 (4 traversals where 1 suffices), 14c D1 (unused color map), 22 P5/P6 (unused imports/variables)
**Fix effort**: Low (tooling)

Each feature adds code, and subsequent refactors leave artifacts. Not harmful individually, but accumulates — the 14c case where 4 separate BFS traversals existed was a real performance issue hiding behind dead-code noise.

**Systemic fix**: Run `tsc --noUnusedLocals --noUnusedParameters` periodically. Review for dead computations during code review, not just dead variables — a variable may be "used" but its value never consumed.

---

## Pattern 8: Spec Gaps Leading to Silent Failures

**Severity**: Design debt
**Occurrences**: 14a S1-S5 (5 spec gaps), 22 S1-S7 (7 spec gaps)
**Fix effort**: Medium (process)

Features ship without specifying edge cases (empty input, provider removal, concurrent sessions). The code either silently does nothing or crashes in ways unrelated to the original feature.

**Systemic fix**: Spec review checklist:
- What happens when the input is empty/null/undefined?
- What if the external dependency (provider, model, API) is unavailable?
- What if this runs concurrently with itself?
- What happens on the second invocation, not just the first?

---

## Summary

| # | Pattern | Occurrences | Severity | Fix Effort |
|---|---------|-------------|----------|------------|
| 1 | Zustand selector instability | 8+ | Critical (crashes) | Low |
| 2 | Redundant tree traversals | 4 | Performance | Medium |
| 3 | Missing numeric validation | 4 | Bug (NaN) | Low |
| 4 | UI-only validation | 3 | Bug (silent failure) | Low |
| 5 | Abort/cancellation gaps | 3 | Bug (resource leak) | Low |
| 6 | Regex fragility on LLM output | 3 | Bug (false results) | Medium |
| 7 | Dead code accumulation | 5 | Maintenance | Low |
| 8 | Spec gaps | 12 | Design debt | Medium |

**Priority**: Pattern 1 (Zustand selectors) is the clear top priority — it's the only pattern that has caused user-visible crashes in production and has the highest occurrence count. Patterns 3-5 are low-effort fixes that prevent real bugs. Patterns 2 and 6 require more targeted work per instance.

---

## Source Bugdocs

| Bugdoc | Items | Features Reviewed |
|--------|-------|-------------------|
| `feature14a-code-review.md` | 30 | Querier agent, backtracking, refusal detection |
| `feature14b-coverage-scoring-review.md` | 11 | Coverage scoring, term matching, suggest flow |
| `feature14c-orchestrator-review.md` | 8 | Orchestrator agent, tree tools, dispatch |
| `feature22-pricing-review.md` | 23 | Token pricing, cost display, model pricing data |
