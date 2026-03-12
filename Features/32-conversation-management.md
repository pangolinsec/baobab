# 32 — Conversation Management

## Summary

Two quality-of-life improvements for managing conversations: inline rename (double-click in sidebar + context menu) with optional LLM-generated titles, and an assign-to-project dropdown in the conversation view header.

## Priority

Tier 1 — core UX.

## Dependencies

None (uses existing stores and components).

## Phasing

Single implementation — no phasing needed.

---

## Part A: Rename Conversations

### Current Behavior

Conversation titles are auto-generated from the first 50 characters of the first user message (`useStreamingResponse.ts:149`). There is no way to manually rename a conversation.

### New Behavior

#### 1. Double-click inline edit (sidebar)

Double-clicking a conversation title in the sidebar activates inline editing:

```
Before:
│ Explain quantum entanglement in simple terms fo… │

Double-click:
│ ┌──────────────────────────────────────────────┐ │
│ │ Explain quantum entanglement in simple terms │ │  ← focused input
│ └──────────────────────────────────────────────┘ │
```

- The text becomes an `<input>` field, pre-filled with the current title, fully selected.
- **Enter** or **blur** saves the new title via `updateConversationTitle()`.
- **Escape** cancels without saving.
- Empty input reverts to the previous title (no empty titles allowed).

#### 2. Context menu option (sidebar)

Add "Rename" to the existing conversation context menu:

```
Move to project  →
Rename                 ← new
──────────────
Delete
```

Clicking "Rename" activates the same inline edit mode as double-click.

#### 3. LLM-generated titles (optional, global setting)

**Settings addition** (in the General or Advanced tab):

```
Auto-generate titles
  ☑ Use LLM to generate conversation titles
  Model: [Same as chat ▾]        ← dropdown, default "Same as chat"
```

**Behavior when enabled**:
- After the first assistant response completes (not on user message send — need both question and answer for a good summary).
- Fire a background LLM call with a short prompt:

  ```
  Summarize this conversation in 5-8 words as a title. Return only the title, no quotes or punctuation.

  User: {first user message}
  Assistant: {first assistant response, truncated to 500 chars}
  ```

- The model used is the one selected in the setting. "Same as chat" resolves to whatever model produced the first response.
- The generated title replaces the default truncated-message title.
- If the LLM call fails (timeout, error), fall back to the current truncation behavior silently.
- Only fires once per conversation (when title is still "New Conversation" or matches the truncation pattern).
- Does not overwrite user-set titles (if the user has already renamed).

**Data model**: Add to `AppSettings`:

```typescript
interface AppSettings {
  // ... existing fields
  autoGenerateTitles: boolean;       // default false
  titleGenerationModel?: string;     // model ID, undefined = same as chat
}
```

**Implementation**: In `useStreamingResponse.ts`, in the `onComplete` callback, after the existing auto-title logic:

```typescript
// Existing: truncate first message to 50 chars
// New: if autoGenerateTitles is enabled, fire background LLM call
if (settings.autoGenerateTitles && conv.title === truncatedTitle) {
  generateTitle(conv.id, userMessage, assistantResponse, settings.titleGenerationModel || node.model);
}
```

The `generateTitle` function is fire-and-forget (async, no await). It uses a lightweight provider call with low max tokens (20) and no streaming.

---

## Part B: Assign to Project from Conversation View

### Current Behavior

Assigning a conversation to a project requires either:
- Right-click in sidebar → "Move to project" → submenu
- Drag-and-drop in sidebar (when grouped by projects)

There is no way to assign/change project from within the conversation itself.

### New Behavior

Add a project assignment dropdown in the conversation view header, near the existing tags area:

```
┌──────────────────────────────────────────────────────────────┐
│ Explain quantum entanglement...                              │
│ [My Research ▾]  [+ tags]  [physics] [quantum]               │
│                                                              │
│ ┌──────────────────────────┐                                 │
│ │ 🔍 Search projects...    │  ← searchable dropdown          │
│ ├──────────────────────────┤                                 │
│ │ ✓ My Research            │  ← current assignment (checked) │
│ │   Product Analysis       │                                 │
│ │   Code Reviews           │                                 │
│ ├──────────────────────────┤                                 │
│ │   No project             │  ← removes assignment           │
│ └──────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

**Display**:
- When assigned: shows project name as a chip/button (similar styling to tag chips but distinct — e.g., folder icon prefix, different color).
- When unassigned: shows a muted "No project" or folder-plus icon button.
- Clicking opens a searchable dropdown.

**Dropdown**:
- Search input at top, filters project list.
- Current project has a checkmark.
- "No project" option at the bottom to remove assignment.
- Selecting a project calls `useTreeStore.getState().setConversationProject(convId, projectId)`.

**Location**: In the conversation header area of `ConversationView.tsx` (or the shared header used by both tree and thread views). Positioned to the left of the tags area, since project is a higher-level grouping than tags.

### Component

```
src/components/shared/
  ProjectAssignDropdown.tsx    # Searchable project selector
```

Reuses the project list from `useProjectStore`. The search filters on project name. The dropdown closes on selection or outside click.

---

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty rename input → revert to previous title. No project selected → show "No project" state. |
| What if the external dependency is unavailable? | LLM title generation: if provider/model unavailable, silently fall back to truncation. Project assignment: all data is local, always works. |
| What if this runs concurrently with itself? | Double-clicking while already editing → no-op (already in edit mode). LLM title generation racing with manual rename → manual rename wins (check if title was manually changed before applying generated title). |
| What happens on the second invocation? | Renaming again overwrites. Changing project again overwrites. Both idempotent. |
| What if the user's data is larger than expected? | Many projects (50+): searchable dropdown handles this. Very long title: input field scrolls horizontally, sidebar truncates with ellipsis as it does now. |
| What state persists vs. resets across page reload? | Title and project assignment persist in IndexedDB. Inline edit state is transient. LLM title generation setting persists in AppSettings. |
