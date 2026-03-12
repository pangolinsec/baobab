---
title: Theming
parent: Development
nav_order: 4
---

# Theming

Baobab uses a warm, Claude-inspired design language with light and dark modes.

## Design language

- **Warm cream/beige palette** with terra cotta accents
- **Rounded cards** with soft borders
- **Smooth bezier edges** connecting tree nodes
- **Inter font** as the primary typeface

## How themes work

Themes are implemented via CSS custom properties defined in `src/index.css`:

```css
:root {
  --color-bg: #FAF9F6;
  --color-accent: #D97757;
  --color-text: #3D3229;
  /* ...more variables */
}

.dark {
  --color-bg: #1C1917;
  --color-accent: #D97757;  /* accent stays the same */
  --color-text: #E0D5CB;
  /* ...more variables */
}
```

The `.dark` class is toggled on the `<html>` element based on the theme setting in `useSettingsStore`.

## Using theme colors in components

Reference CSS variables via Tailwind's arbitrary value syntax:

```tsx
<div className="bg-[var(--color-card)] border border-[var(--color-border)]">
  <p className="text-[var(--color-text)]">Hello</p>
  <button className="bg-[var(--color-accent)] text-white">
    Click me
  </button>
</div>
```

This automatically switches between light and dark values when the theme changes — no `dark:` prefix needed.

## Adding new theme colors

1. Add the variable to both `:root` and `.dark` in `src/index.css`
2. Use `var(--color-your-new-color)` in components
3. Follow the warm tone palette — avoid cool grays or bright neon colors

## React Flow theming

React Flow edge and node styles are overridden in `src/index.css`:

```css
.react-flow__edge-path {
  stroke: var(--color-edge);
  stroke-width: 2;
}

.react-flow__edge.active-path .react-flow__edge-path {
  stroke: var(--color-accent);
  stroke-width: 3;
}
```

The MiniMap's `nodeColor` prop is a JavaScript value (not CSS), so it reads the theme from `useSettingsStore` directly.
