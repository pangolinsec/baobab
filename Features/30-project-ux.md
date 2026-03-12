# 30 — Project UX Improvements

## Summary

Improve the project interaction model: clicking a project header in the sidebar navigates to the project detail page (full-page route), the chevron toggles collapse/expand of the conversation list independently. Add a "Start Chat" button on the project detail page that creates a conversation pre-assigned to the project with inherited system prompt. Improve the knowledge file display on the project detail page.

## Priority

Tier 2 — power feature (small scope).

## Dependencies

- **13 Project Knowledge**: project detail page already exists with file management.

## Phasing

Single implementation — no phasing needed.

---

## Changes

### 1. Sidebar Project Header Behavior

**Current behavior**: Clicking the project header row (name + icons) toggles collapse/expand of the conversation list underneath. The gear icon navigates to `/projects/:id`.

**New behavior**:
- **Clicking the project name** navigates to `/projects/:id` (the project detail page replaces the main content area).
- **Clicking the chevron (▸/▾)** toggles collapse/expand of the conversation list in the sidebar.
- **Remove the gear icon** — it's redundant now that clicking the name navigates to the detail page.

The chevron is always visible. The project name is styled as a link (cursor pointer, hover underline or color shift).

```
┌──────────────────────────────────┐
│ ▾  My Research Project           │  ← click name → navigate
│    ↑ click chevron → toggle      │     click ▾ → collapse
│    Conversation A                │
│    Conversation B                │
│    Conversation C                │
├──────────────────────────────────┤
│ ▸  Another Project               │  ← collapsed
└──────────────────────────────────┘
```

**Implementation**: In `Sidebar.tsx`, split the project header row's click handler:
- Chevron `<button>` gets `onClick={() => toggleCollapse(project.id)}`
- Project name `<span>` or `<button>` gets `onClick={() => navigate(`/projects/${project.id}`)}`

### 2. Start Chat from Project Detail Page

Add a "Start Chat" button to the `ProjectDetailPage` header area:

```
┌──────────────────────────────────────────────────┐
│ ← Back    My Research Project     [Start Chat]   │
│                                                  │
│ Description: ...                                 │
│ System Prompt: ...                               │
│ ...                                              │
└──────────────────────────────────────────────────┘
```

**Behavior**:
1. Click "Start Chat" → call `useTreeStore.getState().createConversation()`.
2. Set `projectId` on the new conversation to this project's ID.
3. If the project has a `systemPrompt`, set it as the conversation's `systemPrompt`.
4. Navigate to `/c/:newConversationId`.
5. The new conversation appears in the sidebar under this project's group.

The chat opens blank (no pre-filled input). The user can start typing immediately.

**Implementation**: Add a button in `ProjectDetailPage.tsx` header. The `createConversation` action in `useTreeStore` already accepts initial fields — pass `{ projectId, systemPrompt }`.

### 3. Knowledge File Viewing

**Current state**: `ProjectFileList` shows filename, size, and mime type with upload/delete actions. No way to preview file content.

**Improvement**: Add expandable text preview for each file:

```
┌──────────────────────────────────────────────────┐
│ Files (3)                              [Upload]  │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 📄 research-notes.md  (4.2 KB)    [▾] [🗑]  │ │
│ │ ┌──────────────────────────────────────────┐ │ │
│ │ │ # Research Notes                         │ │ │
│ │ │ These are my notes on quantum...         │ │ │
│ │ │ (showing first 500 chars)                │ │ │
│ │ │                        [Show full text]  │ │ │
│ │ └──────────────────────────────────────────┘ │ │
│ ├──────────────────────────────────────────────┤ │
│ │ 📄 paper.pdf  (1.2 MB)            [▸] [🗑]  │ │
│ ├──────────────────────────────────────────────┤ │
│ │ 🖼 diagram.png  (340 KB)          [▸] [🗑]  │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- Each file has a collapse/expand toggle (▸/▾).
- Collapsed by default.
- Expanded view shows `extractedTextPreview` (first 200 chars from the DB).
- "Show full text" fetches the complete `extractedText` via `fetchFileText()` and displays it in a scrollable monospace area (max-height with overflow).
- For images: show a small thumbnail if the backend serves the file (or placeholder icon if not).

**Implementation**: Modify `ProjectFileList.tsx` to add per-file expand state and a text preview section. Use the existing `fetchFileText` from `backend.ts` for full content.

---

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | "Start Chat" always works — creates a conversation with "New Conversation" title (same as normal new conversation flow). |
| What if the external dependency is unavailable? | Backend offline: file preview falls back to `extractedTextPreview` from IndexedDB (if using browser-only files). "Show full text" button hidden when backend unavailable and file is backend-stored. |
| What if this runs concurrently with itself? | Clicking "Start Chat" twice quickly → two conversations created. Acceptable — user can delete the duplicate. |
| What happens on the second invocation? | Each "Start Chat" click creates a new conversation. No "resume" behavior. |
| What if the user's data is larger than expected? | Full text preview is in a scrollable container with max-height. Large files (>100KB text) show a warning: "Large file — showing first 10,000 characters." |
| What state persists vs. resets across page reload? | File expand/collapse state is transient (resets to collapsed). Everything else is persisted via existing stores. |

---

## Implementation Review

**Commit**: `69ff81f` — Improve project UX: split sidebar header, add Start Chat, add file previews (Feature 30)

**Files changed**: 3 (+147 / −49)
- `src/components/layout/Sidebar.tsx`
- `src/components/pages/ProjectDetailPage.tsx`
- `src/components/project/ProjectFileList.tsx`

### Anti-Pattern Review — All Passed

| Check | Severity | Result |
|-------|----------|--------|
| Zustand selector instability | Critical | Pass — all selectors use individual field picks or module-level `EMPTY_FILES` constant |
| Orphan AbortController | High | Pass — no `new AbortController().signal` |
| Unvalidated numeric parsing | Medium | Pass — no `parseFloat`/`parseInt` usage |
| Naive LLM output matching | Medium | N/A — files not in `src/agents/` or `src/components/elicitation/` |
| UI-only validation | Medium | N/A — no capability checks in target files |
| Dead code / type errors | Low | Pass — `tsc --noEmit` clean, no TODO/HACK/FIXME |

### Type Check

```
docker compose run --rm app npx tsc --noEmit → exit 0
```
