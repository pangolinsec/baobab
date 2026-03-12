# 28 — Manual Tree Editing

## Summary

Extend tree editing capabilities in three ways: (1) expand the existing Duplicate & Edit modal to support tool calls and thinking content, (2) add manual node creation for crafting arbitrary user/assistant messages without API calls, and (3) move the knowledge mode toggle from ChatInput to the project detail page. Together these enable prompt engineering, counterfactual exploration, and synthetic conversation building.

## Priority

Tier 2 — Power Features.

## Dependencies

- **23 Resend / Duplicate**: extends the existing Duplicate & Edit flow.
- **13 Project Knowledge**: knowledge mode toggle relocation.

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| A — Extend Duplicate & Edit | Tool call editing, thinking editing, `source: 'manual'` type | Planned |
| B — Manual node creation | Create arbitrary nodes via NodeDetailPanel, ManualNodeModal | Planned |
| C — Knowledge toggle relocation | Move knowledge mode from ChatInput to ProjectDetailPage | Planned |

---

## Phase A — Extend Duplicate & Edit

### What Changes

The existing `DuplicateEditModal` currently only edits text content. Extend it to support:

1. **Tool call editing**: view, edit, add, and remove tool calls on the duplicated node.
2. **Thinking content editing**: view and edit the thinking/reasoning text.

### UI — Extended Modal

```
┌──────────────────────────────────────────┐
│ Duplicate & Edit                    [X]  │
├──────────────────────────────────────────┤
│ Content                                  │
│ ┌──────────────────────────────────────┐ │
│ │ Frogs are amphibians belonging to   │ │
│ │ the order Anura...                   │ │
│ │                                     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ▶ Thinking (click to expand)             │
│                                          │
│ ▼ Tool Calls (2)                         │
│ ┌──────────────────────────────────────┐ │
│ │ web_search                    [🗑️]  │ │
│ │ Input:                              │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ {"query": "frog species"}        │ │ │
│ │ └──────────────────────────────────┘ │ │
│ │ Result:                             │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ Found 3 results: ...             │ │ │
│ │ └──────────────────────────────────┘ │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ read_file                     [🗑️]  │ │
│ │ Input:                              │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ {"filename": "species.csv"}      │ │ │
│ │ └──────────────────────────────────┘ │ │
│ │ Result:                             │ │
│ │ ┌──────────────────────────────────┐ │ │
│ │ │ name,class,order\nRana...        │ │ │
│ │ └──────────────────────────────────┘ │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [+ Add Tool Call]                        │
│                                          │
│                 [Cancel] [Save]          │
└──────────────────────────────────────────┘
```

### Tool Call Editor

Each tool call entry shows:
- **Tool name**: editable text input (free-form, since tool names come from various sources).
- **Input**: JSON editor (textarea with monospace font). Validated as JSON on save.
- **Result**: textarea (plain text, not JSON — tool results are strings).
- **Remove button** (trash icon): removes this tool call.
- **Search provider** (optional): shown if the tool call has a `searchProvider` field. Editable dropdown.

**Add Tool Call** button appends a new empty entry with fields pre-populated:
```typescript
{ toolName: '', input: {}, result: '' }
```

### Thinking Editor

Collapsible section below content, above tool calls:
- Textarea with monospace font.
- Pre-filled with existing `thinking` content if present.
- Empty if the source node had no thinking.

### Sections Are Conditional

- **Thinking section**: always shown (useful for injecting synthetic thinking).
- **Tool calls section**: always shown (useful for injecting synthetic tool results).
- Both default to collapsed when empty on the source node.

### Data Flow

`duplicateAndModifyAssistant` store method signature expands:

```typescript
duplicateAndModifyAssistant(
  nodeId: string,
  newContent: string,
  newThinking?: string,
  newToolCalls?: ToolCallRecord[],
): Promise<void>;
```

The duplicated node copies all fields from the source, overriding content/thinking/toolCalls with the edited values, and sets `userModified: true`.

---

## Phase B — Manual Node Creation

### What It Does

Create arbitrary user or assistant nodes in the tree without sending to the API. The node is inserted as a child of the selected node.

### Entry Point

**NodeDetailPanel** action bar — a new "Create Child" button:

```
[Reply here] [Resend] [Duplicate & Edit] [+ Create Child] [Copy] [Delete]
```

Available on any non-streaming node. The button opens the `ManualNodeModal`.

**Context menu** — Group 1 (Primary Actions):

```
┌─────────────────────────┐
│ Reply here              │
│ Resend                  │
│ Duplicate & Edit        │
│ Create Child            │  ← new
│ ─────────────────────── │
│ ...                     │
```

