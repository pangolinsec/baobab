# Project Detail Page + System Prompt Cascade — Code Review

**Date**: 2026-02-21
**Scope**: All files from the "project detail page + project-level system prompt" commit `94634ef`
**Fix pass 1**: 2026-02-21 — addressed B1, B2, I1, I2 in commit `a498df5`

---

## Summary

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| B1 | HIGH | FIXED | Zustand selector `\|\| []` instability in files selector |
| B2 | MEDIUM | FIXED | useEffect syncs on `[project]` object ref, overwrites in-progress edits |
| I1 | VERY LOW | FIXED | Missing `!project` guard on toggleInjectDescription |
| I2 | COSMETIC | FIXED | Dead `text-sm` class shadowed by `text-xs` |
| M1 | LOW | OPEN | `navigate(-1)` fails on direct navigation to project page |
| M2 | LOW | OPEN | No auto-redirect when project deleted while viewing detail page |

---

## Bugs

### ~~B1: Zustand selector `|| []` creates infinite re-render risk~~ FIXED

**File**: `src/components/pages/ProjectDetailPage.tsx:13`
**Pattern**: [00-cross-cutting §1 — Zustand selector instability]

```typescript
// BROKEN — new array reference every render
const files = useProjectStore((s) => s.filesByProject[projectId || ''] || []);
```

When `filesByProject[projectId]` is `undefined` (files not yet fetched), the `|| []` fallback creates a new array literal on every `getSnapshot()` call. `useSyncExternalStore` compares snapshots with `Object.is([], [])` → `false`, triggering re-render → infinite loop.

**Fix**: Module-level `const EMPTY_FILES: ProjectFile[] = []` + `?? EMPTY_FILES`.

---

### ~~B2: useEffect dependency on `[project]` overwrites in-progress edits~~ FIXED

**File**: `src/components/pages/ProjectDetailPage.tsx:20-26`

```typescript
useEffect(() => {
  if (project) {
    setDescription(project.description || '');
    setSystemPrompt(project.systemPrompt || '');
    setInjectDescription(project.injectDescription ?? false);
  }
}, [project]); // project is a new object ref after every updateProject
```

The selector `s.projects.find(p => p.id === projectId)` returns a project from the array. When `updateProject` fires (e.g., saving description on blur), it does `{ ...p, ...updatedFields }` plus a new `updatedAt` timestamp, creating a new object reference. This triggers the useEffect, which resets all three local state fields to their store values — overwriting any in-progress edits in sibling fields.

**Race condition scenario**: User edits description → blurs (save fires) → immediately starts editing system prompt → `updateProject` completes → useEffect fires → system prompt local state reset to old value.

**Fix**: Changed dependency to `[projectId]` so sync only runs on mount or navigation to a different project. Added eslint-disable comment explaining the intentional omission of `project`.

---

## Significant Issues

### ~~I1: toggleInjectDescription lacks `!project` guard~~ FIXED

**File**: `src/components/pages/ProjectDetailPage.tsx:49-54`

`saveDescription` and `saveSystemPrompt` both guard `if (!projectId || !project) return`, but `toggleInjectDescription` only checked `!projectId`. If the project were deleted between renders, this would call `updateProject` on a non-existent ID. In practice Dexie's `update()` is a no-op for missing IDs, so no crash — but inconsistent with sibling functions.

**Fix**: Added `!project` to the guard.

---

### ~~I2: Dead `text-sm` class on system prompt textarea~~ FIXED

**File**: `src/components/pages/ProjectDetailPage.tsx:135`

The className contained both `text-sm` and `text-xs`. In Tailwind, the later class wins (same specificity, later in stylesheet). The `text-sm` was dead/overridden — the intended style was `text-xs font-mono`.

**Fix**: Removed `text-sm`, reordered to `text-xs font-mono`.

---

## Minor / Open

### M1: `navigate(-1)` fails on direct navigation

**File**: `src/components/pages/ProjectDetailPage.tsx:70`

If the user navigates directly to `/project/<id>` (bookmark, URL bar), there's no previous history entry. `navigate(-1)` will navigate out of the app or do nothing. Consistent with `SettingsPage` which has the same pattern.

**Potential fix**: `navigate('/')` instead of `navigate(-1)`, or a conditional fallback.

---

### M2: No auto-redirect when project is deleted

**File**: `src/components/pages/ProjectDetailPage.tsx:61`

When a project is deleted from the sidebar while viewing its detail page, the `project` selector returns `undefined` and the "Project not found" fallback renders. The user is stuck on a dead page — no automatic redirect to `/`.

**Potential fix**: `useEffect` that calls `navigate('/')` when `project` becomes `undefined` after initial load (guard with a `hasLoaded` ref to distinguish "loading" from "deleted").

---

## Verified Correct

- **Streaming hook project lookups** (`useStreamingResponse.ts`): All three `useProjectStore.getState().getProject(...)` calls correctly use non-reactive point-in-time reads inside imperative callbacks. No selector instability risk.
- **`resolveSystemPrompt` cascade** (`tree.ts`): `??` chain correctly handles `undefined` (fall through) and `""` (explicit clear → line 104 converts to `undefined`). New 5th param is optional with default `undefined` — existing callers unaffected.
- **Dexie schema**: No migration needed — `systemPrompt` and `injectDescription` are non-indexed fields. Existing projects simply won't have them; code handles `undefined` with `|| ''` and `?? false`.
- **Sidebar gear icon** (`Sidebar.tsx`): `Settings` icon already imported. `stopPropagation` on wrapper div prevents toggle collapse on click. Navigation uses `navigate()` correctly.
