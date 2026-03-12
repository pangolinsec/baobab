---
title: Thread View
parent: Features
nav_order: 13
---

# Thread View

A linear, chat-like alternative to the tree graph view.

## Concept

While the tree view excels at showing the overall conversation structure, sometimes you want to read a single thread as a flowing conversation. Thread view shows the path from root to the selected node as a scrollable list of messages.

## Switching views

Toggle between **Tree** and **Thread** view using the view mode selector in the toolbar. The currently selected node determines which path is displayed in thread view.

## Thread view features

- **Full markdown rendering** with syntax highlighting
- **Role-based styling**: user and assistant messages are visually distinct
- **Thinking content**: expandable sections for extended thinking
- **Action bar**: reply, star, copy, and other actions on each message

## Branch indicators

When the thread passes through a node with multiple children (a branching point), a **branch indicator** appears:

```
┌─────────────────────────────────────┐
│  2 other branches from here         │
│    └ "Follow-up question" (5 msgs)  │
│    └ "Alternative approach" (3 msgs)│
└─────────────────────────────────────┘
```

Clicking a branch in the indicator switches to that branch's thread.

## Reply

The chat input works the same in thread view as in tree view — messages are sent to the current reply target node.