### Role Auto-Alternation

The created node's role is determined automatically:
- If parent is `assistant` → new node is `user`.
- If parent is `user` → new node is `assistant`.

This matches the natural conversation flow. The role is displayed in the modal header but is **not editable** in v1.

### UI — ManualNodeModal

```
┌──────────────────────────────────────────┐
│ Create Manual User Message          [X]  │
├──────────────────────────────────────────┤
│ Content                                  │
│ ┌──────────────────────────────────────┐ │
│ │                                     │ │
│ │ [type message content here]         │ │
│ │                                     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ▶ Thinking (click to expand)             │
│                                          │
│ ▶ Tool Calls (click to expand)           │
│                                          │
│        [Cancel] [Create] [Create & Add]  │
└──────────────────────────────────────────┘
```

- **Title** reflects the auto-determined role: "Create Manual User Message" or "Create Manual Assistant Message".
- **Content**: required — modal doesn't save with empty content.
- **Thinking** and **Tool Calls**: same editor components as Phase A (shared `ToolCallEditor` and `ThinkingEditor` sub-components).
- **Create**: creates the node and closes the modal.
- **Create & Add Another**: creates the node, then immediately reopens the modal for the next child (role auto-alternates again). This enables rapid conversation building.

### Data Model — `source: 'manual'`

Extend the `source` field on `TreeNode`:

```typescript
// Before
source?: 'user' | 'querier';

// After
source?: 'user' | 'querier' | 'manual';
```

Manually created nodes get `source: 'manual'`. This is distinct from `userModified: true` (which marks duplicated-and-edited nodes).

### Visual Indicator — "created" Badge

Nodes with `source === 'manual'` display a "created" badge, using the same styling pattern as the existing "edited" badge for `userModified`:

**Tree node (MessageNode)**:
```
┌─────────────────────────────────────────┐
│ 🔮✏️ Claude (created)        [Haiku]   │
│                                         │
│ Frogs are actually reptiles...          │
│                                         │
└─────────────────────────────────────────┘
```

**Detail panel (NodeDetailPanel)**:
- Banner: "This message was manually created" (same style as the "edited by you" banner).

**Thread view (ThreadMessage)**:
- "(created)" tag in header, same position as "(edited)".

### Store Method — `createManualNode`

```typescript
createManualNode(
  parentId: string,
  content: string,
  thinking?: string,
  toolCalls?: ToolCallRecord[],
): Promise<string>;  // returns new node ID
```

