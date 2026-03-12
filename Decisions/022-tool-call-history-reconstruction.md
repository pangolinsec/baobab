# ADR-022: Tool Call History Reconstruction — Cross-Provider Translation at Send Time

**Date**: 2026-03-04
**Status**: Accepted
**Context**: Tool calls (web search, file read) executed during a conversation turn are consumed within the provider's internal loop and discarded from message history. The assistant node stores only the final text output (`content`) plus a flat `toolCalls[]` audit record. On subsequent turns, the model has no memory of its tool usage — it only sees its own text summary. This limits the model's ability to reference prior tool interactions, know it has tool-calling capability, and maintain coherence across multi-turn tool workflows.

---

## Decision 1: Persist Structured Tool Call Records and Reconstruct at Send Time

**Problem**: The current `ToolCallRecord` stores `{toolName, input, result?, searchProvider?}` — enough for display but not for API reconstruction. Missing: correlation IDs (needed to link tool_use to tool_result), round ordering (a single turn can have multiple tool-loop iterations), and provider identity (needed to know the native format).

**Options considered**:

1. **Store raw provider-format messages**: Persist the exact Anthropic or OpenAI message objects from the tool loop. Maximally faithful but couples storage to provider API formats — a provider API change breaks stored data.

2. **Store enriched normalized records**: Extend `ToolCallRecord` with `id` (correlation) and `round` (ordering), keep the provider-neutral shape. Reconstruct provider-specific format at send time from these fields.

3. **Store content block arrays**: Persist the assistant's full content block array (text + tool_use interleaved) as a new field. Faithful to structure but large and partially redundant with `content`.

**Decision**: Option 2 — enriched normalized records.

**Rationale**: The normalized record already contains all the semantic information (tool name, input, result). Adding `id` and `round` provides the structural information needed for reconstruction. The translation from normalized → Anthropic or OpenAI format is mechanical and stateless. This decouples storage from any single provider's API format while losing no information.

**Schema change**:
```typescript
interface ToolCallRecord {
  id: string;              // NEW — correlation UUID (provider-neutral)
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  searchProvider?: string;
  round?: number;          // NEW — 0-indexed tool-loop iteration
}
```

The `id` is generated at capture time as a UUID, not the provider's native ID format (`toolu_xxx` for Anthropic, `call_xxx` for OpenAI). At reconstruction time, the provider formatter generates appropriately-prefixed IDs from this UUID.

**Migration**: Existing `toolCalls` entries get `id: crypto.randomUUID()` and `round: 0`. No data loss; existing records gain reconstructability.

---

## Decision 2: Cross-Provider Format Translation over Provider Lock-in

**Problem**: Anthropic and OpenAI use structurally different formats for tool calls. When a user switches providers mid-branch (a core Baobab capability), prior tool call history can't be sent in its native format.

**Options considered**:

1. **Lock branch to provider**: Once tools are used, the branch can only continue with the same provider. Simple but sacrifices Baobab's core differentiator (model switching).

2. **Degrade on mismatch**: Send tool history only when the provider matches; fall back to text-only (current behavior) on mismatch. Safe but loses tool context on provider switch.

3. **Translate at send time**: Convert between Anthropic and OpenAI formats mechanically at message-build time. Degrade to text summary only for providers that don't support tools at all.

**Decision**: Option 3 — translate at send time.

**Rationale**: Anthropic and OpenAI tool calling is semantically isomorphic. Both encode: tool name, JSON input, string result, and a correlation ID linking invocation to result. The structural differences (content-array with `tool_use` blocks vs. `tool_calls` array + `role: "tool"` messages) are purely syntactic. Translation is mechanical, stateless, and lossless.

The only true degradation case is providers that don't support tools at all (Gemini, Ollama, HuggingFace), where a text summary is the only option — analogous to the plaintext fallback for thinking blocks.

**Format mapping**:

| Concept | Anthropic | OpenAI |
|---------|-----------|--------|
| Tool invocation | `{type: "tool_use", id, name, input}` in assistant content array | `tool_calls: [{id, type: "function", function: {name, arguments}}]` on assistant message |
| Tool result | `{type: "tool_result", tool_use_id, content}` in user message | `{role: "tool", tool_call_id, content}` as separate message |
| Multiple tools per turn | Multiple tool_use blocks in one content array | Multiple entries in tool_calls array |
| Multi-round | assistant(tool_use) → user(tool_result) → assistant(tool_use) → ... | assistant(tool_calls) → tool messages → assistant(tool_calls) → ... |

---

## Decision 3: Message Expansion in messageBuilder — One Node Becomes Multiple Messages

**Problem**: A single `TreeNode` with tool calls currently maps to one API message (the final text). With tool history reconstruction, it must expand to 2N+1 messages (N = number of tool rounds): alternating assistant(tool_use) → user/tool(tool_result) pairs, followed by the final assistant(text).

**Options considered**:

