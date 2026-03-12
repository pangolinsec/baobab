# 13 — Project Knowledge

## Summary

Group conversations into projects with shared knowledge files. Files can be referenced inline with `@` syntax (injected directly into the prompt) or accessed agentically via tool_use. Supports text, PDF, code, and image files — all converted to text for model consumption.

## Status

**Implemented** — all phases (A, B, C) complete.

| Phase | Scope | Status |
|-------|-------|--------|
| A — Backend & data layer | File upload, text extraction (PDF/OCR/text), SQLite storage, REST endpoints, browser-only fallback with Dexie | Done |
| B — @mention & agentic access | `@file` autocomplete in chat input, `resolveKnowledgeContext` injection in `useStreamingResponse` (send/resend/retry), `read_file` tool for agentic mode, knowledge mode toggle (off/@mention/agentic) | Done |
| C — UI polish | File pills in rendered messages (`MarkdownWithFilePills`), click-to-resolve in detail panel, file size caps (10MB/file, 50MB/project backend, 20MB browser-only), large injection warning | Done |
| Bugfix pass | Phase C review (`Bugs/feature13c-phase-c-review.md`): global regex stale `lastIndex`, duplicated matching logic, missing `th`/`blockquote` coverage, lint warning — all fixed | Done |

### Known limitation

PDF/image upload requires the backend server. If the frontend loads before the API container is ready, the initial health check fails and is cached for 30 seconds — during which uploads fall back to text-only mode. Refocusing the browser tab or waiting 30s triggers a recheck.

## Priority

Tier 3 — requires backend.

## Dependencies

- **00 Backend Architecture**: file storage, PDF extraction, OCR.
- **24 Tags**: projects appear as a grouping mechanism in the sidebar alongside tags.

## Concepts

### Project

A named collection of conversations and knowledge files. Conversations belong to at most one project (or none — "ungrouped"). A project's knowledge files are accessible to all conversations within that project.

### Knowledge File

A file uploaded to a project. The original file is stored on disk (via backend); extracted text is cached for model consumption.

### Access Modes

1. **Direct injection (`@filename`)**: the user types `@` in the chat input, an autocomplete dropdown shows project files, and selecting one injects the file's full extracted text into the message at that position.

2. **Agentic access (toggle)**: when enabled, the system prompt is augmented with a file index (filenames + brief metadata), and a `read_file` tool is provided. The model can choose to read any file's content via tool_use.

## Data Model

### Frontend (IndexedDB)

```typescript
interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface Conversation {
  // ... existing
  projectId?: string;    // null = ungrouped
}
```

Dexie schema update:
```
projects: 'id, name, createdAt'
conversations: 'id, createdAt, updatedAt, projectId'
```

### Backend (SQLite)

The backend does **not** store a `projects` table. Project metadata lives exclusively in frontend IndexedDB (see ADR-001 Decision 9). The backend only stores `project_files`, which references `project_id` as a loose foreign key — the project record itself is in IndexedDB.

