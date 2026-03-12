# Project Detail Page — Test Results

**Date**: 2026-02-21
**Environment**: Chrome MCP browser automation, `localhost:5173`, dark theme
**Starting state**: App running via `docker compose up`, Projects grouping mode active, no pre-existing test project

---

## Summary

| Section | Total | Pass | Fail | Skipped |
|---------|-------|------|------|---------|
| 1 — Sidebar Navigation | 4 | 4 | 0 | 0 |
| 2 — Description Editing | 3 | 3 | 0 | 0 |
| 3 — Inject Description Toggle | 4 | 4 | 0 | 0 |
| 4 — System Prompt Editing | 3 | 3 | 0 | 0 |
| 5 — Files Section | 1 | 1 | 0 | 0 |
| 6 — Page Stability (B1 Fix) | 2 | 2 | 0 | 0 |
| 7 — Edge Cases | 3 | 3 | 0 | 0 |
| **Total** | **20** | **20** | **0** | **0** |

---

## Section 1 — Sidebar Navigation to Project Detail Page

### T1-1: Create a project for testing — PASS

**Actions**: Clicked "+ New Project" button in sidebar. Entered "Test Project Alpha" as name and "A project for testing" as description via the dialog. Submitted.

**Observations**: Project appeared in sidebar with folder icon, name "Test Project Alpha", and conversation count "(0)".

### T1-2: Gear icon appears on hover — PASS

**Actions**: Hovered over "Test Project Alpha" project header row. Took screenshot.

**Observations**: Gear (Settings) icon and upload icon appeared to the right of the conversation count. Both icons are hidden when not hovering and visible on hover via `group-hover/proj:opacity-100`.

### T1-3: Gear icon navigates to project detail page — PASS

**Actions**: Hovered over project row, clicked the gear icon.

**Observations**: URL changed to `/project/3ad8ca23-e855-45d4-8efb-5dd646169f6f`. Main content area showed:
- Back arrow button (ArrowLeft) in top-left
- Folder icon and "Test Project Alpha" as page title
- Description section with textarea
- "Inject description into system prompt" toggle
- System Prompt section with textarea
- Files section showing "(0)" count and "No files uploaded"

### T1-4: Gear icon does not collapse/expand the project — PASS

**Actions**: Navigated back via back arrow. Confirmed project section was expanded. Hovered and clicked gear icon. Navigated back again.

**Observations**: Project section remained expanded after gear icon clicks. The `stopPropagation` on the icon wrapper prevents toggle collapse.

---

## Section 2 — Description Editing

### T2-1: Description pre-populated from project creation — PASS

**Actions**: Navigated to project detail page via gear icon.

**Observations**: Description textarea contained "A project for testing" — the description entered during project creation.

### T2-2: Edit description and save on blur — PASS

**Actions**: Clicked into Description textarea. Cleared text and typed "Updated description for Alpha". Clicked outside textarea (on System Prompt label) to trigger blur. Navigated away (back arrow), then back to project detail page.

**Observations**: After round-trip navigation, Description textarea showed "Updated description for Alpha" — the change persisted via save-on-blur.

### T2-3: No-op save when description unchanged — PASS

**Actions**: Clicked into Description textarea without changing text. Clicked outside to blur.

**Observations**: No errors, no visual flicker. Page remained stable. The `description !== project.description` guard prevented unnecessary writes.

---

## Section 3 — Inject Description Toggle

### T3-1: Toggle default state is off — PASS

**Actions**: Navigated to project detail page. Located toggle.

**Observations**: Toggle knob was on the left side with gray track color (`bg-[var(--color-border)]`), indicating OFF state.

### T3-2: Toggle can be switched on — PASS

**Actions**: Clicked the toggle button. Took screenshot.

**Observations**: Toggle moved to ON position — knob slid to the right, track color changed to accent orange (`bg-[var(--color-accent)]`). Subtitle "Prepends the project description to every API call in this project" visible below.

### T3-3: Toggle state persists across navigation — PASS

**Actions**: With toggle ON, clicked back arrow to navigate away. Navigated back to project detail page.

**Observations**: Toggle was still in ON position after round-trip navigation.

