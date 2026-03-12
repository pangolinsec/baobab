# ADR-020: OpenAI Responses API Migration for Reasoning Block Support

**Date**: 2026-03-03
**Status**: Superseded by [ADR-023](023-azure-foundry-dual-api.md)
**Context**: Feature 39 (Reasoning Block Injection) requires capturing and replaying provider-native reasoning blocks. Anthropic's Messages API already exposes thinking blocks with signatures in streaming responses, requiring only minor changes to capture the signature alongside the text. OpenAI's current integration uses the Chat Completions API, which does not expose or consume reasoning items. The Responses API is required for OpenAI reasoning support. This ADR captures the decision to defer the migration and the technical analysis informing that decision.

---

## Decision 1: Defer OpenAI Responses API Migration to Phase B

**Problem**: Feature 39 needs native reasoning block capture and replay for both Anthropic and OpenAI. Anthropic support requires minor changes to the existing provider. OpenAI support requires migrating from Chat Completions to the Responses API — a significant rewrite of the OpenAI provider's streaming, message formatting, and tool-use handling.

**Options considered**:

1. **Ship both providers simultaneously**: Migrate OpenAI to Responses API as part of Feature 39.
2. **Ship Anthropic first, defer OpenAI**: Implement Feature 39 Phase A (Anthropic + plaintext fallback) now. Migrate OpenAI in Phase B.
3. **Ship Anthropic only, never migrate**: Rely on plaintext fallback for OpenAI permanently.

**Decision**: Option 2 — Anthropic first, OpenAI deferred to Phase B.

**Rationale**:
- Anthropic is the primary provider for the user's workflow and the highest-priority target for reasoning injection.
- The plaintext fallback provides reasonable OpenAI support in the interim — research shows that reasoning content in assistant messages does influence model behavior, even without native format.
- The Responses API migration is a self-contained provider-internal change that doesn't affect the store, tree logic, or context assembly architecture. Shipping it separately reduces risk.
- Phase A establishes the full data model, UX patterns, and context assembly logic. Phase B only adds the OpenAI-specific capture and send paths.

**Impact**: Feature 39 Phase A ships with Anthropic native reasoning + plaintext fallback for all other providers. The `ThinkingBlock` data model includes `encryptedContent` and OpenAI-specific fields from day one, so no data model changes are needed for Phase B.

---

## Decision 2: Use Responses API in Stateless Mode

**Problem**: The Responses API supports both stateful (`previous_response_id`) and stateless (full `input` array) modes. Baobab's architecture sends full message history from root to leaf on every API call. Stateful mode would require fundamental changes to context management.

**Decision**: Use the Responses API in stateless mode only.

**Rationale**:
- Baobab's tree-based context model (walk path to root, build linear history) is fundamentally stateless — each API call includes the full conversation path.
- Stateful mode (`previous_response_id`) would require server-side state tracking that conflicts with the client-side IndexedDB persistence model.
- Stateless Responses API is functionally equivalent to Chat Completions for message submission — it just uses a different item format (`input` array of typed items instead of `messages` array of role/content objects).
- Reasoning items are supported in both stateful and stateless modes.

**Impact**: The migration only requires reformatting messages from Chat Completions format to Responses API input item format. No changes to the store, tree traversal, or context assembly logic.

---

## Decision 3: Responses API Message Format Mapping

**Problem**: The Responses API uses typed items instead of role/content messages. The mapping needs to be defined for the migration.

**Decision**: The following mapping will be used:

| Chat Completions | Responses API |
|-----------------|---------------|
| `{ role: 'system', content: '...' }` | `{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: '...' }] }` |
| `{ role: 'user', content: '...' }` | `{ type: 'message', role: 'user', content: [{ type: 'input_text', text: '...' }] }` |
| `{ role: 'assistant', content: '...' }` | `{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '...' }] }` |
| `{ role: 'assistant', tool_calls: [...] }` | `{ type: 'function_call', name: '...', arguments: '...' }` |
| `{ role: 'tool', tool_call_id: '...', content: '...' }` | `{ type: 'function_call_output', call_id: '...', output: '...' }` |
| *(no equivalent)* | `{ type: 'reasoning', id: '...', encrypted_content: '...' }` |

**Rationale**: This is a direct structural translation. The `developer` role replaces `system` in the Responses API. Reasoning items are a new item type with no Chat Completions equivalent — this is the key capability gap that motivates the migration.

**Impact**: The OpenAI provider's `sendMessage` method will need to transform the internal message format to Responses API items. This transformation is isolated to the provider — the context builder continues to produce the same internal format.

---

## Decision 4: Streaming Format Migration

**Problem**: Chat Completions uses SSE with `choices[0].delta.content` for text deltas. The Responses API uses a different event-based SSE format with events like `response.output_item.added`, `response.content_part.delta`, `response.output_item.done`, etc.

