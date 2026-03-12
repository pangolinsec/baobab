# ADR-004: Pre-Tier 2 Issue Resolution

**Date**: 2026-02-19
**Status**: Accepted
**Context**: After Tier 1 implementation planning (ADR-003), a comprehensive review identified 7 remaining conflicts, cross-feature interaction gaps, and general concerns that should be resolved before Tier 2 implementation begins. This ADR records the resolutions applied to the spec set.

---

## Decision 1: TreeNode Gets Both `providerId` and `providerOverride`

**Problem**: Feature 07 adds `providerId: string` (provenance — which provider produced a response) to `TreeNode`, but the canonical `TreeNode` from ADR-001 has `providerOverride?: string` (cascade control — use this provider for descendants). These are semantically different fields, but the specs only defined one or the other in different places.

**Decision**: Keep both fields.

- `providerId: string` — required on assistant nodes, written at response time, read-only after creation. Records which provider actually produced the response. Default `'anthropic'` in Phase 1.
- `providerOverride?: string` — optional cascade control, participates in `resolveCascade`. When set, descendants inherit this provider unless overridden further down.

**Rationale**: `providerId` cannot be reliably derived from `node.model` + the provider registry because the same model ID may appear on multiple providers (e.g., OpenRouter exposes Claude models). Explicit provenance recording is the only reliable approach.

**Impact**: `_overview.md` canonical TreeNode updated. Feature 07 spec updated with both fields and semantic explanations.

---

## Decision 2: Unified Tool Dispatch via Handler Registry

**Problem**: Features 05 (web search) and 13 (file access) both inject tools into the API call. When both are enabled simultaneously, the tool loop must handle multiple tool types. Neither spec addressed the combined case.

**Decision**: Add a Tool Dispatch section to `_overview.md` defining a unified tool loop with a handler registry pattern.

- A single tool loop handles all tool types in the streaming hook.
- Each tool call is dispatched by `toolName` to a registered handler.
- Multiple tool calls in a single turn are executed in parallel (`Promise.all`).
- The `toolCalls` array on the assistant node stores all calls regardless of type.
- Features register handlers at initialization: `registerToolHandler('web_search', ...)`, `registerToolHandler('read_file', ...)`.

**Rationale**: A registry pattern is extensible (new tools plug in without modifying the loop) and prevents the two specs from diverging into incompatible tool loop implementations.

**Impact**: New Tool Dispatch section added to `_overview.md` architectural conventions.

---

## Decision 3: System Prompt Assembly Pipeline

**Problem**: Three features modify the system prompt (09: cascade, 13: file index, 19: RAG context). The order of operations matters, and Feature 19 explicitly flagged this as an open question.

**Decision**: Define a three-stage pipeline in `_overview.md`:

1. `resolveCascade(systemPromptOverride)` → base system prompt (Feature 09)
2. Append project file index context (Feature 13)
3. Append RAG retrieval context (Feature 19)

Each stage appends with a `\n\n---\n\n` separator. Only explicit `systemPromptOverride` values trigger Feature 10 visual indicators — stages 2 and 3 are infrastructure augmentations, not user-set overrides.

**Rationale**: Cascade resolution must come first (it determines the base prompt). File index and RAG context are additive augmentations that don't interact with each other. The ordering is natural: structural context (files) before retrieval context (RAG).

**Impact**: New System Prompt Assembly Pipeline section in `_overview.md`. Closes the open question in Feature 19.

---

## Decision 4: Inline Dexie Migrations Replaced with Pointers

**Problem**: Feature 24's spec showed a `this.version(2)` migration, but the coordinated migration plan (`_dexie-migrations.md`) assigns tags to Version 3. Individual specs had stale version numbers.

**Decision**: Remove inline migration code from individual feature specs and replace with a pointer to `_dexie-migrations.md`.

**Rationale**: The migration plan is the single source of truth for version numbers. Inline code in feature specs will always drift when features are reordered or batched differently. A pointer ensures implementers always reference the correct version.

**Impact**: Feature 04 and Feature 24 inline migration code replaced with `*Dexie migration: see [Dexie Migration Plan](_dexie-migrations.md), Version N.*`

---

## Decision 5: Heatmap Temporarily Overrides Summary/Merge Tint

