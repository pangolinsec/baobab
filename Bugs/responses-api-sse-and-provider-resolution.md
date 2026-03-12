# Responses API SSE Parsing & Provider Resolution Bugs

**Date**: 2026-03-06
**Status**: Fixed
**Scope**: `src/api/providers/openai-responses-api.ts`, `src/hooks/useStreamingResponse.ts`, `src/types/index.ts`, `src/components/shared/ReasoningBlocksSection.tsx`

---

## Bug 1: SSE Event Nesting — `response.output_item` fields read from wrong level

**Severity**: Critical (reasoning and tool-call data silently lost)
**Affected providers**: OpenAI, Azure (Responses API path)

### Symptom
Reasoning `encrypted_content` and function-call fields (`id`, `name`, `arguments`) were never captured from SSE events. ThinkingBlocks had empty `encryptedContent`, and tool-use via Responses API was broken.

### Root cause
`response.output_item.added` and `response.output_item.done` SSE events nest the actual item under `.item`:
```json
{"type": "response.output_item.done", "item": {"type": "reasoning", "encrypted_content": "..."}}
```
The code read `obj.type` (got `"response.output_item.done"`) instead of `obj.item.type` (would get `"reasoning"`).

### Fix
Extract the nested item: `const item = (obj.item as Record<string, unknown>) ?? obj;`
Applied to both `response.output_item.added` and `response.output_item.done` handlers.

---

## Bug 2: Missing `summary` field on reasoning input items — 400 error on multi-turn

**Severity**: Critical (blocks all multi-turn with reasoning models)

### Symptom
Second message in any conversation using o-series models via Responses API returned:
```
400 - Missing required parameter: 'input[2].summary'
```

### Root cause
When rebuilding reasoning items for conversation history in `buildResponsesApiInput()`, the `summary` field was not included. The Responses API requires it on all reasoning items in the input array.

### Fix
Added `summary` field to reasoning items. Uses stored `apiSummary` (opaque roundtrip from the API response) when available, falls back to building from display text or empty array.

---

## Bug 3: Fabricated reasoning item ID — encrypted content verification failure

**Severity**: Critical (blocks multi-turn with reasoning models)

### Symptom
```
400 - The encrypted content for item rs_... could not be verified.
Reason: Encrypted content item_id did not match the target item id.
```

### Root cause
`buildResponsesApiInput()` generated a fake ID: `rs_${block.id.replace(/-/g, '').slice(0, 24)}` (derived from the ThinkingBlock's UUID). The encrypted content is cryptographically bound to its original API-assigned ID, so the fabricated ID failed verification.

### Fix
- Capture the original API item ID from the `response.output_item.done` SSE event (`item.id`)
- Store it as `ThinkingBlock.apiItemId`
- Pass it through `onThinkingComplete` callback chain
- Use `block.apiItemId` in `buildResponsesApiInput()` instead of generating a fake ID

---

## Bug 4: Reasoning summary not captured — Azure sends no delta events

**Severity**: Minor (UI shows placeholder instead of summary text)

### Symptom
The ReasoningBlocksSection header showed `[Encrypted reasoning (N chars)]` instead of the actual reasoning summary text. The summary text was never captured.

### Root cause
The SSE parser listened for `response.reasoning_summary_text.delta` events, but Azure o4-mini does not emit these. The summary is only available as a field on the reasoning item in the `response.output_item.done` event (which can be an array of `{type: "summary_text", text: "..."}` parts, or an empty array).

### Fix
- Extract `item.summary` from the `response.output_item.done` event for reasoning items
- Handle both array format (extract text from parts) and string format
- Store raw summary as `ThinkingBlock.apiSummary` for opaque API roundtrip
- Extract display text into `ThinkingBlock.text` / `reasoningSummary`

Note: Azure o4-mini returns `summary: []` (empty array) for simple queries. The summary may be populated for more complex reasoning. The empty array is valid for re-injection.

---

## Bug 5: UI showed char count instead of summary text

**Severity**: Minor (cosmetic)

### Symptom
ReasoningBlocksSection header always showed `"N chars"` for encrypted reasoning blocks, even when summary text was available.

### Fix
Changed header display logic: for encrypted blocks with actual summary text, show a truncated preview (up to 80 chars). For blocks without summary, show `"Encrypted (N chars)"`. Plaintext blocks (Anthropic) still show `"N chars"` since the full text is expandable.

---

## Bug 6: Provider not derived from model string — provider/model mismatch

**Severity**: Critical (sends Azure models to Anthropic API)

### Symptom
UI model picker showed "Default (azure::\<guid\>)" but messages were sent to the Anthropic provider, causing 404 errors. This also meant reasoning block injection could never be tested because the wrong provider was always used.

### Root cause
In `useStreamingResponse.ts`, provider resolution was independent of model resolution:

```typescript
// Provider resolved FIRST, ignoring the model
const providerId = resolveProvider(options, currentConversation.providerId, defaultProvider);
// Model resolved separately — its .providerId return value was IGNORED
const { model } = resolveModel(...);
```

When `conversation.providerId` was `undefined` (common — `createConversation()` never sets it), `resolveProvider()` fell back to `defaultProvider` which defaults to `'anthropic'`.

The model correctly resolved to `"azure::<guid>"` but the provider was always `'anthropic'`.

### Fix
Changed resolution order to: resolve model first, then derive provider from the model string using `findProviderForModel()` (which handles `azure::` → `'azure'`, `claude-` → `'anthropic'`, etc.):

```typescript
const model = resolved.model;
const providerId = options?.providerOverride
  || findProviderForModel(model, providerConfigs)
  || resolveProvider(options, currentConversation.providerId, defaultProvider);
```

---

## New types added

| Field | Type | Purpose |
|-------|------|---------|
| `ThinkingBlock.apiItemId` | `string?` | Original API reasoning item ID for encrypted content roundtrip |
| `ThinkingBlock.apiSummary` | `unknown?` | Raw API summary (opaque, preserved for re-injection) |

---

## Cross-cutting pattern

Bugs 1-4 share a root cause: the Responses API SSE format was implemented from documentation rather than observed events. The actual event structure differed (nested `.item`, no summary deltas, ID binding). Adding a debug `console.log` of raw SSE events was essential to diagnose all four issues.

Bug 6 is an instance of **provider/model decoupling** — the system treats provider and model as independently resolvable, but model strings encode their provider (e.g., `azure::` prefix). When no explicit provider is set, the model string must be the source of truth.
