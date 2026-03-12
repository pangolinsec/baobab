# ADR-007: Multi-Provider Refinements

**Date**: 2026-02-19
**Status**: Accepted
**Context**: With multi-provider support now implemented (Anthropic, OpenAI, Ollama, etc.), several UI labels and feature specs still assumed a single-provider (Claude-only) world. This session addressed provider-neutral labeling, a dead-end rendering bug, and extended the merge feature spec with a full-context mode inspired by GitChat's DAG-based merge approach.

---

## Decision 1: Rename Assistant Role Label from "Claude" to "Assistant"

**Problem**: Five components hardcoded `'Claude'` as the assistant role label (tree nodes, detail panel, thread view, branch indicator, starred sidebar list). With multiple providers wired up, a response might come from GPT-4o, Gemini, or a local Ollama model — labeling everything "Claude" is misleading.

**Options considered**:

1. **"Assistant"**: Generic, matches the `role: 'assistant'` field in the data model and API conventions. Provider-neutral.
2. **"Model"**: More technical, doesn't read naturally as a label ("Model said...").
3. **Dynamic label based on provider/model**: e.g., "Claude", "GPT-4o", "Gemini". Informative but adds complexity, looks inconsistent when branches use different models, and the model indicator chips already serve this purpose.

**Decision**: Option 1 — use "Assistant" everywhere.

**Rationale**: The model name is already visible via indicator chips on tree nodes and the model label in NodeDetailPanel. A static "Assistant" label is clean, universally understood, and requires no conditional logic. Dynamic labels would add complexity for information that's already displayed elsewhere.

**Impact**: `MessageNode.tsx`, `NodeDetailPanel.tsx`, `ThreadMessage.tsx`, `BranchIndicator.tsx`, `Sidebar.tsx` — one string replacement each.

---

## Decision 2: Fix `computeDeadEndMap` Short-Circuit Bug

**Problem**: `computeDeadEndMap()` in `src/lib/tree.ts` used `childIds.every(childId => bottomUp(childId))` in its bottom-up pass. `Array.every()` short-circuits on the first `false` — if the first sibling's subtree was not dead, remaining children (including explicitly flagged dead-end nodes) were never visited. Their status was never cached, so the top-down pass treated them as not-dead-end. Result: `opacity-40` was not applied to dead-end nodes or their descendants.

**Decision**: Replace `childIds.every(childId => bottomUp(childId))` with `childIds.map(childId => bottomUp(childId))` followed by `.every(Boolean)`. The `map()` visits all children to populate the cache; `every()` then checks the collected results.

**Rationale**: The bottom-up pass must visit every node in the tree to populate the cache that the top-down pass depends on. Short-circuiting is a correctness bug, not a performance optimization — the top-down pass needs complete data regardless of the parent's result.

**Impact**: `src/lib/tree.ts` — one line changed in `computeDeadEndMap()`. The standalone `computeAllPathsDead()` helper (used for single-node queries) retains `every()` because it doesn't need to populate a shared cache.

---

## Decision 3: Add Full-Context Merge Mode to Feature 16

**Problem**: Feature 16 (Merge Branches) specified only a summarization-based merge — both branches are synthesized into a condensed response, and future replies only see the summary. This is token-efficient but lossy. Analysis of GitChat's DAG-based merge approach (which sends complete branch content to the LLM) revealed a real user tradeoff: some merges benefit from preserving the full original content at the cost of higher token usage.

**Options considered**:

1. **Summarize only** (existing spec): Token-efficient, lossy. One mode, simpler implementation.
2. **Full context only** (GitChat approach): Lossless, token-intensive. Requires DAG support (multi-parent nodes), fundamentally changes the tree data model.
3. **Dual mode — summarize (default) + full context option**: User chooses per-merge. Full context embeds both branch transcripts in the synthetic user node content. Tree invariant preserved — no data model changes beyond a `mergeMode` field.

**Decision**: Option 3 — dual mode with summarize as default.

**Rationale**: The two modes serve different use cases and the implementation cost is low. The key insight is that full-context mode doesn't require DAG support (GitChat's `parent: string[]` approach) — it embeds transcripts in the synthetic user node's content, so the standard `parentId` walk picks them up automatically. The merge dialog already shows token estimates, making the cost tradeoff visible to users. A warning escalates when chained full-context merges compound token costs.

**Impact**: `Features/16-merge-branches.md` updated with:
- Dual mode description in Summary
- Mode radio button and contextual token warnings in Merge Dialog
- Mode-dependent synthetic user node content in Execution
- `mergeMode?: 'summarize' | 'full-context'` field in TreeNode data model
- Rewritten Context Building section (two subsections, no special logic needed)
- Full-context visual treatment with collapsed transcript sections
- Chained full-context merge edge case
- Default mode preference in Advanced Settings

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `Features/16-merge-branches.md` | Added full-context merge mode: dual mode summary, dialog mockup with warnings, mode-dependent execution, `mergeMode` field, context building per mode, visual treatment, chained merge edge case, settings |
