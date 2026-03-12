# 09 — System Prompt Cascade

## Summary

Allow system prompts at four levels with a cascade: **global → chat → branch → message**. The deepest (most recent) override along the path from root to the current node wins. Different branches can have different system prompts. Changes are visually marked (see feature 10).

## Priority

Tier 1 — core UX.

## Dependencies

None (standalone, but visual indicators in feature 10 depend on this).

## Cascade Logic

When sending a message from node X, walk the path from root to X. The **last system prompt override** encountered along that path is the one sent to the API.

```
Root (chat default: "You are a helpful assistant")
  └─ User: "Tell me about frogs"
     └─ Assistant: "Frogs are amphibians..."
        └─ User: "Now as a poet"  ← system prompt override: "You are a poet"
           └─ Assistant: "Upon the lily pad..."
              └─ User: "What about toads?"  ← no override, inherits "You are a poet"
                 └─ Branch A: (inherits "You are a poet")
                 └─ Branch B: override: "You are a scientist"
                    └─ (uses "You are a scientist")
```

### Resolution Algorithm

Uses the shared `resolveCascade<T>()` utility (defined in `src/lib/tree.ts`), which is the same generic function used by Feature 08 (Model Cascade) and any future cascading settings. All cascades walk root-to-node, last override wins. See ADR-001 Decision 7.

```typescript
// Shared utility in src/lib/tree.ts
function resolveCascade<T>(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  getOverride: (node: TreeNode) => T | undefined,
  defaultValue: T
): T {
  const path = getPathToRoot(nodeId, nodes); // root → node order
  let resolved = defaultValue;
  for (const node of path) {
    const override = getOverride(node);
    if (override !== undefined && override !== null) {
      resolved = override;
    }
  }
  return resolved;
}

// Usage for system prompt:
const systemPrompt = resolveCascade(
  nodeId,
  nodes,
  n => n.systemPromptOverride,
  conversation.systemPrompt || settings.defaultSystemPrompt
);
```

## Data Model Changes

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  systemPromptOverride?: string;   // null/undefined = inherit from parent
}
```

### `AppSettings`

```typescript
interface AppSettings {
  // ... existing
  defaultSystemPrompt: string;     // global default, e.g. ""
}
```

### `Conversation`

Already has `systemPrompt?: string` — this serves as the chat-level default.

## UI — System Prompt Editor in Detail Panel

In `NodeDetailPanel`, a collapsible "System Prompt" section:

```
┌──────────────────────────────────────┐
│ 🔮 Claude                      [X]  │
├──────────────────────────────────────┤
│ ▶ System Prompt                      │
│   (inherited from chat)              │
│   "You are a helpful assistant"      │
│                                      │
│   [Override for this node]           │
│                                      │
│ Here is my response...               │
│ ...                                  │
├──────────────────────────────────────┤
│ [Reply here] [Copy] [Delete]         │
└──────────────────────────────────────┘
```

### Collapsed State (default)

Shows a one-line summary:
- **No override**: "System Prompt (inherited from chat)" with the first ~40 chars of the prompt.
- **Has override**: "System Prompt (overridden)" with an orange indicator.

### Expanded State

Full textarea showing the current effective system prompt:
- If inherited: shows the inherited prompt as read-only, with an "Override" button.
- If overridden: shows the override in an editable textarea, with a "Remove override" button (reverts to inherited).

```
▼ System Prompt (overridden)
┌─────────────────────────────────┐
│ You are a poet. Respond to all  │
│ questions with lyrical prose.   │
│                                 │
│                                 │
└─────────────────────────────────┘
[Remove override]   [Set as branch default]
```

### "Set as branch default" Button

Similar to model cascade — sets the override on the branch point node so all descendants inherit it.

## UI — Chat Input System Prompt Indicator

In the chat input area, a small indicator shows the effective system prompt for the next message:

```
┌─────────────────────────────────────────────────┐
│ ↳ Replying to: Upon the lily pad...             │
│   System: "You are a poet" [edit]               │
├─────────────────────────────────────────────────┤
│ [Type a message...]                    [Send ▶] │
└─────────────────────────────────────────────────┘
```

Clicking "edit" opens an inline textarea to set the system prompt for the next message.

## UI — Global Default System Prompt

In Settings, a new field:

```
Default System Prompt
[textarea - can be blank]
```

This is the fallback when no chat or node overrides exist.

## API Integration

When building the API call in `useStreamingResponse`:

```typescript
const systemPrompt = resolveSystemPrompt(
  replyTargetNodeId,
  nodes,
  currentConversation,
  settings.defaultSystemPrompt
);

// Store the override on the new nodes if the user set one
if (userOverrodeSystemPrompt) {
  userNode.systemPromptOverride = newSystemPrompt;
}
```

The system prompt is passed to the provider's `sendMessage` as before — the provider adapter handles format differences (Anthropic uses a `system` parameter, OpenAI uses a system-role message, etc.).

## Edge Cases

- **Empty system prompt**: if the user explicitly sets an empty override, that's valid — it means "no system prompt." This differs from `undefined` (inherit from parent).
- **Viewing the effective prompt**: the detail panel always shows what prompt was *actually used* for that message, even if the override was set on an ancestor. This is important for transparency.
- **System prompt and thinking**: some models behave differently with thinking enabled + system prompts. No special handling needed — just pass both to the API.

## Persistence

System prompt overrides are stored per-node in IndexedDB. The global default is in the settings store.
