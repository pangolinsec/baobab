# 07 — Inference Providers

## Summary

Abstract the LLM API layer to support multiple inference providers beyond Anthropic: Ollama (local), OpenAI (ChatGPT), OpenRouter, Gemini, and Hugging Face. Each provider has its own API key configuration and model discovery. Provider selection defaults to Anthropic globally but can be overridden per chat, branch, or message (cascade defined in feature 08).

## Priority

Tier 2 — power feature.

## Dependencies

- **00 Backend Architecture**: some providers may need backend proxying (Ollama from a hosted environment, HuggingFace inference).

## Provider Specifications

### Anthropic (default)

- **Already implemented.**
- API key in Settings.
- Models fetched via `client.models.list()`.
- Streaming via `messages.stream()`.
- Tool use: native `tools` parameter.

### Ollama

- **Base URL**: configurable, default `http://localhost:11434`.
- **Auth**: none (local).
- **Model discovery**: `GET /api/tags` → list of locally available models.
- **Chat API**: `POST /api/chat` — OpenAI-compatible format with streaming.
- **Tool use**: Ollama supports function calling on compatible models (llama3.1+, mistral, etc.). Not all models support it.
- **Note**: when the app is hosted remotely, the user provides their Ollama instance URL (e.g., a tunnel or VPN). The backend proxies the request if needed (to avoid CORS issues from the browser).

### OpenAI (ChatGPT)

- **Base URL**: `https://api.openai.com/v1`.
- **Auth**: API key (`sk-...`).
- **Model discovery**: `GET /v1/models` → filter for chat models.
- **Chat API**: `POST /v1/chat/completions` with streaming (`stream: true`).
- **Tool use**: native `tools` parameter (OpenAI function calling).
- **Streaming format**: SSE with `data: {...}` lines.

### OpenRouter

- **Base URL**: `https://openrouter.ai/api/v1`.
- **Auth**: API key.
- **Model discovery**: `GET /v1/models` → large list of models from many providers.
- **Chat API**: OpenAI-compatible `POST /v1/chat/completions`.
- **Tool use**: depends on the underlying model.
- **Note**: OpenRouter gives access to Claude, GPT, Gemini, Llama, etc. through a single API key.

### Gemini (Google)

- **Base URL**: `https://generativelanguage.googleapis.com/v1beta`.
- **Auth**: Google API key.
- **Model discovery**: `GET /models` → list of Gemini models.
- **Chat API**: `POST /models/{model}:streamGenerateContent`.
- **Tool use**: native function calling support.
- **Note**: Gemini's API format differs significantly from OpenAI — needs its own adapter.

### Hugging Face

- **Base URL**: `https://api-inference.huggingface.co`.
- **Auth**: HF token.
- **Model discovery**: curated list of recommended models (HF has thousands; showing all is not useful). Allow user to type a model ID.
- **Chat API**: `POST /models/{model_id}` — uses the HF Inference API, which supports OpenAI-compatible chat format for chat models.
- **Tool use**: limited; most HF models don't support native function calling.

## Architecture — Provider Abstraction

### Interface

```typescript
// src/api/providers/types.ts

interface LLMProvider {
  id: string;                    // 'anthropic', 'ollama', 'openai', etc.
  name: string;                  // Display name

  validateKey(config: ProviderConfig): Promise<boolean>;
  fetchModels(config: ProviderConfig): Promise<ModelInfo[]>;
  sendMessage(params: ProviderSendParams): Promise<void>;
  supportsToolUse(modelId: string): boolean;
  supportsThinking(modelId: string): boolean;
}

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

interface ProviderSendParams {
  config: ProviderConfig;
  model: string;
  messages: { role: string; content: string }[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  thinkingEnabled?: boolean;
  thinkingBudget?: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  onToken: (text: string) => void;
  onThinking?: (text: string) => void;
  onToolUse?: (toolCall: ToolCall) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

interface ModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  supportsTools: boolean;
  supportsThinking: boolean;
  contextWindow?: number;
}
```

### Provider Registry

```typescript
// src/api/providers/registry.ts

const providers: Record<string, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
  openai: new OpenAIProvider(),
  openrouter: new OpenRouterProvider(),
  gemini: new GeminiProvider(),
  huggingface: new HuggingFaceProvider(),
};

export function getProvider(id: string): LLMProvider { ... }
export function getAllProviders(): LLMProvider[] { ... }
```

### File Structure

