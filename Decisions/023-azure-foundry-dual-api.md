# ADR-023: Azure Foundry Provider and Dual API Strategy for OpenAI-Family Providers

**Date**: 2026-03-06
**Status**: Accepted
**Context**: Adding Azure Foundry as a new provider, and enabling reasoning/thinking support for OpenAI-family models. The existing OpenAI provider uses Chat Completions exclusively. Azure OpenAI deployments use the same API surface as direct OpenAI. Empirical research (`../thinking-sig-replay/`) demonstrates that OpenAI encrypted reasoning steers model behavior when correctly positioned, and that the Responses API is the only path to capturing and replaying these reasoning blocks. This ADR supersedes ADR-020's planned full migration to Responses API, replacing it with a dual-API approach.

---

## Decision 1: Add Azure Foundry as a Distinct Provider

**Problem**: Azure OpenAI deployments use the same API as direct OpenAI but with per-deployment base URLs, API keys, and model endpoints. The existing OpenAI provider assumes a single API key and fetches models from a `/models` endpoint. Azure deployments are not discoverable — each must be configured individually.

**Options considered**:

1. **Extend the OpenAI provider** with Azure-specific fields (multiple base URLs, keys).
2. **Add Azure as a separate provider** with per-model configuration.
3. **Use a generic "custom endpoint" mechanism** (user supplies URL + key + model name).

**Decision**: Option 2 — Azure Foundry as a separate provider (`id: 'azure'`).

**Rationale**:
- Azure's per-deployment configuration model is fundamentally different from OpenAI's single-key-many-models approach.
- A separate provider makes the settings UI cleaner — Azure gets a dedicated section with a model entry list, while OpenAI keeps its existing single-key pattern.
- The two providers share internal API code (Responses API streaming parser, Chat Completions handler) but have different configuration surfaces.
- Users who have both direct OpenAI and Azure deployments can configure both independently.

**Impact**: New provider in the registry. New `AzureModelEntry` type for per-model configuration. Shared API code extracted to a common module used by both OpenAI and Azure providers.

---

## Decision 2: Per-Model Configuration with Stable UUIDs

**Problem**: Azure deployments are configured individually (each has a base URL, API key, and deployment name). The deployment name (model endpoint) may not be unique across different Azure resources. We need a stable model identifier for tree nodes and a human-friendly display name.

**Decision**: Each Azure model entry gets:
- An auto-generated UUID (`id`) as the stable model identifier stored in tree nodes
- A `nickname` field (optional, required when `endpoint` duplicates another entry) for display
- Display priority: nickname if set, otherwise endpoint name
- Validation: nickname uniqueness enforced; nickname required when endpoint would be ambiguous

**Rationale**:
- UUIDs prevent breakage when users rename nicknames — existing nodes still resolve to the correct entry.
- Nicknames are user-controlled and meaningful (e.g., "o4 East US" vs "o4 Staging"), unlike auto-generated disambiguators.
- Azure base URLs are 50+ chars — unusable in dropdowns. Nicknames keep the model picker clean.
- Requiring nicknames only on conflict keeps configuration lightweight for users with no duplicates.

**Impact**: `ProviderConfigData` gains `azureModels?: AzureModelEntry[]`. Model IDs in tree nodes use the format `azure::${entry.id}`. ModelSelector groups Azure models under an "Azure Foundry" optgroup.

---

## Decision 3: Dual API — Reasoning Models Use Responses API, Non-Reasoning Use Chat Completions

**Problem**: OpenAI's Chat Completions API does not expose reasoning tokens. The Responses API exposes `encrypted_content` on reasoning items, enabling capture, display, and replay. However, non-reasoning models (GPT-4o, etc.) don't benefit from the Responses API and work fine with Chat Completions.

**Options considered**:

1. **Full Responses API migration**: Move all OpenAI/Azure models to Responses API.
2. **Dual API by model type**: Reasoning models → Responses API, non-reasoning → Chat Completions.
3. **Chat Completions only**: Defer all Responses API work.

**Decision**: Option 2 — Dual API, selected by `isReasoningModel` flag.

**Rationale**:
- Reasoning models (o-series) require the Responses API for thinking capture — this is the only path to `encrypted_content` (Finding 10-14 from the research).
- Non-reasoning models (GPT-4o, GPT-4) have no reasoning to capture and no benefit from migrating.
- Building Azure on Responses API from the start avoids building on the older API only to rewrite later.
- The `isReasoningModel` toggle (explicit for Azure, auto-detected for OpenAI by prefix) provides a clean partition with no ambiguity.
- Chat Completions remains proven and stable for non-reasoning models — no reason to introduce migration risk for no benefit.

**Supersedes**: ADR-020's planned full migration to Responses API. The dual-API approach achieves the same reasoning support goal without the risk and cost of migrating non-reasoning models. ADR-020's technical analysis (message format mapping, streaming format, stateless mode) remains valid for the Responses API path.

**Impact**: Both OpenAI and Azure providers contain two code paths. The Responses API streaming parser, message formatter, and tool handler are shared between providers. The `isReasoningModel` flag is explicit per Azure model entry and auto-detected by prefix for OpenAI (`o1-`, `o3-`, `o4-`).

---

## Decision 4: Responses API in Stateless Mode with `store: false`

**Problem**: The Responses API supports stateful (`previous_response_id`) and stateless (full `input` array) modes. It also supports server-side response persistence (`store: true`) or client-managed state (`store: false`).