**Decision**: Rewrite the OpenAI streaming parser to handle Responses API events. The existing `readSSEStream` utility can be reused for SSE transport, but the event payload parsing will be provider-specific.

**Rationale**: The streaming format difference is the largest implementation cost of the migration. However, it's isolated to the OpenAI provider's `sendMessage` method. The `onToken`, `onComplete`, and `onThinkingComplete` callbacks remain the same — only the internal parsing changes.

**Open question**: Whether to maintain a Chat Completions fallback for non-reasoning models (e.g., `gpt-4.1`). The Responses API supports all OpenAI models, so a full migration is possible. However, if any edge cases arise, having a fallback path reduces risk.

---

## Decision 5: OpenAI Last-Turn-Only Reasoning Filtering

**Problem**: Research (Finding 13, `RESEARCH_ANALYSIS.md`) shows that OpenAI's server silently discards reasoning items from all but the most recent assistant turn. This means injecting reasoning into earlier turns in a branch has no effect with OpenAI.

**Decision**: Show a user-facing warning when reasoning blocks are pasted onto non-leaf OpenAI nodes. Do NOT auto-promote reasoning to the last turn (this would change the user's intended injection point).

**Rationale**:
- Auto-promotion would silently move blocks, confusing users about where their reasoning is applied.
- The warning respects user agency while informing them of the platform limitation.
- Users may still want non-leaf reasoning blocks for: (a) plaintext fallback mode, which is not affected by the last-turn filter, or (b) documentation/annotation purposes.

**Impact**: Feature 39 Phase B UI adds a warning banner in NodeDetailPanel when an OpenAI reasoning block is on a non-leaf node.

---

## Technical Analysis: Chat Completions vs Responses API

| Dimension | Chat Completions (current) | Responses API (target) |
|-----------|---------------------------|----------------------|
| Endpoint | `/v1/chat/completions` | `/v1/responses` |
| Message format | `messages: [{role, content}]` | `input: [{type, ...}]` typed items |
| System prompt role | `system` | `developer` |
| Reasoning | Not exposed, not consumable | Returned as items with `encrypted_content`, replayable in `input` |
| Streaming format | `choices[0].delta` SSE | Event-based SSE (`response.output_item.added`, `.delta`, `.done`) |
| Tool use — call | `tool_calls` in `choices[0].delta` | `function_call` output items |
| Tool use — result | `{ role: 'tool', tool_call_id, content }` | `{ type: 'function_call_output', call_id, output }` |
| State management | Always stateless | Stateless (full input) or stateful (`previous_response_id`) |
| Token usage | `usage` object in final SSE chunk | `response.completed` event with `usage` |
| Model support | All models | All models (OpenAI's primary API going forward) |
| Store/persistence | N/A | `store: true/false` controls server-side response persistence |

### Migration scope

The migration is isolated to `src/api/providers/openai.ts`:
1. **Message formatting**: Transform internal messages to Responses API input items
2. **Request construction**: Change endpoint, body structure, headers
3. **Streaming parser**: Handle new event types instead of `choices[0].delta`
4. **Tool use loop**: Adapt to `function_call`/`function_call_output` items
5. **Reasoning capture**: Extract `encrypted_content` from reasoning items in response
6. **Token usage**: Extract from `response.completed` event instead of final SSE chunk

No changes to: store, tree logic, context assembly, types (ThinkingBlock already has `encryptedContent` field), or other providers.

### Risk assessment

- **Medium risk**: Streaming format is significantly different; edge cases in SSE event ordering could cause bugs
- **Low risk**: Message formatting is a structural translation with clear mapping
- **Low risk**: Tool use loop is conceptually identical, just different field names
- **Mitigation**: Can maintain Chat Completions as a fallback for non-reasoning models during transition

---

## Research Context

The empirical research motivating this migration is documented in:
- `../thinking-testing-main/RESEARCH_ANALYSIS.md` — Findings 10, 11, 12, 13, 14 (OpenAI reasoning replay and steering)
- `../thinking-testing-main/PROBE_ANALYSIS.md` — Token inclusion probe revealing last-turn-only filtering
- `../thinking-testing-main/RESEARCH_ANALYSIS_TOOLINJECTIONRESULTS.md` — FR injection resistance (OpenAI resists all injection attempts)

Key findings for this migration:
1. OpenAI `encrypted_content` steers model behavior when positioned in the last assistant turn (Finding 13: 12/12 FAIL, 100%)
2. Cross-conversation replay is accepted — blobs are not bound to conversation context (Finding 10)
3. Server silently discards reasoning from non-last turns (Finding 11 revision)
4. Tool results dominate over injected reasoning (Finding 3/14 OAI-5Y)
5. Chat Completions API cannot consume reasoning items at all — Responses API is required
