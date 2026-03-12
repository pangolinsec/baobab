# 40 — Azure Foundry Provider and OpenAI Reasoning Support

## Summary

Add Azure Foundry as a new LLM provider with per-deployment model configuration. Enable reasoning/thinking capture and replay for OpenAI-family reasoning models (o3, o4-mini, etc.) via the Responses API, while keeping Chat Completions for non-reasoning models (GPT-4o, etc.). Applies to both the new Azure provider and the existing OpenAI provider.

This feature is motivated by the same empirical research as Feature 39 (reasoning block injection): encrypted reasoning blocks from OpenAI reasoning models steer model behavior when correctly positioned (100% reliability), and the Responses API is the only path to capturing and replaying them.

## Priority

Tier 2.

## Dependencies

- **07 Inference Providers**: provider registry, capability flags, settings UI patterns
- **39 Reasoning Block Injection** (Phase A): ThinkingBlock data model, copy/paste UX, ReasoningBlocksSection component, messageBuilder
- **ADR-023**: Azure Foundry dual API strategy (supersedes ADR-020)

## Phases

### Phase A — Azure Foundry Provider (Chat Completions)

Add Azure as a provider with per-model entries. Non-reasoning models work immediately via Chat Completions. Reasoning models are configured but defer thinking capture to Phase B.

### Phase B — Responses API for Reasoning Models

Add Responses API code path for both Azure and OpenAI. Enable reasoning capture, display, replay, and last-turn visualization.

### Phase C — Reasoning Copy/Paste and Cross-Provider Injection

Enable Feature 39 copy/paste for OpenAI encrypted reasoning blocks. Cross-provider plaintext fallback (OpenAI reasoning → Anthropic context as plaintext, and vice versa).

---

## Data Model

### AzureModelEntry

```typescript
interface AzureModelEntry {
  id: string;               // auto-generated UUID, stable model identifier stored in tree nodes
  endpoint: string;         // Azure deployment name, sent as `model` parameter
  baseUrl: string;          // full Azure base URL (e.g., "https://resource.openai.azure.com/openai/v1")
  apiKey: string;           // Azure resource API key
  nickname?: string;        // optional display name; required if endpoint duplicates another entry
  isReasoningModel: boolean; // true → Responses API + reasoning capture; false → Chat Completions
}
```

### ProviderConfigData changes

```typescript
interface ProviderConfigData {
  // existing fields...
  azureModels?: AzureModelEntry[];  // only used when id === 'azure'
}
```

### ProviderModelInfo for Azure

When `fetchModels` is called on the Azure provider, it returns the user-configured entries as `ProviderModelInfo`:

```typescript
{
  id: `azure::${entry.id}`,           // stable UUID-based model ID
  displayName: entry.nickname || entry.endpoint,
  providerId: 'azure',
}
```

### Model ID format

Azure model IDs in tree nodes use the format `azure::{uuid}`. When sending to the API, the provider looks up the `AzureModelEntry` by UUID and extracts the `endpoint` (deployment name) to send as the `model` parameter.

### LLMProvider changes

The `supportsThinking` flag becomes model-dependent rather than provider-level. For OpenAI/Azure reasoning models, thinking is always enabled (controlled by `reasoning_effort`, not a toggle).

```typescript
// New optional method on LLMProvider:
supportsThinkingForModel?(modelId: string): boolean;
```

If present, this overrides the provider-level `supportsThinking` flag for specific models.

---

## Provider Implementation

### New file: `src/api/providers/azure.ts`

```typescript
class AzureProvider implements LLMProvider {
  id = 'azure';
  name = 'Azure Foundry';
  requiresApiKey = false;    // keys are per-model, not per-provider
  supportsStreaming = true;
  supportsThinking = false;  // overridden per-model via supportsThinkingForModel
  supportsToolUse = true;

  supportsThinkingForModel(modelId: string): boolean {
    const entry = this.resolveEntry(modelId);
    return entry?.isReasoningModel ?? false;
  }

  async validateKey(config: ProviderConfig): Promise<boolean> {
    // Send a lightweight request to the first configured endpoint
    const entries = (config as any).azureModels as AzureModelEntry[];
    if (!entries?.length) return false;
    // Try fetching models list from the first entry's base URL
    // Return true if connection succeeds
  }

  async fetchModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const entries = (config as any).azureModels as AzureModelEntry[];
    if (!entries?.length) return [];
    return entries.map(entry => ({
      id: `azure::${entry.id}`,
      displayName: entry.nickname || entry.endpoint,
      providerId: this.id,
    }));
  }

  async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
    const entry = this.resolveEntry(params.model);
    if (!entry) throw new Error(`Azure model entry not found: ${params.model}`);

    if (entry.isReasoningModel) {
      return sendViaResponsesApi(entry, params);
    } else {
      return sendViaChatCompletions(entry, params);
    }
  }
}
```

