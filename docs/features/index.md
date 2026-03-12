---
title: Features
nav_order: 4
has_children: true
---

# Features

Baobab ships with a rich set of implemented features. Additional capabilities are planned for future releases.

## Implemented features

### Core

| Feature | Description |
|:--------|:------------|
| [Tree Conversations]({% link features/tree-conversations.md %}) | Branch from any response, explore multiple threads with full context |
| [Streaming Responses]({% link features/streaming.md %}) | Real-time token streaming with visual indicators |
| [Advanced API Config]({% link features/advanced-config.md %}) | Temperature, thinking mode, top-p/top-k, max tokens |
| [Model Cascade]({% link features/model-cascade.md %}) | Override the model at any point in the tree |
| [System Prompt Cascade]({% link features/system-prompt-cascade.md %}) | Override the system prompt per-subtree |
| [Visual Indicators]({% link features/visual-indicators.md %}) | Chips and badges showing active overrides |
| [Resend & Duplicate]({% link features/resend-duplicate.md %}) | Resend messages, duplicate and edit responses |
| [Conversation Management]({% link features/conversation-management.md %}) | Inline rename, LLM-generated titles, project assignment |

### Power features

| Feature | Description |
|:--------|:------------|
| [Multi-Provider Support]({% link features/providers.md %}) | Connect to Anthropic, OpenAI, Azure Foundry, Gemini, OpenRouter, Ollama, HuggingFace |
| [Star Messages]({% link features/star-messages.md %}) | Bookmark important messages for quick access |
| [Dead-End Branches]({% link features/dead-end-branches.md %}) | Flag unproductive branches to dim them visually |
| [Summarize Branches]({% link features/summarize-branches.md %}) | Generate LLM summaries of branch content |
| [Search]({% link features/search.md %}) | Full-text search across conversations |
| [Thread View]({% link features/thread-view.md %}) | Linear chat-like view as an alternative to the tree graph |
| [Tags]({% link features/tags.md %}) | Organize conversations with tags |
| [Merge Branches]({% link features/merge-branches.md %}) | Combine insights from two branches |
| [Pricing Transparency]({% link features/pricing.md %}) | Real-time token counting and cost estimation |
| [Manual Tree Editing]({% link features/manual-tree-editing.md %}) | Create arbitrary nodes, duplicate tool calls and thinking blocks |
| Reasoning Block Management | View, copy, paste, and inject thinking blocks across nodes; supports Anthropic extended thinking and OpenAI/Azure encrypted reasoning |

### Research & knowledge

| Feature | Description |
|:--------|:------------|
| [Web Search]({% link features/web-search.md %}) | DuckDuckGo, Tavily, and Bing search as tool calls |
| [Project Knowledge]({% link features/project-knowledge.md %}) | Group conversations, attach files, inject context via @mention or agentic retrieval |
| [Research Agent]({% link features/research-agent.md %}) | Plan-and-execute research across conversation trees or the web |

## Planned features (not yet implemented)

These features are designed and specced but have no functional implementation yet. See the `Features/` directory in the repository for detailed specifications.

| Feature | Status |
|:--------|:-------|
| [Compare & Classify]({% link features/compare-classify.md %}) | Spec only |
| [RAG Over Conversations]({% link features/rag.md %}) | Spec only |
| Batch Prompt Execution (Feature 29) | Spec only |
| HTTP Tool Extensions (Feature 33) | Spec only |
| Code Interpreter (Feature 34) | Spec only |
