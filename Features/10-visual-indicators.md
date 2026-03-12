# 10 — Visual Indicators for Setting Changes

## Summary

When a message node uses a non-default model, system prompt, or advanced settings, it gets a visual indicator: an orange outline ring and colored chips describing what changed. This gives users at-a-glance awareness of where settings differ across the tree.

## Priority

Tier 1 — core UX.

## Dependencies

- **08 Model Cascade**: model override detection.
- **09 System Prompt Cascade**: system prompt override detection.

## Indicator Design

### Orange Outline Ring

Any node where one or more settings differ from the inherited default gets a `2px` orange outline (`border-[#D97757]`), distinct from the selection ring (which is also orange but uses `ring-2` — the override indicator uses `border-2`).

If the node is *both* selected and has overrides, both indicators show: `ring-2 ring-[#D97757] border-2 border-[#D97757]`.

### Change Chips

Small rounded chips displayed below the header row of the node card, before the content preview:

| Condition | Chip | Color |
|-----------|------|-------|
| Model differs from inherited default | `Opus 4` (model name) | Orange background (`bg-[#D97757]/15 text-[#D97757]`) |
| Model is same as inherited default | `Haiku 4.5` (model name) | Muted background (`bg-[#F0EBE4] text-[#8B7E74]`) |
| System prompt overridden at this node | `system` | Orange background |
| Advanced settings changed (thinking, temp, etc.) | `settings` | Orange background |

### Chip Layout

```
┌─────────────────────────────────────────┐
│ 🔮 Claude                   🌿 3       │
│ [Opus 4] [system] [settings]           │
│                                         │
│ Here is my response to your question    │
│ about the nature of...                  │
└─────────────────────────────────────────┘
```

- Chips are small (`text-[10px]`, `px-1.5 py-0.5`, `rounded-md`).
- Maximum 3 chips — model, system, settings. They only appear when relevant.
- The model chip always shows (it's useful context). It's orange only when overridden.

## Detection Logic

For each node, determine what's changed by comparing against the inherited values:

```typescript
interface NodeIndicators {
  modelOverridden: boolean;     // node or ancestor has modelOverride
  modelName: string;            // effective model display name
  systemOverridden: boolean;    // this specific node has systemPromptOverride
  settingsOverridden: boolean;  // this node has any advanced settings override
  hasAnyOverride: boolean;      // any of the above
}

function getNodeIndicators(
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): NodeIndicators {
  // Walk path to root to find overrides
  const path = getPathToRoot(node.id, nodes);

  // Model: check if this node's effective model differs from chat default
  const effectiveModel = resolveModel(node.id, nodes, conversation, settings);
  const chatDefaultModel = conversation.model || settings.defaultModel;
  const modelOverridden = effectiveModel.model !== chatDefaultModel;

  // System prompt: check if THIS node has an override (not inherited)
  const systemOverridden = node.systemPromptOverride !== undefined && node.systemPromptOverride !== null;

  // Settings: check if this node has any advanced settings overrides
  // (future: when per-node settings overrides are added)
  const settingsOverridden = false; // placeholder until per-node settings exist

  return {
    modelOverridden,
    modelName: getModelDisplayName(effectiveModel.model),
    systemOverridden,
    settingsOverridden,
    hasAnyOverride: modelOverridden || systemOverridden || settingsOverridden,
  };
}
```

## MessageNode Component Changes

The `MessageNode` component receives indicator data and renders accordingly:

```tsx
// In MessageNode data
interface MessageNodeData {
  // ... existing
  indicators: NodeIndicators;
}

// In the component
<div className={`
  ...existing classes
  ${data.indicators.hasAnyOverride ? 'border-2 border-[#D97757]' : ''}
`}>
  {/* Header */}
  ...

  {/* Chips row */}
  <div className="flex items-center gap-1 mt-1 mb-1.5">
    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
      data.indicators.modelOverridden
        ? 'bg-[#D97757]/15 text-[#D97757]'
        : 'bg-[#F0EBE4] text-[#8B7E74] dark:bg-[#3D3229] dark:text-[#A89B91]'
    }`}>
      {data.indicators.modelName}
    </span>

    {data.indicators.systemOverridden && (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#D97757]/15 text-[#D97757]">
        system
      </span>
    )}

    {data.indicators.settingsOverridden && (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#D97757]/15 text-[#D97757]">
        settings
      </span>
    )}
  </div>

  {/* Content preview */}
  ...
