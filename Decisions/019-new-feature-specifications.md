# ADR-019: New Feature Specifications — Batch Execution, Project UX, Elicitation History, Conversation Management

**Date**: 2026-02-23
**Status**: Accepted
**Context**: This session began with a comprehensive codebase review and feature status audit, resulting in an updated implementation status section in `Features/_overview.md`. The user then proposed several new features: batch prompt execution with multi-model support, project UX improvements, elicitation session history browsing, and conversation management (rename + project assignment). Through iterative Q&A, design decisions were made and four feature specs were written (Features 29–32). A parseltongue encoding integration was discussed but deferred.

---

## Decision 1: Batch Execution — N-Per-Model Semantics

**Problem**: When a user selects multiple models (e.g., 3) and sets N=5, should the system create 15 total runs (5 per model) or 5 total runs (round-robin across models)?

**Options considered**:

1. **N-per-model (multiplicative)**: 3 models × 5 = 15 runs. Each model gets exactly N samples.
2. **N-total (round-robin)**: 5 runs total, distributed ~2 per model. N is the hard cap.

**Decision**: Option 1 — N-per-model.

**Rationale**: Maps cleanly to systematic comparison ("how do 3 models each handle this?"). Enables intra-model consistency analysis with equal sample sizes. When only one model is selected, degenerates to "N total" anyway. The dry-run step makes the real total visible before execution, preventing surprise. The batch results table naturally organizes as rows grouped by model.

**Impact**: Feature 29 spec defines the total runs formula as `N × Models × SystemPromptVariants`. The dry-run section in the batch modal computes and displays this before execution.

---

## Decision 2: Batch Node Grouping via `batchId`

**Problem**: Batch execution creates many sibling nodes. Without grouping metadata, they're indistinguishable from manually-created branches. The tree becomes unreadable at scale, and synthesis needs to know which nodes belong to the same batch.

**Decision**: Add a `batchId: string` field to `TreeNode`. All nodes created by a single batch operation share a UUID `batchId`.

**Rationale**: Lightweight metadata approach that enables visual grouping in the tree (collapsible batch bands), powers the batch results view (filter by `batchId`), and identifies synthesis targets. No new Dexie table needed — `BatchRun` tracking is transient Zustand state since completed nodes are individually persisted.

**Impact**: `TreeNode` in `types/index.ts` gains `batchId?: string`. `buildReactFlowGraph` in `lib/tree.ts` detects sibling nodes with matching `batchId` for visual grouping. Feature 29 Phase C (synthesis) uses `batchId` to collect all siblings for the merge prompt.

---

## Decision 3: Batch Results View Threshold at N > 10

**Problem**: For small batches (3–5 runs), normal tree branches work. For large batches (50–100 runs), the tree is unusable. At what threshold should a dedicated results view activate?

**Decision**: Show the batch results table view for batches with more than 10 total nodes. For N ≤ 10, use normal tree branches with visual grouping.

**Rationale**: 10 is the practical threshold where scanning individual tree nodes becomes cumbersome. Below 10, the tree's spatial layout adds value (comparing branches visually). Above 10, a sortable/filterable table with response previews is more useful.

**Impact**: Feature 29 spec. The batch results view replaces the detail panel and shows a sortable table with model, response preview, tokens, and cost columns.

---

## Decision 4: Batch Synthesis — Extend Merge for N > 2

**Problem**: The existing merge (Feature 16) handles exactly 2 branches. Batch synthesis needs to handle N > 2 sibling responses.

**Options considered**:

1. **New synthesis operation**: A completely separate synthesis pipeline, independent of merge.
2. **Adapt existing merge**: Extend the merge pattern to accept N inputs instead of 2.

**Decision**: Option 2 — adapt the existing merge.

**Rationale**: The merge infrastructure (prompt template in settings, synthetic node creation, `nodeType: 'merge'`, `mergeSourceIds` array) already handles the core workflow. The main change is the prompt template — instead of comparing 2 branches, it lists N responses with their model/system-prompt metadata and asks for patterns, consensus, and divergences. Reusing merge avoids duplicating the node creation and visual treatment logic.

**Impact**: Feature 29 Phase C. The merge prompt from `useSettingsStore.mergePrompt` is adapted for N inputs. `mergeSourceIds` on the synthetic node contains all N assistant node IDs.

