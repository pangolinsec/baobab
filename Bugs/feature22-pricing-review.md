# Feature 22 Pricing Transparency — Bug & Issue Report

**Date**: 2026-02-20
**Scope**: `src/lib/pricing.ts`, `src/data/pricing.json`, provider token capture (`src/api/providers/`), streaming hook, UI display components, settings store

---

## Bugs

### ~~B1: Output token fields unguarded across providers — `NaN` propagation~~ ✅ FIXED

**Files**: `src/api/providers/gemini.ts:97-101`, `src/api/providers/openrouter.ts:122-127`, `src/api/providers/huggingface.ts:119-124`, `src/api/providers/openai.ts:161-163`
**Severity**: wrong-result
**Fixed in**: `7d6adf3`

Added `?? 0` fallback on every output token read in all four providers.

---

### ~~B2: Cancel/abort never calls `finalizeNode` — partial content lost on reload~~ ✅ FIXED

**Files**: `src/hooks/useStreamingResponse.ts:492-500`
**Severity**: data-loss

Cancel handler now reads `streamingNodeId` and current content from the store, then calls `finalizeNode()` with `undefined` tokenUsage (no usage data on abort). Thinking and tool call buffers accumulated before abort are preserved. Falls back to `setStreaming(null)` if no streaming node (safety).

---

### ~~B3: `o1`/`o3` patterns are overbroad — wrong pricing for mini variants~~ ✅ FIXED

**File**: `src/data/pricing.json:9-10`
**Severity**: wrong-result
**Fixed in**: `7d6adf3`

Added explicit `o3-mini` entry ($1.10/$4.40) to `pricing.json`. The `o1-mini` case is moot — `o1-mini` has been deprecated from OpenAI's model lineup. The longest-prefix-wins matching ensures `o3-mini` (7 chars) takes precedence over `o3` (2 chars).

---

### ~~B4: Live pricing lookup is case-sensitive while static lookup is case-insensitive~~ ✅ FIXED

**File**: `src/lib/pricing.ts:105-106` vs `src/lib/pricing.ts:53-69`
**Severity**: wrong-result
**Fixed in**: `5e60615`

Normalized live pricing cache keys to lowercase in both `setLivePricing` and `findPricing`.

---

### ~~B5: `totalCost` incorrectly nullified for Ollama + unpriced node mix~~ ✅ FIXED

**File**: `src/lib/pricing.ts:197`
**Severity**: wrong-result
**Fixed in**: `5e60615`

Added `gapCount` tracker. Now returns `null` only when all nodes lack pricing (`nodeCount === gapCount`), not when the priced sum happens to be zero.

---

### ~~B6: `node.model` can be undefined — crash in `estimateCost`~~ ✅ FIXED

**Files**: `src/components/tree/NodeDetailPanel.tsx:321`, `src/lib/pricing.ts:134->53`
**Severity**: crash
**Fixed in**: `5e60615`

Added early return in `estimateCost` when `modelId` is falsy.

---

### ~~B7: No-op line in Anthropic provider~~ ✅ FIXED

**File**: `src/api/providers/anthropic.ts:119`
**Severity**: cosmetic
**Fixed in**: `5e60615`

Replaced no-op `cumulativeText.slice()` assignment with a comment.

---

## Performance

### ~~P1: ChatInput subscribes to entire store — re-renders on every streamed token~~ ✅ FIXED

**File**: `src/components/chat/ChatInput.tsx:30-38`
**Impact**: HIGH
**Fixed in**: `7d6adf3`

Replaced `useTreeStore()` destructure with individual `useTreeStore((s) => ...)` selectors. Merged second `useTreeStore()` call for `setWebSearchEnabled`/`setSearchProvider`. Note: `nodes` still triggers re-renders on every token for `contextEstimate`/`effectiveModel`/`effectiveSystemPrompt` — a deeper fix (lazy `getState()` reads) is tracked under P4.

