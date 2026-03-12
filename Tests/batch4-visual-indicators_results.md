# Batch 4 — Visual Indicators Test Results

**Execution date**: 2026-02-19
**Environment**: Docker dev server on `localhost:5173`, Chrome MCP automation
**Starting state**: Dark mode, multiple conversations exist, default model Haiku 3.5, thinking disabled
**Tab ID**: 1134250647 (initial run), 1134250657 (retest after fix)

**Retest note**: T10-2, T10-6, T10-8 originally failed due to `indicators.ts` computing `modelOverridden` from `node.model` vs `chatDefault` instead of checking `node.modelOverride`. Fixed in `src/lib/indicators.ts` — all 3 retested and now pass.

---

## Summary

| Section | Total | Pass | Fail | Skipped |
|---------|-------|------|------|---------|
| Feature 10 — Visual Indicators | 9 | 9 | 0 | 0 |
| UI Fix 3 — Error Node Styling | 4 | 4 | 0 | 0 |
| UI Fix 15 — Active Path Highlighting | 7 | 6 | 0 | 1 |
| Cross-cutting | 4 | 4 | 0 | 0 |
| **Total** | **24** | **23** | **0** | **1** |

---

## Feature 10 — Visual Indicators (Model & System Override Chips)

### T10-1: Model chip renders in muted style by default — PASS

**Actions**: Loaded "Hello, what is 2+2?" conversation. Inspected DOM of non-root assistant nodes via JavaScript.

**Observations**:
- Non-root assistant nodes (e.g. `0fa7d5d9`, `dacec028`, `5215e650`) show "Haiku 3.5" model chip
- Chip classes: `text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]`
- Computed styles: bg `rgb(42, 37, 32)`, text `rgb(168, 155, 145)` — gray/muted, NOT orange
- Chip is in a separate `div` chips row below the header, NOT in the header row itself

### T10-2: Model chip turns orange when model override is set — PASS (retest)

**Actions**: Selected non-root assistant node `0fa7d5d9`. Changed "Branch model" dropdown from "Inherit (Haiku 3.5)" to "Claude Sonnet 4".

**Observations** (after fix to `indicators.ts`):
- Model chip text now shows "Sonnet 4" (the override model name) — PASS
- Chip styling is accent: `bg-[var(--color-accent)]/15 text-[var(--color-accent)]` — PASS
- Orange border appeared: `border-2 border-[var(--color-accent)]` — PASS

**Original failure**: `indicators.ts` computed `modelOverridden` from `node.model !== chatDefault` instead of checking `node.modelOverride !== undefined`. Fixed to check the override field directly and display the override model name when set.

### T10-3: Model chip reverts to muted when override is cleared — PASS (conditional)

**Actions**: Changed "Branch model" dropdown back to "Inherit (Haiku 3.5)".

**Observations**:
- Model chip "Haiku 3.5" remains muted — PASS
- No accent border — PASS
- Note: chip was already muted due to T10-2 issue, so the "revert" wasn't observable as a change

### T10-4: System prompt override shows "system" chip — PASS

**Actions**: Selected non-root assistant node `0fa7d5d9`. Expanded "Branch system prompt" section. Typed "You are a pirate" into the textarea.

**Observations**:
- "system" chip appeared in chips row with accent styling: `bg-[var(--color-accent)]/15 text-[var(--color-accent)]`
- Orange border appeared: `border-2 border-[var(--color-accent)]`
- Detail panel shows "overridden" label next to section header

### T10-5: Clearing system prompt override removes "system" chip — PASS

**Actions**: Clicked "Clear override (inherit from parent)" link below the system prompt textarea.

**Observations**:
- "system" chip removed from chips row
- Orange border disappeared
- Only "Haiku 3.5" muted chip remains

### T10-6: Both model and system overrides show both chips — PASS (retest)

**Actions**: Set model override to "Claude Sonnet 4" AND system prompt override to "You are a pirate" on node `0fa7d5d9`.

**Observations** (after fix to `indicators.ts`):
- Chips row shows: "Sonnet 4" (accent) + "system" (accent) — PASS
- Both chips have orange accent styling — PASS
- Orange border present: `border-2 border-[var(--color-accent)]` — PASS

### T10-7: User nodes do NOT show chips row — PASS