### T3-4: Toggle can be switched back off — PASS

**Actions**: Clicked toggle to turn OFF. Navigated away and back.

**Observations**: Toggle returned to OFF position (knob left, gray track) and remained OFF after round-trip navigation.

---

## Section 4 — System Prompt Editing

### T4-1: System prompt starts empty — PASS

**Actions**: Navigated to project detail page. Located System Prompt textarea.

**Observations**: Textarea was empty with placeholder "Enter a project-level system prompt...". Subtitle "Applied to conversations in this project unless overridden at conversation or node level." was visible. Text appeared in monospace font (`font-mono text-xs`), confirmed via zoom inspection.

### T4-2: Edit system prompt and save on blur — PASS

**Actions**: Clicked into System Prompt textarea. Typed "You are a helpful coding assistant. Always use TypeScript." Clicked outside to blur. Navigated away and back.

**Observations**: System Prompt textarea still contained "You are a helpful coding assistant. Always use TypeScript." — the change persisted.

### T4-3: B2 regression — editing description does not reset system prompt — PASS

**Actions**:
1. Confirmed System Prompt contained previously saved text
2. Clicked into System Prompt, added " Be concise." at end (did NOT blur)
3. Clicked into Description textarea, added " v2" at end
4. Clicked outside Description to blur (triggering `updateProject` for description)
5. Took screenshot — System Prompt still showed "You are a helpful coding assistant. Always use TypeScript. Be concise."
6. Clicked outside System Prompt to blur and save
7. Navigated away and back

**Observations**: The system prompt in-progress edit was NOT wiped out by the description save. Both fields persisted correctly after round-trip:
- Description: "Updated description for Alpha v2"
- System Prompt: "You are a helpful coding assistant. Always use TypeScript. Be concise."

This confirms the B2 fix (changing useEffect dependency from `[project]` to `[projectId]`) works correctly.

---

## Section 5 — Files Section

### T5-1: Empty files state — PASS

**Actions**: Scrolled to Files section on project detail page. Zoomed in for detail.

**Observations**:
- Section header shows "Files (0)"
- Dashed-border box displays "No files uploaded"
- Upload button (upload icon) visible to the right of "Files" label

---

## Section 6 — Page Stability (B1 Fix Verification)

### T6-1: Page does not crash or flicker on load — PASS

**Actions**: Navigated to home page. Navigated to project detail page via gear icon. Waited 3 seconds. Took screenshot. Checked console for errors.

**Observations**: Page was stable — no blank screen, no rapid flickering, no "too many re-renders" error in console. Files section displayed "No files uploaded" correctly. The `EMPTY_FILES` constant fix for Zustand selector stability is working.

### T6-2: Page remains stable during interaction — PASS

**Actions**: Rapidly performed sequence:
1. Clicked description textarea, typed "x"
2. Clicked system prompt textarea, typed "y"
3. Clicked inject description toggle ON
4. Clicked inject description toggle OFF
Waited 2 seconds. Took screenshot. Checked console.

**Observations**: Page remained responsive and stable throughout. No freeze, crash, or blank screen. No console errors. Both textareas retained the typed characters.

---

## Section 7 — Edge Cases

### T7-1: Invalid project URL shows fallback — PASS

**Actions**: Navigated directly to `http://localhost:5173/project/nonexistent-id-12345`.

**Observations**: Page displayed "Project not found" centered in the content area. Sidebar remained visible and functional.

### T7-2: Back button navigates away from detail page — PASS

**Actions**: Navigated to home (`/`). Then to project detail page via gear icon. Clicked back arrow button.

**Observations**: App navigated back to home page. URL confirmed as `/`.

### T7-3: Project deletion while viewing detail page — PASS

**Actions**: Navigated to project detail page. Right-clicked "Test Project Alpha" in sidebar. Clicked "Delete Project".

**Observations**: Main content area changed to show "Project not found". Page did not crash — degraded gracefully. Project removed from sidebar. As noted in bugdoc (M2), no auto-redirect occurs — user remains on the dead URL until manual navigation.

---

## Cleanup

Test Project Alpha was deleted as part of T7-3 (destructive test). App left in clean state with no test artifacts.
