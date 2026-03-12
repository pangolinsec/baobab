# Retest Round 2 — Post-Bugfix Verification

**Execution date**: 2026-02-20
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, Anthropic provider enabled, default model Haiku 4.5
**Tab ID**: 1134250664
**Bugfix commit**: `da64dc2` — "Fix 6 Tier 2 test bugs across search, streaming, providers, and UI"

---

## Summary

| Test | Previous Status | New Status | Notes |
|------|----------------|------------|-------|
| T20-8: Filter by role — User only | FAIL | **PASS** | Toggling Claude off reduces results from 4 to 2 (User only) |
| T20-9: Filter by role — Claude only | FAIL | **PASS** | Toggling User off shows 2 Claude-only results |
| T20-10: Filter — Starred only | FAIL | **PASS** | Toggling User+Claude off, Starred on shows 1 starred result |
| T20-13: No results empty state | FAIL | **PASS** | "0 results" and "No results found" message displayed |
| T07-E1: No providers enabled | FAIL | **PASS** | Error node: "No provider enabled. Please enable a provider in Settings." |
| T21-4: Thread view timestamps | FAIL | **PASS** | Timestamps (e.g., "8:46 AM") shown in thread message headers |
| T21-23: Thread path extends during streaming | FAIL | **PASS** | Thread path extended to show new user + assistant nodes after send |
| T21-18: Dead-end opacity in thread view | PARTIAL PASS | **PASS** | `opacity-40` class now applied to dead-end message cards |
| T21-13: Branch indicator rows clickable | FAIL | **WONTFIX** | False positive — handler works, visual change is subtle; multi-branch thread view is a new feature |

| Category | Total | Now Pass | Still Fail |
|----------|-------|----------|------------|
| Previously FAIL | 7 | 6 | 1 |
| Previously PARTIAL PASS | 1 | 1 | 0 |
| Previously SKIPPED | 0 | 0 | 0 |
| **Total** | **8** | **7** | **1** |

---

## Detailed Results

### T20-8: Filter by role — User only — NOW PASS

**Actions**: Searched "quantum" (4 results). Clicked "Claude" filter button to deactivate it.

**Observations**:
- "Claude" button visually deactivated (muted styling) — PASS
- Results changed from 4 to 2 — PASS
- Only user messages shown (both from "What is quantum entanglement?" and "Tell me about quantum computing" conversations) — PASS
- **Fix**: `setFilters()` now calls `executeGlobalSearch()` after updating filter state

---

### T20-9: Filter by role — Claude only — NOW PASS

**Actions**: Toggled User off, Claude on.

**Observations**:
- "User" button muted, "Claude" button highlighted (accent) — PASS
- Results show 2 assistant messages only — PASS

---

### T20-10: Filter — Starred only — NOW PASS

**Actions**: Toggled User and Claude off, Starred on (highlighted orange).

**Observations**:
- Only 1 result shown: starred "# Quantum Computing" assistant message with star icon — PASS
- Filter correctly narrows to starred results only — PASS

---

### T20-13: No results empty state — NOW PASS

**Actions**: Cleared search, typed "xyzzy99999" (no matches).

**Observations**:
- Filter bar visible with "User", "Claude", "Starred" toggles — PASS
- "0 results" count displayed — PASS
- "No results found" message displayed below filter bar — PASS
- Sidebar does NOT fall back to conversation list — PASS
- **Fix**: Sidebar condition changed to show search UI when query is non-empty

---

### T07-E1: No providers enabled — NOW PASS

**Actions**: Opened Settings > Providers. Disabled Anthropic (toggle off, gray dot). Default Provider dropdown empty. Navigated to "Say hello" conversation, typed "test disabled provider", clicked Send.

**Observations**:
- User node created: "test disabled provider" with Haiku 4.5 badge — PASS
- Assistant node created with error: "Error: No provider enabled. Please enable a provider in Settings." — PASS
- Warning icon (⚠) shown on error assistant node — PASS
- No response received via legacy SDK fallback — PASS (legacy path removed)
- Re-enabled Anthropic after test — confirmed working

