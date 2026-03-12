# Tier 2 Batch 4 — Search: Test Results

**Execution date**: 2026-02-19
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, multiple conversations exist (including test conversations with "quantum" content), default model Haiku 4.5
**Tab ID**: 1134250662

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| Feature 20 — Global Search | 14 | 9 | 4 | 1 | Filter bugs, empty state bug |
| Feature 20 — Per-Chat Search | 11 | 11 | 0 | 0 | |
| Cross-cutting | 2 | 2 | 0 | 0 | |
| **Total** | **27** | **22** | **4** | **1** | |

---

## Feature 20 — Global Search

### T20-1: Search bar visible in sidebar — PASS

**Actions**: Loaded app, inspected sidebar above conversation list.

**Observations**:
- Search input with magnifying glass icon and placeholder "Search messages..." visible — PASS
- Positioned above the All Chats / Starred tabs — PASS

### T20-2: Type query triggers search — PASS (with deviation)

**Actions**: Clicked search input, typed "quantum" using key-by-key input.

**Observations**:
- Search executes via debounce (250ms) as user types — no "Press Enter to search" prompt — PASS (deviation: test plan says "Press Enter", but implementation uses live debounced search)
- Results appear in sidebar below search bar — PASS

### T20-3: Results from multiple conversations — PASS

**Actions**: Searched for "quantum" (exists in two conversations: "Tell me about quantum computing..." and "What is quantum entanglement?").

**Observations**:
- 4 results shown from both conversations — PASS
- Results span both conversations that contain "quantum" — PASS
- "4 results" count displayed — PASS

### T20-4: Result card layout — PASS

**Actions**: Inspected search result cards for "quantum" query.

**Observations**:
- Each result shows role icon (user or assistant sparkle icon) — PASS
- Conversation title shown (e.g., "What is quantum entanglement? Kee...") — PASS
- Content snippet with matching text shown — PASS
- Results are clickable — PASS

### T20-5: Starred result indicator — PASS

**Actions**: Inspected search results; one assistant node was previously starred.

**Observations**:
- Starred result shows amber star icon next to the role icon — PASS
- Non-starred results have no star — PASS

### T20-6: Click result navigates to conversation and selects node — PASS

**Actions**: Clicked on a search result from the "What is quantum entanglement?" conversation.

**Observations**:
- App navigates to the correct conversation — PASS
- Matching node is selected (NodeDetailPanel opens) — PASS
- Search is cleared and conversation list returns — PASS

### T20-7: Filter bar with toggles — PASS

**Actions**: Searched for "quantum". Inspected filter bar below search input.

**Observations**:
- Filter bar visible with "Filter:" label — PASS
- Three toggle buttons: "User" (with user icon), "Claude" (with sparkle icon), "Starred" (with star icon) — PASS
- All three active/selected by default — PASS

### T20-8: Filter by role — User only — FAIL

**Actions**: Clicked "Claude" toggle to deactivate it (leaving only "User" active). Observed results.

**Observations**:
- "Claude" button visually deactivated (muted styling) — PASS
- **Results did NOT change** — still showing all 4 results including assistant messages — FAIL
- **Root cause**: `setFilters()` in `useSearchStore` updates the filter state but does NOT re-trigger `executeGlobalSearch()`. The search results are stale after filter change.

### T20-9: Filter by role — Claude only — FAIL

**Actions**: Toggled "User" off, "Claude" on.

**Observations**:
- Visual toggle state correct — PASS
- **Results did NOT change** — same bug as T20-8 — FAIL

### T20-10: Filter — Starred only — FAIL

**Actions**: Toggled to show only "Starred" results.

**Observations**:
- Visual toggle state correct — PASS
- **Results did NOT change** — same filter bug — FAIL

### T20-11: Clear search with X button — PASS

**Actions**: With search results showing, clicked X button in search input.

**Observations**:
- Search query cleared — PASS
- Results disappear, conversation list returns — PASS

### T20-12: Clear search with Escape — PASS

**Actions**: Typed "quantum" in search input, pressed Escape.

**Observations**:
- Search query cleared — PASS
- Conversation list returns — PASS

### T20-13: No results state — FAIL

**Actions**: Typed "xyzzy12345" (no matches anywhere) using key-by-key input.

**Observations**:
- **No "No results found" or "0 results" message displayed** — FAIL
- Instead, the sidebar shows the normal conversation list
- **Root cause**: In `Sidebar.tsx`, the condition `globalQuery && (globalResults.length > 0 || isSearching)` only shows the search results area when there ARE results or search is in progress. When 0 results and not searching, it falls through to showing the conversation list. Should show an empty state message.

### T20-14: Searching state indicator — SKIPPED

**Reason**: Search completes too fast (sub-250ms debounce + instant IndexedDB query) to observe a "Searching..." spinner. Would require artificial delay or very large dataset.

---

## Feature 20 — Per-Chat Search

### T20-15: Search icon in conversation header — PASS

