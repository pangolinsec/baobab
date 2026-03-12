# 16 — Merge Branches

## Summary

Select two messages from different branches that share a common ancestor. A merge operation creates a synthetic user message at the divergence point and attaches a merged response as a new branch. The merged branch is visually linked to the two source messages.

Two merge modes are available:

- **Summarize** (default): the LLM synthesizes both branches into a condensed response. Future replies from the merge point only see the summary — token-efficient but lossy.
- **Full context**: both branch transcripts are embedded verbatim in the synthetic user node. The LLM still generates a merged response, but future replies walking through the merge point have access to the complete original content — lossless but token-intensive.

## Priority

Tier 3.

## Dependencies

- **15 Summarize Branches**: shares the branch content collection logic and summary UX patterns.

## Merge Flow

### 1. Selection

User `Ctrl+Click` (or `Cmd+Click` on Mac) two nodes in the tree. This enters "multi-select mode" using the shared Multi-Select Architecture (see `_overview.md`):

- Both selected nodes get a blue highlight ring (distinct from the orange single-select ring).
- The detail panel is replaced by the shared **multi-select action menu** (`MultiSelectPanel`):

```
┌──────────────────────────────────────┐
│ 2 nodes selected                     │
│                                      │
│ Node A: "The key finding is..."      │
│   in Branch 1 (5 messages deep)      │
│                                      │
│ Node B: "Another perspective..."     │
│   in Branch 2 (3 messages deep)      │
│                                      │
│ Common ancestor:                     │
│   "Tell me about climate change"     │
│                                      │
│ [🔀 Merge] [📊 Compare] [Cancel]    │
└──────────────────────────────────────┘
```

### 2. Merge Dialog

Clicking "Merge" opens a dialog:

```
┌──────────────────────────────────────────┐
│ Merge Branches                      [X]  │
├──────────────────────────────────────────┤
│ Model: [Claude Haiku 4.5 ▾]             │
│                                          │
│ Mode: (•) Summarize  ( ) Full context    │
│                                          │
│ Merging Prompt:                          │
│ ┌──────────────────────────────────────┐ │
│ │ You are given two conversation       │ │
│ │ branches that diverged from a common │ │
│ │ point. Synthesize the key insights,  │ │
│ │ findings, and conclusions from both  │ │
│ │ branches into a unified, coherent    │ │
│ │ response. Resolve any contradictions │ │
│ │ and note where the branches agree.   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Branch 1: 5 messages (4,200 tokens est.) │
│ Branch 2: 3 messages (2,100 tokens est.) │
│                                          │
│                 [Cancel] [Merge]         │
└──────────────────────────────────────────┘
```

When "Full context" is selected, a warning appears below the mode selector:

```
⚠ Full context embeds both branch transcripts (~6,300 tokens) in
  the merge node. All future replies from this point will include
  the full content in their context window.
```

If the merge includes a previous full-context merge, the warning also notes the compounded size:

```
⚠ Full context embeds both branch transcripts (~14,800 tokens) in
  the merge node. This includes a previous full-context merge.
  All future replies from this point will include the full content
  in their context window.
```

The merging prompt is editable directly in the dialog (not just in settings). There's also a default that can be customized in Advanced Settings.

### 3. Execution

1. **Find the common ancestor**: walk both nodes to root; the first shared ancestor is the divergence point.
2. **Collect both branches**: from divergence point to each selected node (inclusive).
3. **Build the merge prompt** (same for both modes — the LLM always sees both full branches for the initial merge response):
   ```
   {user's merging prompt}

   Original question/context at the divergence point:
   {divergence node content}

   Branch 1:
   {branch 1 messages formatted as transcript}

   Branch 2:
   {branch 2 messages formatted as transcript}
   ```
4. **Create the synthetic user node**: a child of the divergence point node. Content depends on the merge mode:

   **Summarize mode** (default):
   ```
   [Merge of branches ending at "{nodeA content preview}" and "{nodeB content preview}"]
   ```

   **Full context mode** — the synthetic user node embeds the complete branch transcripts so they're available in future context:
   ```
   [Merge of branches ending at "{nodeA content preview}" and "{nodeB content preview}"]

   --- Branch 1 (full transcript) ---
   User: {message}
   Assistant: {message}
   ...

   --- Branch 2 (full transcript) ---
   User: {message}
   Assistant: {message}
   ...
   ```

   In both modes the node is marked as `nodeType: 'merge'`. The "synthetic" concept is derived from `nodeType + role`: a user-role node with `nodeType: 'merge'` is synthetic by definition (it was not typed by the user). See ADR-001 Decision 1.
5. **Stream the merge response**: an assistant node (child of the synthetic user) with the model's merged synthesis.
6. **Create visual links** from the synthetic user node to both source nodes.

## Data Model Changes

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  nodeType: 'merge';          // marks merge nodes (both the synthetic user request and the merged assistant response)
  mergeSourceIds?: string[];  // IDs of the two source nodes (for visual links), only on merge nodes
  mergeMode?: 'summarize' | 'full-context';  // only on merge nodes; determines context behavior
}
```

> **Note**: The `nodeType: 'merge'` replaces the previous `isSynthetic` and `isMerge` booleans. `NodeType` is a mutually exclusive union (`'standard' | 'summary' | 'merge'`). "Synthetic" is derivable: `nodeType !== 'standard' && role === 'user'` means the user node was generated, not typed. See ADR-001 Decision 1.

### Visual Link Edges (Overlay-Only)

In `buildReactFlowGraph`, merge source links are rendered as **dashed overlay edges** that are **excluded from dagre layout**. Dagre is a tree/DAG layout algorithm — feeding cross-branch edges into it would distort vertical positioning. Instead, merge edges are collected separately and combined with tree edges only for React Flow rendering. See ADR-001 Decision 10.

```typescript
// In buildReactFlowGraph (src/lib/tree.ts)
const treeEdges: Edge[] = [];   // parent-child relationships, fed to dagre
const overlayEdges: Edge[] = []; // merge links, NOT fed to dagre

