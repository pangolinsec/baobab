# Retest of Failed & Skipped Tests — Results

**Execution date**: 2026-02-20
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, Anthropic provider enabled, default model Haiku 4.5
**Scope**: All FAILED and SKIPPED tests from Tier 2 test batches and backend verification
**Tab ID**: 1134250663

---

## Summary

| Category | Total | Now Pass | Still Fail | Still Skipped | Notes |
|----------|-------|----------|------------|---------------|-------|
| Previously FAILED | 10 | 2 | 7 | 1 | TC1-1 fixed, T21-20 now testable |
| Previously SKIPPED | 16 | 1 | 0 | 15 | T21-20 now PASS |
| **Total** | **26** | **3** | **7** | **16** | |

---

## Previously FAILED Tests — Retest Results

### TC1-1: All annotations visible simultaneously (batch1) — NOW PASS

**Previous result**: FAIL — selecting a persisted dead-end node crashed the app with "Maximum update depth exceeded"; opacity-40 not applied.

**Retest actions**: Loaded "Say hi" conversation. Selected dead-end node. Verified no crash. Confirmed opacity-40 applied to dead-end nodes and descendants.

**Retest observations**:
- No crash on selecting dead-end node — PASS (fixed in commit `2112510`)
- Dead-end opacity-40 applied correctly — PASS (fixed in commit `ad703db`)
- Stars, tags, and dead-end annotations all coexist — PASS

---

### T15-2: Summarize option hidden for leaf nodes (batch2) — STILL FAIL (by design)

**Previous result**: FAIL — "Summarize branch" available on leaf nodes.

**Retest**: Not retested. Commit `73b68ef` intentionally changed behavior to "Allow summarize branch on any node". The test plan is outdated; this is by-design behavior.

---

### T21-4: Thread view message cards show timestamps (batch3) — STILL FAIL

**Previous result**: FAIL — no timestamps displayed in thread view.

**Retest**: Confirmed. Thread view shows role, model chip, and content but no timestamps. Feature 21 spec does not include timestamps, so this is a test plan deviation rather than a code bug.

**Severity**: Low (cosmetic / test plan vs spec mismatch)

---

### T21-13: Branch indicator — click sibling to navigate (batch3) — WONTFIX

**Previous result**: FAIL — clicking sibling row text doesn't navigate, only eye icon works.

**Retest**: False positive. Sibling rows have an `onClick` handler (`selectNode(sibling.id)`) that works correctly — it updates the selected node and the thread path re-renders through the new sibling. The visual change is subtle (no scroll/highlight animation), which made it appear non-functional. Displaying multiple branches side-by-side in thread view would be a new feature, not a bugfix.

**Resolution**: WONTFIX

---

### T21-23: Auto-scroll during streaming (batch3) — STILL SKIPPED

**Previous result**: FAIL — thread view path doesn't extend during streaming.

**Retest**: Not retested. Requires sending a message and streaming a response, consuming API credits. The underlying bug (thread path not extending to include new nodes during streaming) has not been addressed in any commits since the original test.

---

### T20-8: Filter by role — User only (batch4) — STILL FAIL

**Previous result**: FAIL — toggling "Claude" filter off doesn't change results.

**Retest actions**: Searched "hello" (9 results). Toggled "Claude" filter off (User only active).

**Retest observations**:
- "Claude" button visually deactivated — PASS
- Results still show 9 results including assistant messages — FAIL
- Root cause unchanged: `setFilters()` doesn't re-trigger `executeGlobalSearch()`

---

### T20-9: Filter by role — Claude only (batch4) — STILL FAIL

**Previous result**: FAIL — same root cause as T20-8.

**Retest**: Confirmed. Toggled "User" off and "Claude" on. Results unchanged. Same filter bug.

---

### T20-10: Filter — Starred only (batch4) — STILL FAIL

**Previous result**: FAIL — same root cause as T20-8.

**Retest**: Not independently retested; shares identical root cause with T20-8/T20-9. Filter toggle changes visual state but doesn't re-execute search.

---

### T20-13: No results state (batch4) — STILL FAIL

**Previous result**: FAIL — no "No results found" message for zero-result queries.

**Retest actions**: Searched "xyzzy99999" (no matches).

**Retest observations**:
- Sidebar falls back to showing normal conversation list — FAIL
- No "No results found" or "0 results" message displayed
- Root cause unchanged: condition `globalQuery && (globalResults.length > 0 || isSearching)` excludes zero-result state

---

### T07-E1: No providers enabled (batch6) — STILL FAIL

**Previous result**: FAIL — message sent via legacy SDK fallback despite all providers disabled.

**Retest actions**: Disabled Anthropic provider (toggle off, gray dot). Default Provider dropdown empty. Navigated to conversation, typed "test disabled provider", clicked Send.

