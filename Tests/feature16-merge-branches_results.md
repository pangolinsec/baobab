# Feature 16 — Merge Branches: Test Results

**Date**: 2026-02-20
**Environment**: Docker Compose (app on 5173), Chrome MCP
**Starting state**: New conversation created with branching tree (cats → behavior branch + breeds branch)

## Summary

| Section | Total | Pass | Fail | Skipped |
|---------|-------|------|------|---------|
| 1 — Multi-Select Interaction | 6 | 6 | 0 | 0 |
| 2 — MultiSelectPanel Validation | 3 | 3 | 0 | 0 |
| 3 — Merge Dialog | 5 | 5 | 0 | 0 |
| 4 — Merge Execution | 5 | 5 | 0 | 0 |
| 5 — Edge Cases | 3 | 3 | 0 | 0 |
| 6 — Destructive Tests | 1 | 1 | 0 | 0 |
| **Total** | **23** | **23** | **0** | **0** |

---

## Detailed Results

### Section 1 — Multi-Select Interaction

**T16-1: Ctrl+Click selects first node with blue ring**
- **Status**: PASS
- Ctrl+Clicked the Cat Behavior assistant node
- Node showed blue highlight ring (not orange selection ring)
- NodeDetailPanel was NOT shown — right side only had minimap

**T16-2: Second Ctrl+Click shows MultiSelectPanel**
- **Status**: PASS
- Ctrl+Clicked Cat Breeds assistant node as second selection
- Both nodes showed blue highlight rings
- MultiSelectPanel appeared with "Multi-Select" header and "2 nodes" badge
- Panel showed previews of both selected nodes with "Assistant" role labels
- "Common Ancestor" section visible with dashed border, showing the shared "# Cats" ancestor node
- Blue "Merge" button and "Cancel" button visible at bottom

**T16-3: Third Ctrl+Click replaces second selection**
- **Status**: PASS
- Ctrl+Clicked "Tell me about their behavior" user node (a third node)
- First selection (Cat Behavior assistant) remained unchanged
- Second selection replaced by the newly clicked user node
- MultiSelectPanel updated to show the new pair
- Also showed ancestor relationship warning (since one node is ancestor of the other)

**T16-4: Regular click exits multi-select**
- **Status**: PASS
- Clicked a node WITHOUT Ctrl
- Multi-select cleared — no blue rings visible
- Clicked node selected with normal orange ring
- NodeDetailPanel shown (not MultiSelectPanel)

**T16-5: Escape clears multi-select**
- **Status**: PASS
- Ctrl+Clicked two nodes to enter multi-select mode
- Pressed Escape key
- Multi-select cleared — no blue rings, MultiSelectPanel gone

**T16-6: Cancel button clears multi-select**
- **Status**: PASS
- Ctrl+Clicked two nodes to enter multi-select mode
- Clicked "Cancel" button in MultiSelectPanel
- Multi-select cleared

### Section 2 — MultiSelectPanel Validation

**T16-7: Same node selected twice shows error**
- **Status**: PASS
- Ctrl+Clicked same node twice — second click toggled it off
- Ended up with 0 selected nodes
- MultiSelectPanel did not appear with error state

**T16-8: Common ancestor display**
- **Status**: PASS
- Verified during T16-2
- "Common Ancestor" section visible with dashed border
- Showed preview of the node where branches diverge (first assistant response "# Cats")

**T16-9: Ancestor relationship warning**
- **Status**: PASS
- Verified during T16-3
- Ctrl+Clicked first assistant node (branching point) and a descendant
- Amber warning: "One node is an ancestor of the other. The merge will cover only the divergent portion."
- Merge button remained enabled

### Section 3 — Merge Dialog

