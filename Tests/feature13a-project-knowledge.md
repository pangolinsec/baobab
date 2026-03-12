# Feature 13 Phase A — Browser-Based Test Plan

Tests for Feature 13 Phase A: Project Knowledge foundation — backend file service, project store, sidebar project grouping, file management UI. All tests are designed to be executed by Claude Code using the Chrome MCP tools against the running dev server at `http://localhost:5173`.

---

## Prerequisites

Before running tests:

1. App is running via `docker compose up` and accessible at `localhost:5173`
2. Backend API is running at `localhost:3001` (verify: `curl http://localhost:3001/api/health` returns `{"status":"ok"}`)
3. Chrome MCP tab group is initialized (`tabs_context_mcp`)
4. A new tab is created and navigated to `http://localhost:5173`
5. At least one conversation exists (create one if needed by clicking the "+" button in the sidebar header)

---

## Section 1 — Sidebar Grouping Selector

### T1-1: Grouping selector is visible in All Chats tab

1. Navigate to `http://localhost:5173`
2. Ensure the sidebar is expanded (not collapsed) and the "All Chats" tab is active
3. Take a screenshot
4. **Verify**: Below the "All Chats / Starred" tab switcher, there is a row showing `Group: [None] [Projects]`
5. **Verify**: "None" is highlighted with accent color (it is the default)
6. **Verify**: "Projects" is shown in muted color

### T1-2: Grouping selector is hidden in Starred tab

1. Click the "Starred" tab in the sidebar
2. Take a screenshot
3. **Verify**: The grouping selector row (`Group: None Projects`) is NOT visible
4. Click back to "All Chats" tab
5. **Verify**: The grouping selector row reappears

### T1-3: Toggling grouping mode

1. In the "All Chats" tab, click the "Projects" button in the grouping row
2. Take a screenshot
3. **Verify**: "Projects" is now highlighted with accent color
4. **Verify**: "None" is now muted
5. **Verify**: A "New Project" button appears at the bottom of the conversation list area (with a folder-plus icon)
6. Click "None" to switch back
7. **Verify**: The flat conversation list is shown again without project sections

### T1-4: Tag filter hidden when grouped by projects

1. If there are conversations with tags, note the tag filter strip is visible below the grouping selector when groupBy is "None"
2. Switch to "Projects" grouping
3. Take a screenshot
4. **Verify**: The tag filter strip is NOT visible when grouped by projects

---

## Section 2 — Project CRUD

### T2-1: Create a new project

1. Switch to "Projects" grouping in the sidebar
2. Click the "New Project" button at the bottom of the project list
3. **Verify**: A modal dialog appears with title "New Project", a "Name" input field, an optional "Description" field, and "Cancel" / "Create" buttons
4. Type "Test Project Alpha" in the Name field
5. Type "First test project" in the Description field
6. Click "Create"
7. Take a screenshot
8. **Verify**: The dialog closes
9. **Verify**: "Test Project Alpha" appears as a collapsible section in the sidebar with a folder icon in accent color

### T2-2: Create a second project

1. Click the "New Project" button again
2. Type "Beta Project" in the Name field
3. Leave Description empty
4. Click "Create"
5. Take a screenshot
6. **Verify**: Both "Test Project Alpha" and "Beta Project" appear as separate sections
7. **Verify**: An "Ungrouped" section exists below the projects containing any conversations not assigned to a project

### T2-3: Create project via Enter key

1. Click the "New Project" button
2. Type "Gamma" in the Name field
3. Press Enter
4. **Verify**: The dialog closes and "Gamma" appears as a new project section

### T2-4: Cancel project creation

1. Click the "New Project" button
2. Type "Should Not Exist" in the Name field
3. Click "Cancel"
4. **Verify**: The dialog closes
5. **Verify**: "Should Not Exist" does NOT appear in the project list

### T2-5: Empty name is prevented

1. Click the "New Project" button
2. Leave the Name field empty
3. **Verify**: The "Create" button is disabled (dimmed/non-clickable)
4. Click "Cancel" to dismiss

### T2-6: Rename a project via context menu