**Actions**: Inspected top-right of conversation header area.

**Observations**:
- Magnifying glass icon visible with muted styling — PASS
- Positioned to the left of the Tree/Thread toggle — PASS

### T20-16: Open per-chat search via button click — PASS

**Actions**: Clicked the search icon button.

**Observations**:
- Search bar appears below the conversation header — PASS
- Input has placeholder "Search in this conversation..." — PASS
- X close button visible — PASS
- Header search icon changes to accent color — PASS

### T20-17: Open per-chat search via Ctrl+F — PASS

**Actions**: Pressed Ctrl+F.

**Observations**:
- Per-chat search bar opened — PASS
- Native browser find dialog NOT triggered — PASS
- Input is auto-focused — PASS

### T20-18: Type to find matches — PASS

**Actions**: Typed "quantum" in per-chat search input.

**Observations**:
- Match counter shows "1 of 2" — PASS
- ChevronUp and ChevronDown navigation arrows visible — PASS

### T20-19: Tree view highlights on matching nodes — PASS

**Actions**: Observed tree view with per-chat search active for "quantum".

**Observations**:
- User node "Tell me about quantum..." has amber/orange ring highlight — PASS
- Assistant node "# Quantum Computing..." has amber/orange ring highlight — PASS
- Non-matching nodes (root) have no highlight — PASS

### T20-20: Navigate between matches with arrows — PASS

**Actions**: Clicked ChevronDown arrow, then ChevronUp arrow.

**Observations**:
- ChevronDown advances to "2 of 2" — PASS
- ChevronUp returns to "1 of 2" — PASS
- Selected node changes with navigation — PASS

### T20-21: Enter/Shift+Enter navigation — PASS

**Actions**: Pressed Enter, then Shift+Enter in per-chat search input.

**Observations**:
- Enter advances to "2 of 2" — PASS
- Shift+Enter returns to "1 of 2" — PASS

### T20-22: Close per-chat search with X button — PASS

**Actions**: Clicked X close button on per-chat search bar.

**Observations**:
- Search bar closes — PASS
- Highlight rings removed from tree nodes — PASS
- Header search icon returns to muted styling — PASS

### T20-23: Close per-chat search with Escape — PASS

**Actions**: Opened per-chat search with Ctrl+F, typed "test", pressed Escape.

**Observations**:
- Search bar closes — PASS
- Highlights cleared — PASS

### T20-24: Per-chat search in thread view — PASS

**Actions**: Switched to thread view, opened per-chat search with Ctrl+F, typed "quantum".

**Observations**:
- Match counter shows "1 of 2" — PASS
- Matching message cards in thread view have amber/orange left border highlight — PASS
- Navigation arrows work in thread view — PASS

### T20-25: No matches in per-chat search — PASS

**Actions**: Typed "xyzzy" in per-chat search.

**Observations**:
- No match counter shown (just X button visible) — PASS
- No highlight rings on any tree nodes — PASS

---

## Cross-cutting

### TC20-1: Global search then per-chat search — PASS

**Actions**: Typed "entang" in global search (3 results). Clicked first result to navigate to "What is quantum entanglement?" conversation. Global search cleared. Opened per-chat search (Ctrl+F), typed "entang".

**Observations**:
- Global search navigated to correct conversation and cleared — PASS
- Per-chat search independently found "1 of 2" matches in the conversation — PASS
- Both search systems work independently — PASS

### TC20-2: Search highlights coexist with star indicator — PASS

**Actions**: In "Tell me about quantum..." conversation (starred assistant node), opened per-chat search for "quantum".

**Observations**:
- Starred assistant node shows both amber star icon in card header AND orange search highlight ring — PASS
- Star and search highlight visually coexist without conflict — PASS
- NodeDetailPanel also shows filled star while search is active — PASS

---

## Bugs Found

### Bug 1: Search filters don't re-trigger search — MEDIUM
**Severity**: Medium (functional gap)
**Description**: In `useSearchStore.ts`, `setFilters()` updates the filter state but does NOT call `executeGlobalSearch()`. Filter toggles (User, Claude, Starred) change visually but the search results remain unchanged. Users see buttons toggle but nothing happens to the results.
**Fix**: `setFilters()` should call `executeGlobalSearch()` after updating the filter state, or use a Zustand `subscribe` / `useEffect` to re-trigger search when filters change.

### Bug 2: No empty state for zero global search results — LOW
**Severity**: Low (UX gap)
**Description**: In `Sidebar.tsx`, the condition `globalQuery && (globalResults.length > 0 || isSearching)` only shows the search results area when results exist. When a query returns 0 results and searching is complete, the sidebar shows the normal conversation list instead of a "No results found" message. Users can't tell if their search found nothing vs. if search didn't execute.
**Fix**: Change condition to `globalQuery && (globalResults.length > 0 || isSearching || globalQuery.trim())` or similar, and add an empty state message when `globalResults.length === 0 && !isSearching && globalQuery.trim()`.
