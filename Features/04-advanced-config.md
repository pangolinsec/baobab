# 04 — Advanced API Configuration

## Summary

Expose advanced Claude API parameters in a dedicated "Advanced" section within Settings: thinking toggle with budget tokens, temperature, max output tokens, and top-p. Thinking content is rendered in the detail panel, collapsed by default and expandable.

## Priority

Tier 1 — core UX.

## Dependencies

None (works with current Anthropic-only setup; extends to other providers via feature 07).

## Data Model Changes

### `AppSettings` (types/index.ts)

Add fields:

```typescript
interface AppSettings {
  // ... existing fields
  thinkingEnabled: boolean;
  thinkingBudget: number;      // budget_tokens, e.g. 10000
  temperature: number;          // 0.0 – 1.0, default 1.0
  maxOutputTokens: number;      // default 8192
  topP: number;                 // 0.0 – 1.0, default unset (null = use API default)
  topK: number;                 // integer, default unset (null = use API default)
}
```

Defaults:
- `thinkingEnabled: false`
- `thinkingBudget: 10000`
- `temperature: 1.0`
- `maxOutputTokens: 8192`
- `topP: null` (omitted from API call when null)
- `topK: null` (omitted from API call when null)

### `TreeNode` (types/index.ts)

Add optional thinking content:

```typescript
interface TreeNode {
  // ... existing fields
  thinking?: string;           // thinking block content, if thinking was enabled
}
```

### Dexie Schema

*Dexie migration: see [Dexie Migration Plan](_dexie-migrations.md), Version 2.* No new indexes needed — new fields are stored but not queried via index.

## UI — Settings Dialog

Add a collapsible "Advanced" section below the existing settings:

### Layout

```
┌─────────────────────────────────────┐
│ Settings                        [X] │
├─────────────────────────────────────┤
│ Anthropic API Key                   │
│ [sk-ant-•••••••••]           [👁]  │
│ ✓ Key verified — 12 models          │
│                                     │
│ Default Model                       │
│ [Claude Haiku 4.5          ▾]      │
│                                     │
│ Theme                               │
│ [Light] [Dark]                      │
│                                     │
│ ▶ Advanced                          │
│ ┌─────────────────────────────────┐ │
│ │ Extended Thinking                │ │
│ │ [toggle off/on]                 │ │
│ │                                 │ │
│ │ Thinking Budget (tokens)        │ │
│ │ [========○----] 10,000          │ │
│ │ (only shown when thinking on)   │ │
│ │                                 │ │
│ │ Temperature                     │ │
│ │ [====○--------] 0.5             │ │
│ │                                 │ │
│ │ Max Output Tokens               │ │
│ │ [==========○--] 8,192           │ │
│ │                                 │ │
│ │ Top P (optional)                │ │
│ │ [                    ] blank    │ │
│ │                                 │ │
│ │ Top K (optional)                │ │
│ │ [                    ] blank    │ │
│ └─────────────────────────────────┘ │
│                                     │
│                           [Save]    │
└─────────────────────────────────────┘
```

### Controls

- **Extended Thinking**: toggle switch. When enabled, shows the budget slider.
- **Thinking Budget**: slider from 1,000 to 100,000 tokens, step 1,000. Also accepts direct numeric input.
- **Temperature**: slider from 0.0 to 1.0, step 0.05. Note: when thinking is enabled, temperature must be 1.0 (Anthropic API constraint). If thinking is on, disable the temperature slider and show a note: "Temperature is fixed at 1.0 when thinking is enabled."
- **Max Output Tokens**: slider from 256 to 128,000 (or model max). Step 256.
- **Top P / Top K**: optional numeric inputs. When blank, omitted from the API call (uses API defaults).

## API Integration

### `claude.ts` — sendMessage changes

Pass the advanced parameters through:

```typescript
const requestParams: any = {
  model,
  max_tokens: maxOutputTokens,
  messages,
};

if (systemPrompt) requestParams.system = systemPrompt;
if (thinkingEnabled) {
  requestParams.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
  requestParams.temperature = 1.0; // Required by API
} else {
  if (temperature !== 1.0) requestParams.temperature = temperature;
}
if (topP !== null) requestParams.top_p = topP;
if (topK !== null) requestParams.top_k = topK;
```

### Thinking Content Capture

When thinking is enabled, the API response includes `thinking` blocks before the `text` block. Capture these:

```typescript
stream.on('contentBlock', (block) => {
  if (block.type === 'thinking') {
    // Accumulate thinking content
    thinkingText += block.thinking;
  }
});
```

Store the thinking content on the `TreeNode.thinking` field when finalizing.

## UI — Thinking Display in Detail Panel

In `NodeDetailPanel`, when a node has `thinking` content:

```
┌──────────────────────────────────────┐
│ 🔮 Claude                      [X]  │
├──────────────────────────────────────┤
│ ▶ Thinking                    2,340t │
│ ┌──────────────────────────────────┐ │
│ │ (collapsed by default)           │ │
│ │ Let me analyze this step by      │ │
│ │ step. First, I need to...        │ │
│ │ ...                              │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Here is my response to your          │
│ question about...                    │
│                                      │
├──────────────────────────────────────┤
│ [Reply here] [Copy] [Delete]         │
└──────────────────────────────────────┘
```

- **Collapsed by default**: show "Thinking" header with a token count badge and chevron.
- **Expanded**: show the full thinking text in a distinct styled block (slightly different background, italic or monospace, subtle left border in the accent color).
- **The thinking content is rendered as markdown** (thinking blocks can contain structured reasoning).

## Thinking Display in Tree Node (MessageNode)

The tree node card should show a small thinking indicator when the node has thinking content:

- A small brain/sparkle icon or "💭" indicator next to the "Claude" label.
- No thinking content preview in the tree node itself (too verbose) — detail panel only.

## Constraints

- Extended thinking is only available on certain Claude models (Sonnet 3.5+, Opus). If the selected model doesn't support it, the toggle should be disabled with a tooltip: "Not available for this model."
- When thinking is enabled, `temperature` must be 1.0 — enforce this in the UI by disabling the temperature slider.
- Thinking budget counts against the model's max output tokens. The UI should reflect this (e.g., show remaining tokens for the response).

## Persistence

All advanced settings persist to IndexedDB via the existing `useSettingsStore` write-through pattern. The `TreeNode.thinking` field persists alongside message content.
