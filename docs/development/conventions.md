---
title: Conventions
parent: Development
nav_order: 3
---

# Coding Conventions

## CSS & Theming

**Never hardcode hex color values in components.** Use `var(--color-*)` CSS variable references instead.

```tsx
// Good
className="bg-[var(--color-bg)] text-[var(--color-text)]"

// Bad
className="bg-[#FAF9F6] dark:bg-[#1C1917] text-[#3D3229] dark:text-[#E0D5CB]"
```

CSS variables are defined in `src/index.css` with `:root` (light) and `.dark` (dark) variants. One class handles both themes — no `dark:` prefixes needed in most cases.

### Exceptions for `dark:` prefix

- Cases where light and dark values don't map to a single variable (rare)
- `text-white` on accent backgrounds (not theme-dependent)
- Semantic colors (red/emerald for validation) that aren't part of the theme palette

### Theme colors

| Variable | Light | Dark | Purpose |
|:---------|:------|:-----|:--------|
| `--color-bg` | `#FAF9F6` | `#1C1917` | Main background |
| `--color-bg-secondary` | `#F0EBE4` | `#2A2520` | Secondary background |
| `--color-accent` | `#D97757` | `#D97757` | Terra cotta accent |
| `--color-text` | `#3D3229` | `#E0D5CB` | Primary text |
| `--color-text-secondary` | `#6B5F55` | `#A89B91` | Secondary text |
| `--color-card` | `#FFFFFF` | `#2A2520` | Card background |
| `--color-user-card` | `#F5EDE8` | `#3D2E24` | User message card |
| `--color-border` | `#E0D5CB` | `#3D3229` | Borders |
| `--color-edge` | `#C4B5A6` | `#5C4F44` | Tree edges |
| `--color-reply-target` | `#5B8A72` | `#7DB89A` | Reply target indicator |

## Components

- **Tailwind CSS v4** for all styling — utility classes only, no CSS modules
- **Icons** from `lucide-react`
- **No `dark:` prefix** in most cases — CSS variables handle theme switching automatically
- **MiniMap `nodeColor`** is a JS prop (not CSS) — requires `useSettingsStore` theme check

## TypeScript

- Strict mode enabled
- All types defined in `src/types/index.ts`
- Use explicit return types on exported functions
- Prefer interfaces over type aliases for object shapes

## State management

- Zustand stores are the single source of truth for application state
- Every data mutation writes through to IndexedDB
- Transient UI state (hover, focus, animation) stays in component state
- Selection state (multi-select, context menu) lives in Zustand

## Commits

Commit messages should summarize **what changed and why**. The "why" matters most — the diff shows the code, but the commit message explains the reasoning.

```
# Good
Fix cascade resolution skipping null overrides

When a node had an explicit null override, the cascade
would skip it instead of resetting to the default. This
caused inherited overrides to "stick" even after removal.

# Bad
Update tree.ts
```