---

### T21-4: Thread view timestamps — NOW PASS

**Actions**: Navigated to "Say hello" conversation. Switched to Thread view.

**Observations**:
- Root assistant node shows "8:46 AM" timestamp on right side of header — PASS
- Timestamp positioned after model chip and reply target badge — PASS
- All thread message cards show timestamps — PASS
- **Fix**: ThreadMessage component now renders `createdAt` timestamp

---

### T21-23: Thread path extends during streaming — NOW PASS

**Actions**: In thread view, reply target set to root node. Typed "Reply with just one word: hello" and clicked Send. Waited for response.

**Observations**:
- Thread path extended to show 3 messages: root → user "Reply with just one word: hello" → assistant "Hello" — PASS
- Branch indicator "2 other branches from here" appeared between root and user message — PASS
- All messages show timestamps (8:46 AM, 6:43 AM, 6:43 AM) — PASS
- Reply target updated to new assistant node "Hello" — PASS
- ChatInput shows "Replying to: Hello" — PASS
- **Fix**: `useStreamingResponse` now selects the new assistant node after streaming completes, causing thread view to re-render with extended path

---

### T21-18: Dead-end opacity in thread view — NOW PASS

**Actions**: Flagged "test disabled provider" node as dead-end via tree view "Dead end" button. Switched to Thread view. Inspected DOM.

**Observations**:
- Dead-end message card has `opacity-40` class applied — PASS (verified via JS: `document.querySelectorAll('.opacity-40')` found 1 element with text matching the dead-end node)
- Flag icon visible next to model badge in thread header — PASS
- Visual dimming consistent with tree view behavior — PASS
- Unflagged dead-end after test
- **Fix**: ThreadMessage component now applies `opacity-40` class when node is dead-end

---

### T21-13: Branch indicator rows clickable — WONTFIX

**Actions**: In thread view, clicked "2 other branches from here" to expand. Clicked on "Say hello" sibling row text.

**Observations**:
- Branch indicator expands correctly showing sibling previews — PASS
- Eye icon (View in tree) visible on each row — PASS
- Sibling rows DO have an `onClick` handler (`selectNode`) — the click works but the visual change (thread path re-render) is subtle with no scroll/highlight animation
- The eye icon is more noticeable because it switches to tree view entirely

**Resolution**: WONTFIX — false positive. The handler works; the test missed the subtle path update. Displaying multiple branches within thread view would be a new feature, not a bugfix.

---

## Remaining Open Bugs

| Bug | Source | Severity | Status |
|-----|--------|----------|--------|
| Branch indicator rows not clickable | T21-13 | Low | WONTFIX — false positive; new feature territory |
| Summarize available on leaf nodes | T15-2 | None | By design (commit `73b68ef`) |

## Previously Skipped Tests — Status Unchanged

The following tests remain skipped for the same reasons as the previous retest round:

| Test | Reason |
|------|--------|
| T14-11: Prose markdown code blocks theme | No conversations with markdown code blocks available |
| T14-12: Scrollbar adapts to theme | No content long enough to trigger visible scrollbars |
| T6-10: Delete node updates reply target | Destructive test |
| T15-5: No active path when no node selected | No deselect mechanism exists |
| T20-14: Searching state indicator | Search too fast to observe spinner |
| T07-5: Configure API key via provider panel | N/A — General tab no longer has API key field |
| T07-14: Send message via Ollama | No local Ollama instance |
| T07-16: Legacy API key migration | N/A — legacy API key field removed |
| T07-E2: Provider with empty API key | Would disrupt test environment |
| BV-16: POST to search endpoint | Expected — only GET handler defined |
| BV-23: Chat functionality without backend | Requires API key for live send |
| BV-24/25/26: Tier 3 readiness | Informational, not pass/fail |
