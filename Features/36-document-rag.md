# 36 — Document RAG

## Summary

Add retrieval-augmented generation over project knowledge files. When enabled, uploaded documents (Feature 13) are chunked and embedded in the background. On each message, the user's input is embedded and the most relevant chunks across all project files are retrieved and injected into the system prompt as additional context. This complements Feature 13's direct access modes (`@mention` and agentic `read_file`) with semantic search over large document collections.

## Priority

Tier 3 — requires backend for embedding pipeline.

## Dependencies

- **00 Backend Architecture**: embedding model inference, vector storage in SQLite.
- **13 Project Knowledge**: reuses existing file storage, upload pipeline, and project structure. Document RAG operates on the same files — no separate upload path.

## Relationship to Feature 19

Feature 19 (RAG Over Conversations) embeds conversation messages for cross-conversation retrieval. This feature (36) embeds project files for document retrieval. The use cases are distinct:

- **Feature 19**: "Find what I discussed about X in past conversations" → conversation-scoped semantic memory.
- **Feature 36**: "Find relevant content across my uploaded documents" → document knowledge base.

Both use the same embedding model and similar infrastructure, but operate on different data. Feature 36 is higher priority because document RAG is a more common user need.

When both are implemented, they share:
- The embedding model (`all-MiniLM-L6-v2` or user-configured).
- The vector storage layer (SQLite with `sqlite-vec`).
- The system prompt assembly pipeline (Feature 36 injects at stage 3, Feature 19 at stage 4).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  File Upload (Feature 13)                                     │
│  POST /api/files/upload → extract text → store in SQLite      │
│                              │                                │
│                              ▼                                │
│  Chunking Pipeline (new)                                      │
│  Split extracted text into overlapping chunks (~500 tokens)    │
│                              │                                │
│                              ▼                                │
│  Embedding Pipeline (new)                                     │
│  Embed each chunk with all-MiniLM-L6-v2 (384-dim)            │
│  Store embeddings in document_chunks table                     │
│                              │                                │
│                              ▼                                │
│  Retrieval (on message send)                                  │
│  Embed user query → cosine similarity search → top-k chunks   │
│                              │                                │
│                              ▼                                │
│  System Prompt Injection (stage 3)                            │
│  Append retrieved chunks as context to system prompt           │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Model Changes

### Backend — SQLite

```sql
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,           -- references project_files.id
  project_id TEXT NOT NULL,        -- denormalized for efficient project-scoped queries
  chunk_index INTEGER NOT NULL,    -- ordering within the file
  content TEXT NOT NULL,           -- the chunk text
  token_count INTEGER NOT NULL,    -- estimated token count
  embedding BLOB,                  -- float32 array (384 × 4 = 1,536 bytes), NULL if not yet embedded
  created_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE CASCADE
);

CREATE INDEX idx_chunks_project ON document_chunks(project_id);
CREATE INDEX idx_chunks_file ON document_chunks(file_id);
```

If `sqlite-vec` is available, create a virtual table for efficient vector search:

```sql
CREATE VIRTUAL TABLE document_chunk_embeddings USING vec0(
  id TEXT PRIMARY KEY,
  embedding float[384]
);
```

If `sqlite-vec` is not available, fall back to brute-force cosine similarity in application code (viable for < 100K chunks).

### Backend — Embedding Status

```sql
CREATE TABLE embedding_status (
  project_id TEXT PRIMARY KEY,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  embedded_chunks INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'indexing' | 'ready' | 'error'
  error TEXT,
  updated_at INTEGER NOT NULL
);
```

### Frontend — Types

```typescript
interface RAGConfig {
  enabled: boolean;
  topK: number;                    // Number of chunks to retrieve (default 5)
  minSimilarity: number;           // Minimum cosine similarity threshold (default 0.3)
  scope: 'project';               // Currently only project-scoped (future: 'all')
}

interface Conversation {
  // ... existing fields
  ragConfig?: RAGConfig;           // Per-conversation RAG settings (undefined = RAG disabled)
}

interface RAGResult {
  chunkId: string;
  fileId: string;
  filename: string;
  content: string;
  similarity: number;
  chunkIndex: number;
}
```

### `AppSettings` (types/index.ts)

```typescript
interface AppSettings {
  // ... existing fields
  ragDefaults: {
    topK: number;                  // Default 5
    minSimilarity: number;         // Default 0.3
    embeddingModel: string;        // Default 'all-MiniLM-L6-v2'
  };
}
```

### Dexie Migration