1. **Expand in messageBuilder**: The `buildMessagesWithThinkingBlocks` function handles the expansion, keeping provider formatting centralized.

2. **Expand in each provider's sendMessage**: Each provider reconstructs its own format from the raw tool records. Duplicates logic across providers.

3. **Pre-expand in a middleware layer**: A new function between messageBuilder and the provider that handles tool-specific message expansion.

**Decision**: Option 1 — expand in messageBuilder.

**Rationale**: The message builder already handles the analogous complexity for thinking blocks (native vs. plaintext, per-provider formatting). Tool call reconstruction follows the same pattern: inspect the target provider, format accordingly. Adding a new layer would fragment the message-building logic across two places.

The builder produces a richer message type that includes optional tool call metadata. Each provider's `sendMessage` then uses these annotations to construct its native format, the same way it already uses `thinkingBlocks` annotations.

**Message expansion for a node with 2 rounds of tool calls**:
```
Node with toolCalls[round=0: {id: "a", ...}, {id: "b", ...}] and toolCalls[round=1: {id: "c", ...}]

Expands to:
  1. assistant message: [tool_use(a), tool_use(b)]          // round 0 invocations
  2. user message:      [tool_result(a), tool_result(b)]    // round 0 results
  3. assistant message:  [tool_use(c)]                      // round 1 invocation
  4. user message:       [tool_result(c)]                    // round 1 result
  5. assistant message:  node.content                       // final text
```

For non-tool providers: steps 1-4 are replaced by a single text block prepended to the assistant message (analogous to plaintext thinking block injection).

---

## Decision 4: Tool Definition Registry for Historical Tool Calls

**Problem**: Both Anthropic and OpenAI APIs may require tool definitions in the request when tool_use/tool_result blocks appear in message history. Without definitions, the API may reject the request or behave unexpectedly.

**Options considered**:

1. **Always include definitions for historically-used tools**: Scan the message path for tool calls, collect unique tool names, include their definitions.

2. **Include definitions only when the current turn also uses tools**: Skip definitions for pure chat turns that happen to have tool history. Risk: API validation failure.

3. **Test empirically and handle per-provider**: Some providers may accept tool history without current definitions. Handle on a case-by-case basis.

**Decision**: Option 1 — always include definitions for historically-used tools.

**Rationale**: Safest approach. The tool definition set is small (currently `web_search` and `read_file`). Including them costs negligible tokens and avoids API-specific validation edge cases. The message builder can derive "tools used in this path" from the expanded messages and include the corresponding definitions.

**Implementation note**: This means `buildMessagesWithThinkingBlocks` (or its successor) needs to return both the messages array and a set of tool definitions to include. The calling code in `useStreamingResponse.ts` merges these with any tools the current turn explicitly requests.

---

## Decision 5: Text Summary Fallback Format

**Problem**: When the target provider doesn't support tools (Gemini, Ollama, etc.), tool call history must be represented as plain text in the message content — similar to plaintext thinking block injection.

**Decision**: Use a bracketed format consistent with the existing plaintext thinking block pattern:

```
[Tool use: web_search({"query": "capital of Occitanie"}) → "1. Toulouse - Capital of Occitanie region..."]
```

Configurable prefix/suffix in settings (like `reasoningInjectionPlaintextPrefix/Suffix`), defaulting to `[Tool use: ` / `]`.

For multiple tool calls in a round, each gets its own bracketed block. Results are truncated to a configurable max length (default: 500 chars) to avoid bloating context with large search results.

**Rationale**: Consistent with the plaintext thinking block pattern the user is already familiar with. Gives the model enough context to know what tools were used and what they returned, without the structural overhead of proper tool blocks.

---

## Impact Summary

| Area | Change |
|------|--------|
| `ToolCallRecord` type | Add `id: string`, `round?: number` fields |
| `ToolCallRecord` storage | Providers capture `id` and `round` during tool loop |
| DB migration | Existing tool calls get `id` + `round: 0` |
| `messageBuilder.ts` | Expand nodes with tool calls into multi-message sequences; format per target provider; text fallback for non-tool providers |
| `types.ts` (MessageWithThinking) | Extend to carry tool call metadata for provider formatting |
| Provider `sendMessage` | Use tool call annotations from message builder (similar to thinking block handling) |
| `useStreamingResponse.ts` | Pass target provider ID to message builder; merge historical tool definitions with current-turn tools |
| Settings | New `toolCallPlaintextPrefix/Suffix`, `toolCallResultMaxLength` settings |

---

## Phasing

- **Phase A**: Data model — enrich `ToolCallRecord`, DB migration, capture `id`/`round` in providers. No behavior change.
- **Phase B**: Same-provider reconstruction — message builder expands tool history when target provider matches. Highest value, lowest risk.
- **Phase C**: Cross-provider translation — Anthropic ↔ OpenAI format conversion. Mechanical but needs API validation testing.
- **Phase D**: Text fallback for non-tool providers + tool definition registry + settings UI.
