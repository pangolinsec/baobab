# ADR-005: Spec Review Refinements

**Date**: 2026-02-19
**Status**: Accepted
**Context**: Full cross-spec review to identify gaps in implementation detail, cross-feature conflicts, and missing architectural conventions.

## Motivation

A comprehensive review of all feature specs and ADRs identified six areas where implementers would hit ambiguity, missing detail, or duplicated patterns that should be shared. None of these are blocking conflicts — they are refinements that prevent rework during implementation.

## Decisions

### Decision 1: Search in Thread View (Features 20 + 21)

**Problem**: Feature 20 specifies per-chat search (`Ctrl+F`) with tree-node highlight rings and viewport panning. Feature 21 introduces thread view but doesn't specify how search renders there. A linear scrollable thread needs different visual treatment than a graph viewport.

**Resolution**: Added a "Per-Chat Search in Thread View" section to Feature 20 specifying:
- Yellow/amber left border + background tint on matching message cards (instead of highlight rings)
- `scrollIntoView` navigation (instead of viewport panning)
- Search scoped to current thread path only (not entire tree)
- View-switching behavior: search results transfer between views with appropriate visual adaptation

**Files modified**: `Features/20-search.md`, `Features/21-thread-view.md` (cross-reference)

### Decision 2: Multi-Select as Shared Component (Features 16 + 17)

**Problem**: Features 16 (Merge) and 17 (Compare) both independently specify `Ctrl+Click` multi-select with identical interaction patterns and identical action menu mockups. Without a shared component spec, these would be implemented twice with inevitable divergence.

**Resolution**: Added "Multi-Select Architecture" to `_overview.md` Architectural Conventions specifying:
- Shared `MultiSelectState` in transient Zustand slice
- Shared `MultiSelectPanel.tsx` component replacing the detail panel
- Multi-select mode behavior (enter, exit, selection limits)
- Feature-specific action buttons conditionally rendered based on which features are available

Features 16 and 17 updated with cross-references to the shared spec. Their action menu mockups remain as documentation but the implementation should use the shared component.

**Files modified**: `Features/_overview.md`, `Features/16-merge-branches.md`, `Features/17-compare-classify.md`

### Decision 3: Cascade Traceability (Feature 10)

**Problem**: The cascade system (`resolveCascade<T>()`) elegantly resolves effective values for model and system prompt, but when users see unexpected model usage, there's no way to understand *which* cascade level determined the value without manually inspecting ancestor nodes.

**Resolution**: Added "Cascade Traceability" section to Feature 10 specifying:
- Tooltip on model chip showing all four cascade levels (global, chat, branch, message) with their values
- The winning level marked with `←` and the source node's content preview for branch overrides
- Similar tooltip on `[system]` chip
- `CascadeTrace` type and `resolveModelWithTrace()` function signature
- Computed lazily (on hover) to avoid render-time performance overhead

**Files modified**: `Features/10-visual-indicators.md`

### Decision 4: Error Response Format (Feature 00)

**Problem**: Feature 00 defines API endpoints and request formats but not error response format. Without a standard error shape, each endpoint would use a different format, and the frontend `backendFetch` helper would need per-endpoint error parsing.

**Resolution**: Added "Error Response Format" section to Feature 00 specifying:
- Standard `ApiError` shape: `{ error: string, code?: string, details?: unknown }`
- HTTP status code usage table (400, 404, 413, 422, 500)
- Concrete examples for common errors
- Updated `backendFetch` with a `BackendError` class that parses the structured response

**Files modified**: `Features/00-backend-architecture.md`

### Decision 5: Feature Gating Hook (cross-cutting)

**Problem**: Features 05, 06, 13, 17, and 19 all independently check `isBackendAvailable()` to hide/degrade UI. Without centralization, feature gating logic drifts across the codebase, capability checks are duplicated, and adding new backend-dependent features requires finding all the places where gating logic lives.

**Resolution**: Added "Feature Gating" section to `_overview.md` specifying:
- `useFeatureGating()` hook returning a `FeatureCapabilities` map
- `useBackendStatus()` hook for cached health check (ping once on load, re-check on tab refocus)
- Each capability maps to specific features and their requirements
- Components use the capabilities map rather than raw `isBackendAvailable()` checks

This does not change any feature's behavior — it centralizes the gating pattern that each spec already describes independently.

**Files modified**: `Features/_overview.md`

### Decision 6: File Upload Limits (Feature 13)

**Problem**: Feature 13 warns about large file *injection* (>50K tokens) but has no upload size limits. Without limits, users could upload multi-hundred-megabyte files that would exhaust disk space, IndexedDB quotas, or processing time (tesseract.js on a 50MB image).

**Resolution**: Added "File Size Limits" table to Feature 13 specifying:
- 10 MB per-file maximum (enforced at both frontend pre-upload and backend 413 response)
- 50 MB per-project total (disk mode); 20 MB per-project in browser-only mode (IndexedDB constraints)
- Clarified that the existing >50K token injection warning is separate from the upload limit (a 2 MB text file is under the upload limit but may still produce too many tokens)

**Files modified**: `Features/13-project-knowledge.md`

## Cross-References

- ADR-001: Decisions 2 (tool nodules), 7 (cascade resolution), 10 (merge overlay edges) — unchanged, referenced by new specs
- ADR-002: Decision 6 (yellow/amber search highlight) — extended to thread view variant
- ADR-004: Decision 1 (providerId vs providerOverride) — cascade traceability builds on this distinction
- `Features/_dexie-migrations.md` — no changes needed; these refinements don't affect schema

## Specs NOT Modified

The following specs were reviewed and found complete:
- Features 02, 04, 05, 06, 07, 08, 09, 11, 12, 15, 19, 22, 23, 24
- UI Fixes 1, 3, 6, 15
- Dexie migration plan
