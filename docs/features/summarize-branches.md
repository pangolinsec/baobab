---
title: Summarize Branches
parent: Features
nav_order: 11
---

# Summarize Branches

Generate LLM-powered summaries of branch content.

## Usage

1. Right-click any node with descendants
2. Select **"Summarize branch"**
3. In the dialog, choose:
   - Which model to use for summarization
   - The summarization prompt (editable, with a sensible default)
4. Click **Summarize**

Baobab collects all messages in the branch (from the selected node to the leaves), formats them as text, and sends them to the chosen model with the summarization prompt.

## Result

A new **summary node** is created as a child of the selected node. It has:

- `nodeType: 'summary'`
- A blue-gray left border and background tint
- A **"Summary"** badge
- The generated summary as content

Summary nodes are visually distinct from regular messages so you can tell at a glance that they're generated meta-content rather than conversation turns.

## Customization

The default summarization prompt can be configured in **Settings > Prompts**. You can also edit the prompt per-summarization in the dialog.

## Direction

By default, summarization collects content **downward** from the selected node (all descendants). The summarizer recursively collects all messages in the subtree.
