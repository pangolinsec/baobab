---
title: Model Cascade
parent: Features
nav_order: 4
---

# Model Cascade

Override the model used for responses at any point in the conversation tree. The override inherits down to all descendant nodes.

## How it works

Each node can have a `modelOverride` field. When set, all responses generated from that node and its descendants will use the specified model instead of the conversation default.

```
Root (conversation default: claude-haiku)
├── Branch A (no override → haiku)
│   └── User sets modelOverride to "gpt-4"
│       └── All descendants use gpt-4
└── Branch B (no override → haiku)
```

## Setting a model override

1. Right-click a node to open the context menu
2. Select the model from the model picker
3. The override applies to that node and all descendants

The [Visual Indicators]({% link features/visual-indicators.md %}) feature shows a model chip on nodes where the effective model differs from the conversation default.

## Resolution

Model resolution follows the [cascade system]({% link architecture/cascade-system.md %}):

1. Walk from root to the target node
2. Check each node for `modelOverride`
3. Last override wins
4. If no override found, use the conversation's default model
5. If no conversation default, use the global default from settings

## Use cases

- **Compare models**: Branch from the same point and set different models on each branch to compare responses
- **Cost management**: Use a cheaper model for routine questions and switch to a more capable model for complex ones
- **Capability matching**: Use a model with specific strengths (coding, reasoning, creativity) for relevant branches
