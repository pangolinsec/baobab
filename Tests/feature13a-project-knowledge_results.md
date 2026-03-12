# Feature 13 Phase A — Test Results

**Executed**: 2026-02-20
**Environment**: Baobab dev server via Docker (`localhost:5173`), backend API at `localhost:3001`, Chrome MCP automation
**Starting state**: Dark mode, multiple existing conversations (Tell me a joke, What is the current population of Tokyo?, Tell me about cats, etc.)

---

## Summary

| Section | Total | Pass | Fail | Skipped | Notes |
|---------|-------|------|------|---------|-------|
| 1 — Sidebar Grouping Selector | 4 | 4 | 0 | 0 | |
| 2 — Project CRUD | 7 | 7 | 0 | 0 | |
| 3 — Assigning Conversations | 4 | 4 | 0 | 0 | |
| 4 — Collapse/Expand | 3 | 3 | 0 | 0 | |
| 5 — File Upload | 4 | 4 | 0 | 0 | |
| 6 — Backend File API | 2 | 2 | 0 | 0 | |
| 7 — Cross-cutting | 5 | 5 | 0 | 0 | |
| 8 — Visual Consistency | 3 | 3 | 0 | 0 | |
| Cleanup | 1 | 1 | 0 | 0 | |
| **Total** | **33** | **33** | **0** | **0** | |

---

## Section 1 — Sidebar Grouping Selector

### T1-1: Grouping selector is visible in All Chats tab
**Result: PASS**

**Actions**: Navigated to `localhost:5173`, ensured sidebar was expanded and "All Chats" tab was active.

**Observations**:
- Below the "All Chats / Starred" tab switcher, a row shows `Group: [None] [Projects]`
- "None" is highlighted with the accent orange color (it is the default)
- "Projects" is shown in muted color

---

### T1-2: Grouping selector is hidden in Starred tab
**Result: PASS**

**Actions**: Clicked "Starred" tab, took screenshot, clicked back to "All Chats".

**Observations**:
- In the Starred tab, the grouping selector row is NOT visible
- Clicking back to "All Chats" makes the grouping selector reappear

---

### T1-3: Toggling grouping mode
**Result: PASS**

**Actions**: Clicked "Projects" button in the grouping row.

**Observations**:
- "Projects" became highlighted with accent orange color
- "None" became muted
- An "Ungrouped" section appeared containing all conversations (no projects created yet)
- A "New Project" button appeared at the bottom of the conversation list with a folder-plus icon
- Clicking "None" switched back to the flat list without project sections

---

### T1-4: Tag filter hidden when grouped by projects
**Result: PASS**

**Actions**: Noted tag filter strip (ai, important, machine-learning) visible in "None" mode, then switched to "Projects".

**Observations**:
- In "None" mode: tag filter strip is visible below the grouping selector
- In "Projects" mode: tag filter strip is NOT visible — hidden as expected

---

## Section 2 — Project CRUD

### T2-1: Create a new project
**Result: PASS**

**Actions**: Switched to "Projects" grouping, clicked "New Project", filled in name "Test Project Alpha" and description "First test project", clicked "Create".

**Observations**:
- Modal dialog appeared with title "New Project", Name input, Description (optional) field, Cancel and Create buttons
- After clicking Create, dialog closed
- "Test Project Alpha" appeared as a collapsible section in the sidebar with an orange folder icon

---

### T2-2: Create a second project
**Result: PASS**

**Actions**: Clicked "New Project" again, typed "Beta Project", left description empty, clicked "Create".

**Observations**:
- Both "Test Project Alpha" and "Beta Project" appear as separate sections
- An "Ungrouped" section exists below the projects containing conversations not assigned to any project

---

### T2-3: Create project via Enter key
**Result: PASS**

**Actions**: Clicked "New Project", typed "Gamma" in the Name field, pressed Enter.

**Observations**:
- Dialog closed and "Gamma" appeared as a new project section

---

### T2-4: Cancel project creation
**Result: PASS**

**Actions**: Clicked "New Project", typed "Should Not Exist", clicked "Cancel".

**Observations**:
- Dialog closed
- "Should Not Exist" does NOT appear in the project list

---

### T2-5: Empty name is prevented
**Result: PASS**

**Actions**: Clicked "New Project", left Name field empty.

**Observations**:
- The "Create" button is visually disabled (opacity ~0.4) and non-clickable
- Clicked "Cancel" to dismiss