---

## Decision 5: Project Header Navigation — Click Name vs Chevron Split

**Problem**: Currently clicking the project header in the sidebar toggles collapse/expand. Navigating to the project detail page requires clicking a small gear icon. This buries the project detail page.

**Decision**: Split the interaction: clicking the project name navigates to `/projects/:id`, clicking the chevron toggles collapse/expand. Remove the gear icon.

**Rationale**: The project detail page is gaining importance (knowledge mode toggle from Feature 28C, start chat, file previews). Making it one click away from the sidebar improves discoverability. The chevron provides a clear, standard affordance for collapse/expand.

**Impact**: Feature 30 spec. `Sidebar.tsx` splits the project header row's click handler into two targets.

---

## Decision 6: Elicitation History — Top-Level Route

**Problem**: Where should the elicitation session history page live in the navigation?

**Options considered**:

1. **Top-level route** (`/elicitation`) with sidebar link.
2. **Tab within project detail page**.
3. **Section in settings page**.

**Decision**: Option 1 — top-level route at `/elicitation`.

**Rationale**: Elicitation sessions span conversations and projects — they're not subordinate to either. A top-level route gives the page appropriate prominence for a research-focused workflow and avoids overloading the settings page or project detail. Positioned in the sidebar above Settings.

**Impact**: Feature 31 spec. New route added to the router. Sidebar gains a link with a flask/beaker icon.

---

## Decision 7: LLM-Generated Titles — After First Response, Global Setting

**Problem**: Auto-generated conversation titles (truncated first message to 50 chars) are low-quality. When should LLM title generation fire, and how should it be configured?

**Decision**: Fire after the first assistant response completes (not on user message send). Controlled by a global setting toggle + model selector (default: "same as chat model"). Does not overwrite user-set titles.

**Rationale**: Generating a title from both the question and answer produces much better summaries than the question alone. Making it a global setting (not per-conversation) keeps configuration simple. The "same as chat" default avoids requiring separate model configuration. Fire-and-forget execution means it never blocks the conversation flow.

**Impact**: Feature 32 spec. `AppSettings` gains `autoGenerateTitles: boolean` and `titleGenerationModel?: string`. `useStreamingResponse.ts` fires a background LLM call in `onComplete` when enabled.

---

## Decision 8: Parseltongue Integration — Deferred, Extraction Script Approach

**Problem**: Parseltongue (P4RS3LT0NGV3) provides 79+ text encoding transformers useful for batch prompt variants. It's a Vue web app, not an npm package. How to integrate it?

**Options considered**:

1. **Git dependency + wrapper**: `"p4rs3lt0ngv3": "github:elder-plinius/P4RS3LT0NGV3"` with a Vite plugin to handle the non-standard module format.
2. **Git submodule + direct imports**: Submodule at `vendor/parseltongue/`, import transformer files directly.
3. **Build-time extraction script**: Script clones the repo, copies transformer files into `src/lib/parseltongue/`, generates an index.

**Decision**: Option 3 — build-time extraction script. Integration deferred to a future session.

**Rationale**: Simplest approach. No Vite plugin complexity, no submodule pain for contributors. Parseltongue's transformers are pure functions that won't change meaningfully — long-term auto-sync is unnecessary. The extraction script can be re-run manually when updates are desired. Also requires license clarification (repo has AGPL-3.0 file but package.json says MIT) before integration.

**Impact**: No immediate code changes. Feature 29 spec notes parseltongue as a future encoding variants source. When implemented, the extracted transformers would live in `src/lib/parseltongue/` with a feature flag for clean separation (relevant if AGPL applies — community edition only).

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `Features/_overview.md` | Added implementation status section (all features). Added Features 29–32 to tier tables, dependency graph, and feature number gaps. |
| `Features/29-batch-prompt-execution.md` | New spec: batch prompt execution with 4 phases (core, system variants, synthesis, templates). |
| `Features/30-project-ux.md` | New spec: project header navigation split, start chat from project, file previews. |
| `Features/31-elicitation-history.md` | New spec: dedicated elicitation history page at `/elicitation`. |
| `Features/32-conversation-management.md` | New spec: rename chats (inline + context menu + LLM titles), assign-to-project dropdown. |
