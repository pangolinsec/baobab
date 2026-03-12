# ADR-008: Provider Bugfix Analysis

**Date**: 2026-02-19
**Status**: Accepted
**Context**: Code review of the non-Anthropic provider implementations (Feature 07) revealed six bugs ranging from silent data corruption to hard API failures. Anthropic and Ollama had been manually tested; the remaining providers (OpenAI, OpenRouter, Gemini, HuggingFace) had not. This session catalogued the bugs, assessed severity, and produced a bugfix spec (`Features/07b-BUGFIX-provider-streaming-and-compat.md`).

---

## Decision 1: Extract a Shared SSE Parser Instead of Fixing Four Providers Independently

**Problem**: All four SSE-based providers (OpenAI, OpenRouter, HuggingFace, Gemini) share the same line-splitting bug — SSE data split across `ReadableStream` chunk boundaries causes silent token drops. The naive fix is to add line buffering to each provider's `sendMessage()`, but this duplicates identical buffer logic four times.

**Options considered**:

1. **Fix each provider independently**: Add `buffer` variable and `lines.pop()` logic to each `sendMessage()`. Simple, but 4x duplication of identical parsing code.
2. **Extract `readSSEStream()` utility**: A shared `src/api/providers/sse.ts` module that handles line buffering, `data:` prefix stripping, `[DONE]` sentinel detection, and JSON parsing. Each provider calls it with a callback to extract the delta from the parsed object.

**Decision**: Option 2 — shared `readSSEStream()` utility in `src/api/providers/sse.ts`.

**Rationale**: The SSE parsing logic is identical across all four providers — only the JSON path to extract the delta differs (`choices[0].delta.content` for OpenAI-compatible, `candidates[0].content.parts[0].text` for Gemini). A single well-tested parser eliminates the duplication and makes the bug class impossible to reintroduce. Each provider's `sendMessage()` simplifies to a request setup + one `readSSEStream()` call with a data callback.

**Impact**: New file `src/api/providers/sse.ts`. Modified: `openai.ts`, `openrouter.ts`, `huggingface.ts`, `gemini.ts` — streaming loops replaced with `readSSEStream()` calls.

---

## Decision 2: Handle OpenAI Reasoning Models (o1/o3) as a Special Case

**Problem**: The OpenAI provider exposes `o1-*` and `o3-*` models in the model list, but sends request parameters (`temperature`, `max_tokens`, `top_p`, system role messages, `stream: true`) that these reasoning models reject. Users selecting an o1 or o3 model get hard API errors.

**Options considered**:

1. **Filter out reasoning models**: Remove `o1-*` and `o3-*` from `fetchModels()`. Simple but removes functionality users may want.
2. **Detect reasoning models and adjust request parameters**: Check model ID prefix and conditionally omit incompatible parameters, use `max_completion_tokens` instead of `max_tokens`, and handle system prompts by prepending to the first user message.

**Decision**: Option 2 — detect and adjust.

**Rationale**: Reasoning models are a major OpenAI feature. Filtering them out punishes users who specifically want them. The parameter adjustments are well-documented by OpenAI and the detection heuristic (`model.startsWith('o1-') || model.startsWith('o3-')`) is reliable since OpenAI controls these model ID prefixes.

**Impact**: `src/api/providers/openai.ts` — `sendMessage()` gains an `isReasoningModel` branch that omits `temperature`, `top_p`, system role messages, and uses `max_completion_tokens`.

---

## Decision 3: Validate HuggingFace Models Individually Rather Than All-or-Nothing

**Problem**: `HuggingFaceProvider.fetchModels()` returns a hardcoded list of 5 models and validates only the first one. If that model is unavailable (HF rotates free-tier model availability), the provider shows zero models even when others work.

**Decision**: Probe each curated model individually with `Promise.allSettled()` and return only those that respond. Update the curated list to include current popular models.

**Rationale**: HuggingFace's free Inference API has unpredictable model availability. Individual probes with timeouts ensure the user sees whatever is actually available. `Promise.allSettled()` runs probes in parallel to keep latency low. The curated list approach is retained (HF has thousands of models; a full listing is not useful) but the all-or-nothing validation gate is removed.

**Impact**: `src/api/providers/huggingface.ts` — `fetchModels()` rewritten with per-model probing. `validateKey()` changed to validate against the Inference API endpoint instead of the Hub `whoami` endpoint.

---

## Decision 4: Improve `findProviderForModel` Heuristics for Non-Prefix Model IDs

**Problem**: The `findProviderForModel()` registry function only has prefix heuristics for `claude-`, `gpt-`/`o1-`/`o3-`, and `gemini-`. Ollama models (`llama3:latest`), HuggingFace models (`mistralai/Mistral-7B-Instruct-v0.3`), and OpenRouter models (`meta-llama/llama-3-70b-instruct`) fall through to the first enabled provider, which may be wrong. This primarily affects the `resend` flow's provider resolution.

**Decision**: Add structural heuristics: models containing `:` (name:tag format) map to Ollama; models containing `/` (org/model format) map to HuggingFace or OpenRouter depending on which is enabled. When ambiguous (both enabled), fall through to the existing enabled-provider scan.

**Rationale**: These patterns are inherent to how each platform identifies models — Ollama uses `name:tag`, HuggingFace/OpenRouter use `org/model`. The heuristics won't produce false positives for Anthropic, OpenAI, or Gemini models (which never contain `:` or `/`). The ambiguity between HuggingFace and OpenRouter `org/model` formats is handled by checking which providers are enabled, and falling through when both are.

**Impact**: `src/api/providers/registry.ts` — `findProviderForModel()` gains two new heuristic branches.

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `Features/07b-BUGFIX-provider-streaming-and-compat.md` | New file — bugfix spec covering all 6 issues with implementation details, code samples, testing guidance, and shared SSE parser proposal |
