---
title: Tree Conversations
parent: Features
nav_order: 1
---

# Tree Conversations

The core feature of Baobab. Conversations are trees, not linear threads.

## Concept

Every assistant response is a potential branching point. You can reply to any node in the tree, creating a new branch that maintains full context from the root to that point. Each branch is an independent thread of thought, but they all share common ancestry.

```
         [User: "Explain X"]
              │
         [Assistant: "X is..."]
            ╱    ╲
   [User: "More        [User: "Compare
    detail on A"]        X with Y"]
        │                    │
   [Assistant: ...]     [Assistant: ...]
        │
   [User: "And B?"]
        │
   [Assistant: ...]
```

## Context building

When you send a message from node N, Baobab builds the API request by:

1. Walking from N to the root via `parentId` links
2. Collecting all nodes along the path
3. Reversing to get root-first order
4. Formatting as the standard `messages` array for the LLM API

The model sees a clean, linear conversation — it has no knowledge of the tree structure or other branches.

## Interaction model

### Selecting nodes

Click any node to **select** it. The detail panel on the right shows the full message content, metadata, and action buttons. The tree highlights the active path from root to the selected node.

### Replying

To branch from a node:

1. Click the node to select it
2. Click **"Reply here"** in the detail panel (or use the context menu)
3. Type your message and press Enter

The new message is attached as a child of the selected node, creating a branch if the node already has children.

### Navigation

- **Zoom**: scroll wheel or zoom controls
- **Pan**: click and drag on empty space
- **Fit**: click the fit-to-view button to see the entire tree
- **Collapse/expand**: click the collapse button on any node to hide its subtree
- **Minimap**: shows a bird's-eye view of the tree in the corner

## Tree visualization

Baobab uses [React Flow](https://reactflow.dev/) with [dagre](https://github.com/dagrejs/dagre) for automatic layout. Nodes are positioned top-to-bottom with edges showing parent-child relationships.

### Node appearance

- **User nodes**: lighter background tint
- **Assistant nodes**: white/card background
- **Selected node**: orange ring
- **Reply target**: green ring
- **Streaming node**: pulsing animation
- **Error node**: red border
- **Dead-end node**: reduced opacity
- **Multi-selected**: blue ring

### Edge appearance

- **Normal edges**: muted color, thin
- **Active path** (root → selected): accent color, thicker
- **Streaming edge**: animated dashes
- **Dead-end edge**: reduced opacity
- **Merge overlay**: dashed blue-gray lines to source nodes
