# 25 — Thread View Metadata Parity

## Summary

Bring thread view to full parity with tree view + detail panel, so the detail panel becomes optional in thread view. Adds model chips, system prompt display, thinking character count, provider info, and the full set of message actions inline.

## Priority

Tier 2 — UX polish. Thread view is already functional but lacks metadata visibility that tree view provides via the detail panel.

## Dependencies

- **21 Thread View**: base implementation (shipped).
- **10 Visual Indicators**: model chip styling and override detection (shipped).
- **08 Model Cascade**: model override fields on TreeNode (shipped).
- **09 System Prompt Cascade**: system prompt override fields (shipped).
- **23 Resend / Duplicate**: resend and duplicate actions (shipped).

## Current State

ThreadMessage currently renders:
- Role icon + name in header
- Thinking blocks (collapsible, no character count)
- Full markdown content
- Star, dead-end, edited badges
- Hover actions: star toggle, reply here (assistant only), copy

**Missing** (available only via detail panel or tree view):
- Model chip (with override highlighting)
- System prompt display
- Thinking character count badge
- Provider indicator
- Resend, retry, duplicate & edit, dead-end toggle, delete actions

## Design

### 1. Model Chip in Header

Add a model chip to every ThreadMessage header, using the same override-highlighting logic as tree view (`getNodeIndicators`). The chip sits after the role name:

```
┌──────────────────────────────────────────────────────────────┐
│ You         [Haiku 3.5]                          ★  📋     │
│                                                              │
│ Tell me about frogs                                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Assistant   [Sonnet 4] [system]              ★  ↩  📋     │
│                                                              │
│ Frogs are fascinating amphibians...                         │
└──────────────────────────────────────────────────────────────┘
```

- **Muted** (`bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]`): model matches previous turn.
- **Accent** (`bg-[var(--color-accent)]/15 text-[var(--color-accent)]`): model differs from previous turn.
- **System chip**: accent-colored, shown only on user nodes with `systemPromptOverride`.

This reuses `getNodeIndicators()` from `lib/indicators.ts` — the same function tree view uses.

### 2. System Prompt (Collapsible)

Every message that has an effective system prompt gets a collapsible section, collapsed by default. Positioned between the header and the thinking block (if present):

```
┌──────────────────────────────────────────────────────────────┐
│ Assistant   [Sonnet 4]                           ★  ↩  📋 │
│                                                              │
│ ▶ System prompt                                [overridden] │
│                                                              │
│ ▶ Thinking                                     (4,231 chars)│
│                                                              │
│ Here is my detailed response about frogs...                 │
└──────────────────────────────────────────────────────────────┘
```

Expanded:

```
│ ▼ System prompt                                [overridden] │
│ ┃ You are a biology tutor. Explain concepts                 │
│ ┃ using clear examples and analogies...                     │
```

- Uses `resolveSystemPrompt()` to get the effective prompt for this node.
- Shows "overridden" badge when `node.systemPromptOverride !== undefined`.
- Matches the detail panel's collapsible pattern (chevron + icon + label).
- The section is hidden entirely when no system prompt is active (empty string or undefined).

### 3. Thinking Character Count

The existing thinking block in ThreadMessage already has expand/collapse. Add the character count badge to match the detail panel:

```
Before:  ▶ Thinking
After:   ▶ Thinking                                  (4,231 chars)
```

```tsx
<span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[10px]">
  {node.thinking.length.toLocaleString()} chars
</span>
```

### 4. Expanded Hover Actions

Extend the hover action bar to include the full set of message actions, matching the detail panel. Actions are role-dependent:

**User messages:**
```
                              [Resend] [Dup] [Dead end] [★] [📋] [🗑]
```

**Assistant messages:**
```
                              [↩ Reply] [Dup] [Dead end] [★] [📋] [🗑]
```

**Error messages:**
```
                              [Retry] [📋] [🗑]
```

Action details:
| Action | Icon | Nodes | Behavior |
|--------|------|-------|----------|
| Resend | `Send` | User | Calls `resend(node.id, chatInputState)` — uses current ChatInput model override |
| Reply here | `CornerDownRight` | Assistant | Sets reply target |
| Duplicate & Edit | `CopyPlus` | User, Assistant (non-root) | User: prefill chat input. Assistant: open edit modal |
| Dead end | `Flag` | Non-root | Toggles dead-end flag |
| Star | `Star` | All | Toggles star |
| Copy | `Copy` | All | Copies content to clipboard |
| Delete | `Trash2` | Non-root | Deletes subtree |
| Retry | `RefreshCw` | Error | Retries failed request |

### 5. Provider Indicator

When the message's provider differs from the default provider, show the provider name as a subtle annotation next to the model chip:

```
│ Assistant   [Sonnet 4] via Anthropic            ★  ↩  📋 │
```

- Only shown when `node.providerId` differs from `defaultProvider`.
- Styled in muted text (`text-[var(--color-text-muted)] text-[10px]`).
- Provider name comes from `providers.find(p => p.id === node.providerId)?.name`.

