# ADR-003: Tier 1 Implementation Plan

**Date**: 2026-02-19
**Status**: Accepted
**Context**: With all feature specs reconciled (ADR-001) and reviewed (ADR-002), implementation begins with Tier 1 features. This ADR records the implementation order, batching strategy, and scope decisions.

---

## Tier 1 Features

| # | Feature | Dependencies | Spec |
|---|---------|-------------|------|
| 00 | Backend Architecture | — | [00-backend-architecture.md](../Features/00-backend-architecture.md) |
| 02 | GUID-Based Routing | — | [02-guid-routing.md](../Features/02-guid-routing.md) |
| 04 | Advanced API Configuration | — | [04-advanced-config.md](../Features/04-advanced-config.md) |
| 08 | Model Cascade (Phase 1) | — | [08-model-cascade.md](../Features/08-model-cascade.md) |
| 09 | System Prompt Cascade | — | [09-system-prompt-cascade.md](../Features/09-system-prompt-cascade.md) |
| 10 | Visual Indicators | 08, 09 | [10-visual-indicators.md](../Features/10-visual-indicators.md) |
| 23 | Resend / Duplicate | — | [23-resend-duplicate.md](../Features/23-resend-duplicate.md) |

---

## Decision 1: Defer Backend (Feature 00)

Feature 00 (Backend Architecture) is classified as Tier 1 but **no other Tier 1 feature depends on it**. The backend serves Tier 2/3 features: web search (05), inference providers (07), project knowledge (13), and pricing (22).

**Decision**: Defer Feature 00 until the first Tier 2/3 feature that requires it. Build all Tier 1 features as frontend-only.

**Rationale**: Building a backend with no consumers is wasted effort. The frontend-first approach lets us validate UX patterns before adding server complexity. When Feature 07 (Inference Providers) or Feature 05 (Web Search) begins, Feature 00 can be implemented as a prerequisite.

---

## Decision 2: Implementation Order — 4 Sequential Batches

Features are grouped into batches based on code overlap and dependencies. Each batch is planned and implemented before the next begins. Within a batch, features that touch different parts of the codebase can be developed in parallel.

### Batch 1: GUID Routing (Feature 02)

**Solo**. This restructures the application layout fundamentally — wrapping the app in a router, splitting `App.tsx` into `MainLayout` with sidebar + `<Outlet />`, creating `ConversationView` and `LandingPage` components, and changing all navigation from direct store calls to URL-based routing.

Every subsequent feature builds on this structure (route-based settings page, conversation-scoped views, URL-driven state). It must land first.

**Includes**: UI Fix 1 (landing page / empty state onboarding) as specified in the Feature 02 spec.

**Key files likely affected**:
- `src/App.tsx` — router wrapping, route definitions
- New: `src/components/layout/MainLayout.tsx`
- New: `src/components/pages/LandingPage.tsx`
- New: `src/components/pages/ConversationView.tsx`
- `src/components/sidebar/Sidebar.tsx` — navigation via `useNavigate()`
- `src/stores/useTreeStore.ts` — loading conversations from URL params

### Batch 2: Advanced Config + Resend/Duplicate (Features 04, 23)

**Parallel pair**. These features touch different parts of the codebase:

- **Feature 04** modifies settings (new `AppSettings` fields), the API call layer (thinking, temperature, etc.), and the detail panel (thinking block display). Primarily settings + API integration.
- **Feature 23** modifies the tree store (resend, duplicate, retry operations), context menu (new actions), and the chat input (prefill for duplicated messages). Primarily tree operations + UX.

Minimal overlap — Feature 04 changes how API calls are constructed, Feature 23 changes when/how they're triggered.

**Dexie migration**: Both are covered by Version 2 in the migration plan (`_dexie-migrations.md`). The V2 upgrade runs once, adding defaults for `nodeType`, `userModified`, `starred`, and `deadEnd` to all existing nodes.

**Key files likely affected**:

*Feature 04*:
- `src/types/index.ts` — `AppSettings` additions, `TreeNode.thinking`
- `src/db/database.ts` — Dexie V2 migration
- `src/stores/useSettingsStore.ts` — new settings fields + defaults merge
- `src/hooks/useStreamingResponse.ts` — thinking blocks, temperature, etc. in API params
- `src/components/detail/NodeDetailPanel.tsx` — thinking block display (collapsible)
- New: settings page component(s) at `/settings/advanced`

