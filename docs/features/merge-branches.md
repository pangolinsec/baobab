---
title: Merge Branches
parent: Features
nav_order: 15
---

# Merge Branches

Combine insights from two conversation branches into a single synthesis.

## Usage

1. **Select two nodes**: `Ctrl+Click` (or `Cmd+Click` on Mac) two nodes in different branches
2. The **multi-select panel** appears showing both selections and their common ancestor
3. Click **"Merge"**
4. In the merge dialog, choose:
   - **Merge mode**: Summarize or Full Context
   - **Model** to generate the synthesis
   - **Merge prompt** (editable)
5. Click **Merge**

## Merge modes

### Summarize

Both branches are condensed before being sent to the model. Produces a shorter, more focused synthesis. Good for long branches where you want the key points combined.

### Full context

Both branches are included in full in the merge prompt. Produces a more detailed synthesis but uses more tokens. Good for shorter branches where every detail matters.

## Result

A merge creates two new nodes:

1. A **synthetic user node** with `nodeType: 'merge'` — contains the merge prompt, displayed with a dashed border
2. An **assistant response** — the model's synthesis of both branches

Both nodes are attached to the **common ancestor** of the two selected nodes. The merge node records `mergeSourceIds` pointing to the original branches.

Merge overlay edges (dashed blue-gray lines) connect the merge node to its source branches in the tree visualization.

## Customization

The default merge prompt can be configured in **Settings > Prompts**.
