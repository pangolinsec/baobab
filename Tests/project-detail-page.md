# Project Detail Page — Browser-Based Test Plan

Tests for the project detail page feature: sidebar gear icon navigation, editable description/system prompt with save-on-blur, inject description toggle, files section, and the bug fixes for Zustand selector instability and useEffect sync.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A new tab is created and navigated to `http://localhost:5173`
4. The sidebar is visible (not collapsed) and the grouping mode is set to "Projects" (click the "Projects" chip in the Group selector bar if not already active)

---

## Section 1 — Sidebar Navigation to Project Detail Page

### T1-1: Create a project for testing

1. In the sidebar, click the "+ New Project" button at the bottom of the project list
2. In the dialog that appears, enter the name "Test Project Alpha" and a description "A project for testing"
3. Submit the dialog
4. **Verify**: The project "Test Project Alpha" appears in the sidebar with a folder icon and the name displayed

### T1-2: Gear icon appears on hover

1. Hover over the "Test Project Alpha" project header row in the sidebar
2. Take a screenshot
3. **Verify**: A small gear/settings icon (cog) appears to the right of the conversation count, next to the upload icon
4. **Verify**: Both the gear and upload icons are visible on hover but hidden when not hovering

### T1-3: Gear icon navigates to project detail page

1. Hover over the "Test Project Alpha" project header row
2. Click the gear/settings icon (not the project name — the gear icon specifically)
3. Take a screenshot
4. **Verify**: The URL changes to `/project/<some-uuid>`
5. **Verify**: The main content area shows a project detail page with:
   - A back arrow button (left arrow icon) in the top-left
   - A folder icon and the text "Test Project Alpha" as the page title
   - A "Description" section with a textarea
   - An "Inject description into system prompt" toggle
   - A "System Prompt" section with a textarea
   - A "Files" section showing "(0)" count and a "No files uploaded" message

### T1-4: Gear icon does not collapse/expand the project

1. Navigate back to the home page by clicking the back arrow on the project detail page
2. Ensure the "Test Project Alpha" project section is expanded in the sidebar (click to expand if collapsed)
3. Hover over the project header row and click the gear icon
4. **Verify**: After navigation, when you return (back arrow), the project section is still expanded — clicking the gear did not toggle the collapse state

---

## Section 2 — Description Editing

### T2-1: Description pre-populated from project creation

1. Navigate to the project detail page for "Test Project Alpha" (hover project row, click gear icon)
2. **Verify**: The Description textarea contains "A project for testing" (the description entered during project creation)

### T2-2: Edit description and save on blur

1. On the project detail page, click into the Description textarea
2. Clear the existing text and type "Updated description for Alpha"
3. Click somewhere outside the textarea (e.g., click on the "System Prompt" label) to trigger blur
4. **Verify**: No visible error or page flash occurs
5. Navigate away by clicking the back arrow, then navigate back to the same project detail page (hover project row, click gear icon)
6. **Verify**: The Description textarea still shows "Updated description for Alpha" — the change persisted

### T2-3: No-op save when description unchanged

1. On the project detail page, click into the Description textarea (do NOT change the text)
2. Click outside to blur
3. **Verify**: No errors, no visual flicker — the page remains stable (this tests that the save guard `description !== project.description` prevents unnecessary writes)

---

## Section 3 — Inject Description Toggle

### T3-1: Toggle default state is off

1. Navigate to the project detail page for "Test Project Alpha"
2. Locate the "Inject description into system prompt" toggle
3. **Verify**: The toggle is in the OFF position (the knob is on the left side, the track is a muted/gray color, not the accent orange)

### T3-2: Toggle can be switched on

1. Click the toggle button
2. Take a screenshot
3. **Verify**: The toggle moves to the ON position (knob slides to the right, track color changes to the accent orange color)
4. **Verify**: The subtitle text "Prepends the project description to every API call in this project" is visible below the toggle label

### T3-3: Toggle state persists across navigation

1. With the toggle ON, click the back arrow to navigate away
2. Navigate back to the project detail page (hover project row, click gear icon)
3. **Verify**: The toggle is still in the ON position — the state persisted

### T3-4: Toggle can be switched back off

1. Click the toggle again to turn it OFF
2. **Verify**: The toggle returns to the OFF position (knob on left, gray track)
3. Navigate away and back
4. **Verify**: The toggle remains OFF after round-trip navigation