*Feature 23*:
- `src/stores/useTreeStore.ts` — `resendMessage`, `duplicateAndModifyAssistant`, `prefillDuplicateUser`, `retryFailedRequest`
- `src/components/tree/TreeNode.tsx` — context menu additions
- `src/components/chat/ChatInput.tsx` — prefill content support
- `src/types/index.ts` — `TreeNode.userModified`

### Batch 3: Model Cascade + System Prompt Cascade (Features 08 P1, 09)

**Parallel pair**. These features share the same cascade pattern (`resolveCascade<T>()`) and similar UX (per-node override in detail panel, "Set as branch default" button, visual chips). Planning them together ensures the shared utility is designed once and used consistently.

- **Feature 08 P1** adds `modelOverride` to `TreeNode`, a model selector dropdown in the detail panel and chat input, and the `resolveModel()` function. Phase 1 is Anthropic-only (flat dropdown, `providerId: 'anthropic'` hardcoded).
- **Feature 09** adds `systemPromptOverride` to `TreeNode`, a collapsible system prompt editor in the detail panel, and a visual indicator in the chat input.

Both features produce the override fields that Feature 10 consumes.

**Key files likely affected**:

*Shared*:
- New: `src/lib/tree.ts` — `resolveCascade<T>()` utility, `getPathToRoot()` (may already exist)
- `src/types/index.ts` — `TreeNode.modelOverride`, `TreeNode.systemPromptOverride`

*Feature 08 P1*:
- `src/hooks/useStreamingResponse.ts` — use resolved model instead of conversation default
- `src/components/detail/NodeDetailPanel.tsx` — model selector dropdown
- `src/components/chat/ChatInput.tsx` — model selector in input area
- New: `src/components/shared/ModelSelector.tsx`

*Feature 09*:
- `src/hooks/useStreamingResponse.ts` — use resolved system prompt
- `src/components/detail/NodeDetailPanel.tsx` — system prompt editor
- `src/components/chat/ChatInput.tsx` — system prompt indicator

### Batch 4: Visual Indicators (Feature 10)

**Solo, last**. Depends on Features 08 and 09 — it reads `modelOverride` and `systemPromptOverride` fields to determine which indicators to display. Also integrates UI Fix 3 (error node styling) and UI Fix 15 (path highlighting).

This is primarily a rendering/display feature with no data model changes. It adds visual treatments (orange ring, model/system/settings chips, error borders, path edge highlighting) to existing tree nodes.

**Key files likely affected**:
- `src/components/tree/TreeNode.tsx` — indicator rendering, error styling
- New: `src/lib/indicators.ts` — `getNodeIndicators()` function
- `src/utils/treeLayout.ts` (or equivalent) — edge styling for path highlighting
- `src/components/detail/NodeDetailPanel.tsx` — indicator display in detail view

---

## Decision 3: Dexie Migration Timing

Per the coordinated migration plan (`_dexie-migrations.md`), all Tier 1 features are covered by **Dexie Version 2**. The V2 migration is implemented in Batch 2 (when the first data model changes land) and covers all Tier 1 schema needs:

- `nodeType: 'standard'` default on all nodes (ADR-001)
- `userModified: false` default (Feature 23)
- `starred: false` and `deadEnd: false` defaults (forward-compat for Tier 2)
- No index changes (V2 schema string is identical to V1)

AppSettings growth (thinking, temperature, etc.) is handled at the store level via defaults merge, not Dexie schema.

---

## Decision 4: Settings Page Timing

Feature 02 establishes the `/settings/:section?` route, but the settings page starts minimal — only the General tab with existing settings (API key, default model, theme). Subsequent features add their tabs:

- Batch 2 adds the **Advanced** tab (Feature 04: thinking, temperature, etc.)
- Batch 3 adds the **Prompts** tab (Feature 09: default system prompt)
- Later tiers add Providers, Search, Research, Pricing tabs

The settings page component should be designed for incremental tab addition from the start.

---

## Summary

```
Batch 1: Feature 02 (GUID Routing)
   └── Restructures app layout, establishes routing

Batch 2: Feature 04 (Advanced Config) + Feature 23 (Resend/Duplicate)
   └── Dexie V2 migration, settings expansion, tree operations

Batch 3: Feature 08 P1 (Model Cascade) + Feature 09 (System Prompt Cascade)
   └── resolveCascade<T>() utility, per-node overrides

Batch 4: Feature 10 (Visual Indicators)
   └── Reads override fields from Batches 2-3, adds visual treatments
```

Feature 00 (Backend) deferred until Tier 2/3 features require it.
