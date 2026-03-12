# 17 — Compare & Classify Messages / Branches

## Summary

Select two or more nodes via `Ctrl+Click` and compare them using classifiers, embeddings, or model-based analysis. Also supports scoring individual nodes or branches using classifiers (e.g., sentiment analysis), with results displayed as a heatmap overlay on the tree.

## Priority

Tier 4 — advanced.

## Dependencies

- **00 Backend Architecture**: server-side ML inference for classifiers and embeddings (optional — client-side Transformers.js as alternative).

## Comparison Modes

### 1. Compare via Classifier

Apply a classification model to both messages and compare their labels/scores.

Example: compare two messages using a sentiment classifier → one is 0.8 positive, the other is 0.3 positive.

### 2. Compare via Embeddings

Embed both messages and compute cosine similarity (or other distance metric).

Example: two responses have 0.87 cosine similarity → "highly similar."

### 3. Compare via Prompt

Send both messages to a model with a comparison prompt and get a natural-language analysis.

Example: "Compare these two responses for accuracy, completeness, and clarity."

## UI Flow

### Multi-Select → Action Menu

Multi-select uses the shared Multi-Select Architecture (see `_overview.md`). After `Ctrl+Click` on two nodes, the shared `MultiSelectPanel` shows:

```
┌──────────────────────────────────────┐
│ 2 nodes selected                     │
│                                      │
│ Node A: "The key finding is..."      │
│ Node B: "Another perspective..."     │
│                                      │
│ [🔀 Merge] [📊 Compare] [Cancel]    │
└──────────────────────────────────────┘
```

### Compare Dialog

Clicking "Compare" shows options:

```
┌──────────────────────────────────────────┐
│ Compare Messages                    [X]  │
├──────────────────────────────────────────┤
│                                          │
│ Method:                                  │
│ ○ Classifier                             │
│ ○ Embeddings                             │
│ ● Prompt-based                           │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Prompt-based options:                │ │
│ │                                      │ │
│ │ Model: [Claude Haiku 4.5 ▾]        │ │
│ │                                      │ │
│ │ Comparison prompt:                   │ │
│ │ [Compare these two responses for   ] │ │
│ │ [accuracy, completeness, and       ] │ │
│ │ [clarity. Highlight differences.   ] │ │
│ └──────────────────────────────────────┘ │
│                                          │
│                 [Cancel] [Compare]       │
└──────────────────────────────────────────┘
```

### Method-Specific Options

**Classifier**:
```
Model source: [Client-side (Transformers.js)] [Server-side (HF API)]
Classifier: [────────────────────────── ▾]
  Built-in:
    sentiment-analysis
    zero-shot-classification
  Custom:
    [Type a HuggingFace model ID...]

Labels (for zero-shot): [positive, negative, neutral]
```

**Embeddings**:
```
Model source: [Client-side (Transformers.js)] [Server-side (HF API)]
Embedding model: [────────────────────────── ▾]
  Built-in:
    all-MiniLM-L6-v2
    bge-small-en-v1.5
  Custom:
    [Type a HuggingFace model ID...]

Distance metric: [Cosine similarity ▾]
```

**Prompt-based**: model selector + editable comparison prompt.

### Results Display

After running, the detail panel shows the comparison results:

```
┌──────────────────────────────────────┐
│ Comparison Results              [X]  │
├──────────────────────────────────────┤
│ Method: Prompt-based (Haiku 4.5)     │
│                                      │
│ Node A and Node B both address the   │
│ topic of climate change, but differ  │
│ significantly in their approach:     │
│                                      │
│ **Accuracy**: Node A cites specific  │
│ studies (IPCC 2024), while Node B    │
│ uses more general claims...          │
│                                      │
│ **Completeness**: Node B covers a    │
│ broader range of topics...           │
│                                      │
│ [Run again] [Export] [Close]         │
└──────────────────────────────────────┘
```

For classifier/embedding results:

