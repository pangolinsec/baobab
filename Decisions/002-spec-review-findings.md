# ADR-002: Spec Review Findings and Decisions

**Date**: 2026-02-19
**Status**: Accepted
**Context**: After the spec reconciliation (ADR-001), a comprehensive review of all 22 feature specs identified remaining conflicts, cross-cutting concerns, and implementation gaps. This ADR records the decisions made to resolve them.

---

## Decision 1: Lazy @filename Resolution in Project Knowledge

**Problem**: Feature 13 originally specified that `@filename.ext` references in chat messages would be resolved (expanded to full file text) at send time and stored in `TreeNode.content`. This means every message referencing the same file duplicates the entire file content in IndexedDB.

**Options considered**:

1. **Eager resolution** (original spec): Resolve `@filename.ext` to full text at send time, store the expanded content in `TreeNode.content`.
2. **Lazy resolution**: Store the unresolved `@filename.ext` reference in `TreeNode.content`, resolve at API-call time only.

**Decision**: Option 2 — lazy resolution.

**Rationale**: A 50K-token file referenced by 10 messages would store 500K tokens of duplicate content with eager resolution. Lazy resolution stores only the short reference string (`@filename.ext`) and fetches the file text on demand when building the API request. The display layer renders references as styled pills/chips and can fetch the resolved content for the detail panel on demand.

**Impact**: Feature 13 updated. `TreeNode.content` stores unresolved references. The `resolveFileReferences()` function is called at API-call time, not at storage time.

---

## Decision 2: Coordinated Dexie Migration Plan

**Problem**: Multiple features independently specify Dexie schema version bumps. If features are implemented in parallel or out of order, version numbers will collide.

**Options considered**:

1. **Per-feature version bumps**: Each feature bumps the version when implemented, ad hoc.
2. **Coordinated version plan**: Pre-assign version numbers mapped to feature tiers.

**Decision**: Option 2 — coordinated plan with 5 versions.

**Rationale**: Pre-assigning versions prevents merge conflicts and ensures upgrade functions run in the correct order. Grouping by tier creates logical migration boundaries and aligns with the implementation priority order.

**Migration versions**:

| Version | Features | Key Changes |
|---------|----------|-------------|
| 1 (current) | Baseline | — |
| 2 | 04, 08 P1, 09, 23, NodeType | Upgrade adds defaults to all nodes |
| 3 | 11, 12, 24 | `*tags` multi-entry index, `starred` index |
| 4 | 07, 08 P2, 05, 13, 15, 16, 22 | `projectId` index, `nodeType` index, `projects` table |
| 5 | 06, 19 | `researchRuns`, `researchNodes`, `embeddings` tables |

**Impact**: New cross-cutting document `Features/_dexie-migrations.md`. Individual feature specs defer to this plan for version numbers. AppSettings growth is handled at the store level via defaults merge, not Dexie schema.

---

## Decision 3: Search Filters — Content Searches, Not Role Filters

**Problem**: Feature 20 defined filter options for "tool" and "thinking" as role filters, but `MessageRole` is `'user' | 'assistant'` only (ADR-001 Decision 2). Tool calls are metadata on assistant nodes; thinking is a field on `TreeNode`. Using these as role filters would conflict with the type system.

**Options considered**:

1. **Expand MessageRole**: Add `'tool'` and `'thinking'` as roles (contradicts ADR-001 Decision 2).
2. **Content-type filters**: Keep `MessageRole` as-is, treat "tool" and "thinking" as content/metadata search options.

**Decision**: Option 2 — content-type filters.

**Rationale**: Tool calls and thinking are not separate tree nodes and not separate roles. They are data on assistant nodes. The search function searches `node.toolCalls[].result` and `node.thinking` respectively, controlled by `includeToolCalls` and `includeThinking` boolean options, not by the `roles` filter.

**Impact**: Feature 20 updated. Search function signature now includes `includeToolCalls?: boolean` and `includeThinking?: boolean` as separate options from the `roles` filter.

---

## Decision 4: Settings Route and Tab Assignment

**Problem**: ADR-001 Decision 11 defined settings as a full routed page at `/settings/:section` with tab names listed, but Feature 02's routing table omitted this route, and no document specified which feature's settings belong to which tab.

**Decision**: Add `/settings/:section?` to the routing table (Feature 02) and define a canonical tab assignment table in `_overview.md`.

**Tab assignment**:

