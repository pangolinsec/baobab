---
title: Manual Tree Editing
parent: Features
nav_order: 16
---

# Manual Tree Editing

Create and modify tree nodes beyond what normal conversation flow allows.

## Duplicate & Edit (extended)

The duplicate-and-edit feature (Feature 23) has been extended to support:

- **Tool calls** — duplicate assistant nodes that contain tool calls, with an editor for modifying tool name, input, and result
- **Thinking blocks** — duplicate nodes with extended thinking content, with an editor for the thinking text

Access via the context menu: right-click a node and select "Duplicate & Edit".

## Manual node creation

Create arbitrary user or assistant nodes at any point in the tree. Access via the context menu: right-click a node and select "Add child node".

The modal allows:

- Choosing the role (user or assistant)
- Writing the message content
- Optionally setting the model name

This is useful for constructing synthetic conversation trees, testing prompt variations, or manually adding context the model didn't generate.

## Implemented phases

| Phase | Description | Status |
|:------|:------------|:-------|
| A | Extended duplicate-and-edit (tool calls + thinking) | Done |
| B | Manual node creation | Done |
| C | Knowledge mode toggle relocation (project-level) | Done |

See [Feature 28 spec](https://github.com/OWNER/baobab/blob/main/Features/28-manual-tree-editing.md) for the full design.