```
┌──────────────────────────────────────┐
│ Comparison Results              [X]  │
├──────────────────────────────────────┤
│ Method: Sentiment Analysis           │
│ Model: distilbert-sentiment          │
│                                      │
│ Node A: Positive (0.92)  ████████▓  │
│ Node B: Neutral  (0.51)  █████░░░░  │
│                                      │
│ Method: Cosine Similarity            │
│ Model: all-MiniLM-L6-v2             │
│ Similarity: 0.73  ███████▓░░        │
│                                      │
│ [Run again] [Export] [Close]         │
└──────────────────────────────────────┘
```

## Scoring / Heatmap Mode

### Trigger

Single node selection → detail panel → "Score" button. Or right-click → "Score/Evaluate."

```
┌──────────────────────────────────────┐
│ Score Messages                  [X]  │
├──────────────────────────────────────┤
│ Scope:                               │
│ ○ This message only                  │
│ ● This branch (12 messages)          │
│ ○ All messages in conversation       │
│                                      │
│ Classifier: [sentiment-analysis ▾]   │
│ Labels: [positive, negative, neutral]│
│                                      │
│              [Cancel] [Score]        │
└──────────────────────────────────────┘
```

### Heatmap Overlay

After scoring, the tree nodes get a color overlay based on their scores:

- Each node's background gets a tinted overlay based on the score.
- Color scale: red (negative/low) → yellow (neutral/mid) → green (positive/high).
- Intensity proportional to confidence score.

```
┌─────────────────────────────────────────┐  ← green tint (positive: 0.92)
│ 🔮 Claude                    [Haiku]   │
│ This is a really great finding...       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐  ← red tint (negative: 0.78)
│ 🔮 Claude                    [Haiku]   │
│ Unfortunately this approach fails...    │
└─────────────────────────────────────────┘
```

A **legend** appears in the corner of the tree view:

```
Score: Sentiment
🟢 Positive ──── ⚪ Neutral ──── 🔴 Negative
[Clear heatmap]
```

Clicking "Clear heatmap" removes the overlay and returns to normal styling.

**Visual stacking rule**: When a heatmap is active, it temporarily overrides the summary/merge blue-gray background tint (Features 15, 16). Dismissing the heatmap restores the original tint. See the Visual Channels Convention table in `_overview.md`.

## ML Infrastructure

### Client-Side (Transformers.js)

For the browser-only version or when the user prefers:

```typescript
import { pipeline } from '@xenova/transformers';

// Classifier
const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
const result = await classifier(text);

// Embeddings
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const embedding = await embedder(text, { pooling: 'mean', normalize: true });
```

- Models are downloaded on first use and cached in the browser.
- Show a progress bar during download ("Downloading model: 45%").
- Client-side inference is slower but works without the backend.

### Server-Side (Backend)

Via the backend's ML endpoints:

- `POST /api/ml/classify` — runs classification on the server (faster, supports larger models).
- `POST /api/ml/embed` — generates embeddings on the server.

The backend uses `@xenova/transformers` in Node.js (same library, faster execution).

### HuggingFace Inference API

For models that are too large for local inference:

- Use the HF Inference API (`POST https://api-inference.huggingface.co/models/{model_id}`).
- Requires an HF token (configured in Settings, feature 07).
- Supports any model hosted on HuggingFace.

## Data Model

Comparison and scoring results are ephemeral — they're shown in the UI but not persisted to IndexedDB. If the user wants to keep a result, they can export it.

The heatmap overlay state is stored in a transient Zustand slice (cleared on page reload or when the user dismisses it).

## Advanced Settings

```
Compare & Classify Settings
  Default comparison prompt:
  [textarea]

  Preferred model source:
  [Client-side] [Server-side] [HuggingFace API]

  Default classifier: [sentiment-analysis ▾]
  Default embedding model: [all-MiniLM-L6-v2 ▾]
```

## Browser-Only Mode

- **Client-side classifiers/embeddings**: fully available via Transformers.js.
- **Server-side inference**: disabled (backend not present).
- **HuggingFace API**: available if the user has an HF token.
- **Prompt-based comparison**: fully available (uses the user's LLM provider).
