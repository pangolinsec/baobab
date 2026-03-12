---
title: Home
layout: default
nav_order: 1
---

# Baobab

A tree-based conversation UI for LLM APIs. Branch from any response to explore multiple threads of thought, with full context preserved from root to leaf.
{: .fs-6 .fw-300 }

[Get Started]({% link getting-started.md %}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[Usage Guide]({% link guide.md %}){: .btn .btn-green .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/OWNER/baobab){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## What is Baobab?

Baobab reimagines AI conversations as **explorable trees** rather than linear chat threads. Every assistant response becomes a branching point — fork the conversation to pursue different lines of reasoning, compare approaches, or backtrack without losing context.

Built as a standalone web app that runs entirely in your browser, Baobab connects directly to LLM provider APIs (Anthropic, OpenAI, Azure Foundry, Google Gemini, OpenRouter, Ollama, and more) and renders conversations as interactive node-and-edge graphs.

### Key capabilities

- **Tree-structured conversations** — branch from any response to start independent threads, each preserving full linear context from root to leaf
- **Multi-provider support** — connect to Anthropic, OpenAI, Azure Foundry, Gemini, OpenRouter, Ollama, and Hugging Face from a single interface
- **Real-time streaming** — token-by-token streaming with visual indicators
- **Interactive graph** — zoom, pan, collapse/expand subtrees, minimap navigation
- **Dual view modes** — switch between tree graph and linear thread view
- **Branch operations** — summarize, merge, and annotate branches (star, dead-end flags)
- **Full-text search** — search across all conversations with role and content filters
- **Persistent local storage** — all data stored in IndexedDB, survives page reloads, no server required
- **Dark mode** — warm-toned dark theme matching the light theme's aesthetic
- **Pricing transparency** — real-time token counting and cost estimation
- **Export/import** — download conversations as JSON for backup or sharing
- **Reasoning blocks** — view, copy, paste, and inject thinking blocks across nodes; supports Anthropic extended thinking and OpenAI/Azure encrypted reasoning with effort control

### How it works

When you send a message from any node in the tree, Baobab walks from that node to the root via parent links, building the linear message history that gets sent to the LLM API. Each branch maintains its own independent context path — the model sees a clean, linear conversation even though you're exploring a tree.

```
         [System prompt]
              │
         [User: "Explain quantum computing"]
              │
         [Assistant: "Quantum computing uses..."]
            ╱    ╲
   [User: "Tell me     [User: "How does
    about qubits"]       entanglement work?"]
        │                       │
   [Assistant: ...]        [Assistant: ...]
```

Each path from root to leaf is a complete, coherent conversation thread.

---

## Tech stack

| Layer | Technology |
|:------|:-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Routing | react-router-dom 7 |
| Graph | @xyflow/react v12 (React Flow) + dagre |
| State | Zustand v5 |
| Persistence | Dexie.js v4 (IndexedDB) |
| Styling | Tailwind CSS v4 |
| LLM Providers | Anthropic, OpenAI, Azure Foundry, Gemini, OpenRouter, HuggingFace, Ollama |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Icons | lucide-react |

## License

Baobab is released under the [MIT License](https://opensource.org/licenses/MIT).