No new Dexie tables — all RAG data lives in the backend SQLite. The frontend stores only `ragConfig` on `Conversation` (optional field, no index needed) and `ragDefaults` in `AppSettings`.

---

## Chunking Pipeline

### Strategy

Fixed-size chunks with overlap, split on sentence boundaries:

1. Split extracted text into sentences (using period + whitespace as delimiter, with abbreviation handling).
2. Accumulate sentences into chunks of ~500 tokens (estimated at 4 chars/token).
3. Each chunk overlaps by ~50 tokens with the previous chunk (to preserve context at boundaries).
4. Chunks shorter than 20 tokens are merged into the previous chunk.

```typescript
interface ChunkConfig {
  targetTokens: number;     // 500
  overlapTokens: number;    // 50
  minTokens: number;        // 20
}

function chunkText(text: string, config: ChunkConfig): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    if (currentTokens + sentenceTokens > config.targetTokens && currentTokens >= config.minTokens) {
      chunks.push(current.join(' '));
      // Keep overlap: retain last N tokens worth of sentences
      const overlapSentences = getOverlapSentences(current, config.overlapTokens);
      current = [...overlapSentences];
      currentTokens = estimateTokens(current.join(' '));
    }
    current.push(sentence);
    currentTokens += sentenceTokens;
  }
  if (current.length > 0) {
    chunks.push(current.join(' '));
  }
  return chunks;
}
```

### Triggering

Chunking + embedding runs automatically when:

1. **File uploaded**: new file is chunked and embedded immediately after text extraction completes.
2. **RAG first enabled**: all existing project files that haven't been chunked yet are processed in a batch.
3. **File updated/replaced**: old chunks deleted, new chunks created.
4. **File deleted**: associated chunks deleted (CASCADE in SQLite).

### Embedding Model

Default: `all-MiniLM-L6-v2` via `@xenova/transformers` (Transformers.js) running in Node.js on the backend.

- 384-dimensional embeddings.
- ~50ms per chunk on CPU.
- Model downloaded on first use (~23MB).
- Batch embedding: process 32 chunks at a time for efficiency.

```typescript
// server/src/services/embeddings.ts
import { pipeline } from '@xenova/transformers';

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const model = await getEmbedder();
  const results = await model(texts, { pooling: 'mean', normalize: true });
  return texts.map((_, i) => results[i].data as Float32Array);
}
```

---

## Retrieval

### Backend Route

```typescript
// POST /api/rag/search
// Request: {
//   query: string,
//   projectId: string,
//   topK?: number,         // default 5
//   minSimilarity?: number // default 0.3
// }
// Response: {
//   results: RAGResult[],
//   queryEmbeddingTimeMs: number,
//   searchTimeMs: number
// }
```

### Search Implementation

```typescript
async function searchChunks(
  query: string,
  projectId: string,
  topK: number,
  minSimilarity: number
): Promise<RAGResult[]> {
  // 1. Embed the query
  const [queryEmbedding] = await embedTexts([query]);

  // 2. Search
  if (sqliteVecAvailable) {
    // Use sqlite-vec for efficient vector search
    const results = db.prepare(`
      SELECT dc.id, dc.file_id, dc.content, dc.chunk_index, pf.filename,
             vec_distance_cosine(dce.embedding, ?) as distance
      FROM document_chunk_embeddings dce
      JOIN document_chunks dc ON dc.id = dce.id
      JOIN project_files pf ON pf.id = dc.file_id
      WHERE dc.project_id = ?
      ORDER BY distance ASC
      LIMIT ?
    `).all(queryEmbedding.buffer, projectId, topK);

    return results
      .map(r => ({ ...r, similarity: 1 - r.distance }))
      .filter(r => r.similarity >= minSimilarity);
  }

  // Brute-force fallback
  const allChunks = db.prepare(`
    SELECT dc.*, pf.filename FROM document_chunks dc
    JOIN project_files pf ON pf.id = dc.file_id
    WHERE dc.project_id = ? AND dc.embedding IS NOT NULL
  `).all(projectId);

  return allChunks
    .map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, new Float32Array(chunk.embedding)),
    }))
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

---

## System Prompt Integration

Retrieved chunks are injected into the system prompt assembly pipeline at **stage 3** (after cascade resolution and file index augmentation):

```typescript
function assembleSystemPrompt(nodeId, nodes, defaultSystemPrompt, options) {
  // Stage 1: Cascade resolution (Feature 09)
  let prompt = resolveCascade(nodeId, nodes, n => n.systemPromptOverride, defaultSystemPrompt);

  // Stage 2: File index augmentation (Feature 13 — agentic mode)
  if (options.fileIndex) {
    prompt += '\n\n---\n\n' + options.fileIndex;
  }

  // Stage 3: RAG context augmentation (Feature 36 — NEW)
  if (options.ragContext) {
    prompt += '\n\n---\n\n' + options.ragContext;
  }

  // Stage 4: Conversation RAG (Feature 19 — future)
  if (options.conversationRagContext) {
    prompt += '\n\n---\n\n' + options.conversationRagContext;
  }

  return prompt;
}
```

### RAG Context Format

```
The following excerpts from your project files may be relevant to the current question. Use this context if helpful, but prioritize the current conversation.

