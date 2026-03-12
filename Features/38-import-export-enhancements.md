# 38 — Import/Export Enhancements

## Summary

Extend the existing per-conversation JSON import/export (sidebar buttons) with bulk export, project-inclusive exports, external format import (ChatGPT), Markdown export for sharing, and settings backup/restore. The current implementation exports a single conversation as JSON with full node data and imports with ID remapping — this feature builds on that foundation.

## Priority

Tier 2 — quality-of-life enhancement.

## Dependencies

- **13 Project Knowledge**: project-inclusive exports include file metadata and extracted text.
- Existing import/export in `useTreeStore.importConversation()` and `Sidebar.tsx`.

## Current State

The existing implementation (commit `e541482`):

- **Export**: Downloads a single conversation as `{title}.json` containing `{ conversation, nodes }`. Excludes the silent root node.
- **Import**: Reads a `.json` file, remaps all UUIDs, creates new root node, appends "(imported)" to title. Handles orphaned nodes by re-parenting to root.
- **Location**: Export/import buttons in sidebar footer.
- **Format**: Baobab-native JSON only.

### Limitations to Address

1. No bulk export (all conversations or filtered subset).
2. Projects and files not included.
3. No external format import (ChatGPT, Claude.ai exports).
4. No human-readable export (Markdown, PDF).
5. No settings backup/restore.

## Phasing

| Phase | Scope | Prerequisites | Status |
|-------|-------|---------------|--------|
| **A** | Bulk export: export all or filtered conversations as a single JSON archive. Bulk import of archives. | — | — |
| **B** | Project-inclusive export: include project metadata and file references in exports. | 13 | — |
| **C** | Markdown export: export a conversation thread as a readable Markdown file. | — | — |
| **D** | External format import: import ChatGPT conversation exports. | — | — |
| **E** | Settings backup/restore: export and import AppSettings. | — | — |

---

## Phase A — Bulk Export/Import

### Bulk Export

A new "Export All" option in the sidebar or settings:

**Entry point**: Sidebar footer, next to existing export button:

```
┌──────────────────────────────────┐
│                                  │
│ [↓ Export]  [↓ Export All]       │
│ [↑ Import]                       │
└──────────────────────────────────┘
```

Or as a dropdown on the existing export button:

```
[↓ Export ▾]
  ├─ This conversation
  ├─ All conversations
  ├─ Filter by project...
  └─ Filter by tag...
```

**Archive format**: A single JSON file containing all conversations:

```typescript
interface BaobabArchive {
  version: 1;
  exportedAt: number;
  source: 'baobab';
  conversations: Array<{
    conversation: Conversation;
    nodes: Record<string, TreeNode>;
  }>;
  // Phase B additions:
  projects?: Project[];
  // Phase E additions:
  settings?: Partial<AppSettings>;
}
```

**Filename**: `baobab-export-{date}.json` (e.g., `baobab-export-2026-02-23.json`).

**Filtered export**: User can filter by:
- Project: export all conversations in a project.
- Tag: export all conversations with a specific tag.
- Date range: export conversations created/updated within a range.

### Bulk Import

When importing an archive file:

1. Detect format: if `version` field exists and `conversations` is an array, treat as archive.
2. Show a preview dialog:

```
┌─── Import Archive ──────────────────────────────────────┐
│                                                          │
│ baobab-export-2026-02-23.json                          │
│ 15 conversations found                                   │
│                                                          │
│ ☑ Quantum Computing Research (42 nodes)                  │
│ ☑ API Design Discussion (18 nodes)                       │
│ ☑ Book Notes: Thinking Fast and Slow (73 nodes)          │
│ ☐ Quick Question (3 nodes)                               │
│ ...                                                      │
│                                                          │
│ [Select All]  [Select None]                              │
│                                                          │
│ Selected: 14 conversations, ~2,400 nodes                 │
│                                                          │
│                          [Cancel]  [Import Selected]     │
└──────────────────────────────────────────────────────────┘
```

3. Import selected conversations using the existing `importConversation()` logic (ID remapping, root node creation, "(imported)" suffix).
4. Show progress for large imports: "Importing 14/15..."
5. Report results: "14 conversations imported. 1 skipped (duplicate title)."

### Store Changes

```typescript
// useTreeStore.ts — new actions
exportAll: () => BaobabArchive;
exportFiltered: (filter: ExportFilter) => BaobabArchive;
importArchive: (archive: BaobabArchive, selectedIds: string[]) => Promise<ImportResult>;

interface ExportFilter {
  projectId?: string;
  tag?: string;
  dateFrom?: number;
  dateTo?: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
```

---

## Phase B — Project-Inclusive Export

### Enhanced Archive Format

When exporting conversations that belong to projects, include project metadata:

```typescript
interface BaobabArchive {
  // ... existing fields
  projects?: Array<{
    project: Project;
    files: Array<{
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      extractedText: string;     // Full extracted text (not the binary file)
    }>;
  }>;
}
```

**Important**: The export includes the **extracted text** of project files, not the original binary files. This keeps exports portable (plain JSON) and reasonably sized. Users who need the original PDFs/images can re-upload them.