Implementation:
1. Determine role from parent node's role (auto-alternate).
2. Create a `TreeNode` with:
   - `source: 'manual'`
   - `userModified: false` (not a duplicate — it's a creation)
   - `model`: inherit from the effective model at the parent (for display consistency)
   - `nodeType: 'standard'`
   - `content`, `thinking`, `toolCalls` from parameters
3. Add node via `addNode`.
4. Select the new node and set it as reply target.

### Manual Nodes as Tree Citizens

Manually created nodes are fully normal tree nodes:
- They can be branched from (send real API messages as children).
- They are included in `getPathToRoot` context building — the model receives them as if they were real messages.
- They can be duplicated, starred, flagged as dead-end, deleted.
- They can be resent (if user role) or have children regenerated.

### Shared Editor Components

Extract from the extended `DuplicateEditModal` into reusable components:

```
components/
  shared/
    ToolCallEditor.tsx      # Single tool call entry (name, input, result, remove)
    ToolCallListEditor.tsx  # List of ToolCallEditors + "Add" button
    ThinkingEditor.tsx      # Collapsible thinking textarea
```

Both `DuplicateEditModal` and `ManualNodeModal` compose these.

---

## Phase C — Knowledge Toggle Relocation

### What Changes

Move the knowledge mode toggle (Off / @ Direct / Agentic) from `ChatInput.tsx` to `ProjectDetailPage.tsx`. This:
- Simplifies `ChatInput` (removes ~30 lines of toggle UI + state).
- Makes knowledge mode a project-level setting (conceptually correct — it's about how the project's files are accessed).
- Reduces visual clutter in the chat input area.

### Data Model Change

Move `knowledgeMode` from `Conversation` to `Project`:

```typescript
// Before (Conversation)
knowledgeMode?: 'off' | 'direct' | 'agentic';

// After (Project)
interface Project {
  // ... existing
  knowledgeMode?: 'off' | 'direct' | 'agentic';  // default: 'off'
}
```

Remove `knowledgeMode` from the `Conversation` interface. The `setKnowledgeMode` store action moves from `useTreeStore` to `useProjectStore`.

### Migration

Existing conversations with `knowledgeMode` set: the field becomes inert (ignored). No active migration needed — the project-level default takes over. If a conversation's project doesn't have a `knowledgeMode` set, it defaults to `'off'`.

### UI — ProjectDetailPage

Add a "Knowledge Access" section between "System Prompt" and "Files":

```
┌──────────────────────────────────────────┐
│ Knowledge Access                         │
│                                          │
│ How conversations access project files:  │
│                                          │
│ [Off] [@ Direct] [Agentic]              │
│                                          │
│ Off — Files are not injected             │
│ @ Direct — Use @filename to inject       │
│   file content into messages             │
│ Agentic — Model can read files via       │
│   tool use                               │
└──────────────────────────────────────────┘
```

Same button styling as the current ChatInput toggle, but with descriptive text below each option.

### Read Sites Update

Update all places that read `knowledgeMode`:

1. **`useStreamingResponse.ts`** — `resolveKnowledgeContext`: read from `useProjectStore` via `conv.projectId` instead of `conv.knowledgeMode`.
2. **`ChatInput.tsx`** — dropdown gating: read from project store instead of conversation.
3. **`ChatInput.tsx`** — remove the knowledge toggle UI entirely.

### Backend Guard

The backend-unavailable guard (from the 13b review fixes) moves to the project page. When the backend is unavailable, the "@ Direct" and "Agentic" buttons are disabled with "Backend required" tooltip — same pattern as currently in ChatInput.

---

## Edge Cases

| Question | Answer |
|----------|--------|
| Empty content on manual create? | Disabled "Create" button when content is empty |
| Invalid JSON in tool call input? | Show validation error inline, prevent save |
| Manual node with no tool calls but thinking? | Allowed — thinking is independent of tool calls |
| Create child of streaming node? | "Create Child" button disabled during streaming |
| Duplicate a manual node? | Allowed — creates a copy with `userModified: true` (it was duplicated). `source` stays `'manual'` on the original only |
| Manual node in querier/elicitation session? | Manual nodes have `source: 'manual'`, not `'querier'` — querier backtracking logic (`source === 'querier'`) correctly ignores them |
| Knowledge mode set on project with no files? | Toggle still works but has no effect. No warning needed |
| Pre-13b conversations with `knowledgeMode` on Conversation? | Field is ignored after migration. Conversations inherit project-level setting |
| Create & Add Another when parent has multiple children? | New node is added as the latest child. Modal reopens targeting the just-created node as parent |

---

## TODO

Items deferred from this feature:

- [ ] **Duplicate entire branch**: duplicate a node and all its descendants as a subtree. Assess complexity before implementing — requires recursive tree cloning with new IDs.
- [ ] **Manual role selection**: allow overriding auto-alternation to create consecutive same-role messages (e.g., two user messages in a row). Low priority — auto-alternation covers >95% of use cases.
- [ ] **Per-conversation knowledge mode override**: if different conversations in the same project need different modes, add an optional per-conversation override that takes precedence over the project default.

---

## Files to Modify

### Phase A
- `src/types/index.ts` — extend `source` type union
- `src/components/tree/DuplicateEditModal.tsx` — add tool call and thinking editors
- `src/components/shared/ToolCallEditor.tsx` — new shared component
- `src/components/shared/ToolCallListEditor.tsx` — new shared component
- `src/components/shared/ThinkingEditor.tsx` — new shared component
- `src/store/useTreeStore.ts` — expand `duplicateAndModifyAssistant` signature

### Phase B
- `src/components/tree/ManualNodeModal.tsx` — new modal
- `src/components/tree/NodeDetailPanel.tsx` — add "Create Child" button
- `src/store/useTreeStore.ts` — add `createManualNode` method
- `src/components/tree/MessageNode.tsx` — "created" badge for `source === 'manual'`
- `src/components/thread/ThreadMessage.tsx` — "created" badge
- `src/components/tree/RawContextTab.tsx` — display `'manual'` source value (already works, just verify)

### Phase C
- `src/types/index.ts` — move `knowledgeMode` from `Conversation` to `Project`
- `src/components/pages/ProjectDetailPage.tsx` — add knowledge access toggle UI
- `src/store/useProjectStore.ts` — add `setKnowledgeMode` method
- `src/components/chat/ChatInput.tsx` — remove knowledge toggle, read mode from project store
- `src/hooks/useStreamingResponse.ts` — read `knowledgeMode` from project store