| Tab | Content | Source Feature(s) |
|-----|---------|-------------------|
| General | API key, default model, theme | Existing + Feature 04 |
| Providers | Provider configs (API keys, endpoints, model lists) | Feature 07 |
| Advanced | Thinking toggle, temperature, max tokens, top-p, top-k | Feature 04 |
| Prompts | Default system prompt, summarization prompt, merge prompt | Features 09, 15, 16 |
| Search | Search provider selection, API keys (Tavily, Bing) | Feature 05 |
| Research | Orchestrator prompt, synthesis prompt, sub-agent configs, max iterations | Feature 06 |
| Pricing | Price table, display preferences | Feature 22 |
| About | Version, links, credits | — |

**Impact**: Feature 02 routing table updated. `_overview.md` Settings Architecture section updated with tab assignment table.

---

## Decision 5: sqlite-vec Over sqlite-vss

**Problem**: Feature 19 (RAG) specified `sqlite-vss` as the vector search extension for SQLite, but `sqlite-vss` was effectively abandoned in 2025.

**Decision**: Use `sqlite-vec` (the actively maintained successor).

**Rationale**: `sqlite-vec` is maintained by the same author, has a more stable API, and is the recommended replacement. No functional difference for our use case.

**Impact**: Feature 19 updated.

---

## Decision 6: Search Highlight Visual Channel

**Problem**: Feature 20 uses a yellow/amber highlight ring for per-chat search result nodes, but this visual treatment was not reserved in the Visual Channels Convention table, risking future collisions.

**Decision**: Reserve `Node highlight ring (yellow/amber)` for per-chat search result highlighting (Feature 20) in the Visual Channels Convention table.

**Impact**: `_overview.md` visual channels table updated.

---

## Decision 7: UI Fixes Documentation

**Problem**: Feature specs reference "UI Fix 3", "UI Fix 6", "UI Fix 15" etc. as dependencies, but no spec files exist for these fixes. An implementer encountering these references has nowhere to look.

**Options considered**:

1. **Inline descriptions**: Copy the behavioral spec into every referencing feature spec.
2. **Central reference file**: Create a single `_ui-fixes.md` with behavioral specs for each referenced fix.
3. **Full feature specs**: Write complete feature specs for each UI fix.

**Decision**: Option 2 — central reference file.

**Rationale**: A single file avoids duplication while being lighter-weight than full feature specs. UI fixes are small, well-scoped changes that don't need the full feature spec treatment (data model, store changes, edge cases). The reference file documents the behavioral contract that feature specs depend on.

**Fixes documented**:

| Fix | Description | Status |
|-----|-------------|--------|
| UI Fix 1 | Empty state / onboarding landing page | Not implemented (ships with Feature 02) |
| UI Fix 3 | Error node visual distinction (red border, no reply target) | Not implemented (ships with Feature 10) |
| UI Fix 6 | Selection / reply target decoupling | Implemented (commits `005d209`, `275e3d6`) |
| UI Fix 15 | Active path highlighting (edge color/thickness) | Not implemented (ships with Feature 10) |

**Impact**: New document `Features/_ui-fixes.md`. Specs that reference UI fixes now link to this file.

---

## Decision 8: Feature Number Gap Documentation

**Problem**: Features 01, 03, 14, and 18 are absent from the spec set, creating confusion about whether specs are missing or were intentionally skipped.

**Decision**: Document the gaps in `_overview.md` with explanations.

**Explanations**:

| Number | Reason |
|--------|--------|
| 01 | Model selector with Haiku default + API key validation — already implemented in initial codebase |
| 03 | Visual/UI/UX improvements — deferred as too broad; specific improvements captured in individual specs |
| 14 | Socratic elicitation — deferred (ADR-001 Decision 13) |
| 18 | Combined with Feature 17 (comparing and classifying was originally scoped as two features) |

**Impact**: `_overview.md` updated with Feature Number Gaps section.

---

## Spec Files Updated

| File | Changes |
|------|---------|
| `Features/_overview.md` | Decisions 4, 6, 7, 8 |
| `Features/_dexie-migrations.md` | Decision 2 (new file) |
| `Features/_ui-fixes.md` | Decision 7 (new file) |
| `Features/02-guid-routing.md` | Decision 4 |
| `Features/06-research-agent.md` | Implementation notes (deferred order, JSON fallback, cost estimation, cancellation) |
| `Features/13-project-knowledge.md` | Decision 1 |
| `Features/19-rag.md` | Decision 5, RAG/cascade open question |
| `Features/20-search.md` | Decision 3 |
| `Features/21-thread-view.md` | UI Fix 6 link + implementation status |