1. Right-click on the "Test Project Alpha" project header
2. **Verify**: A context menu appears with "Rename" and "Delete Project" options
3. Click "Rename"
4. **Verify**: A modal dialog appears with title "Rename Project", pre-filled with "Test Project Alpha"
5. Clear the name and type "Alpha Renamed"
6. Click "Save"
7. Take a screenshot
8. **Verify**: The project header now shows "Alpha Renamed" instead of "Test Project Alpha"

### T2-7: Delete a project via context menu

1. Right-click on the "Gamma" project header
2. Click "Delete Project" from the context menu
3. Take a screenshot
4. **Verify**: "Gamma" is no longer visible in the sidebar project list
5. **Verify**: If Gamma had any conversations, they now appear under "Ungrouped"

---

## Section 3 — Assigning Conversations to Projects

### T3-1: Move conversation to a project via context menu

1. Ensure "Projects" grouping is active
2. Find a conversation under "Ungrouped" (create a new one with "+" if needed)
3. Right-click on that conversation item
4. **Verify**: A context menu appears with "Move to project" and "Delete" options
5. Click "Move to project"
6. **Verify**: A submenu appears listing "None (ungrouped)" and all existing projects (e.g., "Alpha Renamed", "Beta Project")
7. Click "Alpha Renamed"
8. Take a screenshot
9. **Verify**: The conversation now appears under the "Alpha Renamed" project section
10. **Verify**: The conversation is no longer under "Ungrouped"

### T3-2: Move conversation back to ungrouped

1. Right-click on the conversation that was just moved to "Alpha Renamed"
2. Click "Move to project" → "None (ungrouped)"
3. Take a screenshot
4. **Verify**: The conversation now appears under "Ungrouped" again
5. **Verify**: It is no longer listed under "Alpha Renamed"

### T3-3: Conversation still navigable after project assignment

1. Move a conversation to "Beta Project" using the context menu
2. Click on that conversation to open it
3. **Verify**: The conversation loads normally in the main tree view
4. **Verify**: The conversation is highlighted in the sidebar under its project

### T3-4: Context menu for conversations in flat (None) grouping

1. Switch to "None" grouping
2. Right-click on any conversation
3. **Verify**: A context menu appears with "Move to project" and "Delete" options (same as in project-grouped view)

---

## Section 4 — Project Section Collapse/Expand

### T4-1: Collapse a project section

1. Switch to "Projects" grouping
2. Ensure "Alpha Renamed" has at least one conversation assigned to it
3. Click on the "Alpha Renamed" project header (the row with the folder icon and chevron)
4. Take a screenshot
5. **Verify**: The project section collapses — conversations and files under it are hidden
6. **Verify**: The chevron icon changes from pointing down to pointing right

### T4-2: Expand a collapsed project section

1. Click the collapsed "Alpha Renamed" header again
2. **Verify**: The section expands, showing conversations and files
3. **Verify**: The chevron points down again

### T4-3: Conversation count badge on project header

1. Move two conversations to "Alpha Renamed"
2. Take a screenshot of the project header
3. **Verify**: The project header shows a count badge (e.g., "2") next to the project name

---

## Section 5 — File Upload

### T5-1: File upload button appears on project header hover

1. Ensure "Projects" grouping is active
2. Hover over the "Alpha Renamed" project header
3. Take a screenshot
4. **Verify**: An upload button (upload icon) appears on the right side of the project header row

### T5-2: Upload a text file

1. Hover over the "Alpha Renamed" project header and click the upload button
2. **Verify**: A native file picker dialog opens
3. Select a `.txt` file (or simulate by uploading via the file input)
4. **Verify**: While uploading, a spinner icon replaces the upload icon briefly
5. After upload completes, the file appears in the project section below the header and above the conversations