### Import with Projects

When importing an archive with projects:

1. Show project info in the preview dialog:

```
│ Projects included:                                       │
│ ☑ Biology Research (2 files: textbook.pdf, notes.md)     │
│ ☑ Code Review (1 file: codebase.ts)                      │
```

2. Create projects if they don't exist (matched by name).
3. If a project with the same name exists, offer:
   - **Merge**: add conversations to existing project, skip duplicate files.
   - **Create new**: create "Biology Research (imported)" as a separate project.
4. Re-create files from extracted text (text files only — PDF/image files store extracted text with a note that the original binary is not included).

---

## Phase C — Markdown Export

Export a conversation as a human-readable Markdown file suitable for sharing, reading, or archiving outside Baobab.

### Entry Point

In the export dropdown:

```
[↓ Export ▾]
  ├─ JSON (this conversation)
  ├─ JSON (all conversations)
  ├─ Markdown (this thread)       ← new
  └─ Markdown (full tree)         ← new
```

### "This Thread" Export

Exports the currently selected thread (root → selected node path) as a linear Markdown document:

```markdown
# Quantum Computing Research

*Exported from Baobab on 2026-02-23*
*Model: claude-sonnet-4-20250514 (Anthropic)*

---

## User

Explain quantum error correction in simple terms.

## Assistant

Quantum error correction is a technique used to protect quantum information
from errors caused by decoherence and noise...

[🔍 Web search: "quantum error correction latest results"]

---

## User

What about the IBM results specifically?

## Assistant

IBM's recent work with their Eagle processor has been groundbreaking...

**Sources:**
- [IBM achieves quantum error correction milestone](https://nature.com/...)
- [Quantum Computing Progress Report 2026](https://arxiv.org/...)
```

### "Full Tree" Export

Exports the entire conversation tree with branch structure indicated by indentation and markers:

```markdown
# Quantum Computing Research (Full Tree)

*Exported from Baobab on 2026-02-23*

---

## [1] User

Explain quantum error correction.

### [1.1] Assistant (claude-sonnet-4-20250514)

Quantum error correction is a technique...

#### [1.1.1] User

What about the IBM results?

##### [1.1.1.1] Assistant (claude-sonnet-4-20250514)

IBM's recent work...

#### [1.1.2] User ← *Branch point*

How does this compare to Google's approach?

##### [1.1.2.1] Assistant (gpt-4o) ← *Model override*

Google's approach differs in that...

### [1.2] Assistant (gemini-2.0-flash) ← *Branch from [1]*

From a simplified perspective, quantum error correction...
```

Nodes are numbered with a hierarchical scheme (1, 1.1, 1.1.1, etc.) to show tree structure. Branch points are annotated. Model overrides are noted.

### Metadata

Include in the Markdown header:
- Conversation title and export date.
- Model(s) used.
- System prompt (if non-default).
- Tags.
- Star/dead-end annotations as Markdown comments or footnotes.

---

## Phase D — External Format Import

### ChatGPT Export Format

ChatGPT's "Export data" feature produces a ZIP containing `conversations.json`:

```json
[
  {
    "title": "Conversation Title",
    "create_time": 1708000000.0,
    "update_time": 1708000100.0,
    "mapping": {
      "node-id-1": {
        "id": "node-id-1",
        "parent": null,
        "children": ["node-id-2"],
        "message": {
          "author": { "role": "system" },
          "content": { "parts": ["You are a helpful assistant."] },
          "create_time": 1708000000.0
        }
      },
      "node-id-2": {
        "id": "node-id-2",
        "parent": "node-id-1",
        "children": ["node-id-3"],
        "message": {
          "author": { "role": "user" },
          "content": { "parts": ["Hello, how are you?"] },
          "create_time": 1708000001.0
        }
      }
    }
  }
]
```

### Import Mapping

ChatGPT → Baobab mapping:

| ChatGPT | Baobab |
|---------|----------|
| `mapping` (node map) | `nodes: Record<string, TreeNode>` |
| `message.author.role: "user"` | `role: 'user'` |
| `message.author.role: "assistant"` | `role: 'assistant'` |
| `message.author.role: "system"` | Extracted as `systemPrompt` on Conversation |
| `message.author.role: "tool"` | Stored as `toolCalls` on parent assistant node |
| `message.content.parts` | Joined with `\n` as `content` |
| `title` | `title` |
| `create_time` (Unix float) | `createdAt` (ms) |
| `mapping` tree structure | `parentId` / `childIds` |
| `message.metadata.model_slug` | `model` (best-effort mapping: `gpt-4` → `gpt-4`) |

### Import Flow

1. User selects a `.zip` file or `conversations.json`.
2. If ZIP: extract `conversations.json` from the archive.
3. Parse and detect format (ChatGPT format has `mapping` with `message.author.role`).
4. Show preview dialog with conversation list (same as archive import).
5. Transform selected conversations to Baobab format.
6. Import using existing `importConversation()` with ID remapping.

### Format Detection