```
src/api/providers/
  types.ts                # Interfaces
  registry.ts             # Provider registry
  anthropic.ts            # Anthropic implementation (refactored from current claude.ts)
  ollama.ts
  openai.ts
  openrouter.ts
  gemini.ts
  huggingface.ts
```

## Data Model Changes

### `AppSettings`

```typescript
interface AppSettings {
  // ... existing
  providers: Record<string, ProviderConfig>;  // keyed by provider ID
  defaultProvider: string;                     // default 'anthropic'
}
```

Default `providers`:
```typescript
{
  anthropic: { apiKey: '' },
  ollama: { baseUrl: 'http://localhost:11434' },
  openai: { apiKey: '' },
  openrouter: { apiKey: '' },
  gemini: { apiKey: '' },
  huggingface: { apiKey: '' },
}
```

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  providerId: string;          // provenance: which provider produced this response (written at response time, read-only after)
  providerOverride?: string;   // cascade control: "use this provider for descendants" (participates in resolveCascade)
}
```

**`providerId` vs `providerOverride`**: These are semantically different fields:

- **`providerId`** (required on assistant nodes): Records which provider actually produced this node's response. Written once when the API response completes. Used for display ("via OpenAI"), pricing lookups, and auditing. Cannot be derived reliably from `node.model` because the same model ID may appear on multiple providers (e.g., OpenRouter exposes Claude models).
- **`providerOverride`** (optional, any node): A cascade override — "use this provider for new messages below this point." Participates in `resolveCascade` alongside `modelOverride`. When set on a node, all descendants inherit this provider unless overridden further down.

### Settings Store

```typescript
interface SettingsState {
  // ... existing
  availableModels: ModelInfo[];  // now aggregated across all configured providers
  validateProvider: (providerId: string) => Promise<boolean>;
}
```

When any provider's key is set, validate and fetch its models. The `availableModels` array contains models from all valid providers, each tagged with `providerId`.

## UI — Settings Dialog

### Provider Configuration Section

Replace the single "Anthropic API Key" field with a tabbed or accordion provider list:

```
Inference Providers

▼ Anthropic (default)
  API Key: [sk-ant-•••••••]  ✓ 12 models

▶ OpenAI
  API Key: [                ]

▶ Ollama
  Base URL: [http://localhost:11434]
  [Test Connection]

▶ OpenRouter
  API Key: [                ]

▶ Gemini
  API Key: [                ]

▶ Hugging Face
  Token: [                  ]

Default Provider: [Anthropic ▾]
```

Each provider section:
- Collapsed by default (except the default provider).
- Shows validation status (checkmark, model count) when configured.
- "Test Connection" button for Ollama (and others as appropriate).

### Model Selector (feature 08 integration)

The model dropdown groups models by provider:

```
┌─────────────────────────────────┐
│ Anthropic                       │
│   Claude Haiku 4.5              │
│   Claude Sonnet 4               │
│   Claude Opus 4                 │
│ ─────────────────────────────── │
│ OpenAI                          │
│   GPT-4o                        │
│   GPT-4o mini                   │
│ ─────────────────────────────── │
│ Ollama                          │
│   llama3.1:70b                  │
│   mistral:latest                │
│   codestral:latest              │
└─────────────────────────────────┘
```

Only providers with valid configuration and at least one model appear.

## Message Format Translation

Each provider has different message format requirements. The provider implementation handles translation:

- **Anthropic**: `{ role: 'user' | 'assistant', content: string }` (current format).
- **OpenAI/OpenRouter**: `{ role: 'system' | 'user' | 'assistant', content: string }` — system prompt goes in a system message, not a separate parameter.
- **Gemini**: `{ role: 'user' | 'model', parts: [{ text: string }] }` — different role names and structure.
- **Ollama**: OpenAI-compatible format.
- **HuggingFace**: OpenAI-compatible format for chat models.

The provider abstraction handles this translation transparently.

## Streaming Format Translation

- **Anthropic**: custom SSE format with `message_start`, `content_block_delta`, etc.
- **OpenAI/OpenRouter/Ollama**: SSE with `data: {"choices": [{"delta": {"content": "..."}}]}`.
- **Gemini**: SSE with `{"candidates": [{"content": {"parts": [{"text": "..."}]}}]}`.

Each provider implementation parses its own streaming format and calls the unified `onToken` callback.

## Error Handling

- Provider-specific error messages (e.g., "OpenAI rate limit exceeded", "Ollama connection refused").
- If a provider goes down mid-stream, the error is captured on the assistant node and the user can retry with a different provider/model.
- Clear feedback when a selected model doesn't support a requested feature (tool use, thinking).
