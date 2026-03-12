# 29 — Batch Prompt Execution

## Summary

Run a single user prompt N times across one or more models, with optional system prompt variants. Results branch as N sibling assistant nodes with shared `batchId` grouping. A dedicated batch results view activates for large batches (N>10). Synthesis adapts the existing merge to handle N>2 siblings. Saved templates allow re-running batch configurations.

## Priority

Tier 2 — power feature.

## Dependencies

- **08 Model Cascade**: batch modal uses the model selector and cascade resolution to determine available models.
- **07 Inference Providers**: batch runs may target models across different providers.
- **15 Summarize Branches** / **16 Merge Branches**: synthesis adapts the merge pattern for N>2 siblings.

## Phasing

| Phase | Scope | Prerequisites | Status |
|-------|-------|---------------|--------|
| **A** | Core batch: same prompt × N runs × one or more models. Batch results view for N>10. Configurable concurrency. Dry-run step with cost estimate. | 07, 08 | — |
| **B** | System prompt variants: user provides M system prompts, cross-product with models (Models × SystemPrompts × N). | A | — |
| **C** | Synthesis: adapt merge for N>2 siblings sharing a batchId. | A, 16 | — |
| **D** | Templates: save/load batch configs globally in settings. | A | — |

---

## Data Model Changes

### `TreeNode` — new field

```typescript
interface TreeNode {
  // ... existing fields
  batchId?: string;  // Groups nodes created by the same batch operation
}
```

### New types

```typescript
interface BatchConfig {
  n: number;                       // Runs per model per system prompt
  modelIds: string[];              // One or more model IDs
  providerIds?: string[];          // Provider per model (parallel array, optional — uses default if omitted)
  systemPromptVariants?: string[]; // Phase B: list of system prompts to cross-product
  concurrency: number;             // Max parallel requests (default 3)
}

interface BatchTemplate {
  id: string;
  name: string;
  config: BatchConfig;
  createdAt: number;
  updatedAt: number;
}

interface BatchRun {
  batchId: string;
  sourceNodeId: string;            // The user node that was right-clicked
  config: BatchConfig;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  totalRuns: number;               // Pre-computed: n × models × systemPrompts
  completedRuns: number;
  failedRuns: number;
  startedAt: number;
  completedAt?: number;
}
```

### `AppSettings` — new field (Phase D)

```typescript
interface AppSettings {
  // ... existing fields
  batchTemplates: BatchTemplate[];
}
```

### Dexie — no new tables

Batch metadata (`BatchRun`) is transient Zustand state, not persisted. The resulting tree nodes are persisted as normal nodes with `batchId` set. If the user reloads mid-batch, incomplete runs are lost but completed nodes remain.

---

## UI Entry Point

### Context menu addition

Right-click a **user node** → new item in the "Primary Actions" group:

```
Reply here
Resend
Duplicate & Edit
Batch prompt          ← new
─────────────
Star / Unstar
...
```

Only shown on user nodes. Disabled while streaming.

---

## Phase A: Core Batch

### Batch Prompt Modal

Opened from the context menu. Layout:

```
┌─────────────────────────────────────────────────┐
│ Batch Prompt                                    │
│                                                 │
│ Prompt (read-only preview):                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ "Explain quantum entanglement in simple..." │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Runs per model:  [5        ]                    │
│                                                 │
│ Models:                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ ☑ claude-sonnet-4-20250514                  │ │
│ │ ☑ gpt-4o                                    │ │
│ │ ☐ gemini-2.0-flash                          │ │
│ │ [+ Add model]                               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Concurrency:     [3        ]                    │
│                                                 │
│ ─── Dry Run ───────────────────────────────── │
│ Total runs: 10 (5 × 2 models)                  │
│ Estimated cost: ~$0.34                          │
│ Est. time: ~45s at concurrency 3                │
│                                                 │
│              [Cancel]  [Run Batch]              │
└─────────────────────────────────────────────────┘
```

**Model selector**: Multi-select checklist. Populated from `allProviderModels` in settings store. Defaults to the conversation's current model (pre-checked). Shows provider name next to model.

**N input**: Numeric, min 1, max 100. Validated with `safeParseNumber` pattern.

**Concurrency**: Numeric, min 1, max 20, default 3. Controls how many API requests run in parallel via a semaphore/queue.

**Dry-run section**: Always visible. Updates reactively as N and models change. Cost estimate uses `getPricingForModel()` from `lib/pricing.ts`, estimating input tokens from the prompt length and a configurable output assumption (default: 500 output tokens per run).

### Execution Flow

1. User clicks "Run Batch" → modal closes.
2. Create `BatchRun` in transient store with `status: 'running'`.
3. Generate a `batchId` (UUID).
4. For each model × N combination:
   a. Create an assistant placeholder node as a child of the source user node, with `batchId` set.
   b. Use the existing `dispatchToProvider()` pipeline (same as resend).
   c. Stream response into the placeholder node via existing `onToken`/`onComplete` callbacks.
5. Concurrency is managed by a simple semaphore: maintain a pool of `concurrency` active requests, start the next when one completes.
6. On completion/cancellation, update `BatchRun.status`.

**Cancellation**: A floating progress indicator (see below) has a cancel button. Cancellation aborts all in-flight requests via their `AbortController`s and marks remaining pending runs as skipped. Completed nodes are kept.

### Progress Indicator

While a batch is running, show a floating bar at the bottom of the conversation view:

```
┌──────────────────────────────────────────────────┐
│ Batch: 7/10 complete  ██████████░░░░  [Cancel]   │
└──────────────────────────────────────────────────┘
```

Updates in real-time. Shows errors inline if any runs fail ("7/10 complete, 1 failed"). Disappears when batch completes.

### Batch Results View (N > 10)

