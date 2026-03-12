---
title: Advanced API Config
parent: Features
nav_order: 3
---

# Advanced API Configuration

Fine-tune how Baobab communicates with LLM APIs.

## Settings

Configure these in **Settings > Advanced**:

| Setting | Default | Description |
|:--------|:--------|:------------|
| **Temperature** | 1.0 | Controls randomness. Lower = more deterministic, higher = more creative |
| **Max output tokens** | 4096 | Maximum tokens in the response |
| **Top P** | null (use default) | Nucleus sampling threshold |
| **Top K** | null (use default) | Limits token selection to top K candidates |
| **Thinking mode** | Off | Enable extended thinking (Anthropic models only) |
| **Thinking budget** | 10000 | Max tokens for thinking when enabled |

## Extended thinking

When thinking mode is enabled for Anthropic models, the model generates internal reasoning before its visible response. This can improve quality for complex tasks.

- Thinking content is stored separately from the visible response
- Displayed as a collapsible section in the node detail panel
- Thinking tokens count toward pricing but are not visible in the tree preview
- Thinking mode requires compatible Claude models (Claude 3.5 Sonnet and above)

## Per-conversation overrides

These settings apply globally by default. For per-subtree model and prompt overrides, see [Model Cascade]({% link features/model-cascade.md %}) and [System Prompt Cascade]({% link features/system-prompt-cascade.md %}).
