# 23 — Resend / Duplicate

## Summary

Two related actions for iterating on messages:

1. **Resend**: re-send a user message to get a different assistant response (regenerate). Creates a new assistant node as a sibling under the same user node. User messages only.
2. **Duplicate + Modify**: copy a message, edit it, and create a new branch. Works on both user and assistant messages. Modified assistant messages get a visual indicator.

## Priority

Tier 1 — core UX.

## Dependencies

None.

## Resend (Regenerate)

### What It Does

Takes an existing user message and sends it again to the API, producing a new assistant response. The new response is a sibling of the original response under the same user node.

### Tree Structure

Before resend:
```
[Assistant: root greeting]
  └─ [User: "Tell me about frogs"]
       └─ [Assistant: "Frogs are amphibians..."]   ← original response
```

After resend:
```
[Assistant: root greeting]
  └─ [User: "Tell me about frogs"]
       ├─ [Assistant: "Frogs are amphibians..."]   ← original response
       └─ [Assistant: "Frogs belong to..."]        ← new response (regenerated)
```

The user node now has two children (branch point).

### Flow

1. User clicks "Resend" on a user message.
2. Create a new placeholder assistant node as a child of the user node.
3. Build context: path from root to the user node (same context as the original).
4. Send to the API using the effective model/settings at that point.
5. Stream the response into the new assistant node.
6. The tree updates to show the branch.

### UI Trigger

**Detail panel** action button:
```
[📤 Resend] [📋 Copy] [✏️ Duplicate] [Delete]
```

**Right-click context menu**:
```
┌─────────────────────────┐
│ Resend                  │  ← user messages only
│ Duplicate & Edit        │
│ ─────────────────────── │
│ Star                    │
│ Copy                    │
│ ─────────────────────── │
│ Delete                  │
└─────────────────────────┘
```

**On tree node hover**: a small "resend" icon (↻) on user message nodes.

"Resend" only appears on **user messages**.

### Model Selection on Resend

By default, resend uses the same model as the original response. Optionally, the user can choose a different model:

- Shift+click "Resend" opens a model picker, then sends.
- Or: the resend button has a small dropdown arrow for model selection.

```
[📤 Resend ▾]
  ├─ Resend (Haiku 4.5)          ← default, same as original
  ├─ Resend with Sonnet 4
  ├─ Resend with Opus 4
  └─ Resend with...              ← opens full model picker
```

## Duplicate + Modify

### What It Does

Copies a message, lets the user edit the content, and creates a new branch. Works on both user and assistant messages.

### User Message Duplicate

Duplicating a user message creates a new user node as a sibling (same parent assistant node), pre-filled with the original content. The user edits it and sends.

Before:
```
[Assistant: "I can help with that"]
  └─ [User: "Tell me about frogs"]
       └─ [Assistant: "Frogs are..."]
```

After duplicating and editing the user message:
```
[Assistant: "I can help with that"]
  ├─ [User: "Tell me about frogs"]         ← original
  │    └─ [Assistant: "Frogs are..."]
  └─ [User: "Tell me about TOADS"]         ← duplicate, edited
       └─ [Assistant: "Toads are..."]       ← new response
```

### Assistant Message Duplicate

Duplicating an assistant message creates a new assistant node as a sibling (same user parent). The user edits the content. This edited message is marked as **user-modified**.

Before:
```
[User: "Tell me about frogs"]
  └─ [Assistant: "Frogs are amphibians..."]
```

After duplicating and editing the assistant message:
```
[User: "Tell me about frogs"]
  ├─ [Assistant: "Frogs are amphibians..."]          ← original
  └─ [Assistant: "Frogs are REPTILES..." ✏️]         ← duplicate, user-modified
```

The user can then continue the conversation from the modified assistant message.

### Flow — Duplicate User Message

1. User clicks "Duplicate" on a user message.
2. The chat input is pre-filled with the message content and the reply target is set to the same parent.
3. The user edits the content and sends.
4. Normal send flow: creates a new user node + assistant response as a branch.

### Flow — Duplicate Assistant Message

1. User clicks "Duplicate" on an assistant message.
2. A modal/inline editor appears with the message content pre-filled.
3. The user edits the content and clicks "Save."
4. A new assistant node is created as a sibling of the original (same user parent).
5. The new node has `userModified: true`.
6. The user can now reply to this modified message.

### UI Trigger

**Detail panel** action button (both user and assistant messages):
```
[✏️ Duplicate & Edit] [📋 Copy] [Delete]
```

For assistant messages, "Resend" is not shown (only user messages get resend).
For user messages, both "Resend" and "Duplicate & Edit" are available.