```sql
-- Only project_files in backend SQLite (no projects table)
CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,     -- references frontend project ID, no FK constraint
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  extracted_text TEXT,
  file_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

When the frontend creates/updates/deletes a project, it pushes the change to the backend via `PUT /api/projects` (upsert) or `DELETE /api/projects/:id`. The backend uses this to manage associated files. Startup reconciliation cleans up orphan backend files for projects that no longer exist in the frontend.

### Frontend File Reference

```typescript
interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedTextPreview: string;  // first ~200 chars for autocomplete display
}
```

The frontend stores a lightweight file index (fetched from backend) for autocomplete. Full text content is fetched on demand.

## File Processing (Backend)

### Supported Formats

| Format | Processing |
|--------|-----------|
| `.txt`, `.md`, `.csv`, `.json`, `.yaml` | Used as-is (read file content directly) |
| `.js`, `.ts`, `.py`, `.go`, `.rs`, etc. | Used as-is (code files are plain text) |
| `.pdf` | Text extraction via `pdf-parse` |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | OCR via `tesseract.js` |

### Upload Flow

1. User uploads file via the project panel.
2. Backend receives the file (`POST /api/files/upload`).
3. Backend stores the original file on disk.
4. Backend extracts text based on MIME type.
5. Backend stores metadata + extracted text in SQLite.
6. Backend returns the file metadata to the frontend.
7. Frontend caches the file index in memory for autocomplete.

## UI — Sidebar Projects

The sidebar uses a unified design shared with Feature 24 (Tags) and Feature 11 (Star Messages). See ADR-001 Decision 6.

The sidebar has:
- A persistent search bar at the top.
- A `[Chats | Starred]` primary mode toggle.
- A `[None | Projects | Tags]` grouping selector (in Chats view). The "Tags" option is deferred to v2.
- Tag pills on conversation items (from Feature 24) when tags are present.

When grouping by Projects, the content area shows:

```
┌──────────────────────────────┐
│ Baobab                 [+] │
├──────────────────────────────┤
│ 🔍 [Search messages...]      │
│ View: [Chats] [Starred]      │
│ Group: [None|Projects|Tags]  │
├──────────────────────────────┤
│ ▼ Biology Research (project) │
│   📄 textbook.pdf            │
│   📄 notes.md                │
│   💬 Frog Evolution          │
│      [research/biology]      │
│   💬 Amphibian Genetics      │
│      [research/biology][imp.]│
│                              │
│ ▼ Code Review (project)      │
│   📄 codebase.ts             │
│   💬 Refactoring Plan        │
│      [work/code-review]      │
│                              │
│ ▼ Ungrouped                  │
│   💬 Random Chat             │
│   💬 Quick Question          │
│      [personal]              │
├──────────────────────────────┤
│ [Settings]                   │
└──────────────────────────────┘
```

- Projects are collapsible in the sidebar.
- Each project shows its knowledge files and conversations.
- A "+" button on a project adds a file or conversation.
- Drag-and-drop to move conversations between projects.

### Project Management

- **Create project**: "+" button in sidebar → "New Project" → name input.
- **Rename project**: right-click → rename.
- **Delete project**: right-click → delete. Conversations become ungrouped; files are deleted.
- **Add file**: click "+" on project → file picker. Or drag-and-drop onto the project.

## UI — `@` Mention in Chat Input

When the user types `@` in the chat input:

```
┌─────────────────────────────────────────────────┐
│ Tell me about the species in @                  │
│ ┌─────────────────────────────────┐             │
│ │ 📄 textbook.pdf (142 KB)       │             │
│ │ 📄 notes.md (3.2 KB)           │             │
│ │ 📄 species_list.csv (800 B)    │             │
│ └─────────────────────────────────┘             │
├─────────────────────────────────────────────────┤
│                                        [Send ▶] │
└─────────────────────────────────────────────────┘
```

- Autocomplete dropdown appears immediately on `@`.
- Scoped to the current project's files only.
- Typing after `@` filters the list (fuzzy match on filename).
- Selecting a file inserts `@filename.ext` into the message.
- The `@filename.ext` text is visually styled in the input (e.g., as a pill/chip with a file icon).
- On send, the message is stored in `TreeNode.content` with `@filename.ext` references **unresolved**. Resolution (fetching extracted text and substituting inline) happens at API-call time only, not at storage time. This prevents bloating IndexedDB when the same file is referenced across many messages.

### File Versioning Behavior

Lazy resolution always uses the **current file content** at API-call time. This is a conscious design choice:

- If a file is **updated** after messages referencing it were sent, re-sending those messages (via Feature 23 resend) uses the new file content. Old messages displayed in the UI still show the `@filename.ext` pill — clicking it in the detail panel fetches the current content.
- If a file is **deleted**, `resolveFileReferences` replaces the reference with `[File not found: filename.ext]` and logs a warning. The message is still sent to the model with this placeholder rather than failing silently.
- This means the conversation history effectively references "the latest version of this file," not a snapshot. Users who need snapshot behavior should paste the content directly instead of using `@` references.

### File Size Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| **Per-file maximum** | 10 MB | Prevents accidental upload of large binaries; sufficient for any text/code/PDF document |
| **Per-project maximum** | 50 MB total | Keeps IndexedDB/disk usage bounded for self-hosted app |
| **Backend enforcement** | `413` response | Backend rejects files exceeding per-file limit before processing |
| **Frontend enforcement** | Pre-upload check | `File.size` checked before upload; error shown immediately without network round-trip |

Browser-only mode (text files stored in IndexedDB) uses the same per-file limit but a lower per-project limit of 20 MB, since IndexedDB storage is more constrained than disk.

### Large File Handling

When the injected text would exceed a reasonable token count (e.g., >50,000 tokens estimated at ~4 chars/token), show a warning before sending: "This file is large (est. ~60K tokens). This will consume significant context. Continue?"

This is separate from the upload size limit — a 2 MB text file is well under the upload limit but may still produce 500K+ tokens when injected via `@`.

## UI — Agentic Knowledge Access Toggle

A toggle in the conversation header or settings:

```
📁 Knowledge Access: [Direct @] [Agentic 🤖]
```

Or a simple toggle: `🤖 Agentic file access [on/off]`

### When Agentic Access is On

The system prompt is augmented with a file index:

```
You have access to the following project files. Use the read_file tool to access their contents when relevant.