---
[From "research-notes.md", chunk 3/12, similarity: 0.87]
The primary mechanism of quantum error correction involves encoding
logical qubits across multiple physical qubits, creating redundancy
that allows the system to detect and correct errors without...

---
[From "paper.pdf", chunk 7/24, similarity: 0.79]
Recent experimental results from IBM's Eagle processor demonstrate
that surface codes can achieve error rates below the threshold...
```

Each chunk includes its source filename, position, and similarity score for transparency.

---

## Frontend Integration

### Tool Resolution (in `useStreamingResponse.ts`)

Before sending a message, check if RAG is enabled and retrieve context:

```typescript
async function resolveRAGContext(
  conversation: Conversation,
  userMessage: string
): Promise<string | undefined> {
  if (!conversation.ragConfig?.enabled) return undefined;
  if (!conversation.projectId) return undefined;

  const { topK, minSimilarity } = conversation.ragConfig;
  const response = await backendFetch('/api/rag/search', {
    method: 'POST',
    body: JSON.stringify({
      query: userMessage,
      projectId: conversation.projectId,
      topK,
      minSimilarity,
    }),
  });

  if (response.results.length === 0) return undefined;
  return formatRAGContext(response.results);
}
```

---

## UI

### Knowledge Mode Extension

Extend the existing knowledge mode toggle (Feature 13) with a RAG option:

```
📁 Knowledge: [Off] [@Mention] [Agentic] [RAG]
```

When RAG is selected:
- Chunks are retrieved on each message send.
- Retrieved context is injected into the system prompt.
- The `@mention` and `read_file` tools are still available (RAG is additive).
- A "N refs" badge appears on assistant nodes that received RAG context.

### RAG Settings (per-conversation)

Clicking a gear icon next to the RAG toggle opens a small popover:

```
┌── RAG Settings ──────────────────────┐
│ Results per query: [5       ]        │
│ Min similarity:    [0.3     ]        │
│                                      │
│ Index status: ✓ 142 chunks indexed   │
│               from 8 files           │
│               Last updated: 2m ago   │
│                                      │
│ [Re-index files]                     │
└──────────────────────────────────────┘
```

### RAG Reference Display

When RAG context was used, the assistant node shows a badge:

```
┌─────────────────────────────────────────────────────────┐
│ Claude                              📚 3 refs           │
│                                                          │
│ Based on the research notes and paper, quantum error     │
│ correction has achieved...                               │
└─────────────────────────────────────────────────────────┘
```

Clicking "3 refs" in the detail panel expands the retrieved chunks:

```
RAG Context (3 chunks retrieved)
  ┌─────────────────────────────────────────────────────────┐
  │ 📄 research-notes.md (chunk 3/12)      similarity: 0.87│
  │ "The primary mechanism of quantum error correction..."  │
  ├─────────────────────────────────────────────────────────┤
  │ 📄 paper.pdf (chunk 7/24)              similarity: 0.79│
  │ "Recent experimental results from IBM's Eagle..."       │
  ├─────────────────────────────────────────────────────────┤
  │ 📄 research-notes.md (chunk 8/12)      similarity: 0.71│
  │ "The implications for quantum computing scalability..." │
  └─────────────────────────────────────────────────────────┘