## Data Model Changes

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  userModified: boolean;    // default false — true when an assistant message was edited by the user
}
```

> **Note**: `userModified` is an orthogonal flag, separate from `nodeType`. A user can duplicate-and-edit any assistant message, including summary or merge responses. This means `{ nodeType: 'merge', userModified: true }` is a valid state. See ADR-001 Decision 1.

## Visual Indicator for Modified Assistant Messages

Modified assistant messages need a clear visual indicator:

### Tree Node

```
┌─────────────────────────────────────────┐
│ 🔮✏️ Claude (edited)         [Haiku]   │
│                                         │
│ Frogs are REPTILES that live in...      │
│                                         │
└─────────────────────────────────────────┘
```

- A small **pencil icon** (✏️) next to the Claude sparkle icon.
- The text "(edited)" in the header, in muted text.
- A subtle **visual indicator**: slightly different border style (e.g., dashed bottom border) or a very faint tint.

### Detail Panel

```
┌──────────────────────────────────────┐
│ 🔮✏️ Claude (user-modified)    [X]  │
│ ⚠️ This message was edited by you   │
├──────────────────────────────────────┤
│ Frogs are REPTILES...                │
│ ...                                  │
├──────────────────────────────────────┤
│ [Reply here] [Copy] [Delete]         │
└──────────────────────────────────────┘
```

A subtle warning banner at the top: "This message was edited by you" — not alarming, just informational.

### Thread View

In thread view, the modified message shows the pencil icon and "(edited)" tag in the message header, similar to how messaging apps show edited messages.

## Context Building with Modified Messages

When building API context that includes a modified assistant message:
- The **modified content** is used (not the original).
- The model receives the edited version as if the assistant actually said it.
- This is intentional — the user is steering the conversation by modifying what the assistant "said."

## Duplicate + Edit Modal for Assistant Messages

```
┌──────────────────────────────────────────┐
│ Edit Duplicate                      [X]  │
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ Frogs are amphibians belonging to   │ │
│ │ the order Anura. They are           │ │
│ │ characterized by their smooth,      │ │
│ │ moist skin and long hind legs.      │ │
│ │                                     │ │
│ │ [cursor editing here]               │ │
│ │                                     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│                 [Cancel] [Save]          │
└──────────────────────────────────────────┘
```

The editor is a simple textarea with the full message content. Markdown formatting is preserved.

## Store Changes

### `useTreeStore`

```typescript
interface TreeState {
  // ... existing
  resendMessage: (userNodeId: string, model?: string) => Promise<void>;
  duplicateAndModifyAssistant: (nodeId: string, newContent: string) => Promise<void>;
  prefillDuplicateUser: (nodeId: string) => void;
}
```

#### `resendMessage`

```typescript
resendMessage: async (userNodeId: string, overrideModel?: string) => {
  const { nodes, currentConversation } = get();
  const userNode = nodes[userNodeId];
  if (!userNode || userNode.role !== 'user' || !currentConversation) return;

  // Create new assistant placeholder as child of the user node
  const assistantNode: TreeNode = {
    id: crypto.randomUUID(),
    conversationId: currentConversation.id,
    parentId: userNode.id,
    role: 'assistant',
    content: '',
    model: overrideModel || resolveModel(...),
    createdAt: Date.now(),
    childIds: [],
    collapsed: false,
    starred: false,
    deadEnd: false,
    userModified: false,
  };
  await addNode(assistantNode);
  setStreaming(assistantNode.id);

  // Build context and send (same as normal send, but reusing the existing user node)
  // ...
};
```

#### `duplicateAndModifyAssistant`

```typescript
duplicateAndModifyAssistant: async (nodeId: string, newContent: string) => {
  const node = get().nodes[nodeId];
  if (!node || node.role !== 'assistant') return;

  const duplicate: TreeNode = {
    ...node,
    id: crypto.randomUUID(),
    content: newContent,
    userModified: true,
    createdAt: Date.now(),
    childIds: [],
  };
  await addNode(duplicate);  // adds as child of same parent
  selectNode(duplicate.id);
  setReplyTarget(duplicate.id);
};
```

#### `prefillDuplicateUser`

Sets the chat input content and reply target for duplicating a user message:

```typescript
prefillDuplicateUser: (nodeId: string) => {
  const node = get().nodes[nodeId];
  if (!node || node.role !== 'user') return;
  // Set reply target to the same parent as this node
  set({ replyTargetNodeId: node.parentId, prefillContent: node.content });
};
```

The chat input reads `prefillContent` from the store and pre-fills the textarea.

## Retry Failed Request (UI Fix 3 integration)

When a user message's child is an error node (a failed API response), offer a **Retry** action. Retry is semantically different from Resend:

- **Retry**: deletes the error node and creates a new assistant node in its place. The tree structure doesn't branch — the error is replaced.
- **Resend**: creates a new assistant node as a sibling of the error node. The tree branches — both the error and the new response are visible.

### UI Trigger

The Retry button appears on **error nodes** (not on the parent user node):

**Detail panel** (when an error node is selected):
```
[🔄 Retry] [📋 Copy error] [Delete]
```

**Right-click context menu** on error nodes:
```
┌─────────────────────────┐
│ Retry                   │
│ ─────────────────────── │
│ Copy error              │
│ Delete                  │
└─────────────────────────┘
```

Note: "Reply here" does NOT appear on error nodes — error nodes are not valid reply targets (UI Fix 3 prevents this).

### Flow

1. User clicks "Retry" on an error node.
2. The error node is deleted.
3. A new placeholder assistant node is created as a child of the same user node (same position in the tree).
4. The original context is rebuilt (path from root to the user node).
5. The request is sent to the API with the same model/settings.
6. The response streams in.

### Retry with Different Model

Like Resend, Retry supports model selection via Shift+click or dropdown:

```
[🔄 Retry ▾]
  ├─ Retry (same model)
  ├─ Retry with Sonnet 4
  └─ Retry with...
```

This is especially useful when the error was caused by a model-specific issue (rate limit, model unavailable).

## Edge Cases

- **Resend while streaming**: disabled. The resend button is grayed out during streaming.
- **Resend with different model**: the new response's model chip reflects the new model. The user node itself doesn't change.
- **Multiple resends**: the user node accumulates multiple assistant children (all siblings). The branch count badge updates accordingly.
- **Duplicate an already-modified message**: allowed. The new duplicate is also marked `userModified: true`.
