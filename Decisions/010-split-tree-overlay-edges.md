# ADR-010: Split Tree Edges and Overlay Edges in Graph Builder

**Date**: 2026-02-20
**Status**: Accepted
**Context**: Feature 16 (Merge Branches) introduces non-hierarchical visual connections in the tree view — dashed lines from merge nodes back to their two source nodes. These overlay edges must be rendered in React Flow but must NOT be fed to dagre for layout computation, since dagre would interpret them as structural parent-child relationships and distort node positioning. This required changing the return contract of `buildReactFlowGraph`, the central function that converts the tree data model into React Flow nodes and edges.

---

## Decision 1: Split `buildReactFlowGraph` Return into `treeEdges` and `overlayEdges`

**Problem**: `buildReactFlowGraph` previously returned `{ nodes, edges }` where all edges were both rendered and used for dagre layout. Merge overlay edges need to be rendered but excluded from layout. Mixing them into a single array would require downstream consumers to filter by edge type before passing to dagre, leaking implementation details.

**Options considered**:

1. **Single `edges` array with a type flag**: Add a `data.isOverlay` flag to overlay edges. Callers filter before passing to `computeDagreLayout`. Simple but error-prone — any new caller must remember to filter.
2. **Split return type**: Return `{ nodes, treeEdges, overlayEdges }`. `useTreeLayout` feeds only `treeEdges` to dagre, then merges both arrays for React Flow rendering. The API makes the distinction structural and impossible to misuse.
3. **Separate overlay edge builder**: A second function that generates overlay edges independently. Avoids changing `buildReactFlowGraph`'s signature but duplicates tree traversal and node visibility logic.

**Decision**: Option 2 — split the return type into `treeEdges` and `overlayEdges`.

**Rationale**: The split makes the layout-vs-rendering distinction explicit in the type system. Future features that add non-hierarchical edges (Feature 17 compare links, cross-references, annotations) follow the same pattern: add edges to `overlayEdges` and they automatically render without affecting layout. Option 1 would work but relies on convention rather than structure. Option 3 duplicates traversal logic and couples overlay generation to node visibility decisions already made in `buildReactFlowGraph`.

**Impact**:
- `src/lib/tree.ts`: `buildReactFlowGraph` return type changed from `{ nodes: Node[]; edges: Edge[] }` to `{ nodes: Node[]; treeEdges: Edge[]; overlayEdges: Edge[] }`. Internal variable renamed from `flowEdges` to `treeEdges`; overlay edges generated inline for merge nodes.
- `src/hooks/useTreeLayout.ts`: Destructures `{ nodes, treeEdges, overlayEdges }`, passes only `treeEdges` to `computeDagreLayout`, merges `[...treeEdges, ...overlayEdges]` for the final `flowEdges` output.
- No other files call `buildReactFlowGraph` directly — `useTreeLayout` is the sole consumer.

```typescript
// Before
function buildReactFlowGraph(...): { nodes: Node[]; edges: Edge[] }

// After
function buildReactFlowGraph(...): { nodes: Node[]; treeEdges: Edge[]; overlayEdges: Edge[] }
```

---

## Spec Files Updated

No spec files were updated in this session.