---

### T2-6: Rename a project via context menu
**Result: PASS**

**Actions**: Right-clicked "Test Project Alpha" header, clicked "Rename", cleared name, typed "Alpha Renamed", clicked "Save".

**Observations**:
- Context menu appeared with "Rename" and "Delete Project" options
- Rename dialog appeared with title "Rename Project", pre-filled with "Test Project Alpha"
- After saving, the project header now shows "Alpha Renamed"

---

### T2-7: Delete a project via context menu
**Result: PASS**

**Actions**: Right-clicked "Gamma" header, clicked "Delete Project".

**Observations**:
- "Gamma" is no longer visible in the sidebar project list
- (Gamma had no conversations, so no ungrouped items appeared)

---

## Section 3 — Assigning Conversations to Projects

### T3-1: Move conversation to a project via context menu
**Result: PASS**

**Actions**: In "Projects" grouping, right-clicked a conversation ("Tell me a joke") under "Ungrouped", clicked "Move to project", then clicked "Alpha Renamed".

**Observations**:
- Context menu appeared with "Move to project" and "Delete" options
- Submenu listed "None (ungrouped)" and all projects ("Alpha Renamed", "Beta Project")
- After clicking "Alpha Renamed", the conversation moved to the "Alpha Renamed" section
- It no longer appeared under "Ungrouped"

---

### T3-2: Move conversation back to ungrouped
**Result: PASS**

**Actions**: Right-clicked the conversation under "Alpha Renamed", clicked "Move to project" → "None (ungrouped)".

**Observations**:
- The conversation moved back to the "Ungrouped" section
- It is no longer listed under "Alpha Renamed"

---

### T3-3: Conversation still navigable after project assignment
**Result: PASS**

**Actions**: Moved "Tell me a joke" to "Beta Project" via context menu, then clicked on it to open it.

**Observations**:
- The conversation loaded normally in the main tree view, showing the user message and assistant response
- The conversation is highlighted in the sidebar under its project ("Beta Project")

---

### T3-4: Context menu for conversations in flat (None) grouping
**Result: PASS**

**Actions**: Switched to "None" grouping, right-clicked on a conversation.

**Observations**:
- Context menu appeared with "Move to project" and "Delete" options — same as in project-grouped view

---

## Section 4 — Project Section Collapse/Expand

### T4-1: Collapse a project section
**Result: PASS**

**Actions**: Ensured "Alpha Renamed" had at least one conversation, clicked on the project header.

**Observations**:
- The project section collapsed — conversations and files under it are hidden
- The chevron icon changed from pointing down to pointing right

---

### T4-2: Expand a collapsed project section
**Result: PASS**

**Actions**: Clicked the collapsed "Alpha Renamed" header again.

**Observations**:
- The section expanded, showing conversations and files
- The chevron points down again

---

### T4-3: Conversation count badge on project header
**Result: PASS**

**Actions**: Moved two conversations to "Alpha Renamed".

**Observations**:
- The project header shows a count badge "2" next to the project name in muted text

---

## Section 5 — File Upload

### T5-1: File upload button appears on project header hover
**Result: PASS**

**Actions**: Hovered over the "Alpha Renamed" project header.

**Observations**:
- An upload button (upload arrow icon) appeared on the right side of the project header row

---

### T5-2: Upload a text file
**Result: PASS**

**Actions**: Clicked the upload button on "Alpha Renamed", used JavaScript to simulate file upload:
```js
const file = new File(['Test file content for API testing...'], 'api-test-file.txt', { type: 'text/plain' });
```

**Observations**:
- File upload triggered successfully
- After upload, the file appeared in the project section below the header

---

### T5-3: Uploaded file appears in file list
**Result: PASS**

**Actions**: Examined the file listing after upload.

**Observations**:
- The file appears with: a file icon (FileText for .txt), the filename "api-test-file.txt", and the file size "42 B"
- The file is listed between the project header and the conversation items

---

### T5-4: File delete button on hover
**Result: PASS**

**Actions**: Hovered over the uploaded file in the file list.

**Observations**:
- A trash/delete icon appeared on the right side of the file row
- Clicking the delete button removed the file from the list

---

## Section 6 — Backend File API Integration

### T6-1: File list API returns correct data
**Result: PASS**

**Actions**: Uploaded a new file to Alpha Renamed, then executed JavaScript to call the file list API:
```js
fetch('http://localhost:3001/api/files/<projectId>/list').then(r => r.json()).then(d => console.log('FILE_LIST:', JSON.stringify(d)))
```