### Shared API modules

Extract shared logic into reusable modules used by both OpenAI and Azure:

**`src/api/providers/openai-chat-completions.ts`** — the existing Chat Completions streaming/tool-use logic, extracted from `openai.ts`.

**`src/api/providers/openai-responses-api.ts`** (Phase B) — new Responses API handler:
- Message formatting: convert internal messages to Responses API input items (see ADR-020 Decision 3 mapping table, and ADR-023 Decision 4 for `store: false`)
- Streaming parser: handle Responses API SSE events (`response.output_item.added`, `response.content_part.delta`, `response.output_item.done`, `response.completed`)
- Reasoning capture: extract `encrypted_content` and `summary` from reasoning output items, emit via `onThinkingComplete`
- Tool use: handle `function_call` / `function_call_output` items
- Token usage: extract from `response.completed` event

**`src/api/providers/openai.ts`** — updated to delegate:

```typescript
async sendMessage(config: ProviderConfig, params: ProviderSendParams): Promise<void> {
  const isReasoning = params.model.startsWith('o1-') ||
                      params.model.startsWith('o3-') ||
                      params.model.startsWith('o4-');
  if (isReasoning) {
    return sendViaResponsesApi({ baseUrl, apiKey, endpoint: params.model }, params);
  } else {
    return sendViaChatCompletions({ baseUrl, apiKey, endpoint: params.model }, params);
  }
}
```

### OpenAI model filter update

`fetchModels` in `openai.ts` currently filters to `gpt-`, `o1-`, `o3-` prefixes. Add `o4-` prefix:

```typescript
.filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1-') || m.id.startsWith('o3-') || m.id.startsWith('o4-'))
```

### Registry update

`findProviderForModel` in `registry.ts` needs to handle the `azure::` prefix:

```typescript
if (modelId.startsWith('azure::')) return 'azure';
if (modelId.startsWith('o4-')) return 'openai';  // add o4 prefix
```

---

## Responses API Streaming (Phase B)

### Event format

The Responses API uses a different SSE event format from Chat Completions:

```
event: response.output_item.added
data: {"type":"reasoning","id":"rs_...","encrypted_content":"..."}

event: response.content_part.delta
data: {"type":"content_part","delta":{"type":"text_delta","text":"Hello"}}

event: response.output_item.done
data: {"type":"message","content":[{"type":"output_text","text":"Hello world"}]}

event: response.completed
data: {"usage":{"input_tokens":100,"output_tokens":50,"output_tokens_details":{"reasoning_tokens":20}}}
```

### Reasoning capture

When a `reasoning` output item appears in the stream:

1. Extract `encrypted_content` from the item
2. Extract `summary` array if present (human-readable abbreviated reasoning)
3. Build `ThinkingBlock`:
   ```typescript
   {
     id: crypto.randomUUID(),
     text: summary?.map(s => s.text).join('\n') || '',
     providerId: 'openai',  // or 'azure'
     encryptedContent: encrypted_content,
     isOriginal: true,
     plaintextEnabled: false,
     active: true,
   }
   ```
4. Emit via `onThinkingComplete({ text: block.text, encryptedContent: block.encrypted_content })`

### Message builder — Responses API output path

`messageBuilder.ts` needs a second output path for Responses API input items:

```typescript
function buildResponsesApiInput(
  path: TreeNode[],
  systemPrompt?: string
): ResponsesApiItem[] {
  const items: ResponsesApiItem[] = [];

  if (systemPrompt) {
    items.push({
      type: 'message',
      role: 'developer',
      content: [{ type: 'input_text', text: systemPrompt }],
    });
  }

  for (const node of path) {
    if (node.role === 'user') {
      items.push({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: node.content }],
      });
    } else {
      // Inject active reasoning blocks as reasoning items
      if (node.thinkingBlocks?.length) {
        for (const block of node.thinkingBlocks) {
          if (!block.active) continue;
          if (block.encryptedContent) {
            items.push({
              type: 'reasoning',
              id: `rs_${block.id.replace(/-/g, '').slice(0, 24)}`,
              encrypted_content: block.encryptedContent,
            });
          }
          // Non-OpenAI blocks: skip (plaintext fallback handled separately)
        }
      }

      // Inject tool calls as function_call / function_call_output pairs
      if (node.toolCalls?.length) {
        // Group by round, emit function_call + function_call_output items
      }

      // Emit assistant text
      items.push({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: node.content }],
      });
    }
  }

  return items;
}
```

### Reasoning effort setting

