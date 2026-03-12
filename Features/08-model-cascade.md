# 08 — Model Cascade (Per-Message Model Swapping)

## Summary

Allow model selection at four levels with a cascade: **global → chat → branch → message**. The most specific override wins. Each message node shows a small chip indicating which model was used.

## Priority

Tier 1 — core UX.

## Phased Implementation

This feature is split into two phases to avoid blocking on Feature 07 (Inference Providers). See ADR-001 Decisions 5 and 8.

- **Phase 1 (Tier 1, no dependencies)**: Full cascade UX using Anthropic models only. Flat model dropdown. `ResolvedModel` return type with `providerId` hardcoded to `'anthropic'`.
- **Phase 2 (ships with Feature 07)**: Extends to multi-provider. Adds `providerOverride` to `TreeNode`, grouped-by-provider dropdown, provider resolution in the cascade.

## Dependencies

- **Phase 1**: None.
- **Phase 2**: **07 Inference Providers**.

## Cascade Logic

```
Effective model for a message = last override along the path from root to node:
  1. Global default (settings.defaultModel)           ← lowest priority
  2. Chat-level override (conversation.model)
  3. Branch-level override (ancestor node modelOverride)
  4. Message-level override (node modelOverride)       ← highest priority
```

### Resolution Algorithm

Uses the shared `resolveCascade<T>()` utility (defined in `src/lib/tree.ts`). All cascades walk root-to-node, last override wins. See ADR-001 Decision 7.

#### Phase 1

```typescript
interface ResolvedModel {
  model: string;
  providerId: string;
}

// Using the shared cascade utility:
function resolveModel(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): ResolvedModel {
  const model = resolveCascade(
    nodeId,
    nodes,
    n => n.modelOverride,
    conversation.model || settings.defaultModel
  );
  return {
    model,
    providerId: 'anthropic',  // hardcoded in Phase 1
  };
}
```

Note: Phase 1 returns a `ResolvedModel` object (not just a `string`) to minimize Phase 2 churn. Callers destructure `{ model, providerId }` from the start.

#### Phase 2

```typescript
function resolveModel(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): ResolvedModel {
  const model = resolveCascade(
    nodeId,
    nodes,
    n => n.modelOverride,
    conversation.model || settings.defaultModel
  );
  const providerId = resolveCascade(
    nodeId,
    nodes,
    n => n.providerOverride,
    conversation.providerId || settings.defaultProvider
  );
  return { model, providerId };
}
```

Phase 2 just removes the hardcoded `'anthropic'` and adds `providerOverride` to the walk logic.

### Branch-Level Override

A "branch default" is set on the node where a branch diverges (the node with multiple children). When the user sets a branch default:
- The override is stored on that node.
- All descendants inherit it (unless they have their own override).
- The node's model chip shows the branch default.

## Data Model Changes

### Phase 1

```typescript
interface TreeNode {
  // ... existing
  modelOverride?: string;       // null = inherit from parent/cascade
  // NO providerOverride in Phase 1
}

interface Conversation {
  // ... existing
  // model already exists and serves as chat-level default
  // NO providerId in Phase 1 (implicitly 'anthropic')
}
```

### Phase 2 (additions)

```typescript
interface TreeNode {
  // ... Phase 1 fields
  providerOverride?: string;     // null = inherit from parent/cascade
}

interface Conversation {
  // ... Phase 1 fields
  providerId?: string;           // default provider for this chat
}

interface AppSettings {
  // ... Phase 1 fields
  providers: Record<string, ProviderConfig>;  // provider configurations
  defaultProvider: string;                     // global default provider
}
```

## UI — Model Chip on Tree Nodes

Each `MessageNode` in the tree displays a small chip showing the effective model:

```
┌─────────────────────────────────────────┐
│ 🔮 Claude                    Haiku 4.5 │
│                                         │
│ Here is my response to...               │
│                                         │
└─────────────────────────────────────────┘
```

- **Chip styling**: small rounded badge, muted colors by default.
- **Color change when overridden**: if this node (or an ancestor) has a model override that differs from the chat default, the chip gets the accent color (orange) to signal a non-default model. See feature 10 for full visual indicator spec.
- **Chip text (Phase 1)**: abbreviated Anthropic model name (e.g., "Haiku 4.5", "Sonnet 4", "Opus 4").
- **Chip text (Phase 2)**: provider name is omitted if it matches the chat default provider; otherwise shown: "OpenAI GPT-4o".

