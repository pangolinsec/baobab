---
title: Cascade System
parent: Architecture
nav_order: 4
---

# Cascade System

Many settings in Baobab can be overridden at the node level, with overrides automatically inheriting down the tree. This is the **cascade system** — a pattern inspired by CSS cascading, applied to conversation tree settings.

## How cascades work

When Baobab needs the effective value of a setting (model, system prompt, provider) for a given node, it walks from the root to that node and takes the **last override encountered**:

```typescript
function resolveCascade<T>(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  getOverride: (node: TreeNode) => T | undefined,
  defaultValue: T
): T {
  const path = getPathToRoot(nodeId, nodes); // Returns root → node order
  let resolved = defaultValue;
  for (const node of path) {
    const override = getOverride(node);
    if (override !== undefined && override !== null) {
      resolved = override;
    }
  }
  return resolved;
}
```

### Resolution order

For any given node, the effective value is determined by checking (in order of increasing priority):

1. **Global default** (from settings)
2. **Conversation default** (from conversation metadata)
3. **Ancestor node overrides** (from root toward the target node)
4. **The node's own override** (highest priority)

The last non-null value wins.

## Cascade types

### Model cascade

Override which model is used for responses in a subtree.

```
Root (default: claude-haiku)
├── Node A (no override → uses haiku)
│   └── Node B (modelOverride: gpt-4 → uses gpt-4)
│       └── Node C (no override → inherits gpt-4)
└── Node D (no override → uses haiku)
```

### System prompt cascade

Override the system prompt for a subtree. Useful for changing the assistant's behavior mid-conversation.

```
Root (default: "You are a helpful assistant")
├── Node A (systemPromptOverride: "You are a code reviewer")
│   └── Node B (inherits "You are a code reviewer")
└── Node C (uses default prompt)
```

### Provider cascade

Override which LLM provider handles requests in a subtree.

```
Root (default provider: anthropic)
├── Node A (providerOverride: openai)
│   └── Node B (inherits openai)
└── Node C (uses anthropic)
```

## System prompt resolution

The system prompt is resolved at API-call time using `resolveCascade` — walking from root to the target node and using the last `systemPromptOverride` encountered, falling back to the conversation-level system prompt, then to the global default from settings.

The architecture is designed for a multi-stage assembly pipeline where future features (project file context, RAG retrieval) can append additional context, but currently only cascade resolution (Stage 1) is implemented.

## Visual indicators

When a node has an active cascade override, visual indicators appear on the node in the tree view:

- **Model chip** — shows the effective model name when it differs from the conversation default
- **"system" chip** — appears when a system prompt override is active

These indicators help users understand which settings are in effect at any point in the tree.
