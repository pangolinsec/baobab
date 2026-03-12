# ADR-017: Zustand Selector Discipline

**Date**: 2026-02-20 (updated 2026-02-21)
**Status**: Accepted
**Context**: The app crashed with a white screen ("Maximum update depth exceeded" / "getSnapshot should be cached") when loading any conversation. Investigation traced the root cause to two categories of selector misuse. The first (addressed 2026-02-20) was eight call sites across six components that called `useTreeStore()`, `useProjectStore()`, or `useSearchStore()` without selectors — whole-store subscriptions that re-rendered on every mutation. The second (addressed 2026-02-21) was a selector that *had* a selector function but returned a new `[]` literal on every `getSnapshot()` call, which `useSyncExternalStore` treated as a torn snapshot. Both triggered cascading re-renders that hit React's update depth limit. Additionally, three call sites in search-related components were missed by the initial fix because they are only mounted when sidebar search is active — a code path not exercised during verification.

---

## Decision 1: Use Individual Primitive Selectors for All Reactive State

**Problem**: Calling `useStore()` without a selector (e.g., `const { nodes, selectNode } = useTreeStore()`) subscribes the component to the entire state object. Any `set()` call — even to an unrelated field — creates a new state object reference, triggering a re-render. When multiple async operations complete during the same render cycle, this creates a cascade that exceeds React's update depth limit.

**Options considered**:

1. **Individual selectors per field**: `const nodes = useTreeStore(s => s.nodes)` — subscribes only to that slice, re-renders only when the selected value changes by `Object.is` comparison.
2. **Shallow equality selector**: `const { nodes, selectedNodeId } = useTreeStore(s => ({ nodes: s.nodes, selectedNodeId: s.selectedNodeId }), shallow)` — groups related fields into one call with shallow comparison.
3. **Keep whole-store destructuring but debounce effects**: Wrap `useEffect` calls in `setTimeout` or use `useRef` to break the synchronous render loop.

**Decision**: Option 1 — individual selectors per field.

**Rationale**: Individual selectors are the simplest, most predictable pattern. Each selector returns a primitive or stable reference, so `Object.is` comparison is sufficient — no need for `shallow` equality. The one-selector-per-line style is already used consistently in `ChatInput.tsx`, `ConversationView.tsx`, `NodeDetailPanel.tsx`, and `useTreeLayout.ts`, making this a convention alignment rather than a new pattern. Shallow selectors (option 2) add cognitive overhead for grouping decisions and require importing `shallow` from Zustand. Debouncing (option 3) is a band-aid that doesn't address the fundamental subscription problem.

**Impact**: Six component files changed. No behavioral changes — components render the same UI, just with fewer unnecessary re-renders.

---

## Decision 2: Access Store Actions via getState() Instead of Selectors

**Problem**: Store actions (functions like `selectNode`, `deleteSubtree`) are stable references in Zustand — they never change between renders. However, when destructured from `useStore()` without a selector, they still cause the component to subscribe to the full state. When used as `useEffect` dependencies (e.g., `[loadConversations]`), the effect itself is correct (the reference is stable), but the full-store subscription causes the component to re-render on every unrelated state change, amplifying the cascade.

**Options considered**:

1. **Individual selectors for actions**: `const selectNode = useTreeStore(s => s.selectNode)` — subscribes but returns stable reference, so no extra re-renders in practice.
2. **`getState()` in callbacks/effects**: `useTreeStore.getState().selectNode(...)` — no subscription at all, always gets the latest state.
3. **`getState()` at component top level**: `const { selectNode } = useTreeStore.getState()` — no subscription, runs on every render but returns stable references.

**Decision**: Option 2 for actions used inside callbacks and effects. Option 3 for components that only need actions (no reactive state from the store), such as `ThreadMessage` and `BranchIndicator`.

**Rationale**: Using `getState()` inside callbacks is actually preferable to closure-captured action references — it always accesses the latest state, avoiding stale closure bugs. For components that only need actions (all data comes via props), destructuring from `getState()` at the top level is concise and correct since the function references are stable. Individual selectors for actions (option 1) would work but add unnecessary subscription overhead for values that never change.

**Impact**: All `useEffect` hooks that previously depended on store actions (e.g., `[loadConversations, loadProjects]`, `[clearMultiSelect]`) now use `[]` or reduced dependency arrays, with the action accessed via `getState()` inside the effect body.

---

## Decision 3: Selectors Must Return Stable References (No Inline `[]` or `{}`)

**Problem**: A selector can pass the "has a selector function" check but still cause infinite re-renders if it returns a new object or array literal on every call. In `ChatInput.tsx`, the selector `useProjectStore((s) => projectId ? s.getProjectFiles(projectId) : [])` returned a new `[]` every time `projectId` was falsy. `useSyncExternalStore` calls `getSnapshot()` twice per render cycle (render phase + commit phase). Since `Object.is([], [])` is `false`, React detected a "torn snapshot" and re-rendered — creating the same infinite loop as a whole-store subscription. The store method `getProjectFiles` compounded this by also doing `|| []` internally, so even a truthy `projectId` with no fetched files triggered the same bug.

**Decision**: Selectors must never return inline literals (`[]`, `{}`) as fallback values. Use module-level constants instead, and access raw state fields rather than store methods that create new references.

```typescript
// Before (BROKEN): new [] on every getSnapshot() call
const projectFiles = useProjectStore((s) => projectId ? s.getProjectFiles(projectId) : []);

// After (FIXED): stable EMPTY_FILES reference, direct state access
const EMPTY_FILES: ProjectFile[] = [];
const projectFiles = useProjectStore((s) => projectId ? (s.filesByProject[projectId] ?? EMPTY_FILES) : EMPTY_FILES);
```

**Rationale**: The initial ADR-017 fix (Decisions 1–2) searched for `useStore()` calls without any argument. This missed selectors that had a function argument but returned unstable values. The `[]` literal is particularly insidious because it passes TypeScript checks, looks correct at a glance, and only manifests at runtime when `useSyncExternalStore` compares snapshot references. The general rule: every possible return path from a selector must return either a primitive, an existing state reference, or a module-level constant.

**Impact**: `ChatInput.tsx` updated with `EMPTY_FILES` constant. Three additional missed call sites fixed: `SearchResults.tsx` and `SearchFilters.tsx` (whole-store subscriptions only mounted during sidebar search), `Sidebar.tsx` (bare `clearGlobalSearch` reference left undefined after the initial refactor).

---

## Lessons: Why the Initial Fix Was Incomplete

The first pass (2026-02-20) fixed 8 call sites but missed 4 more for two reasons:

1. **Grep was too narrow.** The search targeted `useStore()` with no argument. It did not audit selectors that *had* arguments but returned unstable values (the `[]` literal in `ChatInput`).

2. **Verification only covered the happy path.** The crash happened immediately on page load, so once the app loaded successfully, the fix appeared complete. `SearchResults`, `SearchFilters`, and the sidebar search X button are only rendered when sidebar search is active — a path not exercised during post-fix verification. A more thorough check would have grepped for ALL `useStore()` calls (with or without selectors) and audited each selector's return paths for reference stability.

---

## Spec Files Updated

No spec files were updated in this session.
