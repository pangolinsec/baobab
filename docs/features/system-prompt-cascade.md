---
title: System Prompt Cascade
parent: Features
nav_order: 5
---

# System Prompt Cascade

Override the system prompt at any point in the conversation tree. The override inherits to all descendant nodes.

## How it works

Each node can have a `systemPromptOverride`. When resolving the system prompt for an API call, Baobab walks from root to the target node and uses the last override encountered.

```
Root (default: "You are a helpful assistant")
├── Node A (override: "You are a code reviewer")
│   └── Node B (inherits "You are a code reviewer")
│       └── Node C (override: "You are a Python expert")
│           └── Node D (inherits "You are a Python expert")
└── Node E (uses default prompt)
```

## Setting a system prompt override

The system prompt can be set at multiple levels:

- **Global default**: Settings > Prompts > Default System Prompt
- **Conversation level**: Set when creating a conversation or in conversation settings
- **Node level**: Set via the node context menu or detail panel

## Visual indicator

When a system prompt override is active on a node, a **"system"** chip appears on the node in the tree view (see [Visual Indicators]({% link features/visual-indicators.md %})).

## Use cases

- **Role switching**: Change the assistant's persona mid-conversation (e.g., switch from general assistant to code reviewer)
- **Instruction refinement**: Narrow the assistant's focus for a specific branch
- **A/B testing prompts**: Branch and apply different system prompts to compare outputs
