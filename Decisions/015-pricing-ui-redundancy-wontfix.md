# ADR-015: Pricing UI — Decline Redundant Cost/Context Displays

**Date**: 2026-02-20
**Status**: Accepted
**Context**: During the Feature 22 (Pricing Transparency) bug-fix pass, spec gaps S1 and S2 came up for implementation. S1 called for a "Branch context: ~4,200 tokens" line in NodeDetailPanel. S2 called for a pre-send dollar cost estimate in ChatInput. Both were marked "must-have" in the original spec. On review, both add UI clutter without meaningful new information. This ADR records the decision to close them as wontfix.

---

## Decision 1: Do Not Add "Branch Context" Line to NodeDetailPanel (S1)

**Problem**: The spec (Features/22-pricing.md:88-101) shows a three-line footer in the detail panel: token counts, branch context estimate, and cost. The implementation has token counts and cost but omits the branch context line.

**Options considered**:

1. **Implement as specified**: Add a `Branch context: ~4,200 tokens` line using `estimateContextTokens(getPathToRoot(...))`, reading nodes via `getState()`.
2. **Decline — redundant with input token count**: The input token count already displayed on the node (`1,240 in`) is the actual branch context as measured by the API. A separate rough estimate (~4 chars/token) is strictly less accurate.

**Decision**: Option 2 — decline. The input token count is the branch context.

**Rationale**: The `inputTokens` field on an assistant node is exactly "how many tokens of context the model received for this response." Showing a separate character-based estimate below it would be a less accurate duplicate of the same information. The only scenario where branch context adds value is on user nodes (which lack token usage), but users don't inspect user nodes for context depth. The conversation header already shows total tokens for cost awareness.

**Impact**: `src/components/tree/NodeDetailPanel.tsx` unchanged. `Bugs/feature22-pricing-review.md` S1 marked wontfix.

---

## Decision 2: Do Not Add Pre-Send Dollar Estimate to ChatInput (S2)

**Problem**: The spec (Features/22-pricing.md:188-189) shows `~4,200 tokens in context • est. $0.003` in the chat input area. The implementation shows the token count but not the dollar amount.

**Options considered**:

1. **Implement as specified**: Call `estimateCost(contextEstimate, 0, effectiveModel, providerId)` to compute input-only cost and display it.
2. **Decline — misleading and redundant**: The dollar figure is input-only (output tokens unknown pre-send), so it understates actual message cost by 2-5x. The token count line already conveys "this branch is getting large." Accurate per-node and conversation-level costs are shown post-send.

**Decision**: Option 2 — decline. The token count is sufficient pre-send; accurate costs are shown post-send.

**Rationale**: A pre-send cost showing only input tokens creates a false sense of cheapness. A 4K-context Haiku message shows `est. $0.003` but the actual cost after the response could be $0.01-0.02. Users who care about cost will rely on the per-node cost (shown after each response) and the conversation header running total — both of which include output tokens and are computed from actual API-reported usage, not estimates. Adding a misleadingly low number to the input area undermines trust in the cost display system.

**Impact**: `src/components/chat/ChatInput.tsx` unchanged. `Bugs/feature22-pricing-review.md` S2 marked wontfix.

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `Bugs/feature22-pricing-review.md` | S1 and S2 marked as wontfix with rationale and ADR reference |