</div>
```

## Detail Panel Integration

The detail panel shows the full indicator details:
- Which model was used (and whether it was inherited or overridden).
- The effective system prompt (and whether it was inherited or overridden at this node).
- Any advanced settings that differ from defaults.

This is already covered by features 08 and 09's detail panel sections.

## Dark Mode

Chips in dark mode:
- Default model chip: `bg-[#3D3229] text-[#A89B91]`
- Override chips: `bg-[#D97757]/20 text-[#E08B6D]`
- Orange outline: same `border-[#D97757]` (works in both themes)

## Coexistence with Other Visual Treatments

### Error Node Styling (UI Fix 3)

Error nodes use `border-2 border-red-500` to indicate failed API responses. When a node is both an error *and* has settings overrides:

- **Red border takes precedence** over the orange override border (error is more urgent information).
- Override **chips still render** inside the node — the model chip, "system" chip, etc. are useful context for understanding why the request may have failed.
- The orange outer ring (`ring-2`) does NOT render on error nodes — the red border communicates enough.

### Path Highlighting (UI Fix 15)

Active path highlighting (root → selected node) uses **edge styling only**: thicker stroke and/or accent-colored edges. It does NOT modify node appearance. This keeps the visual channels separate:

- **Edges** = path context (which branch you're looking at)
- **Node border/ring** = node state (error, override)
- **Node opacity** = dead-end status (Feature 12)

See the Visual Channels Convention table in `_overview.md`.

### Dead-End Dimming (Feature 12)

Dead-end nodes have `opacity-40`. Override indicators (orange ring, chips) still render on dimmed nodes — they're just less prominent due to the opacity. This is intentional: the user can still see that a dead-end node had overrides, which may be why the branch was abandoned.

## Cascade Traceability

When a model chip is overridden (orange), users need to understand *why* — which cascade level determined the effective value. Without traceability, debugging unexpected model usage requires manually inspecting ancestor nodes.

### Model Chip Tooltip

Hovering over any model chip shows a tooltip with the cascade chain:

```
Effective model: Claude Opus 4
Resolved via: branch override

  Global default: Claude Haiku 4.5
  Chat default: Claude Sonnet 4
  Branch override: Claude Opus 4  ← (set on "Tell me about frogs")
  Message override: —
```

Each level shows its value (or `—` if not set). The winning level is marked with `←` and the node where the override was set (for branch-level overrides, showing the ancestor node's content preview).

### System Prompt Chip Tooltip

Hovering over the `[system]` chip shows:

```
System prompt overridden at this node

  First 80 chars of override text...
  [Click to view in detail panel]
```

### Implementation

```typescript
interface CascadeTrace {
  globalDefault: string;
  chatDefault: string | null;      // null = not set (falls through to global)
  branchOverride: string | null;   // null = not set; if set, includes source node ID
  branchOverrideSourceId?: string; // the ancestor node where the branch override was set
  messageOverride: string | null;  // null = not set
  resolvedValue: string;
  resolvedLevel: 'global' | 'chat' | 'branch' | 'message';
}

function resolveModelWithTrace(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  conversation: Conversation,
  settings: AppSettings
): { resolved: ResolvedModel; trace: CascadeTrace } {
  // Same root-to-node walk as resolveCascade, but records each level
}
```

The trace is computed lazily (on hover) rather than for every node at render time, to avoid performance overhead.

## Performance

Indicator computation should be memoized per-node. Since it depends on the path to root, recalculate only when:
- The node's own overrides change.
- An ancestor's overrides change.
- The conversation or global defaults change.

This can be computed inside `buildReactFlowGraph` when building node data, so it's part of the existing memoized layout computation.
