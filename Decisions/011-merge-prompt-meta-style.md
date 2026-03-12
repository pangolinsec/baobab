# ADR-011: Keep Meta-Style Merge Prompt for Branch Context Preservation

**Date**: 2026-02-20
**Status**: Accepted
**Context**: During Feature 16 (Merge Branches) implementation, the default merge prompt was observed to produce "meta" output — responses like "Branch 1 discussed X while Branch 2 discussed Y" rather than purely synthesized content. The question arose whether the prompt should be rewritten to produce less meta, more direct output. Analysis of the message flow for follow-up replies revealed this is a deliberate trade-off.

---

## Decision 1: Retain Meta-Style Merge Prompt in Summarize Mode

**Problem**: The merge prompt produces output that talks *about* the branches ("Branch 1 concluded... Branch 2 explored...") rather than directly synthesizing a unified response. This feels overly meta at first glance. Should the prompt be rewritten to produce more natural, direct output?

**Options considered**:

1. **Rewrite prompt for direct synthesis**: Instruct the model to produce a unified response without referencing "branches" or "Branch 1/2". Reads more naturally but loses structural information about which insights came from where.
2. **Keep meta-style prompt**: Allow the model to reference branches and highlight differences. Reads less naturally but preserves provenance information.

**Decision**: Option 2 — keep the meta-style prompt.

**Rationale**: In summarize mode, the merge user node stores only a terse label (`[Merge request] Merging two branches (5 + 3 messages)`), not the actual branch content. When a user replies to the merge output, the follow-up API call walks `parentId` to root and sees: shared ancestor context → merge user label → merge assistant output → new user message. The actual branch transcripts are not in this path — they were sent as a standalone API call during the merge operation. This means the merge assistant output is the *only record* of the branch contents available to the model for follow-up turns. Meta-information about how branches differed ("Branch 1 focused on performance while Branch 2 explored correctness") is more useful to the model than a pure synthesis that discards provenance. In full-context mode, the branch transcripts are embedded in the merge user node, so the model has full context regardless — but the meta style remains helpful for readability.

**Impact**: No code changes. The default `mergePrompt` in `useSettingsStore.ts` is kept as-is. Users can customize the prompt in Settings > Prompts if they prefer a different style.

---

## Spec Files Updated

No spec files were updated in this session.
