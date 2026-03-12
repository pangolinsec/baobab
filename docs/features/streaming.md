---
title: Streaming Responses
parent: Features
nav_order: 2
---

# Streaming Responses

Baobab streams LLM responses token-by-token, providing real-time visual feedback as the model generates its answer.

## How it works

1. User sends a message from the reply target node
2. A user node is created and attached to the tree
3. A placeholder assistant node is created
4. The provider's `sendMessage()` begins streaming
5. Each token updates the assistant node's content in real-time
6. On completion, the node is finalized with full content, thinking, and token usage

## Visual indicators

During streaming:

- The assistant node shows a **pulsing animation** on its border
- The edge from the user node to the streaming node shows **animated dashes**
- The message content updates live in both the tree node preview and the detail panel
- A **stop button** appears in the chat input, allowing the user to abort

## Abort

Click the stop button or press `Escape` to abort a streaming response. The partial content received so far is kept in the node. The node is finalized with whatever content was received.

## Error handling

If the API returns an error:

- The assistant node is finalized with the error message as content
- The node gets a **red border** visual treatment
- The error is displayed in the detail panel
- The user can retry via the context menu ("Retry" option)

## Reasoning blocks

Baobab captures model reasoning from multiple providers using a unified `ThinkingBlock` architecture (replacing the earlier string-based `thinking` field).

### Anthropic extended thinking

When thinking mode is enabled for Anthropic models, the model's internal reasoning is captured as thinking blocks:

- Thinking content is stored as `ThinkingBlock` entries on the node
- It appears as an expandable section in the detail panel
- Thinking tokens are counted separately from output tokens

### OpenAI and Azure reasoning

OpenAI reasoning models (O1, O3) and Azure Foundry reasoning deployments use the Responses API to stream reasoning content:

- Reasoning blocks may contain **encrypted content** — the model produces reasoning tokens but the actual text is opaque. Baobab displays these as "[encrypted reasoning]" placeholders.
- **Reasoning effort** can be controlled per-request with three levels: low, medium, and high. This is configurable in the advanced API settings.
- Reasoning blocks from these providers use the same `ThinkingBlock` structure, enabling consistent display, copy/paste, and injection across providers.

### Reasoning block operations

Reasoning blocks can be:

- **Viewed** in the detail panel as collapsible sections
- **Copied** from one node and **pasted** into another
- **Injected** into nodes manually to provide pre-seeded reasoning context