---

### ~~P2: NodeDetailPanel subscribes to all nodes — ReactMarkdown re-renders on every token~~ ✅ FIXED

**File**: `src/components/tree/NodeDetailPanel.tsx:39`
**Impact**: HIGH
**Fixed in**: `7d6adf3`

Replaced `nodes` map subscription with targeted `s.nodes[s.selectedNodeId]` selector. `resolveSystemPrompt` now reads `nodes` via lazy `useTreeStore.getState().nodes` since the system prompt chain only changes on structural mutations, not during streaming.

---

### ~~P3: `conversationCost` recomputes O(N*P) on every streamed token~~ ✅ FIXED

**File**: `src/components/pages/ConversationView.tsx:76-78`
**Impact**: MEDIUM-HIGH
**Fixed in**: `7d6adf3`

Replaced `nodes`-dependent useMemo with a token-usage fingerprint selector (cheap numeric sum). `getConversationCost` now only recomputes when `tokenUsage` data actually changes (i.e., after `finalizeNode`), not on every streamed token. Also converted `hasUserMessages` and `replyTargetHasChildren` to Zustand selectors returning primitives for the same reason.

---

### ~~P4: `getPathToRoot` in ChatInput recomputes on every token~~ ✅ FIXED

**File**: `src/components/chat/ChatInput.tsx`
**Impact**: MEDIUM

Removed the `nodes` subscription entirely from ChatInput. Converted `effectiveModel`, `effectiveSystemPrompt`, and `contextEstimate` useMemos to read `nodes` via `useTreeStore.getState()` instead of reactive subscription. Converted `replyTarget` to a targeted Zustand selector. ChatInput no longer re-renders on every streamed token.

---

### ~~P5: `hasUserMessages` scans all nodes on every token~~ WONTFIX

**File**: `src/components/pages/ConversationView.tsx:65-67`
**Impact**: LOW

Already a Zustand selector returning a boolean. `Object.values().some()` short-circuits on first user node — microseconds of work. Not worth the complexity of a latch.

---

### ~~P6: `toLowerCase()` on static entries repeated per call~~ WONTFIX

**File**: `src/lib/pricing.ts:57,69`
**Impact**: LOW

With P3's fingerprint optimization, `getConversationCost` only runs once per finalized message, not per streamed token. The `toLowerCase()` overhead is negligible at that frequency.

---

## Spec Gaps

### ~~S1: Missing "Branch context" line in NodeDetailPanel~~ WONTFIX

**Spec**: `Features/22-pricing.md:100-101` — "Branch context: ~4,200 tokens"
**File**: `src/components/tree/NodeDetailPanel.tsx:311-332`
**Severity**: ~~must-have~~ wontfix

The input token count already displayed on the node IS the branch context (what the API actually received). A separate "Branch context: ~4,200 tokens" line computed from a rough 4-chars-per-token estimate would be a less accurate duplicate. See ADR-013.

---

### ~~S2: Pre-send cost estimate missing in ChatInput~~ WONTFIX

**Spec**: `Features/22-pricing.md:189` — `est. $0.003`
**File**: `src/components/chat/ChatInput.tsx:252-261`
**Severity**: ~~must-have~~ wontfix

The token count line already serves the "how deep is this branch" signal. The dollar figure would be input-only and misleadingly small — actual cost after the response could be 2-5x higher. Accurate costs are shown post-send on nodes and in the conversation header. See ADR-013.

---

### ~~S3: Per-model cost breakdown missing~~ ✅ FIXED

**Spec**: `Features/22-pricing.md:145-179` — `costBreakdown: Record<string, number>` with UI mockup
**File**: `src/lib/pricing.ts:140-203`
**Severity**: must-have

Added `ModelCostEntry` interface and `costByModel` field to `ConversationCostResult`. Accumulates per-model cost, tokens, and message count in the existing loop. ConversationView shows a hover tooltip with per-model breakdown when 2+ models are present, sorted by cost descending.

