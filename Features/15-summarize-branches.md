# 15 — Summarize Branches

## Summary

Right-click any node to generate a summary of the branch from that node to its deepest leaf. The summary is created as a new branch (child of the summarized node) with a visual indicator marking it as a summary. Uses a default prompt customizable in Advanced Settings. Model defaults to the effective model at the clicked node.

## Priority

Tier 2 — power feature.

## Dependencies

None (but shares UX patterns with feature 16, Merge Branches).

## Trigger

**Right-click context menu** on any node with descendants:

```
┌─────────────────────────┐
│ Reply here              │
│ Star                    │
│ ─────────────────────── │
│ Summarize branch        │
│ Flag as dead end        │
│ ─────────────────────── │
│ Copy                    │
│ Delete branch           │
└─────────────────────────┘
```

"Summarize branch" is only shown on nodes that have at least one child.

Also available in the **detail panel**:
```
[Reply here] [Copy] [📝 Summarize] [🚫 Dead end] [Delete]
```

## Summarization Flow

1. User right-clicks a node and selects "Summarize branch."
2. **Prompt editor dialog** appears with the default summarization prompt (pre-filled, editable):

```
┌──────────────────────────────────────────┐
│ Summarize Branch                    [X]  │
├──────────────────────────────────────────┤
│ Model: [Claude Haiku 4.5 ▾]             │
│                                          │
│ Prompt:                                  │
│ ┌──────────────────────────────────────┐ │
│ │ Summarize the following conversation │ │
│ │ branch concisely. Highlight key      │ │
│ │ points, decisions, and conclusions.  │ │
│ │ Preserve important nuance.           │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Branch: 8 messages (root → leaf)         │
│                                          │
│               [Cancel] [Summarize]       │
└──────────────────────────────────────────┘
```

3. User can modify the prompt and select a model, then clicks "Summarize."
4. The app collects all messages in the branch (from the clicked node to the deepest leaf — if there are multiple leaves/sub-branches, include all of them, formatted clearly).
5. Sends to the selected model:
   - **System prompt**: the user's summarization prompt.
   - **User message**: the full branch content, formatted as a conversation transcript.
6. The response streams in, creating:
   - A **synthetic user node** (child of the clicked node) with content: `[Summary request]` or similar marker.
   - An **assistant node** (child of the synthetic user) with the summary.
7. Both nodes are marked with `nodeType: 'summary'`.

## Data Model Changes

### `TreeNode`

```typescript
interface TreeNode {
  // ... existing
  nodeType: 'summary';    // marks summary nodes (default for regular nodes is 'standard')
}
```

> **Note**: The `nodeType` field replaces the previous `isSummary` boolean. `NodeType` is a mutually exclusive discriminated union (`'standard' | 'summary' | 'merge'`), so a node cannot be both a summary and a merge. The "synthetic" concept (e.g., the summary request user node was not typed by the user) is derived from `nodeType + role`: a user-role node with `nodeType: 'summary'` is synthetic by definition. See ADR-001 Decision 1.

## Visual Treatment of Summary Nodes

Summary nodes have a distinct visual style to differentiate them from regular conversation branches:

- **Left border accent**: a `3px` left border in a distinct color (blue-gray `#7C9AB5` or similar — different from the orange accent used for overrides).
- **Summary badge**: a small `📝` icon or "Summary" chip in the node header.
- **Slightly different background**: a subtle blue-gray tint instead of the standard white/cream.

```
┌──────────────────────────────────────────┐
│ 📝 Summary                    [Haiku]   │  ← blue-gray left border
│                                          │
│ The conversation explored three main     │
│ themes: 1) amphibian evolution...        │
└──────────────────────────────────────────┘
```

The synthetic user node (the summary request) is styled similarly but more muted:

```
┌──────────────────────────────────────────┐
│ 📝 Summary Request                       │  ← muted, small
│ Summarize the following conversation...  │
└──────────────────────────────────────────┘
```

## Branch Content Collection

When collecting the branch for summarization:

```typescript
function collectBranchContent(nodeId: string, nodes: Record<string, TreeNode>): string {
  const lines: string[] = [];

  function walk(id: string, depth: number) {
    const node = nodes[id];
    if (!node) return;
    const indent = '  '.repeat(depth);
    const role = node.role === 'user' ? 'User' : 'Assistant';
    lines.push(`${indent}${role}:`);
    lines.push(`${indent}${node.content}`);
    lines.push('');

    for (const childId of node.childIds) {
      if (node.childIds.length > 1) {
        lines.push(`${indent}--- Branch ---`);
      }
      walk(childId, depth + (node.childIds.length > 1 ? 1 : 0));
    }
  }

  walk(nodeId, 0);
  return lines.join('\n');
}
```

If the branch has sub-branches, they're included with clear "Branch" markers so the model understands the tree structure.

## Advanced Settings — Summarization

```
Summarization Settings
  Default Prompt:
  ┌──────────────────────────────────────┐
  │ Summarize the following conversation │
  │ branch concisely. Highlight key      │
  │ points, decisions, and conclusions.  │
  │ Preserve important nuance.           │
  └──────────────────────────────────────┘
  [Reset to default]
```

## Interaction with Other Features

- **Summary nodes can be chatted from**: the user can "Reply here" on a summary node to start a new branch. This is useful for "summarize, then continue the conversation from the summary."
- **Summary nodes can be starred**: for quick access to key summaries.
- **Summary nodes in search (feature 20)**: searchable like any other node.
- **Thread view (feature 21)**: summary nodes appear inline in the thread with their distinct styling.

## Edge Cases

- **Summarizing a single node** (leaf with no children): technically allowed — the model summarizes just that one message. Less useful but not harmful.
- **Summarizing a very large branch**: if the branch exceeds the model's context window, truncate from the middle (keep root and recent messages, mark truncation). Show a warning in the dialog.
- **Nested summaries**: summarizing a branch that contains a summary node — the summary node is included in the content like any other message.
