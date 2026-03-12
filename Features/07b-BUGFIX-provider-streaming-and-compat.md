# 07b — BUGFIX: Provider Streaming & Compatibility

## Summary

Fix multiple bugs in the non-Anthropic provider implementations (OpenAI, OpenRouter, Gemini, HuggingFace) that cause silent token drops during streaming, hard failures on specific model families, and unreliable model discovery. These are all within the provider code introduced by Feature 07.

## Priority

High — affects all non-Anthropic providers. The SSE parsing bug alone can corrupt every streamed response under certain network conditions.

## Dependencies

- **07 Inference Providers**: these are bugs in the 07 implementation.

## Bug 1: SSE Line Splitting (OpenAI, OpenRouter, HuggingFace, Gemini)

### Problem

All four SSE-based providers parse streamed chunks like this:

```typescript
const chunk = decoder.decode(value, { stream: true });
const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
```

SSE data can arrive split across `ReadableStream` chunks. If a `data: {"choices":[...]}` line is split between two `reader.read()` calls:

- **First chunk**: `data: {"choices":[{"delta":{"con` — passes the `startsWith('data: ')` check but fails `JSON.parse`, silently caught.
- **Second chunk**: `tent":"hello"}}]}` — does NOT start with `data: `, so it's filtered out entirely.

Result: that token is silently dropped. The user sees incomplete text with missing words/fragments. This is more likely on slow connections, large responses, or when the server flushes mid-line.

### Fix

Add a line buffer that carries incomplete lines across reads:

```typescript
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  // The last element may be an incomplete line — keep it in the buffer
  buffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) continue;

    const data = trimmed.slice(6);
    if (data === '[DONE]') {
      params.onComplete(fullText);
      return;
    }
    try {
      const parsed = JSON.parse(data);
      // ... extract delta per provider format
    } catch {
      // Malformed JSON — skip
    }
  }
}

// Process any remaining buffer content
if (buffer.trim().startsWith('data: ')) {
  const data = buffer.trim().slice(6);
  if (data !== '[DONE]') {
    try {
      const parsed = JSON.parse(data);
      // ... extract delta
    } catch {
      // Skip
    }
  }
}

params.onComplete(fullText);
```

### Files

- `src/api/providers/openai.ts` — `sendMessage()`
- `src/api/providers/openrouter.ts` — `sendMessage()`
- `src/api/providers/huggingface.ts` — `sendMessage()`
- `src/api/providers/gemini.ts` — `sendMessage()`

### Testing

- Stream a long response (1000+ tokens) from each provider.
- Verify the final streamed text matches the complete response (no missing words).
- Simulate slow connection (browser DevTools → Network → throttle to "Slow 3G") and verify no token drops.

---

## Bug 2: OpenAI o1/o3 Model Incompatibility

### Problem

The OpenAI provider filters for `gpt-*`, `o1-*`, and `o3-*` models:

```typescript
.filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1-') || m.id.startsWith('o3-'))
```

However, `o1` and `o3` are reasoning models with different API requirements:

- They do **not** support `temperature` — the API returns an error if it's included.
- They do **not** support `stream: true` in the same way (o1 uses a different streaming protocol; o3 may not support streaming at all depending on version).
- They use `max_completion_tokens` instead of `max_tokens`.
- They do **not** support `top_p`.

The current code unconditionally sends `stream: true`, `temperature`, `max_tokens`, and `top_p`, causing hard API errors for any o1/o3 model.

### Fix

Detect reasoning models and adjust the request accordingly:

```typescript
const isReasoningModel = params.model.startsWith('o1-') || params.model.startsWith('o3-');

const body: Record<string, unknown> = {
  model: params.model,
  messages,
  stream: true,
};

if (isReasoningModel) {
  // Reasoning models: no temperature, no top_p, use max_completion_tokens
  if (params.maxOutputTokens) {
    body.max_completion_tokens = params.maxOutputTokens;
  }
} else {
  // Standard models: full parameter support
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.maxOutputTokens) body.max_tokens = params.maxOutputTokens;
  if (params.topP !== null && params.topP !== undefined) body.top_p = params.topP;
}
```

Additionally, reasoning models don't accept a `system` role message. The system prompt should either be omitted or prepended to the first user message:

```typescript
if (isReasoningModel && params.systemPrompt) {
  // Prepend system prompt to first user message
  const firstUserIdx = messages.findIndex(m => m.role === 'user');
  if (firstUserIdx !== -1) {
    messages[firstUserIdx] = {
      ...messages[firstUserIdx],
      content: `${params.systemPrompt}\n\n${messages[firstUserIdx].content}`,
    };
  }
} else if (params.systemPrompt) {
  messages.unshift({ role: 'system', content: params.systemPrompt });
}
```