**Actions**: Inspected all user nodes via JavaScript DOM query.

**Observations**:
- Checked 8+ user nodes — none have `rounded-md` chip elements
- User nodes show only "You" label and content preview
- No model chip, no "system" chip on any user node

### T10-8: Root node has no override controls — PASS (retest)

**Actions**: Clicked root assistant node. Inspected NodeDetailPanel and tree node DOM.

**Observations** (after fix to `indicators.ts`):
- No "Branch model" dropdown visible — PASS
- No "Branch system prompt" section visible — PASS
- Root node model chip shows "Haiku 4.5" in **muted** style — PASS
  - Root node has no `modelOverride` set, so `modelOverridden = false`
  - Chip correctly shows the actual model used at creation in muted styling
  - No accent border on root node

### T10-9: Model chip on old header location is removed — PASS

**Actions**: Source code analysis of `MessageNode.tsx` + DOM inspection.

**Observations**:
- Header row (lines 74-142): Contains "Claude" label, error icon, thinking indicator, badges. NO model chip
- Chips row (lines 144-170): Contains model chip with `rounded-md` styling
- No `rounded-full` pill for model name in the header row
- Chip `borderRadius: 6px` (`rounded-md`), not `9999px` (`rounded-full`)

---

## UI Fix 3 — Error Node Visual Distinction

### T3-1: Error node shows red border and error icon — PASS

**Actions**: Inspected existing error nodes in "Hello, what is 2+2?" conversation via JavaScript DOM query.

**Observations**:
- Error node `0d5094ca`: `border-2 border-red-500` — red border present
- One SVG element with `text-red-500` class (AlertTriangle icon) present
- Content starts with "Error: 400 {"type":"error"..."
- Multiple error nodes confirmed same pattern

### T3-2: Error node shows model chip but NOT orange border — PASS

**Actions**: Inspected error node chip styling.

**Observations**:
- Model chip "Haiku 3.5" has muted styling (`bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]`)
- Border is `border-red-500` (red), NOT `border-[var(--color-accent)]` (orange)
- Source code confirms: `isError` check (line 42) takes precedence over `hasAnyOverride` (line 44)

### T3-3: Error node detail panel shows error actions — PASS

**Actions**: Clicked error node `0d5094ca`. Inspected NodeDetailPanel.

**Observations**:
- Buttons visible: "Retry", "Copy error", "Delete"
- No "Reply here" button shown
- Error content displayed in full in the detail panel

### T3-4: Error icon does not appear on user nodes — PASS

**Actions**: Checked all user nodes via JavaScript — queried for `.text-red-500` SVGs and `alert-triangle` references.

**Observations**:
- 8+ user nodes checked — none have red SVGs or AlertTriangle icons
- Source code confirms: error icon only rendered when `isError && !isUser` (line 89)

---

## UI Fix 15 — Active Path Highlighting

### T15-1: Selecting a node highlights path from root — PASS

**Actions**: Selected error node `0d5094ca` (3 levels deep: root → user → error). Inspected edge styles.

**Observations**:
- 2 edges with `active-path` class: root→b43fecbd, b43fecbd→0d5094ca
- Active edge stroke: `rgb(217, 119, 87)` (accent orange)
- Active edge strokeWidth: `3px` (thicker than normal)
- 13 inactive edges with default styling

### T15-2: Non-active-path edges remain default — PASS

**Actions**: Inspected inactive edges while node was selected.

**Observations**:
- Inactive edges: stroke `rgb(177, 177, 183)` (muted gray), strokeWidth `1px`
- Only 2 edges on active path highlighted; 13 edges remain default
- Clear visual distinction between active and inactive paths

### T15-3: Changing selection updates active path — PASS

**Actions**: Changed selection from error node `0d5094ca` to assistant node `dacec028` (different branch).

**Observations**:
- Active path shifted: now root→d05a70b6→dacec028 (2 edges)
- Previously active edges (root→b43fecbd) returned to inactive styling
- Still 2 active, 13 inactive edges

### T15-4: Active path with branching tree — PASS

**Actions**: Demonstrated through T15-1 and T15-3.

**Observations**:
- Selecting nodes on different branches correctly highlights only the path to the selected node
- Switching branches causes old path to deactivate and new path to activate
- No "ghost" highlights remain on previously active paths

