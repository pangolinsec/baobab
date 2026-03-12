# 19 — RAG Over Conversations

## Summary

Use the conversation's accumulated messages as a knowledge base for retrieval-augmented generation. When answering a new question, the system can search across all previous messages in the conversation (or across all conversations) to find relevant context and inject it into the prompt.

## Priority

Tier 4 — lowest priority. Nice-to-have.

## Dependencies

- **00 Backend Architecture**: embedding storage and vector search.
- **20 Search**: shares the full-text search infrastructure.

## Concept

Standard RAG pipeline applied to conversation history:

1. **Index**: embed all messages and store vectors.
2. **Retrieve**: when a new message is sent, embed the query and find the most relevant historical messages.
3. **Augment**: inject the retrieved messages into the prompt as additional context.
4. **Generate**: the model responds with awareness of relevant prior conversation content.

## Architecture

### Embedding Index

Each message gets embedded when created (or on-demand when RAG is first enabled).

Storage:
- **Backend**: SQLite with a vector extension (`sqlite-vec`, the actively maintained successor to the deprecated `sqlite-vss`) or a simple brute-force cosine search over stored embeddings (fine for < 100K messages).
- **Browser-only**: embeddings stored in IndexedDB; brute-force search in JS.

### Embedding Model

Default: `all-MiniLM-L6-v2` (384-dim, fast, good quality). Same model used in feature 17.

### Retrieval

```typescript
interface RAGResult {
  nodeId: string;
  conversationId: string;
  content: string;
  similarity: number;
  role: MessageRole;
}

async function retrieveRelevant(
  query: string,
  scope: 'conversation' | 'all',
  conversationId?: string,
  topK: number = 5
): Promise<RAGResult[]> {
  const queryEmbedding = await embed(query);
  const candidates = scope === 'conversation'
    ? await getEmbeddings(conversationId)
    : await getAllEmbeddings();
  return cosineSimilarityTopK(queryEmbedding, candidates, topK);
}
```

### Augmentation

> **Open question**: RAG injects retrieved context into the system prompt, but Feature 09 (System Prompt Cascade) defines a cascade where the resolved system prompt is the last override on the root-to-node path. The interaction between RAG augmentation and the cascade needs to be resolved before implementation. Options include: (a) append RAG context after cascade resolution, (b) treat RAG as a separate context block outside the system prompt, (c) inject RAG context as early user messages instead of system prompt. Since RAG is Tier 4, this can be resolved when implementation begins.

Retrieved messages are injected as additional context in the system prompt:

```
The following messages from previous conversations may be relevant to the current question:

---
[From "Biology Chat", Assistant]:
Frogs undergo metamorphosis from tadpole to adult, involving significant
physiological changes including the development of lungs...

[From "Biology Chat", User]:
What about the differences between frogs and toads?
---

Use this context if relevant, but prioritize the current conversation.
```

## UI

### Toggle

A simple toggle in the conversation header or chat input:

```
🧠 RAG [off]   Scope: [This chat ▾]
```

Scope options:
- **This conversation**: only retrieve from the current conversation's messages.
- **This project**: retrieve from all conversations in the current project (if projects are set up).
- **All conversations**: retrieve from everything.

### Indicator

When RAG is active and context was retrieved, show a small indicator on the assistant response:

```
┌─────────────────────────────────────────┐
│ 🔮 Claude              🧠 3 refs       │
│ Based on our earlier discussion...      │
└─────────────────────────────────────────┘
```

Clicking "3 refs" in the detail panel shows which messages were retrieved and their similarity scores.

## Embedding Pipeline

### On Message Creation

When a message is finalized (streaming complete):
1. Embed the message content.
2. Store the embedding vector alongside the message ID.

This happens in the background and doesn't block the UI.

### Batch Embedding (First Enable)

When RAG is first enabled on a conversation with existing messages:
1. Show a progress indicator: "Indexing messages... (42/128)".
2. Embed all un-embedded messages in batches.
3. Cache embeddings for reuse.

## Data Model

### Backend (SQLite)

```sql
CREATE TABLE message_embeddings (
  node_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  embedding BLOB NOT NULL,        -- float32 array serialized
  created_at INTEGER NOT NULL
);
```

### Frontend (IndexedDB)

```typescript
interface MessageEmbedding {
  nodeId: string;
  conversationId: string;
  embedding: Float32Array;
}
```

Dexie table: `embeddings: 'nodeId, conversationId'`

## Performance Considerations

- **Embedding on every message**: the embedding is small and fast (~50ms for MiniLM). Acceptable overhead.
- **Search over large collections**: brute-force cosine similarity over 10K embeddings of 384-dim vectors takes <10ms. No need for approximate nearest neighbors until >100K messages.
- **Storage**: 384 floats × 4 bytes = 1.5KB per message. 10K messages = 15MB. Manageable.

## Browser-Only Mode

Fully functional using Transformers.js for embeddings and IndexedDB for vector storage. Brute-force search in JS is fast enough for typical usage.

## Edge Cases

- **Very short messages** ("yes", "ok"): these produce low-quality embeddings. Filter out messages shorter than ~20 characters from the index.
- **Tool nodes**: exclude tool_use nodes from the embedding index (they're metadata, not content).
- **Summary/merge nodes**: include these — they contain valuable synthesized content.
- **Embedding source of truth**: when the backend is present, embeddings live in the backend `message_embeddings` table only (not duplicated in frontend IndexedDB). The frontend fetches embeddings on demand for search. In browser-only mode, embeddings live in the IndexedDB `embeddings` table.