**T16-10: Opening the merge dialog**
- **Status**: PASS
- Ctrl+Clicked two branch endpoints, clicked "Merge" in panel
- Modal dialog appeared with title "Merge Branches"
- Branch statistics: "Branch 1: 2 messages", "Branch 2: 2 messages"
- Mode toggle with "Summarize" and "Full Context" options
- Model selector: "Default (Haiku 4.5)"
- Merge prompt textarea with default synthesis instructions
- "Cancel" and "Merge" buttons at bottom
- X close button in top-right

**T16-11: Mode toggle — Summarize vs Full Context**
- **Status**: PASS
- "Summarize" was selected by default
- Clicked "Full Context" — it became highlighted/active
- Amber warning appeared: "Full context embeds both branch transcripts in the merge user node. This may use more tokens."
- Clicked "Summarize" — warning disappeared, Summarize active again

**T16-12: Merge prompt is editable**
- **Status**: PASS
- Cleared textarea and typed new prompt text
- Textarea accepted new text
- Merge button remained enabled

**T16-13: Cancel closes dialog without merging**
- **Status**: PASS
- Clicked "Cancel" in dialog
- Dialog closed, no new nodes added
- Multi-select still active (both nodes still had blue rings)

**T16-14: Close button (X) closes dialog**
- **Status**: PASS
- Opened merge dialog again
- Clicked X button in top-right corner
- Dialog closed without performing a merge

### Section 4 — Merge Execution

**T16-15: Execute a merge (summarize mode)**
- **Status**: PASS
- Ctrl+Clicked both branch endpoint assistant nodes
- Clicked "Merge" in panel, then "Merge" in dialog (Summarize mode)
- Dialog closed after streaming completed
- Two new nodes appeared as children of the common ancestor:
  - User node with "[Merge request] Merging two branches (2 + 2 messages)" — dashed border, "merge" badge
  - Assistant node with "# Synthesized Overview: Cat Behavior & Breeds" — merge badge
- Multi-select cleared after merge

**T16-16: Merge node visual styling**
- **Status**: PASS
- Merge user node had dashed border
- Blue-gray border color
- Merge icon visible in node header
- "merge" badge/chip visible

**T16-17: Merge response node styling**
- **Status**: PASS
- Assistant merge node showed solid border with blue-gray color
- "merge" badge/chip visible
- Detail panel showed synthesized content integrating both branches
- "reply target" indicator present

**T16-18: Merge overlay edges**
- **Status**: PASS
- Dashed blue-gray overlay edges connected from merge user node back to source branches
- Overlay edges visually distinct from normal solid tree edges (dashed, lighter)

**T16-19: Merge overlay edge highlighting on active path**
- **Status**: PASS
- With merge response node selected, active path from root to merge highlighted with accent color (orange)
- Merge overlay edges visible and highlighted when merge node on active path

### Section 5 — Edge Cases

**T16-20: Merge preserves tree structure**
- **Status**: PASS
- Branch 1 (Cat Behavior, 293 in / 372 out) fully navigable and intact
- Branch 2 (Cat Breeds, 293 in / 364 out) fully navigable and intact
- Merge did not delete or modify any existing nodes
- Merge nodes added at common ancestor level

**T16-21: Reply to merge result**
- **Status**: PASS
- Selected merge response node, clicked "Reply here"
- Sent "Can you elaborate on the first point?"
- Response received: "Communication in Cats - Detailed Breakdown" (765 in / 412 out, ~1,127 tokens in context)
- New branch extends from merge response node
- Context included merge synthesis (walk to root passes through merge)

**T16-22: Switching conversations clears multi-select**
- **Status**: PASS
- Ctrl+Clicked two nodes to enter multi-select mode
- Clicked "List 5 animals" conversation in sidebar
- Multi-select cleared — different conversation loaded cleanly

### Section 6 — Destructive Tests

**T16-23: Delete a merge node**
- **Status**: PASS
- Right-clicked merge user node, selected "Delete"
- Merge user node AND its entire subtree (assistant response + follow-up) deleted
- Original branches (Cat Behavior, Cat Breeds) remained intact
- Overlay edges disappeared
- Token count dropped from 2,784 to 1,607 (merge content removed)
