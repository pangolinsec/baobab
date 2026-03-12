---
title: Provider System
parent: Architecture
nav_order: 3
---

# Provider System

Baobab supports multiple LLM providers through a unified abstraction layer. Each provider implements the same interface, allowing the UI to work identically regardless of which model or service is being used.

## Provider interface

```typescript
interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean;

  validateKey(config: ProviderConfig): Promise<boolean>;
  fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]>;
  sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void>;
  fetchPricing?(config: ProviderConfig): Promise<LivePricingEntry[]>;
}
```

## Supported providers

| Provider | Streaming | Thinking | API Key Required | Notes |
|:---------|:----------|:---------|:-----------------|:------|
| **Anthropic** | Yes | Yes | Yes | Claude models, full feature support |
| **OpenAI** | Yes | Yes | Yes | GPT-4, o1/o3/o4 models; dual API strategy (see below) |
| **Gemini** | Yes | No | Yes | Google generative models |
| **OpenRouter** | Yes | Varies | Yes | 100+ models from various providers, includes live pricing API |
| **Ollama** | Yes | No | No | Local inference, no API key needed |
| **Azure Foundry** | Yes | Yes | Yes | Per-deployment config, delegates to Chat Completions or Responses API based on `isReasoningModel` flag |
| **Hugging Face** | Yes | No | Yes | HF Inference API |

## Registry

Providers are registered in a central registry and looked up by ID:

```typescript
// src/api/providers/registry.ts
const providers: Record<string, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  azure: new AzureProvider(),
  gemini: new GeminiProvider(),
  openrouter: new OpenRouterProvider(),
  ollama: new OllamaProvider(),
  huggingface: new HuggingFaceProvider(),
};

export function getProvider(id: string): LLMProvider | undefined;
export function getAllProviders(): LLMProvider[];
```

## Configuration

Each provider requires a `ProviderConfigData` object stored in settings:

```typescript
interface ProviderConfigData {
  id: string;          // Provider ID (e.g., "anthropic")
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;    // Custom endpoint (useful for Ollama, proxies)
  models?: string[];   // Cached model list
}
```

Provider configurations are managed in **Settings > Providers** where users can enable/disable providers, enter API keys, and configure custom endpoints.

## Provider cascade

The provider used for each message is resolved through a cascade:

1. **Node-level override** (`providerOverride` on any ancestor) — highest priority
2. **Conversation-level default** (`conversation.providerId`)
3. **Global default** (`settings.defaultProvider`)

This allows mixing providers within a single conversation tree. For example, you might use Claude for the main thread and GPT-4 for a comparison branch.

## Message flow

When sending a message:

1. Resolve the effective provider via cascade
2. Resolve the effective model via cascade
3. Build the message history via `messageBuilder.ts` (walk to root, assemble messages, inject reasoning blocks)
4. Dispatch to the provider's `sendMessage()` method
5. Stream tokens back to the UI via callback
6. Finalize the node with content, thinking blocks, and token usage

```typescript
// Simplified flow in useStreamingResponse
const provider = getProvider(resolvedProviderId);
await provider.sendMessage(config, {
  messages: messageHistory,
  model: resolvedModel,
  systemPrompt: resolvedSystemPrompt,
  onToken: (token) => updateNodeContent(nodeId, token),
  onComplete: (result) => finalizeNode(nodeId, result),
});
```

### Message builder

`lib/messageBuilder.ts` is the central message assembly point. It walks the tree path from root to the current node, builds the provider-specific message array, and handles reasoning block injection (e.g., `injectAtEnd` blocks are appended after the last user message for OpenAI reasoning roundtrips).

### Dual API path (OpenAI / Azure)

OpenAI and Azure Foundry use two API implementations depending on the model:

- **Reasoning models** (o1-, o3-, o4- series): routed to the **Responses API** (`openai-responses-api.ts`), which supports native reasoning output with encrypted thinking content, `reasoningEffort` control, and `ThinkingBlock[]` capture.
- **Non-reasoning models** (GPT-4, GPT-4o, etc.): routed to the **Chat Completions API** (`openai-chat-completions.ts`), the standard OpenAI chat interface.

The routing decision is made by `callProvider.ts`. For Azure, each deployment declares an `isReasoningModel` flag in its configuration, which determines which API path is used.