```typescript
function detectFormat(data: unknown): 'baobab' | 'baobab-archive' | 'chatgpt' | 'unknown' {
  if (Array.isArray(data) && data[0]?.mapping) return 'chatgpt';
  if ((data as any).version && (data as any).conversations) return 'baobab-archive';
  if ((data as any).conversation && (data as any).nodes) return 'baobab';
  return 'unknown';
}
```

The import button accepts both `.json` and `.zip` files and auto-detects the format.

### Limitations

- ChatGPT conversations are linear (no branching) — they import as linear chains in the tree.
- ChatGPT tool use (code interpreter, DALL-E) imports as text content with tool metadata lost.
- System messages become the conversation's `systemPrompt`.
- No model-specific metadata (temperature, etc.) is preserved.

---

## Phase E — Settings Backup/Restore

### Export Settings

In Settings page footer:

```
[↓ Export Settings]  [↑ Import Settings]
```

Exports `AppSettings` as JSON, **excluding sensitive fields**:

```typescript
function exportSettings(settings: AppSettings): Partial<AppSettings> {
  const exported = { ...settings };
  // Strip API keys and tokens
  delete exported.providers;     // Contains API keys
  delete exported.httpTools;     // Contains auth tokens
  delete exported.mcpServers;    // Contains env vars with secrets
  // Keep everything else: defaults, prompts, pricing, preferences
  return exported;
}
```

**Filename**: `baobab-settings-{date}.json`.

### Import Settings

1. User selects settings JSON file.
2. Show preview: "This will update: Default model, system prompt, pricing settings, ..."
3. Confirm → merge into current settings (does not overwrite API keys or tool configs).

### Sensitive Data Warning

If the user manually edits the export to include API keys and re-imports:
- Show warning: "This settings file contains API keys. Import anyway?"
- Proceed if confirmed.

---

## UI — Unified Import Dialog

All import flows (single conversation, archive, ChatGPT, settings) use a single entry point:

```
[↑ Import]  → file picker (.json, .zip)
              → auto-detect format
              → route to appropriate dialog:
                 ├─ Single Baobab conversation → direct import
                 ├─ Baobab archive → preview dialog with selection
                 ├─ ChatGPT export → preview dialog with selection
                 └─ Settings → preview dialog with confirmation
```

The format detection happens automatically. If the format is unknown, show: "Unrecognized file format. Supported: Baobab JSON, Baobab archive, ChatGPT export, Settings backup."

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/import-export/ExportDropdown.tsx` | Export button dropdown with options |
| `src/components/import-export/ImportPreviewDialog.tsx` | Preview dialog for archive/ChatGPT import |
| `src/components/import-export/MarkdownExporter.tsx` | Markdown export logic (thread and full tree) |
| `src/lib/import/chatgpt.ts` | ChatGPT format parser and transformer |
| `src/lib/import/detection.ts` | Format auto-detection |
| `src/lib/export/markdown.ts` | Markdown generation (thread and tree modes) |
| `src/lib/export/archive.ts` | Archive creation with filtering |

## Files to Modify

| File | Change |
|------|--------|
| `src/store/useTreeStore.ts` | Add `exportAll`, `exportFiltered`, `importArchive` actions |
| `src/components/layout/Sidebar.tsx` | Replace simple export/import buttons with dropdown and unified import |
| `src/components/settings/SettingsDialog.tsx` | Add export/import settings buttons in footer |
| `src/types/index.ts` | Add `BaobabArchive`, `ExportFilter`, `ImportResult` types |

## Implementation Order

1. **Phase A**: Archive format → bulk export → bulk import with preview dialog.
2. **Phase B**: Project inclusion in archive → import with project merge.
3. **Phase C**: Markdown thread export → Markdown tree export.
4. **Phase D**: ChatGPT format parser → format detection → import flow.
5. **Phase E**: Settings export (with key stripping) → settings import.

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty archive (0 conversations) → "No conversations found in file." ChatGPT export with no messages → skip conversation. |
| What if the external dependency is unavailable? | All import/export is client-side (no backend needed). Project file text comes from IndexedDB cache or backend. If backend unavailable for Phase B, export without file text and note the limitation. |
| What if this runs concurrently with itself? | Two imports simultaneously → each gets independent ID remapping, no conflicts. Two exports → independent files. |
| What happens on the second invocation? | Re-importing the same archive creates duplicates (all IDs are remapped). No deduplication by content — this matches the existing behavior. |
| What if the user's data is larger than expected? | Large archives (1000+ conversations): show progress during import. Markdown export of a 1000-node tree → warn "This tree has 1000 nodes. The Markdown file will be large." Stream to file if >10MB. |
| What state persists vs. resets across page reload? | Import preview state is transient (dialog closes on reload). All imported data persists in IndexedDB. Export filters are transient. |

## Browser-Only Mode

All phases work in browser-only mode:
- **Phase A**: Full functionality (IndexedDB → JSON → download).
- **Phase B**: Projects export without file text if files are backend-stored. Text-only files (browser-only mode) export fully.
- **Phase C**: Full functionality.
- **Phase D**: Full functionality.
- **Phase E**: Full functionality.
