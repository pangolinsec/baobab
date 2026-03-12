---
title: Multi-Provider Support
parent: Features
nav_order: 8
---

# Multi-Provider Support

Connect to multiple LLM providers from a single Baobab instance.

## Supported providers

| Provider | Models | Notes |
|:---------|:-------|:------|
| **Anthropic** | Claude Haiku, Sonnet, Opus | Full feature support including thinking mode |
| **OpenAI** | GPT-4o, GPT-4, O1, O3 | ChatCompletions API |
| **Google Gemini** | Gemini Pro, Flash, Ultra | Google AI Studio API |
| **OpenRouter** | 100+ models | Aggregates models from many providers; includes live pricing |
| **Ollama** | Any locally hosted model | Local inference, no API key required |
| **Azure Foundry** | Azure-hosted models (GPT-4o, O1, O3, etc.) | Per-deployment endpoint/key config; reasoning models route to Responses API |
| **Hugging Face** | Text generation models | HF Inference API |

## Configuration

Go to **Settings > Providers** to:

1. Enable/disable providers
2. Enter API keys
3. Configure custom endpoints (e.g., for Ollama or a proxy)
4. View available models from each provider

## Azure Foundry

Azure Foundry uses a per-deployment configuration model. Each model deployment has its own endpoint URL and API key, rather than a single account-wide key. Models are identified by `azure::uuid` identifiers.

When adding an Azure Foundry model in **Settings > Manage Models**, you configure:

- **Deployment endpoint** — the full Azure endpoint URL for that deployment
- **API key** — the key specific to that deployment
- **Is reasoning model** — flag that routes the model to the OpenAI Responses API instead of the Chat Completions API, enabling thinking blocks and reasoning effort control

This dual-API strategy means non-reasoning models use the standard Chat Completions path while reasoning models (O1, O3, etc.) use the Responses API with full thinking block support.

## Using multiple providers

### Default provider

Set a global default provider in **Settings > Providers**. All new conversations use this provider unless overridden.

### Per-conversation provider

Each conversation can have its own default provider, set when creating the conversation or in conversation settings.

### Per-branch provider

Use the [provider cascade]({% link architecture/cascade-system.md %}) to set a `providerOverride` on any node. All descendants of that node will use the specified provider.

### Mixing providers in one tree

A single conversation tree can use different providers on different branches:

```
Root (default: Anthropic)
├── Branch A → Claude responses
├── Branch B (providerOverride: openai) → GPT-4 responses
└── Branch C (providerOverride: ollama) → Local model responses
```

This is especially powerful for comparing how different models handle the same conversation context.