Files:
- textbook.pdf (142 KB) — Biology textbook, chapters on amphibian evolution
- notes.md (3.2 KB) — Research notes on frog species
- species_list.csv (800 B) — CSV of known species with classification
```

And a `read_file` tool is added:

```typescript
const readFileTool = {
  name: 'read_file',
  description: 'Read the content of a project knowledge file.',
  input_schema: {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'The filename to read' },
    },
    required: ['filename'],
  },
};
```

When the model calls `read_file`, the backend fetches the extracted text and returns it as a tool result.

### Visual Notice

When agentic access is toggled on and the current model doesn't support tool use (e.g., some HuggingFace models):

```
⚠️ Current model (mistral-7b) may not support tool use. Agentic file access may not work.
```

This is a non-blocking warning — the user can still enable it.

### No Visual Indicator Per-Message

Toggling agentic access does NOT trigger a visual indicator per feature 10, since it's not a system prompt change — it's an augmentation of the system prompt with metadata. The system prompt itself is considered unchanged.

## API Integration

### Direct `@` Injection

In `useStreamingResponse`, before sending:

```typescript
// Resolve @ references in the user message at API-call time
const resolvedContent = await resolveFileReferences(userMessage, projectId);
// resolvedContent has @filename replaced with:
// "[Content of filename.ext]\n{extracted text}\n[End of filename.ext]"
```

**Important**: The `TreeNode.content` stores the **unresolved** message with `@filename.ext` references intact. Resolution happens at API-call time only — the resolved content is sent to the model but not persisted. This avoids bloating IndexedDB with duplicate file content across every message that references the same file. When displaying a message that contains `@filename.ext` references, render them as styled pills/chips (like the input) with a tooltip showing the file size. The detail panel can show the resolved content on demand by fetching the file text.

### Agentic Access

In `useStreamingResponse`, when agentic access is on:

1. Fetch the file index from the backend.
2. Augment the system prompt with the file index.
3. Include the `read_file` tool in the API call.
4. Handle tool_use responses: call `GET /api/files/:id/text` and return as tool_result.

## Backend Endpoints

Already defined in feature 00. Key endpoints:

- `POST /api/files/upload` — upload and process file
- `GET /api/files/:id/text` — get extracted text
- `GET /api/projects/:projectId/files` — list project files (returns metadata for the frontend index)
- `DELETE /api/files/:id` — delete file

## Browser-Only Mode

- Projects still work as a grouping mechanism for conversations.
- File upload is limited to text files only (read via `FileReader` API, stored in IndexedDB).
- No PDF extraction or OCR.
- `@` injection works (from IndexedDB-stored text files).
- Agentic access works if the model supports tools and files are text.