**Observations**:
- Response contained a `files` array with objects having all required fields:
  - `id`: UUID
  - `projectId`: matching the project UUID
  - `filename`: "api-test-file.txt"
  - `mimeType`: "text/plain"
  - `sizeBytes`: 42
  - `extractedTextPreview`: "Test file content for API testing..."

---

### T6-2: Project cascade delete removes files from backend
**Result: PASS**

**Actions**: Created "Temp Project" (ID: `37ee94f8-265b-42a7-ba31-4d53a875c80a`), uploaded "temp-cascade-test.txt" (49 B) to it. Verified file existed via API (`BEFORE_DELETE` showed 1 file). Deleted "Temp Project" via context menu. Queried API again.

**Observations**:
- Before delete: API returned `{"files":[{"id":"d381af27-...","projectId":"37ee94f8-...","filename":"temp-cascade-test.txt","mimeType":"text/plain","sizeBytes":49,"extractedTextPreview":"Temp project file content for cascade delete test"}]}`
- After delete: API returned `{"files":[]}` — all files were cascade-deleted

---

## Section 7 — Cross-cutting: Grouping Mode Persistence and Edge Cases

### T7-1: Switching to flat mode preserves project assignments
**Result: PASS**

**Actions**: With conversations assigned to "Alpha Renamed" (2 items) and "Beta Project" (1 item), switched grouping to "None" then back to "Projects".

**Observations**:
- In "None" mode: all conversations appear in the flat list
- Switching back to "Projects": conversations are still under their respective projects — assignments preserved

---

### T7-2: Deleting a conversation from project view
**Result: PASS**

**Actions**: In "Projects" grouping, right-clicked "New Conversation" under "Alpha Renamed", clicked "Delete".

**Observations**:
- The conversation was removed from the project section
- The project count decreased from 2 to 1
- The conversation no longer appears anywhere in the sidebar

---

### T7-3: New conversation appears in Ungrouped
**Result: PASS**

**Actions**: In "Projects" grouping, clicked the "+" button to create a new conversation.

**Observations**:
- New conversation "New Conversation" created and appeared under the "Ungrouped" section (highlighted)
- It was not assigned to any project by default

---

### T7-4: Project dialog close via X button
**Result: PASS**

**Actions**: Clicked "New Project" to open dialog, then clicked the X button in the top-right.

**Observations**:
- Dialog closed without creating a project
- No new project sections appeared

---

### T7-5: Context menu dismissed on outside click
**Result: PASS**

**Actions**: Right-clicked a project header to open context menu, then clicked on the main content area.

**Observations**:
- The context menu disappeared after clicking outside of it

---

## Section 8 — Visual Consistency

### T8-1: Project sections use correct colors
**Result: PASS**

**Actions**: In "Projects" grouping with projects visible, zoomed into the project sections area in dark mode.

**Observations**:
- Project folder icons use the accent orange color
- Project header text uses the primary text color (light on dark)
- Conversation count badge uses muted text color
- All colors adapt to the current theme (no hardcoded hex values visible)

---

### T8-2: File list uses correct colors and sizing
**Result: PASS**

**Actions**: With a file uploaded to a project, zoomed into the file list area in dark mode.

**Observations**:
- File items use compact sizing (smaller text than conversation items)
- File icon, filename ("api-test-file.txt"), and size ("42 B") are all visible
- Delete button appears only on hover (confirmed by comparing hovered vs non-hovered states)

---

### T8-3: Dark mode compatibility
**Result: PASS**

**Actions**: Verified projects view in dark mode, switched to light mode via Settings, took screenshot, switched back to dark mode.

**Observations**:
- Dark mode: Project headers, file lists, conversation items, grouping selector, context menus all render correctly with dark backgrounds, light text, orange accent colors. No light-mode colors bleeding through
- Light mode: All elements switch correctly — light backgrounds, dark text, same orange accents, warm-beige borders. No dark-mode remnants
- After switching back to dark mode: All elements return to correct dark-mode styling

---

## Cleanup

### TC-1: Clean up test data
**Result: PASS**

**Actions**: Deleted "Alpha Renamed" and "Beta Project" via context menu. Deleted the test "New Conversation" created during testing. Switched grouping back to "None".

**Observations**:
- Sidebar returned to its default state with flat conversation list, tag filters, no project sections