// When processing a merge node:
if (node.nodeType === 'merge' && node.mergeSourceIds) {
  for (const sourceId of node.mergeSourceIds) {
    // Only render edge if source node is visible (not inside a collapsed subtree)
    if (visibleNodeIds.has(sourceId)) {
      overlayEdges.push({
        id: `merge-${node.id}-${sourceId}`,
        source: sourceId,
        target: node.id,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: '#7C9AB5',       // blue-gray, distinct from regular edges
          strokeWidth: 1.5,
          strokeDasharray: '6 3',  // dashed
        },
        data: { isMergeLink: true },
      });
    }
  }
}

// Feed only treeEdges to dagre:
const layoutNodes = computeDagreLayout(flowNodes, treeEdges);
// Combine both for React Flow rendering:
const allEdges = [...treeEdges, ...overlayEdges];
return { nodes: layoutNodes, edges: allEdges };
```

## Visual Treatment

### Synthetic User Node (Merge Request)

**Summarize mode:**

```
┌──────────────────────────────────────────┐
│ 🔀 Merge                                │  ← dashed border, blue-gray tint
│ Merge of "The key finding..." and        │
│ "Another perspective..."                 │
└──────────────────────────────────────────┘
```

**Full context mode:**

```
┌──────────────────────────────────────────┐
│ 🔀 Merge (full context)                 │  ← dashed border, blue-gray tint
│ Merge of "The key finding..." and        │
│ "Another perspective..."                 │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ ▸ Branch 1 transcript (4,200 tokens)     │  ← collapsed by default
│ ▸ Branch 2 transcript (2,100 tokens)     │
└──────────────────────────────────────────┘
```

In the tree node card, branch transcripts are collapsed behind expandable sections to avoid visual clutter. The full content is visible in the NodeDetailPanel.

Common styling for both modes:

- **Dashed border** (`border-dashed border-2 border-[#7C9AB5]`).
- **Blue-gray tint** background to distinguish from regular user messages.
- **🔀 icon** in the header instead of the user icon.

### Merged Response Node

Same styling as a summary node (feature 15) but with a merge icon:

```
┌──────────────────────────────────────────┐
│ 🔀 Merged Response             [Haiku]  │  ← blue-gray left border
│                                          │
│ Both branches converge on the finding    │
│ that climate change impacts...           │
└──────────────────────────────────────────┘
```

### Dashed Link Edges

Two dashed edges connect the two source nodes to the synthetic user node, visually showing where the merge came from. These are styled differently from regular tree edges:

- **Dashed line** (not solid).
- **Blue-gray color** (not warm gray).
- **Thinner** than regular edges (1.5px vs 2px).

## Finding the Common Ancestor

```typescript
function findCommonAncestor(
  nodeA: string,
  nodeB: string,
  nodes: Record<string, TreeNode>
): string | null {
  const ancestorsA = new Set<string>();
  let current: TreeNode | undefined = nodes[nodeA];
  while (current) {
    ancestorsA.add(current.id);
    current = current.parentId ? nodes[current.parentId] : undefined;
  }

  current = nodes[nodeB];
  while (current) {
    if (ancestorsA.has(current.id)) return current.id;
    current = current.parentId ? nodes[current.parentId] : undefined;
  }

  return null; // shouldn't happen if both nodes are in the same conversation
}
```

## Context Building for Merged Branches

The merged response node is interactive — the user can reply to it and continue the conversation. In both modes, the context walk follows the single `parentId` chain: merge response → synthetic user → divergence point → root. The tree invariant is preserved.

### Summarize mode

- The synthetic user node content is a short label (e.g., `[Merge of "..." and "..."]`).
- The merge response contains the model's synthesis.
- The two source branches are NOT included — they were already distilled into the merge response.
- Token-efficient: future context grows by only the merge label + synthesis length.

### Full context mode

- The synthetic user node content includes the complete transcripts of both branches.
- The merge response still contains the model's synthesis.
- The two source branches ARE available in future context — they're embedded in the synthetic user node.
- Token-intensive: future context grows by the full size of both branches + synthesis.

No special context-building logic is needed. The difference is entirely in what content the synthetic user node contains — the standard `parentId` walk picks it up automatically.

## Advanced Settings — Merge

```
Merge Settings
  Default Mode: (•) Summarize  ( ) Full context

  Default Merging Prompt:
  ┌──────────────────────────────────────┐
  │ You are given two conversation       │
  │ branches that diverged from a common │
  │ ...                                  │
  └──────────────────────────────────────┘
  [Reset to default]
```

## Edge Cases

- **Nodes from different conversations**: not allowed. Show an error: "Both nodes must be in the same conversation."
- **One node is an ancestor of the other**: the "common ancestor" is the ancestor node itself. The merge becomes a summary of the path between them. Show a warning but allow it.
- **Same node selected twice**: ignore (require two distinct nodes).
- **Merge node as reply target**: allowed. The user can continue chatting from a merged response.
- **Chained full-context merges**: if a full-context merge includes a branch that itself passes through a previous full-context merge node, the embedded transcripts compound. The merge dialog detects this and shows the total compounded token estimate in the warning. No special handling is needed — the synthetic user node simply contains more text.
- **Future: merging 3+ branches**: the dialog and content collection support a variable number of branches, but v1 limits to 2.