**Decision**: Use stateless mode with `store: false`.

**Rationale**:
- Baobab's tree-based context model is inherently stateless — each API call sends the full root-to-leaf path.
- `store: false` returns `encrypted_content` on reasoning items, which is required for capture and replay (with `store: true`, the server manages reasoning internally and doesn't return the blobs).
- The probe research was conducted with `store: false` — all findings about last-turn-only filtering, cross-conversation replay, and steering behavior apply specifically to this mode.
- Stateful mode would require fundamental changes to context management that conflict with the tree architecture.

**Impact**: All Responses API calls include `store: false`. The `encrypted_content` blobs are captured and stored as `ThinkingBlock.encryptedContent` per Feature 39's data model.

---

## Decision 5: Explicit `isReasoningModel` Toggle for Azure, Auto-Detect for OpenAI

**Problem**: The API path (Responses vs Chat Completions) depends on whether a model supports reasoning. Azure deployment names are opaque (the user assigns them), so prefix detection is unreliable. Direct OpenAI models have predictable naming (o1/o3/o4 series).

**Decision**:
- Azure: explicit `isReasoningModel` boolean per model entry, configured by the user.
- OpenAI: auto-detect by model ID prefix (`o1-`, `o3-`, `o4-` → reasoning, `gpt-` → non-reasoning). The user does not see or toggle this.

**Rationale**:
- Azure deployment names are user-defined — a deployment named "my-model" gives no signal about whether it's a reasoning model. Only the user knows.
- OpenAI's model naming convention is consistent and predictable. Auto-detection avoids burdening users with a toggle they shouldn't need to think about.
- If OpenAI introduces models that break the prefix convention, the auto-detection can be updated or an override can be added later.

**Impact**: `AzureModelEntry` includes `isReasoningModel: boolean`. OpenAI provider checks model prefix internally.

---

## Decision 6: Reasoning Display — Summary with Encrypted Fallback

**Problem**: OpenAI reasoning blocks have two components: `encrypted_content` (opaque blob for replay) and `summary` (abbreviated human-readable description). Anthropic thinking blocks have cleartext `text` (full thinking). The UI needs to handle both.

**Decision**: Show reasoning summary text when available (expandable, like Anthropic blocks). Fall back to a size indicator ("Encrypted reasoning (N bytes)") when no summary is available.

**Rationale**:
- Summaries provide meaningful signal about what the model was reasoning about, even if abbreviated.
- A size indicator is honest about opacity when summaries aren't available, while still showing that reasoning was captured.
- The expandable block UI is consistent with Anthropic's thinking display — users learn one pattern.
- The `ThinkingBlock.text` field stores the summary (or empty string), and `ThinkingBlock.encryptedContent` stores the blob for replay. Both are preserved regardless of what's displayed.

**Impact**: `useStreamingResponse` captures both summary and encrypted_content from Responses API events. `ThreadMessage`, `ReasoningBlocksSection`, and `NodeDetailPanel` render based on `text` content with fallback to size indicator.

---

## Decision 7: Last-Turn-Only Filtering Visualization

**Problem**: Research shows OpenAI's server only includes reasoning from the last assistant turn in the model's context window. Reasoning blocks on earlier nodes in the conversation path are silently filtered out. Users need to understand which reasoning blocks will actually reach the model.

**Decision**: Visualize filtering status with two treatments:
- **Last-turn position**: Reasoning blocks on the last assistant node in the conversation path are highlighted (these survive filtering and reach the model).
- **Non-last-turn position**: Reasoning blocks on earlier assistant nodes show a filter icon indicating they will be silently discarded by the server.

This applies only to OpenAI/Azure reasoning blocks (blocks with `encryptedContent`). Anthropic thinking blocks are not subject to this filtering.

**Rationale**:
- ADR-020 Decision 5 established the principle of informing users about platform limitations without auto-modifying their data.
- Users may still want non-last-turn reasoning blocks for: plaintext fallback (not affected by server filtering), documentation, or future replay in different contexts.
- The visualization is computed at render time based on the current tree path — no data modification needed.

**Impact**: `ReasoningBlocksSection` and `ThreadMessage` compute last-turn status from the conversation path. A filter icon and tooltip explain the limitation. The computation is: given the path from root to the currently selected/reply-target node, identify the last assistant node — only its OpenAI reasoning blocks are "active."

---

## Research Context

The empirical research motivating these decisions is documented in:
- `../thinking-sig-replay/RESEARCH_ANALYSIS.md` — Findings 10-16 (OpenAI reasoning replay, steering, cross-model portability)
- `../thinking-sig-replay/PROBE_ANALYSIS.md` — Token inclusion probes revealing last-turn-only filtering (H2 confirmed)
- `../thinking-sig-replay/Research_Writeup/FIRST_DRAFT.md` — Full writeup including the complementary validation gap across providers
- Feature 39 spec — ThinkingBlock data model, copy/paste UX, context assembly

Key findings informing these decisions:
1. OpenAI `encrypted_content` steers model behavior at 100% reliability when in last-turn position (Finding 13-14)
2. Cross-conversation replay is accepted — blobs are portable (Finding 10)
3. Server silently discards reasoning from non-last turns (Probe Analysis H2)
4. Tool results dominate over injected reasoning (Finding 3/14)
5. Chat Completions cannot consume reasoning items — Responses API is required
6. `store: false` is required to receive `encrypted_content` blobs
7. o3-mini's blobs are functionally inert — reasoning support is model-specific