For reasoning models, the UI shows a reasoning effort selector (`low` / `medium` / `high`) instead of the thinking toggle + budget slider:

```typescript
// In the Responses API request body:
{
  model: entry.endpoint,
  input: items,
  reasoning: { effort: reasoningEffort },  // from settings or per-node override
  include: ['reasoning.encrypted_content'],
  store: false,
}
```

The default reasoning effort is `medium`. This can be configured globally in settings and overridden per-node via the model cascade system.

---

## Settings UI

### Azure Provider Section

The Azure provider section in `SettingsPage.tsx` replaces the standard API key + base URL pattern with a model entry list:

```
┌─ Azure Foundry ─────────────────────────────────────────┐
│ [Enabled toggle]                                         │
│                                                          │
│ Model Endpoints                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ o4-mini                          [Edit] [Remove]     │ │
│ │ https://thinkingtesting.openai... | Reasoning: Yes   │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ gpt-4o (East US)                 [Edit] [Remove]     │ │
│ │ https://eastus.openai.azure...   | Reasoning: No     │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [+ Add Model Endpoint]                                   │
│                                                          │
│ [Test Connection]                                        │
└──────────────────────────────────────────────────────────┘
```

### Add/Edit Model Dialog

```
┌─ Add Azure Model Endpoint ──────────────────────────────┐
│                                                          │
│ Deployment Name (endpoint)                               │
│ [ o4-mini                                       ]        │
│                                                          │
│ Base URL                                                 │
│ [ https://resource.openai.azure.com/openai/v1   ]        │
│                                                          │
│ API Key                                                  │
│ [ ****************************                  ]        │
│                                                          │
│ Nickname (optional)                                      │
│ [                                               ]        │
│ ⚠ Required — another entry uses the same endpoint name   │
│                                                          │
│ [x] Reasoning model (uses Responses API)                 │
│                                                          │
│ [Cancel]  [Save]                                         │
└──────────────────────────────────────────────────────────┘
```

Validation:
- Endpoint, base URL, and API key are required
- Nickname is required if another entry has the same endpoint name
- Nickname must be unique across all entries (if provided)
- Base URL must be a valid URL

### Model Picker

Azure models appear in an "Azure Foundry" optgroup in `ModelSelector`:

```html
<optgroup label="Azure Foundry">
  <option value="azure::uuid1">o4-mini</option>
  <option value="azure::uuid2">gpt-4o (East US)</option>
</optgroup>
```

Display shows nickname if set, otherwise endpoint name. No base URL shown in the picker.

### Reasoning Effort Control (Phase B)

For OpenAI/Azure reasoning models, the Advanced settings section shows a reasoning effort selector instead of the thinking toggle + budget slider:

```
Reasoning Effort: [Low ▼ | Medium | High]
```

This is displayed when the selected default model is a reasoning model. It can also be overridden per-node via the cascade system (Future: add `reasoningEffort` to the cascade fields).

---

## Last-Turn Visualization (Phase B)

### Concept

OpenAI's server only includes reasoning from the last assistant turn in the model's context (Probe Analysis H2). Users need to see which reasoning blocks will survive filtering.

### Computation

Given the conversation path (root to reply target):
1. Find the last assistant node in the path
2. OpenAI/Azure reasoning blocks (`encryptedContent` present) on that node are marked as **active** (will reach the model)
3. OpenAI/Azure reasoning blocks on all other assistant nodes are marked as **filtered** (will be silently discarded by the server)
4. Anthropic reasoning blocks (`signature` present, no `encryptedContent`) are never marked as filtered — Anthropic does not filter by turn

### UI Treatment

**Active (last-turn) reasoning blocks:**
- Standard display, consistent with existing ReasoningBlocksSection
- No special indicator needed (this is the "normal" case)

