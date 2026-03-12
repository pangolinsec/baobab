---
title: Dead-End Branches
parent: Features
nav_order: 10
---

# Dead-End Branches

Flag unproductive branches to visually de-emphasize them.

## Usage

Right-click a node and select **"Flag as dead end"** to mark it. This:

- Reduces the **opacity** of the node and all its descendants
- Dims the **edges** leading to dead-end nodes
- Signals to you (and your future self) that this branch wasn't productive

Toggle the flag off via the same context menu option.

## Detection algorithm

Dead-end status is computed with a two-pass algorithm:

1. **Bottom-up**: A node is "effectively dead" if it's explicitly flagged OR all its descendant paths lead to dead-end nodes
2. **Top-down**: Dead-end status inherits from parent to children

This means flagging a single node high in the tree dims the entire subtree below it.

## Visual treatment

- **Nodes**: opacity reduced (e.g., 0.4)
- **Edges**: stroke opacity reduced (0.3)
- **Detail panel**: dead-end badge shown when selected

Dead-end dimming stacks with other visual treatments. For example, an error node in a dead-end branch has both a red border and reduced opacity.