## UI — Model Selector in Detail Panel

When viewing a node in the `NodeDetailPanel`, show a model selector:

```
┌──────────────────────────────────────┐
│ 🔮 Claude                      [X]  │
├──────────────────────────────────────┤
│ Model: [Claude Haiku 4.5 ▾]         │
│        (inherited from chat default) │
│                                      │
│ [Set as branch default]              │
│                                      │
│ Here is my response...               │
│ ...                                  │
├──────────────────────────────────────┤
│ [Reply here] [Copy] [Delete]         │
└──────────────────────────────────────┘
```

### Model Dropdown — Phase 1 (flat list)

```
┌─────────────────────────────────────┐
│ ○ Inherit (Haiku 4.5)              │
│ ─────────────────────────────────── │
│ ○ Claude Haiku 4.5                 │
│ ○ Claude Sonnet 4                  │
│ ○ Claude Opus 4                    │
└─────────────────────────────────────┘
```

Models come from `useSettingsStore.availableModels`, already populated by `fetchModels()`.

### Model Dropdown — Phase 2 (grouped by provider)

```
┌─────────────────────────────────────┐
│ ○ Inherit (Haiku 4.5)              │
│ ─────────────────────────────────── │
│ Anthropic                           │
│   ○ Claude Haiku 4.5               │
│   ○ Claude Sonnet 4                │
│   ○ Claude Opus 4                  │
│ ─────────────────────────────────── │
│ OpenAI                              │
│   ○ GPT-4o                         │
│   ○ GPT-4o mini                    │
│ ─────────────────────────────────── │
│ Ollama                              │
│   ○ llama3.1:70b                   │
│   ○ mistral:latest                 │
└─────────────────────────────────────┘
```

The model dropdown component should accept a `groupByProvider: boolean` prop. Phase 1 passes `false`; Phase 2 passes `true`.

- The first option is always "Inherit" which shows the currently resolved model.
- Selecting a specific model sets `modelOverride` on the node.
- Selecting "Inherit" removes the override.

### "Set as branch default" Button

Only shown on nodes with children (branch points). Sets the `modelOverride` on that node, which descendants will inherit.

## UI — Chat Input Model Selector

The chat input area shows the currently effective model for the next message:

```
┌─────────────────────────────────────────────────┐
│ ↳ Replying to: Here is my response...           │
│   Model: Haiku 4.5 [change ▾]                   │
├─────────────────────────────────────────────────┤
│ [Type a message...]                    [Send ▶] │
└─────────────────────────────────────────────────┘
```

Clicking "change" opens the model dropdown. The override applies only to the next message being sent (stored as `modelOverride` on the new user + assistant nodes).

## Conversation-Level Model

The conversation header (or a setting within the conversation) allows setting the chat-level default model. This is stored in `conversation.model`. Phase 2 adds `conversation.providerId`.

## Persistence

Model overrides are stored on each `TreeNode` in IndexedDB via the existing write-through pattern. The cascade is resolved at runtime — no denormalization needed.

## Graceful Extension Checklist (Phase 1 → Phase 2)

To ensure Phase 1 code transitions smoothly to Phase 2:

1. Use `ResolvedModel` return type from the start (even with hardcoded provider).
2. Store `ModelInfo` objects (with `providerId` field) in the available models list. In Phase 1, all will have `providerId: 'anthropic'`.
3. The model dropdown component accepts `groupByProvider: boolean` prop. Phase 1 passes `false`.
4. The `sendMessage` abstraction accepts a `providerId` parameter from Phase 1, even if it only handles `'anthropic'`.
5. Never compare model IDs with hardcoded strings. Always use the resolved model from the cascade.

## Edge Cases

- **Model becomes unavailable**: if a saved model override references a model that's no longer available (e.g., Ollama model deleted in Phase 2), show the chip in a warning color with "Model unavailable" tooltip. Fall back to the next level in the cascade for actual API calls.
- **Provider becomes unconfigured (Phase 2)**: if the provider for an override no longer has a valid API key, same warning treatment.
- **Mixed providers in a single conversation (Phase 2)**: each message in the path to root may use a different provider. When building the API context, the *current* message's provider receives the full message history — the provider only matters for the outgoing API call, not for historical messages.
- **Phase 1 nodes loaded in Phase 2**: nodes created in Phase 1 have no `providerOverride`. The cascade naturally falls through to the conversation or global default provider. No migration needed.