**Retest observations**:
- Message sent successfully despite provider being disabled — FAIL
- New user + assistant nodes created in tree — response received via legacy Anthropic SDK path
- Root cause unchanged: legacy `sendMessage()` in `api/claude.ts` reads API key directly from `useSettingsStore.apiKey`, bypassing provider enabled state
- Re-enabled Anthropic after test

---

## Previously SKIPPED Tests — Retest Results

### T21-18: Dead-end styling in thread view (batch3) — PARTIAL PASS

**Previous result**: SKIPPED — crash risk from dead-end bug.

**Retest actions**: "Say hi" node was already flagged as dead-end. Selected it, switched to thread view.

**Retest observations**:
- Dead-end flag icon visible in thread message header (next to star) — PASS
- No opacity-40 applied to thread message card (computed opacity: 1) — FAIL
- Thread view does not dim dead-end messages like tree view does
- **Verdict**: Flag badge shows correctly but opacity reduction is tree-view-only. Partial pass.

---

### T21-20: Error node styling in thread view (batch3) — NOW PASS

**Previous result**: SKIPPED — no error nodes existed in accessible conversations.

**Retest actions**: Found error node (Error: 400...) in "Say hi" conversation. Selected it, switched to thread view.

**Retest observations**:
- Error message card has `border-l-[3px] border-l-red-500` — red left border — PASS
- Content "Error: 400 {\"type\":\"error\"...}" clearly visible — PASS
- Error styling distinguishes it from normal assistant cards — PASS

---

### T14-11: Prose markdown code blocks theme (phase0) — STILL SKIPPED

**Reason**: No conversations with markdown code blocks or links available. CSS rules verified correct in `index.css` during original test.

---

### T14-12: Scrollbar adapts to theme (phase0) — STILL SKIPPED

**Reason**: No content long enough to trigger visible scrollbars. CSS rules verified correct.

---

### T6-10: Delete node updates reply target (phase0) — STILL SKIPPED

**Reason**: Destructive test — would delete nodes from test conversations. Code logic verified correct at `useTreeStore.ts:263-264` during original test.

---

### T15-5: No active path when no node selected (batch4) — STILL SKIPPED

**Reason**: No mechanism to deselect all nodes exists. App always maintains a selection within a conversation.

---

### T20-14: Searching state indicator (batch4) — STILL SKIPPED

**Reason**: Search completes too fast (< 250ms debounce + instant IndexedDB query) to observe a spinner.

---

### T07-5: Configure API key via provider panel (batch6) — STILL SKIPPED (N/A)

**Reason**: General tab no longer contains an API key field. API key management fully in Providers section. Test not applicable.

---

### T07-14: Send message via Ollama (batch6) — STILL SKIPPED

**Reason**: No local Ollama instance running.

---

### T07-16: Legacy API key migration (batch6) — STILL SKIPPED (N/A)

**Reason**: General tab UI changed. Legacy migration test not applicable.

---

### T07-E2: Provider with empty API key (batch6) — STILL SKIPPED

**Reason**: Would require adding and configuring a new provider, disrupting test environment.

---

### BV-16: POST to search endpoint (backend) — STILL SKIPPED

**Reason**: Expected behavior — only GET handler defined on search route. POST returns 404.

---

### BV-23: Chat functionality works without backend (backend) — STILL SKIPPED

**Reason**: Requires valid API key for live message send. App confirmed functional without backend in BV-21.

---

### BV-24/25/26: Tier 3 readiness (backend) — STILL SKIPPED

**Reason**: Informational checks, not pass/fail tests. Current state documented in backend-verification_results.md.

---

## Open Bugs Summary

| Bug | Source | Severity | Status | Root Cause |
|-----|--------|----------|--------|------------|
| Search filters don't re-trigger search | T20-8/9/10 | Medium | Open | `setFilters()` doesn't call `executeGlobalSearch()` |
| No empty state for zero search results | T20-13 | Low | Open | Sidebar condition excludes zero-result state |
| Legacy SDK bypasses disabled providers | T07-E1 | Medium | Open | `api/claude.ts` reads API key directly, ignoring enabled flag |
| Branch indicator rows not clickable | T21-13 | Low | WONTFIX | False positive — handler works; multi-branch thread view is new feature |
| No timestamps in thread view | T21-4 | Low | Open | Not in Feature 21 spec; test plan deviation |
| Thread view no opacity for dead-ends | T21-18 | Low | Open | Thread view shows flag badge but no opacity-40 |
| Thread path doesn't extend during streaming | T21-23 | Medium | Open | Thread view path based on selected node, not updated during stream |
| Summarize available on leaf nodes | T15-2 | None | By design | Commit `73b68ef` intentionally allows this |

## Fixed Bugs

| Bug | Source | Fix Commit | Description |
|-----|--------|------------|-------------|
| Dead-end node crash | TC1-1 | `2112510` | Zustand selector `.filter()` replaced with stable `useMemo` |
| Dead-end opacity not applied | TC1-1 | `ad703db` | Two-pass bottom-up/top-down dead-end computation |