## Component Changes

### `ThreadMessage.tsx`

**New imports:**
```typescript
import { getNodeIndicators } from '../../lib/indicators';
import { resolveSystemPrompt } from '../../lib/tree';
import { chatInputState } from '../../store/chatInputState';
```

**New props:**
```typescript
interface ThreadMessageProps {
  node: TreeNode;
  siblings: TreeNode[];
  isStreaming: boolean;
  isReplyTarget: boolean;
  searchMatch?: boolean;
  nodes: Record<string, TreeNode>;               // for indicator computation
  conversationModel: string;                     // for indicator computation
  defaultModel: string;                          // for indicator computation
  availableModels: { id: string }[];             // for indicator computation
  conversationSystemPrompt: string | undefined;  // for system prompt resolution
  defaultSystemPrompt: string;                   // for system prompt resolution
  defaultProvider: string;                       // for provider display
  providers: { id: string; name: string }[];     // for provider display
}
```

**Indicator computation:**
```typescript
const indicators = getNodeIndicators(
  node, nodes, conversationModel, defaultModel, availableModels
);
```

**System prompt resolution:**
```typescript
const effectiveSystemPrompt = node.parentId
  ? resolveSystemPrompt(node.id, nodes, conversationSystemPrompt, defaultSystemPrompt)
  : undefined;
```

**New state:**
```typescript
const [promptExpanded, setPromptExpanded] = useState(false);
const [copied, setCopied] = useState(false); // already exists
```

### `ThreadView.tsx`

Pass new props to ThreadMessage:
```typescript
const defaultModel = useSettingsStore((s) => s.defaultModel);
const availableModels = useSettingsStore((s) => s.availableModels);
const defaultSystemPrompt = useSettingsStore((s) => s.defaultSystemPrompt);
const defaultProvider = useSettingsStore((s) => s.defaultProvider);
const providers = useSettingsStore((s) => s.providers);
```

## Layout Structure

Full ThreadMessage layout with all metadata sections:

```tsx
<div className="group">
  {/* Branch indicator (existing) */}
  {!isRoot && siblings.length > 1 && <BranchIndicator ... />}

  <div className="rounded-2xl px-5 py-4 ...">
    {/* Header row: role + model chip + system chip + provider + hover actions */}
    <div className="flex items-center gap-2 mb-3">
      {/* Role icon + name */}
      {/* Model chip (always visible, accent when overridden) */}
      {/* System chip (user nodes with override only) */}
      {/* Provider annotation (when non-default) */}
      {/* Badges: edited, summary, starred, dead-end, reply target */}
      {/* Hover actions (ml-auto, opacity-0 group-hover:opacity-100) */}
    </div>

    {/* System prompt (collapsible, hidden when no prompt) */}
    {effectiveSystemPrompt && (
      <CollapsibleSection icon={MessageSquare} label="System prompt" ... />
    )}

    {/* Thinking (collapsible with char count) */}
    {node.thinking && (
      <CollapsibleSection icon={Brain} label="Thinking" badge="4,231 chars" ... />
    )}

    {/* Content (existing) */}
    <div className="prose ...">
      <ReactMarkdown ...>{node.content}</ReactMarkdown>
    </div>
  </div>
</div>
```

## Edge Cases

1. **Long system prompts**: The collapsible section prevents layout bloat. When expanded, the prompt text uses `whitespace-pre-wrap` with `max-h-48 overflow-y-auto` to cap height.
2. **Rapid model switching**: Every message in the thread independently computes its indicators, so model chip highlighting is always accurate regardless of how many model changes occurred.
3. **Error nodes**: Show retry action (not resend). Model chip still shows what model was attempted.
4. **Root node**: Never shown in thread view (filtered out as silent root). No edge case.
5. **Streaming messages**: Hover actions are disabled during streaming (`disabled:opacity-50`). System prompt and model chip still render on the placeholder.
6. **Delete in thread view**: After deleting a subtree, the thread re-renders with the updated path. If the deleted node was part of the current path, the thread shortens.
7. **Resend in thread view**: Creates a new assistant sibling. The thread continues showing the current path; the user can click the branch indicator to switch to the new response.

## Performance

- `getNodeIndicators()` is called per message at render time — same cost as tree view. The thread shows fewer nodes (one path vs entire tree), so this is lighter.
- `resolveSystemPrompt()` walks root-to-node — same O(depth) as tree view.
- Hover actions use the existing store actions — no new subscriptions or state.
- Consider memoizing the indicators array in ThreadView if re-renders become noticeable with long threads.

## Files Changed

| File | Change |
|------|--------|
| `src/components/thread/ThreadMessage.tsx` | Add model chips, system prompt, thinking count, expanded actions, provider display |
| `src/components/thread/ThreadView.tsx` | Pass new props (settings, conversation context) to ThreadMessage |
| No new files | Reuses existing `getNodeIndicators`, `resolveSystemPrompt`, `chatInputState` |