When a batch completes with more than 10 results, a "View batch results" button appears in the progress bar (or on any node with a `batchId`). Clicking it opens a panel replacing the detail panel:

```
┌───────────────────────────────────────────────────┐
│ Batch Results — "Explain quantum..."  (20 runs)   │
│ [← Back to detail]                                │
│                                                   │
│ Filter: [All models ▾]  Sort: [Model ▾]           │
│                                                   │
│ ┌─────┬──────────┬────────────────────┬──────┬──┐ │
│ │  #  │ Model    │ Response preview   │Tokens│ $│ │
│ ├─────┼──────────┼────────────────────┼──────┼──┤ │
│ │  1  │ Sonnet 4 │ "Quantum entang…"  │  342 │.02│ │
│ │  2  │ Sonnet 4 │ "Imagine two pa…"  │  287 │.01│ │
│ │  3  │ GPT-4o   │ "Think of it li…"  │  401 │.03│ │
│ │ ... │          │                    │      │   │ │
│ └─────┴──────────┴────────────────────┴──────┴──┘ │
│                                                   │
│ Summary: 20 runs, ~$0.42, avg 356 tokens          │
│ [Synthesize]                                      │
└───────────────────────────────────────────────────┘
```

Clicking a row selects that node in the tree (standard selection behavior). The table is sortable by model, token count, cost.

For N ≤ 10, no batch results view — just the normal sibling branches in the tree, visually grouped (see below).

### Tree Visual Grouping

Nodes sharing a `batchId` are rendered with a subtle visual grouping:

- A light background band behind the group in the tree view.
- A small label above the group: "Batch: 10 runs × 2 models".
- Collapsible: clicking the label collapses all batch nodes into a single summary node showing run count and status. Expanding restores individual nodes.

This grouping is computed in `buildReactFlowGraph` by detecting sibling nodes with matching `batchId`.

---

## Phase B: System Prompt Variants

### Modal Extension

A new section in the batch modal, below the model selector:

```
│ System prompt variants:                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ 1. "You are a helpful physics teacher..."   │ │
│ │    [Remove]                                 │ │
│ │ 2. "You are a research scientist..."        │ │
│ │    [Remove]                                 │ │
│ │ [+ Add system prompt variant]               │ │
│ └─────────────────────────────────────────────┘ │
```

Each variant is a textarea. The user adds/removes variants freely.

**Cross-product**: If user provides S system prompt variants, M models, and N runs, total = S × M × N. The dry-run section reflects this.

Each generated assistant node gets `systemPromptOverride` set to its assigned variant. This integrates naturally with the existing cascade system — the override is visible in the detail panel and through Feature 10 visual indicators.

If no system prompt variants are provided, the batch uses whatever system prompt the conversation would normally resolve (cascade from node → conversation → project → global default).

---

## Phase C: Synthesis

### Adapting Merge for N > 2

The existing merge (Feature 16) handles exactly 2 branches. Batch synthesis extends this to N siblings:

1. User clicks "Synthesize" in the batch results view (or right-clicks any batch node → "Synthesize batch").
2. Collect all assistant nodes with the matching `batchId`.
3. Build a synthesis prompt:
   - **Summarize mode** (default): Each response is summarized to a brief excerpt, then the synthesis model is asked to identify patterns, consensus, and divergences across all N responses.
   - **Full-context mode**: All N responses are included verbatim (token-intensive — warn if total exceeds context window).
4. Create a synthetic user node (sibling of the batch nodes, `nodeType: 'merge'`, `batchId` set, `mergeSourceIds` = all batch assistant node IDs) and an assistant node for the synthesis response.
5. Use the existing merge prompt from settings (`useSettingsStore.mergePrompt`), adapted for N inputs instead of 2.

The synthesis prompt should be structured to:
- List each response with its model name and system prompt variant (if applicable)
- Ask the model to identify: common themes, contradictions, unique insights, quality ranking

---

## Phase D: Templates

### Global Template Management

In Settings, add a "Batch Templates" section (could be a sub-section of the existing Prompts tab):

```
┌─────────────────────────────────────────────┐
│ Batch Templates                             │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ "3-model comparison"                    │ │
│ │  5 runs × Sonnet, GPT-4o, Gemini Flash │ │
│ │  Concurrency: 3                         │ │
│ │  [Edit] [Delete]                        │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ "Prompt sensitivity test"               │ │
│ │  10 runs × Sonnet                       │ │
│ │  3 system prompt variants               │ │
│ │  [Edit] [Delete]                        │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Templates are also saveable from the batch  │
│ modal via "Save as template".               │
└─────────────────────────────────────────────┘
```

The batch modal gets:
- A "Load template" dropdown at the top that pre-fills the form.
- A "Save as template" button next to "Run Batch" that saves the current config.

Templates are stored in `AppSettings.batchTemplates` and persisted to IndexedDB via the settings store.

---

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | N < 1 or no models selected → "Run Batch" button disabled. N > 100 → clamped to 100 with warning. |
| What if the external dependency is unavailable? | Provider offline → individual run fails, others continue. Failed nodes show error content as normal. Batch completes with partial results. |
| What if this runs concurrently with itself? | Multiple batches can run simultaneously. Each has its own `batchId` and progress indicator. Concurrency limits are per-batch. |
| What happens on the second invocation? | Opening the modal again on the same node starts a fresh batch with a new `batchId`. Previous batch nodes remain. |
| What if the user's data is larger than expected? | Dry-run shows total runs and cost estimate before execution. For very large batches (N × M × S > 50), show an amber warning: "This will create X nodes. Continue?" |
| What state persists vs. resets across page reload? | Completed nodes persist (normal IndexedDB). In-flight `BatchRun` state is transient — reload cancels pending runs. Templates persist in settings. |