### Files

- `src/api/providers/openai.ts` — `sendMessage()`

### Testing

- Select an o1-mini or o3-mini model and send a message.
- Verify no API error is returned.
- Verify temperature/top_p sliders are not sent in the request (check Network tab).
- Verify standard GPT models still work with all parameters.

---

## Bug 3: HuggingFace Hardcoded Model List

### Problem

`fetchModels()` returns a hardcoded list of 5 models:

```typescript
const curatedModels = [
  'mistralai/Mistral-7B-Instruct-v0.3',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  'microsoft/Phi-3-mini-4k-instruct',
  'HuggingFaceH4/zephyr-7b-beta',
  'google/gemma-2-9b-it',
];
```

Issues:
1. These models may not be available on HuggingFace's free Inference API (they rotate availability).
2. The validation check (`GET /models/{curatedModels[0]}`) only tests the first model — if it's down, the whole provider shows zero models even if others are fine.
3. Users with HuggingFace Pro or dedicated endpoints have access to different/more models.
4. The curated list is already stale (Mistral v0.3 has newer versions).

### Fix

Update the curated list to current popular models and validate each individually:

```typescript
const curatedModels = [
  'meta-llama/Llama-3.3-70B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'microsoft/Phi-3-mini-4k-instruct',
  'HuggingFaceH4/zephyr-7b-beta',
  'google/gemma-2-9b-it',
  'Qwen/Qwen2.5-72B-Instruct',
];
```

Probe each model individually and only return models that respond:

```typescript
const available: ProviderModelInfo[] = [];

await Promise.allSettled(
  curatedModels.map(async (id) => {
    try {
      const resp = await fetch(`${baseUrl}/models/${id}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        available.push({
          id,
          displayName: id.split('/').pop() || id,
          providerId: this.id,
        });
      }
    } catch {
      // Skip unavailable model
    }
  })
);

return available;
```

### Files

- `src/api/providers/huggingface.ts` — `fetchModels()`

### Testing

- Configure a HuggingFace API key and enable the provider.
- Verify available models are shown (not an empty list).
- Verify unavailable models are excluded rather than causing the whole list to fail.

---

## Bug 4: OpenRouter Model Limit

### Problem

```typescript
return data.data.slice(0, 100)
```

OpenRouter has 200+ models. Taking the first 100 without sorting means popular models may be cut off depending on API response order.

### Fix

Sort models alphabetically by name before slicing, and increase the limit:

```typescript
return data.data
  .sort((a: { id: string; name: string }, b: { id: string; name: string }) =>
    (a.name || a.id).localeCompare(b.name || b.id)
  )
  .slice(0, 200)
  .map((m) => ({
    id: m.id,
    displayName: m.name || m.id,
    providerId: this.id,
  }));
```

### Files

- `src/api/providers/openrouter.ts` — `fetchModels()`

### Testing

- Configure an OpenRouter API key and enable the provider.
- Verify more than 100 models appear in the model selector.
- Verify models are in alphabetical order within the OpenRouter optgroup.

---

## Bug 5: `findProviderForModel` Missing Heuristics

### Problem

The `findProviderForModel` function in the registry only has prefix heuristics for `claude-`, `gpt-`/`o1-`/`o3-`, and `gemini-`. Models from Ollama (e.g., `llama3:latest`), HuggingFace (e.g., `mistralai/Mistral-7B-Instruct-v0.3`), and OpenRouter (e.g., `meta-llama/llama-3-70b-instruct`) have no heuristic. The fallback returns the first enabled provider, which may be wrong.

### Fix

Add heuristics for the remaining providers and improve the fallback by checking `allProviderModels`:

```typescript
export function findProviderForModel(
  modelId: string,
  configs: ProviderConfig[]
): string | undefined {
  // Direct prefix heuristics
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.startsWith('o3-')) return 'openai';
  if (modelId.startsWith('gemini-')) return 'gemini';

  // HuggingFace models use org/model format
  if (modelId.includes('/') && !modelId.includes(':')) {
    // Could be HuggingFace or OpenRouter — check which is enabled
    const hfEnabled = configs.find(c => c.id === 'huggingface' && c.enabled);
    const orEnabled = configs.find(c => c.id === 'openrouter' && c.enabled);
    if (hfEnabled && !orEnabled) return 'huggingface';
    if (orEnabled && !hfEnabled) return 'openrouter';
    // Both enabled — ambiguous, fall through
  }

  // Ollama models typically use name:tag format
  if (modelId.includes(':')) return 'ollama';

  // Fall back to checking enabled providers
  for (const config of configs) {
    if (config.enabled && providers[config.id]) {
      return config.id;
    }
  }

  return undefined;
}
```

### Files

- `src/api/providers/registry.ts` — `findProviderForModel()`

### Testing

- With Ollama enabled, verify `findProviderForModel('llama3:latest', configs)` returns `'ollama'`.
- With HuggingFace enabled (OpenRouter disabled), verify `findProviderForModel('mistralai/Mistral-7B-Instruct-v0.3', configs)` returns `'huggingface'`.
- With both HuggingFace and OpenRouter enabled, verify it falls through gracefully.

---

## Bug 6: HuggingFace Validation Endpoint Mismatch

### Problem

`validateKey()` calls `https://huggingface.co/api/whoami-v2` (the Hub API), but inference happens on `https://api-inference.huggingface.co` (the Inference API). A token could authenticate against `whoami` but lack Inference API access, causing confusing failures at send time.