**Filtered (non-last-turn) reasoning blocks:**
- Filter icon (e.g., `FilterX` from lucide-react) next to the block header
- Dimmed text/opacity
- Tooltip: "This reasoning block will be filtered by OpenAI's server — only reasoning from the last assistant turn is included in the model's context"
- Still expandable and copyable (the block exists in the data, it's just not sent to the model)

**ThreadMessage treatment:**
- Thinking blocks in the thread view show the same filter indicator when the node is not the last assistant turn
- The indicator updates dynamically as the user navigates (different reply targets change which node is "last")

---

## Implementation Plan

### Phase A (Azure Chat Completions)

| Step | Files | Description |
|------|-------|-------------|
| 1 | `src/types/index.ts` | Add `AzureModelEntry` interface, add `azureModels?` to `ProviderConfigData` |
| 2 | `src/api/providers/azure.ts` | New provider: `fetchModels` from config, `sendMessage` delegates to Chat Completions, `validateKey` pings first endpoint |
| 3 | `src/api/providers/openai-chat-completions.ts` | Extract Chat Completions logic from `openai.ts` into shared module |
| 4 | `src/api/providers/openai.ts` | Refactor to use shared Chat Completions module |
| 5 | `src/api/providers/registry.ts` | Register Azure provider, update `findProviderForModel` for `azure::` prefix and `o4-` prefix |
| 6 | `src/components/pages/SettingsPage.tsx` | Azure provider section with model entry list, add/edit/remove dialogs, validation |
| 7 | `src/components/shared/ModelSelector.tsx` | Handle Azure optgroup (already works via `allProviderModels` grouping) |

### Phase B (Responses API + Reasoning)

| Step | Files | Description |
|------|-------|-------------|
| 8 | `src/api/providers/openai-responses-api.ts` | New shared module: Responses API streaming parser, message formatter, reasoning capture, tool use handler |
| 9 | `src/api/providers/azure.ts` | Wire reasoning models to Responses API path |
| 10 | `src/api/providers/openai.ts` | Wire reasoning models to Responses API path, add `supportsThinkingForModel` |
| 11 | `src/lib/messageBuilder.ts` | Add `buildResponsesApiInput` output path for Responses API input items |
| 12 | `src/hooks/useStreamingResponse.ts` | Handle `onThinkingComplete` with `encryptedContent` for OpenAI/Azure reasoning |
| 13 | `src/api/providers/types.ts` | Extend `onThinkingComplete` to accept `{ text, signature?, encryptedContent? }` |
| 14 | UI components | Last-turn filtering visualization in `ReasoningBlocksSection`, `ThreadMessage` |
| 15 | `src/components/pages/SettingsPage.tsx` | Reasoning effort control for reasoning models |

### Phase C (Cross-Provider Reasoning)

| Step | Files | Description |
|------|-------|-------------|
| 16 | `src/lib/messageBuilder.ts` | Cross-provider plaintext injection for OpenAI reasoning → Anthropic context |
| 17 | UI components | Copy/paste UX for encrypted reasoning blocks (same as Feature 39 Anthropic pattern) |

---

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty endpoint/baseUrl/apiKey → validation error in add dialog. Empty `azureModels` array → provider shows "no models configured" state. |
| What if the external dependency is unavailable? | Azure endpoint unreachable → standard provider error handling (error node in tree). "Test Connection" button shows failure status. |
| What if this runs concurrently with itself? | Multiple simultaneous requests to different Azure endpoints are fine (each has independent config). Same endpoint: standard AbortController handling. |
| What happens on the second invocation? | Settings persist across reloads (Dexie). Azure model entries are restored from `providers[].azureModels`. Model IDs in tree nodes resolve to entries by UUID. |
| What if the user's data is larger than expected? | Many Azure model entries (50+): scrollable list in settings, all appear in model picker optgroup. No performance concern — this is a flat list. |
| What state persists vs. resets across page reload? | Azure model entries persist (Dexie via `providers`). Transient: last-turn filtering computation (recomputed from tree path). |
| What if a model entry is deleted but nodes reference its UUID? | The model ID `azure::uuid` becomes unresolvable. The node still renders with the stored model ID as display text. Sending a new message from that node falls back to the default provider/model. This is the same behavior as deleting any provider config. |
| What if the Responses API format changes? | The streaming parser is isolated in `openai-responses-api.ts`. Changes only affect that module. |
| What if `encrypted_content` is not returned? | Some models (e.g., o3-mini) return structurally present but functionally empty blobs. The ThinkingBlock is still created with whatever `encrypted_content` and `summary` are available. Display falls back to size indicator. |
| What if the user switches provider for a node that has OpenAI reasoning blocks? | Existing reasoning blocks are preserved on the node. If sending to Anthropic, the message builder uses plaintext fallback for OpenAI blocks (same as Feature 39 cross-provider behavior). The encrypted content cannot be sent natively to Anthropic. |
| What if reasoning effort is not supported by the model? | Non-reasoning models ignore the reasoning effort setting (it's only included in Responses API requests). If an Azure model is incorrectly marked as reasoning but doesn't support it, the API will return an error — standard error handling applies. |
| What about Azure API authentication headers? | Azure's `/openai/v1` compatibility endpoint accepts `Authorization: Bearer {key}` (the same format used by the OpenAI SDK). If a deployment requires the `api-key` header instead, this is a future enhancement. |
| What about the reasoning_tokens in usage? | Responses API returns `output_tokens_details.reasoning_tokens` in the `response.completed` event. This should be captured in `TokenUsage` for pricing transparency (Feature 22). |