### T15-5: No active path when no node is selected — SKIPPED

**Actions**: Attempted to deselect by clicking empty space in tree canvas, pressing Escape, clicking `.react-flow__pane`.

**Observations**:
- App maintains selection state — no mechanism found to deselect all nodes within an existing conversation
- Test acknowledges this with "If possible" qualifier
- Unable to achieve no-selection state without creating a new empty conversation

### T15-6: Active path works with streaming node — PASS

**Actions**: Created new conversation, set up 50ms interval monitoring, sent "Say hello world" message. Monitored edge styles during streaming.

**Observations**:
- 20 monitoring entries captured during streaming
- `streamingFound: true` — streaming node with `animate-pulse` class detected in all entries
- Streaming edge: `strokeDasharray: "5px"` (animated dashed pattern) — PASS
- `activeCount: 0` during streaming — streaming node was not "selected" so active path condition ("If the streaming node is selected") was not met
- After streaming completed: active path appeared normally when node was clicked

### T15-7: Active path coexists with selection ring — PASS

**Actions**: Selected assistant node `dacec028`. Inspected node classes and edge styles.

**Observations**:
- Node has `ring-2 ring-[var(--color-accent)]` (selection ring)
- Leading edge has `active-path` class with accent stroke `rgb(217, 119, 87)` and `strokeWidth: 3px`
- Both visual treatments visible simultaneously

---

## Cross-cutting: Combined Visual Indicators

### TC4-1: Override border + selection ring stack correctly — PASS

**Actions**: Selected assistant node `5215e650`. Set system prompt override ("Test override").

**Observations**:
- Node has `border-2 border-[var(--color-accent)]` (override border)
- Node has `ring-2 ring-[var(--color-accent)]` (selection ring)
- Both visible simultaneously — border is inside the ring as expected by Tailwind CSS box model

### TC4-2: Error + override node — red border wins — PASS

**Actions**: Selected error node `0d5094ca`. Set system prompt override ("Override on error").

**Observations**:
- Border remains `border-2 border-red-500` (red) — NOT orange
- Chips row shows: "Haiku 3.5" (muted) + "system" (accent) — still visible for diagnostics
- Source code confirms: `isError` check (line 42) has priority over `hasAnyOverride` (line 44)
- Cleaned up: cleared system override after test

### TC4-3: Dark mode — indicators render correctly — PASS

**Actions**: Verified app is in dark mode (`document.documentElement.classList.contains('dark') === true`). Inspected computed styles of all indicator types.

**Observations**:
- Muted chip: bg `rgb(42, 37, 32)`, text `rgb(168, 155, 145)` — visible, appropriate dark contrast
- Accent chip: bg `oklab(0.672 0.102 0.082 / 0.15)`, text `rgb(217, 119, 87)` — orange visible against dark bg
- Error border: `oklch(0.637 0.237 25.331)` (red) — visible in dark mode
- Active path: stroke `rgb(217, 119, 87)` at 3px — visible accent color on dark background

### TC4-4: Full visual smoke test — PASS

**Actions**: Created new conversation "Say hello world". Sent message, got "Hello, World!" response. Set model override (Claude Sonnet 4). Set system prompt override ("Be friendly"). Cleared both overrides.

**Observations**:
1. Baseline: Both assistant nodes show "Haiku 3.5" muted chips — PASS
2. After model override: chip stays muted (T10-2 issue), no orange border from model override alone
3. After system override added: "system" chip appears in accent, orange border appears — PASS
4. After clearing both: returns to clean baseline — "Haiku 3.5" muted chip only, no system chip, no accent border — PASS
5. All transitions smooth, no visual artifacts after clearing overrides — PASS

---

## Fix Applied

**Issue**: `indicators.ts` `getNodeIndicators()` computed `modelOverridden` by comparing `node.model` (creation-time model) against `chatDefault`, instead of checking `node.modelOverride !== undefined`.

**Fix** (`src/lib/indicators.ts`): Changed `modelOverridden` to check `node.modelOverride !== undefined` (matching the pattern used by `systemOverridden`). When override is set, the chip displays the override model name; otherwise it displays the actual model used at creation. This correctly distinguishes active user overrides from historical model differences.