---

### ~~S4: Per-nodeType cost breakdown missing~~ WONTFIX

**Spec**: `Features/22-pricing.md:232-249` — `costByNodeType: Record<string, number>`
**Severity**: nice-to-have

Per-nodeType breakdown is for features (summaries, merges) that don't exist yet. Premature to implement until those node types are added.

---

### ~~S5: "Pricing unavailable" text not shown for unknown models~~ WONTFIX

**Spec**: `Features/22-pricing.md:253`
**Severity**: cosmetic

The `+` suffix in the conversation header already signals pricing gaps. Explicit "Pricing unavailable" text on each node adds clutter without actionable information.

---

### ~~S6: "--" not shown for interrupted streams~~ ✅ FIXED

**Spec**: `Features/22-pricing.md:254`
**Severity**: cosmetic

Token usage section now shows for all non-user nodes. When `tokenUsage` is undefined (aborted streams), displays `— in / — out tokens`.

---

### ~~S7: "tokens" suffix missing from detail panel~~ ✅ FIXED

**Spec**: `Features/22-pricing.md:99` — `1,240 in / 856 out tokens`
**Severity**: cosmetic

Added ` tokens` suffix to both the normal and dash display paths.

---

## UX Issues

### ~~U1: Context estimate doesn't include system prompt~~ ✅ FIXED

**File**: `src/components/chat/ChatInput.tsx:92-97`

Added `effectiveSystemPrompt` length to the `contextEstimate` useMemo calculation and dependency array. The estimate now includes system prompt tokens and updates live when the user changes the prompt override.

---

### ~~U2: Partial cost with `+` suffix can be misleading~~ WONTFIX

**File**: `src/lib/pricing.ts:197`, `src/components/pages/ConversationView.tsx:166`

`$0.003+` is technically correct — it's a lower bound. Hiding cost entirely when pricing gaps exist would be worse than showing a partial sum with the `+` indicator.

---

## Robustness Notes

### ~~R1: `gpt-4o` / `gpt-4o-mini` ordering is fragile but currently correct~~ WONTFIX

**File**: `src/data/pricing.json:7-8`

Two-pass matching (exact first, then prefix) handles this correctly. The scenario where `gpt-4o-mini` is removed from `pricing.json` but `gpt-4o` remains is unlikely enough to not warrant additional complexity.

---

## Summary

| Category | Total | Fixed | Wontfix | Open |
|----------|-------|-------|---------|------|
| Bugs | 7 | 7 | 0 | 0 |
| Performance | 6 | 4 | 2 | 0 |
| Spec Gaps | 7 | 3 | 4 | 0 |
| UX Issues | 2 | 1 | 1 | 0 |
| Robustness Notes | 1 | 0 | 1 | 0 |
| **Total** | **23** | **15** | **8** | **0** |

### Suggested Priority Order

1. ~~**B1** — `?? 0` fallbacks on output token fields~~ ✅ `7d6adf3`
2. ~~**B3** — Add `o3-mini` entry to pricing.json~~ ✅ `7d6adf3`
3. ~~**P1+P2+P3** — Targeted Zustand selectors for ChatInput, NodeDetailPanel, ConversationView~~ ✅ `7d6adf3`
4. ~~**B4+B5+B6+B7** — Case-insensitive live pricing, totalCost null fix, model guard, no-op cleanup~~ ✅ `5e60615`
5. ~~**S1+S2** — Branch context + pre-send cost estimate~~ WONTFIX (ADR-013: redundant with existing token counts)
6. ~~**B2+S6+S7+P4** — Cancel finalization, dash display, tokens suffix, lazy ChatInput reads~~ ✅
7. ~~**P5+P6+S4+S5+U2+R1** — Low-impact items~~ WONTFIX
8. ~~**S3+U1** — Per-model cost breakdown + system prompt in context estimate~~ ✅