**Problem**: Feature 17's scoring heatmap adds background tints (red/yellow/green) to nodes, but the Visual Channels table reserves node background tints (blue-gray) for summary/merge nodes. Stacking behavior was unspecified.

**Decision**: When a heatmap is active, it temporarily overrides the summary/merge blue-gray background tint. Dismissing the heatmap restores the original tint.

**Rationale**: Heatmaps are ephemeral (transient Zustand state, cleared on dismiss), while summary/merge tints are persistent. Temporary override is the natural behavior — the user is explicitly requesting a scoring view and expects to see scores on all nodes.

**Impact**: New row added to Visual Channels table in `_overview.md`. Stacking rule note added to Feature 17 spec.

---

## Decision 6: All Node Types Contribute to Conversation Cost

**Problem**: Feature 22 sums `tokenUsage` across assistant nodes, but doesn't address whether summary (Feature 15), merge (Feature 16), and research (Feature 06) nodes are included.

**Decision**: All assistant nodes contribute to the conversation cost total regardless of `nodeType`. Add a `costByNodeType` breakdown alongside the existing per-model breakdown.

**Rationale**: These nodes make real API calls with real costs. Excluding them would undercount. The per-`nodeType` breakdown gives users visibility into what portion of their costs comes from automated operations (summaries, merges) vs. direct conversation.

**Impact**: "Cost Attribution by Node Type" section added to Feature 22 with `costByNodeType` field in the return type.

---

## Decision 7: "Tool Messages" → "Tool Call Sections"

**Problem**: Feature 21 mentions rendering "Tool messages: compact, collapsible inline block." But per ADR-001 Decision 2, tool calls are `toolCalls` arrays on assistant nodes, not separate messages. The terminology was misleading.

**Decision**: Replace "Tool messages" with "Tool call sections" and clarify they render within assistant message cards.

**Rationale**: Terminology alignment with the data model prevents implementer confusion. Tool calls are not messages — they are metadata on assistant nodes.

**Impact**: Feature 21 spec text updated.

---

## Decision 8: Lazy @filename Resolution Uses Current File Content

**Problem**: Feature 13's lazy `@filename` resolution doesn't address what happens when a file changes or is deleted after messages referencing it were sent.

**Decision**: Lazy resolution always uses current file content at API-call time. If a file is deleted, `resolveFileReferences` replaces the reference with `[File not found: filename.ext]`.

**Rationale**: This is the simplest correct behavior. Re-sending a message naturally uses the latest file state. Users who need snapshot behavior should paste content directly. The deleted-file fallback prevents silent failures.

**Impact**: "File Versioning Behavior" section added to Feature 13 spec.

---

## Decision 9: Frontend Performance Memoization Strategy

**Problem**: Several cascade/detection functions walk root-to-node per node during rendering. For trees with 1000+ nodes, this is O(n x depth).

**Decision**: Document a memoization strategy in `_overview.md`: cascade results should be memoized per-node in `buildReactFlowGraph`, keyed on the nodes map reference. Pre-computing a resolved-values map in a single tree traversal pass can be used if profiling reveals bottlenecks at larger scale.

**Impact**: "Frontend Performance" section added to `_overview.md`.

---

## Decision 10: `POST /api/sync` Schema Added to Feature 00

**Problem**: The `POST /api/sync` bulk endpoint is mentioned in Feature 00 but its request/response schema only appeared in `_recommendation-specs.md`, which is marked "historical reference only."

**Decision**: Pull the `SyncRequest` and `SyncResponse` TypeScript interfaces into Feature 00's API Endpoints section.

**Rationale**: The canonical spec should be self-contained for implementers. Historical-reference documents should not be required reading.

**Impact**: Feature 00 updated with full `SyncRequest`/`SyncResponse` schemas and usage description.

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `Features/_overview.md` | Decisions 1, 2, 3, 5, 9 |
| `Features/00-backend-architecture.md` | Decision 10 |
| `Features/04-advanced-config.md` | Decision 4 |
| `Features/07-inference-providers.md` | Decision 1 |
| `Features/13-project-knowledge.md` | Decision 8 |
| `Features/17-compare-classify.md` | Decision 5 |
| `Features/21-thread-view.md` | Decision 7 |
| `Features/22-pricing.md` | Decision 6 |
| `Features/24-tags.md` | Decision 4 |