---

## Section 4 — System Prompt Editing

### T4-1: System prompt starts empty

1. Navigate to the project detail page for "Test Project Alpha"
2. Locate the System Prompt textarea
3. **Verify**: The textarea is empty with placeholder text "Enter a project-level system prompt..."
4. **Verify**: The subtitle "Applied to conversations in this project unless overridden at conversation or node level." is visible above the textarea
5. **Verify**: The textarea text appears in a monospace font (smaller than the description textarea text)

### T4-2: Edit system prompt and save on blur

1. Click into the System Prompt textarea
2. Type "You are a helpful coding assistant. Always use TypeScript."
3. Click outside the textarea to trigger blur
4. Navigate away (click back arrow), then navigate back to the project detail page
5. **Verify**: The System Prompt textarea still contains "You are a helpful coding assistant. Always use TypeScript." — the change persisted

### T4-3: B2 regression — editing description does not reset system prompt (save-on-blur race condition)

This tests the fix for Bug B2 (useEffect dependency on [project] object ref).

1. Navigate to the project detail page for "Test Project Alpha"
2. **Verify**: The System Prompt textarea contains the previously saved text
3. Click into the System Prompt textarea and **add** some text at the end, e.g., " Be concise." — do NOT blur yet
4. Now click into the Description textarea and change it (e.g., add " v2" to the end)
5. Click outside the Description textarea to blur (this triggers a description save via updateProject)
6. **Verify**: The System Prompt textarea still contains your in-progress edits (the added " Be concise." text should NOT have been wiped out by the description save)
7. Click outside the System Prompt textarea to blur and save it
8. Navigate away and back
9. **Verify**: Both the updated description and the updated system prompt persisted correctly

---

## Section 5 — Files Section

### T5-1: Empty files state

1. Navigate to the project detail page for "Test Project Alpha"
2. Scroll down to the Files section
3. **Verify**: The section header shows "Files (0)"
4. **Verify**: A dashed-border box shows the text "No files uploaded"
5. **Verify**: An upload button (upload icon) is visible to the right of the "Files" label

---

## Section 6 — Page Stability (B1 Fix Verification)

### T6-1: Page does not crash or flicker on load

This tests the fix for Bug B1 (Zustand selector `|| []` instability).

1. Navigate to the home page (`/`)
2. Navigate to the project detail page by clicking the gear icon on "Test Project Alpha"
3. Wait 3 seconds
4. Take a screenshot
5. **Verify**: The page is stable — no blank screen, no rapid flickering, no "too many re-renders" error in the console
6. **Verify**: The Files section displays correctly (either "No files uploaded" or a file list)

### T6-2: Page remains stable during interaction

1. On the project detail page, quickly perform these actions in sequence:
   - Click the description textarea, type a character
   - Click the system prompt textarea, type a character
   - Click the inject description toggle
   - Click the inject description toggle again
2. Wait 2 seconds
3. Take a screenshot
4. **Verify**: The page is still responsive and stable — no freeze, no crash, no blank screen

---

## Section 7 — Edge Cases

### T7-1: Invalid project URL shows fallback

1. Navigate directly to `http://localhost:5173/project/nonexistent-id-12345` via the URL bar
2. Take a screenshot
3. **Verify**: The page displays "Project not found" centered in the content area
4. **Verify**: The sidebar is still visible and functional

### T7-2: Back button navigates away from detail page

1. Navigate to the home page first (`/`)
2. Then navigate to the project detail page via the sidebar gear icon
3. Click the back arrow button in the project detail page header
4. **Verify**: The app navigates back to the home/landing page (URL is `/`)

### T7-3: Project deletion while viewing detail page (M2 — known open issue)

**Note**: This is a known minor issue (M2 in bugdoc) — the expected behavior is a "Project not found" fallback, not an auto-redirect.

1. Navigate to the project detail page for "Test Project Alpha"
2. In the sidebar, right-click on the "Test Project Alpha" project header
3. Click "Delete Project" in the context menu
4. **Verify**: The main content area changes to show "Project not found"
5. **Verify**: The page does not crash — it degrades gracefully

---

## Cleanup

After all tests are complete:

- If "Test Project Alpha" still exists, delete it via the sidebar context menu (right-click → Delete Project) to leave the app in a clean state