```

### Indexing Progress

When RAG is first enabled or files are uploaded, show indexing progress:

```
📚 Indexing documents... (42/128 chunks)
██████████████░░░░░░░░░  33%
```

This appears as a toast notification or inline indicator in the knowledge mode area.

---

## Backend Routes

```typescript
// POST /api/rag/search — retrieve relevant chunks
// GET /api/rag/status/:projectId — indexing status
// POST /api/rag/reindex/:projectId — force re-index all files
```

### Hook into File Upload

When a file is uploaded (existing `POST /api/files/upload`), after text extraction:

1. Chunk the extracted text.
2. Insert chunks into `document_chunks` table.
3. Queue embedding (can be synchronous for small files, background for large ones).
4. Update `embedding_status` for the project.

When a file is deleted (existing `DELETE /api/files/:id`):
1. Cascade delete removes chunks automatically.
2. Update `embedding_status`.

---

## Performance Considerations

| Metric | Value | Notes |
|--------|-------|-------|
| Embedding speed | ~50ms/chunk | all-MiniLM-L6-v2 on CPU |
| Batch embedding | 32 chunks/batch | ~1.6s per batch |
| 100 pages of PDF | ~200 chunks | ~10s to index |
| Search (sqlite-vec) | <5ms | Optimized vector search |
| Search (brute-force) | <50ms for 10K chunks | Acceptable for typical project sizes |
| Storage per chunk | ~1.5KB embedding + text | 10K chunks ≈ 15MB |
| Retrieval overhead per message | ~100ms total | Embed query + search + format |

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/services/embeddings.ts` | Embedding model management and inference |
| `server/src/services/chunking.ts` | Text chunking pipeline |
| `server/src/services/rag.ts` | RAG search and retrieval logic |
| `server/src/routes/rag.ts` | Fastify routes for `/api/rag/*` |
| `src/api/rag.ts` | Frontend API client for RAG endpoints |
| `src/components/chat/RAGSettingsPopover.tsx` | Per-conversation RAG settings |
| `src/components/tree/RAGContextDisplay.tsx` | RAG reference display in detail panel |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `RAGConfig`, `RAGResult` types; add `ragConfig` to `Conversation`; add `ragDefaults` to `AppSettings` |
| `src/hooks/useStreamingResponse.ts` | Add RAG context retrieval before message send; store RAG results on node |
| `src/store/useSettingsStore.ts` | Add `ragDefaults` to settings |
| `src/components/chat/ChatInput.tsx` | Extend knowledge mode toggle with RAG option |
| `src/components/tree/NodeDetailPanel.tsx` | Show RAG refs badge and expandable context |
| `server/src/routes/files.ts` | Hook chunking + embedding into file upload/delete |
| `server/src/index.ts` | Register RAG routes |
| `server/package.json` | Add `@xenova/transformers` dependency |

## Implementation Order

1. **Embedding service**: model loading, batch embedding.
2. **Chunking pipeline**: text splitting with overlap.
3. **Database schema**: `document_chunks`, `embedding_status` tables.
4. **Hook into file upload**: chunk + embed on upload, cascade delete.
5. **Search endpoint**: query embedding + vector search.
6. **Frontend RAG context resolution**: retrieve + inject into system prompt.
7. **Knowledge mode UI**: extend toggle with RAG option.
8. **RAG reference display**: badge + expandable context.
9. **Indexing progress UI**: toast notification.

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty user message → skip RAG retrieval (nothing to search for). No project files → RAG toggle disabled with tooltip "Upload files to enable RAG." |
| What if the external dependency is unavailable? | Embedding model download fails → show error in RAG status, disable RAG. Backend unavailable → RAG toggle hidden (feature gating). sqlite-vec unavailable → fall back to brute-force search. |
| What if this runs concurrently with itself? | Two messages sent quickly → two independent RAG searches. Embedding pipeline uses a queue to prevent concurrent model loads. |
| What happens on the second invocation? | RAG retrieval runs fresh on each message. Results may differ as the query changes. Previous RAG context is NOT carried forward (each turn is independent). |
| What if the user's data is larger than expected? | Large files (>1MB text) may produce 2000+ chunks — embedding takes ~60s. Show progress. Search remains fast even at 50K chunks (brute-force ~250ms, sqlite-vec <10ms). |
| What state persists vs. resets across page reload? | `ragConfig` persists on Conversation (IndexedDB). Embeddings persist in backend SQLite. RAG results per-message could be stored on the node (optional — currently ephemeral). |

## Browser-Only Mode

Document RAG is **degraded** in browser-only mode:
- **Chunking**: works (pure text processing).
- **Embedding**: works via Transformers.js in the browser (slower — ~200ms/chunk, model download ~23MB).
- **Storage**: embeddings stored in a new Dexie table `documentChunks` with `Float32Array` embedding field.
- **Search**: brute-force cosine similarity in JS (fast enough for < 10K chunks).
- **Limitation**: only text files (no PDF/OCR without backend).

The feature gating distinguishes `ragDocuments: true` (always available) from `ragDocumentsFull: boolean` (backend available — includes PDF/OCR files).