Note: If you cannot trigger the native file picker in automation, use JavaScript to create a test upload:
```js
const input = document.querySelector('input[type="file"]');
const file = new File(['Test file content for upload testing'], 'test-document.txt', { type: 'text/plain' });
const dt = new DataTransfer();
dt.items.add(file);
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

### T5-3: Uploaded file appears in file list

1. After uploading a file (T5-2), take a screenshot
2. **Verify**: The file appears in the project section with:
   - A file icon (appropriate to the file type — FileText for .txt)
   - The filename
   - The file size (e.g., "36 B")
3. **Verify**: The file is listed between the project header and the conversation items

### T5-4: File delete button on hover

1. Hover over an uploaded file in the file list
2. Take a screenshot
3. **Verify**: A trash/delete icon appears on the right side of the file row
4. Click the delete button
5. **Verify**: The file is removed from the list

---

## Section 6 — Backend File API Integration

These tests verify the backend API endpoints work correctly through the UI. Use JavaScript console or network inspection to verify.

### T6-1: File list API returns correct data

1. Upload a file to a project (if not already done)
2. Execute JavaScript in the browser console:
   ```js
   fetch('http://localhost:3001/api/files/<projectId>/list').then(r => r.json()).then(d => console.log('FILE_LIST:', JSON.stringify(d)))
   ```
   (Replace `<projectId>` with an actual project ID — you can find it via `JSON.stringify(Object.keys(window.__zustand_stores || {}))` or by inspecting the store)
3. Read console messages filtered for `FILE_LIST`
4. **Verify**: The response contains a `files` array with objects having `id`, `projectId`, `filename`, `mimeType`, `sizeBytes`, and `extractedTextPreview` fields

### T6-2: Project cascade delete removes files from backend

1. Create a new project "Temp Project" and upload a file to it
2. Note the project ID
3. Right-click "Temp Project" and click "Delete Project"
4. Execute JavaScript:
   ```js
   fetch('http://localhost:3001/api/files/<projectId>/list').then(r => r.json()).then(d => console.log('AFTER_DELETE:', JSON.stringify(d)))
   ```
5. Read console messages filtered for `AFTER_DELETE`
6. **Verify**: The response shows `{"files":[]}` — all files were cascade-deleted

---

## Section 7 — Cross-cutting: Grouping Mode Persistence and Edge Cases

### T7-1: Switching to flat mode preserves project assignments

1. Assign a conversation to "Alpha Renamed" project
2. Switch grouping to "None"
3. **Verify**: The conversation appears in the flat list (no project grouping visible)
4. Switch back to "Projects"
5. **Verify**: The conversation is still under "Alpha Renamed" — the assignment was preserved

### T7-2: Deleting a conversation from project view

1. In "Projects" grouping, right-click a conversation under a project
2. Click "Delete" from the context menu
3. **Verify**: The conversation is removed from the project section
4. **Verify**: The conversation no longer appears anywhere in the sidebar

### T7-3: New conversation appears in Ungrouped

1. In "Projects" grouping, click the "+" button to create a new conversation
2. **Verify**: The new conversation appears under the "Ungrouped" section (since no project is assigned by default)

### T7-4: Project dialog close via X button

1. Click "New Project" button
2. Click the X button in the top-right of the dialog
3. **Verify**: The dialog closes without creating a project

### T7-5: Context menu dismissed on outside click

1. Right-click a project header to open the context menu
2. Click somewhere else on the page (not on the context menu)
3. **Verify**: The context menu disappears

---

## Section 8 — Visual Consistency

### T8-1: Project sections use correct colors

1. In "Projects" grouping, with at least one project visible
2. Take a screenshot
3. **Verify**: Project folder icons use the accent color
4. **Verify**: Project header text uses the primary text color
5. **Verify**: Conversation count badge uses muted text color
6. **Verify**: All colors adapt to the current theme (no hardcoded hex values)

### T8-2: File list uses correct colors and sizing

1. Upload a file to a project so files are visible
2. Take a screenshot and zoom into the file list area
3. **Verify**: File items use compact sizing (smaller text than conversation items)
4. **Verify**: File icons, filename, and size are all visible
5. **Verify**: Delete button appears only on hover

### T8-3: Dark mode compatibility

1. Open Settings, switch to Dark mode, close Settings
2. Switch sidebar to "Projects" grouping
3. Take a screenshot
4. **Verify**: Project headers, file lists, conversation items, and context menus all render correctly in dark mode
5. **Verify**: No light-mode colors bleeding through (white backgrounds, light borders, etc.)
6. Switch back to Light mode
7. **Verify**: All elements return to light-mode styling

---

## Cleanup (Destructive)

### TC-1: Clean up test data

1. Delete any test projects ("Alpha Renamed", "Beta Project") via context menu
2. Delete any test conversations created during testing
3. Switch grouping back to "None"
4. **Verify**: Sidebar returns to its default state with no project sections
