---
title: Getting Started
nav_order: 2
---

# Getting Started

Baobab runs entirely inside Docker — no Node.js installation required on the host.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- An API key from at least one supported provider:
  - [Anthropic](https://console.anthropic.com/) (recommended)
  - [OpenAI](https://platform.openai.com/api-keys)
  - [Google AI Studio](https://aistudio.google.com/apikey) (Gemini)
  - [OpenRouter](https://openrouter.ai/keys)
  - [Hugging Face](https://huggingface.co/settings/tokens)
  - [Azure Foundry](https://ai.azure.com/) (requires per-deployment endpoint URL and API key)
  - [Ollama](https://ollama.com/) (local, no API key needed)

## Quick start

```bash
git clone <repo-url> && cd baobab
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Initial setup

1. Click **Settings** in the sidebar (gear icon at the bottom)
2. Go to the **Providers** tab
3. Select a provider (Anthropic, OpenAI, Azure Foundry, etc.) and paste your API key — the key is validated immediately and available models are fetched
4. Choose a default model
   - For **Azure Foundry**, use **Manage Models** to add deployments individually, each with its own endpoint URL, API key, and reasoning model flag
5. Optionally switch to dark mode in the **General** tab

You can add multiple providers and switch between them per-conversation or per-node.

## Your first conversation

1. Click **New Chat** in the sidebar
2. Type a message in the input box at the bottom
3. Press Enter or click Send — the response streams in real-time
4. To **branch**: click any assistant node in the tree, then click "Reply here" in the detail panel, and type a new message
5. To **switch branches**: click any node to view it in the detail panel; the tree highlights the active path from root to that node

## Keyboard shortcuts

| Key | Action |
|:----|:-------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Cancel streaming / close panels |
| `Ctrl+Click` | Multi-select nodes (for merge) |

## Production build

To build a production-optimized version:

```bash
docker build --target production -t baobab .
docker run -p 8080:80 baobab
```

This creates a multi-stage build: TypeScript compilation, Vite bundling, and an Nginx container serving the static files on port 8080.

## Next steps

- [Usage Guide]({% link guide.md %}) — walkthrough of every feature, from branching to research agents
- [Features]({% link features/index.md %}) — reference pages for individual features
- [Architecture Overview]({% link architecture/index.md %}) — understand how the codebase is organized
- [Development Guide]({% link development/index.md %}) — set up for contributing