### Fix

Validate against the actual inference endpoint instead:

```typescript
async validateKey(config: ProviderConfig): Promise<boolean> {
  try {
    const baseUrl = config.baseUrl || 'https://api-inference.huggingface.co';
    // Test with a lightweight model request
    const response = await fetch(`${baseUrl}/models/gpt2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'test', parameters: { max_new_tokens: 1 } }),
      signal: AbortSignal.timeout(10000),
    });
    // 200 = success, 503 = model loading (still means auth worked)
    return response.ok || response.status === 503;
  } catch {
    return false;
  }
}
```

### Files

- `src/api/providers/huggingface.ts` — `validateKey()`

### Testing

- Enter a valid HuggingFace token and click "Test Connection".
- Verify it reports success with available models.
- Enter an invalid token and verify it reports failure.

---

## Implementation Order

1. **Bug 1 (SSE line splitting)** — highest impact, affects all four providers. Extract a shared SSE parser utility to avoid duplicating the fix four times.
2. **Bug 2 (OpenAI o1/o3)** — hard failures for a whole model family.
3. **Bug 3 (HuggingFace models)** — functional improvement.
4. **Bug 4 (OpenRouter limit)** — minor improvement.
5. **Bug 5 (findProviderForModel)** — edge case fix.
6. **Bug 6 (HuggingFace validation)** — edge case fix.

### Shared SSE Parser (for Bug 1)

To avoid duplicating the buffer logic in four places, extract a shared utility:

```typescript
// src/api/providers/sse.ts

export interface SSEParseCallbacks {
  onData: (parsed: unknown) => void;
  onDone?: () => void;
}

/**
 * Read an SSE stream with proper line buffering to handle
 * chunks split across ReadableStream boundaries.
 */
export async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: SSEParseCallbacks
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        callbacks.onDone?.();
        return;
      }
      try {
        callbacks.onData(JSON.parse(data));
      } catch {
        // Skip malformed JSON
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim().startsWith('data: ')) {
    const data = buffer.trim().slice(6);
    if (data !== '[DONE]') {
      try {
        callbacks.onData(JSON.parse(data));
      } catch {
        // Skip
      }
    }
  }
}
```

Then each provider's `sendMessage` simplifies to:

```typescript
await readSSEStream(reader, {
  onData: (parsed) => {
    const delta = parsed.choices?.[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      params.onToken(fullText);
    }
  },
  onDone: () => {
    params.onComplete(fullText);
  },
});
```

### New Files

- `src/api/providers/sse.ts` — shared SSE line-buffered parser

### Modified Files

- `src/api/providers/openai.ts`
- `src/api/providers/openrouter.ts`
- `src/api/providers/huggingface.ts`
- `src/api/providers/gemini.ts`
- `src/api/providers/registry.ts`

## Edge Cases

- **Empty SSE lines**: SSE spec allows blank lines between events. The parser must skip them (already handled by `!trimmed` check).
- **Multi-line data fields**: SSE spec allows `data: line1\ndata: line2` for multi-line values. Current providers don't encounter this, but the parser should not break if it does (each `data:` line is parsed independently).
- **OpenAI reasoning model + system prompt**: o1/o3 don't accept system role messages. The system prompt must be prepended to the first user message or omitted.
- **OpenRouter model IDs with `/`**: e.g., `anthropic/claude-3-opus`. The `findProviderForModel` heuristic should not misclassify these as HuggingFace. The fix handles this by checking which providers are enabled.
- **Ollama model tags**: models like `llama3:latest`, `codestral:22b-v0.1-q4_0`. The `:` heuristic correctly identifies these.
