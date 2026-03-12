# 00 — Backend Architecture

## Summary

Add a lightweight backend API service to the Docker setup to support features that can't run browser-only: web search proxying, file storage/processing, and heavy ML inference. The frontend remains a Vite SPA that can operate partially without the backend (direct LLM calls still work), but search, file processing, and classifiers route through the API.

## Priority

Tier 1 — foundational; blocks Tier 3 and Tier 4 features.

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 22 | Same as frontend, shared TS types |
| Framework | Fastify | Fast, TypeScript-native, schema validation built-in |
| Database | SQLite via better-sqlite3 | Zero-config, single-file, perfect for self-hosted app |
| File storage | Filesystem (`/data/files/`) | Simple, inspectable, backed by Docker volume |
| PDF extraction | pdf-parse | Pure JS, no native deps |
| OCR | tesseract.js | Runs in Node without native binaries |
| ORM/Query | Drizzle ORM | Lightweight, type-safe, works with SQLite |

## Docker Compose Changes

```yaml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "5173:5173"
    volumes:
      - ./src:/app/src
      - ./index.html:/app/index.html
      - ./public:/app/public
      - ./vite.config.ts:/app/vite.config.ts
      - ./tsconfig.json:/app/tsconfig.json
      - ./tsconfig.app.json:/app/tsconfig.app.json
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3001

  api:
    build:
      context: ./server
      target: dev
    ports:
      - "3001:3001"
    volumes:
      - ./server/src:/app/src
      - baobab-data:/app/data
      - /app/node_modules
    environment:
      - PORT=3001
      - DATA_DIR=/app/data

volumes:
  baobab-data:
```

## Directory Structure

```
server/
  Dockerfile
  package.json
  tsconfig.json
  src/
    index.ts              # Fastify entry point
    routes/
      search.ts           # Web search proxy endpoints
      files.ts            # File upload, processing, retrieval
      models.ts           # ML model inference proxy (classifiers, embeddings)
    services/
      search/
        duckduckgo.ts
        tavily.ts
        bing.ts
      files/
        pdf.ts            # PDF text extraction
        ocr.ts            # Image OCR via tesseract.js
        storage.ts        # File CRUD on filesystem
      ml/
        transformers.ts   # Server-side Transformers.js inference
    db/
      schema.ts           # Drizzle schema: projects, files, tags
      migrate.ts
    types/
      index.ts            # Shared types (can be imported by frontend)
```

## API Endpoints

### Search
- `POST /api/search` — `{ provider: 'duckduckgo' | 'tavily' | 'bing', query: string, options?: {} }` → `{ results: SearchResult[] }`

### Files
- `POST /api/files/upload` — multipart upload → `{ id, filename, mimeType, extractedText }`
- `GET /api/files/:id` — download original file
- `GET /api/files/:id/text` — get extracted text content
- `DELETE /api/files/:id`
- `GET /api/projects/:projectId/files` — list files in project

### ML Inference
- `POST /api/ml/classify` — `{ text, model, labels }` → `{ scores }`
- `POST /api/ml/embed` — `{ texts[], model }` → `{ embeddings[][] }`
- `POST /api/ml/compare` — `{ textA, textB, model }` → `{ similarity }`

## Frontend Integration

The frontend uses a `VITE_API_URL` environment variable. All backend calls go through a thin client:

```typescript
// src/api/backend.ts
const API_URL = import.meta.env.VITE_API_URL || '';

export async function backendFetch(path: string, options?: RequestInit) {
  if (!API_URL) throw new Error('Backend not configured');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function isBackendAvailable(): boolean {
  return !!API_URL;
}
```

Features check `isBackendAvailable()` and gracefully hide/disable UI elements when the backend isn't present (browser-only mode).

## Database Schema (SQLite)

The backend database stores file metadata and a tag autocomplete cache. Conversations, nodes, projects, and settings remain in the browser's IndexedDB — the backend doesn't need them. See ADR-001 Decision 9.

```sql
CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,      -- references frontend project ID (no FK — project record is in IndexedDB)
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  extracted_text TEXT,
  file_path TEXT NOT NULL,       -- path on disk relative to DATA_DIR
  created_at INTEGER NOT NULL
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,     -- supports slash notation: "research/biology"
  created_at INTEGER NOT NULL
);
```

**Note on `projects`**: There is no `projects` table in SQLite. Project metadata (id, name, timestamps) lives exclusively in the frontend's IndexedDB. The backend `project_files` table references `project_id` as a loose key — the backend trusts that the frontend-provided ID is valid. When a frontend project is deleted, the frontend calls `DELETE /api/projects/:id` and the backend cascades to delete associated files.

**Note on `tags`**: The backend `tags` table is an **autocomplete cache**, not a source of truth. The authoritative tag data is `conversation.tags: string[]` in IndexedDB. The frontend pushes tag changes to the backend via `PUT /api/tags`. During startup reconciliation, the frontend prunes backend tags that no longer exist on any conversation. When the backend is unavailable, autocomplete works by scanning `conversation.tags` across all IndexedDB conversations. See Feature 24.

## Data Ownership

| Data | Owner | Non-Owner | Sync Direction |
|------|-------|-----------|---------------|
| Conversations | Frontend (IndexedDB) | Never in backend | — |
| Tree Nodes | Frontend (IndexedDB) | Never in backend | — |
| AppSettings | Frontend (IndexedDB) | Never in backend | — |
| Projects (metadata) | Frontend (IndexedDB) | Backend (for file association) | Frontend → Backend |
| Project Files | Backend (SQLite + disk) | Frontend (lightweight index in memory) | Backend → Frontend |
| Tags (canonical list) | Frontend (IndexedDB, derived from conversations) | Backend SQLite (autocomplete cache) | Frontend → Backend |
| Tag-Conversation associations | Frontend (IndexedDB) | Never in backend | — |

### Startup Reconciliation

When the app loads and the backend is available, a lightweight reconciliation runs:

1. **Projects**: Push all frontend projects to backend via bulk `POST /api/sync`. Delete orphan backend projects (ones not in the frontend — the user deleted them while offline).
2. **Tags**: Push all tags derived from `conversation.tags` to backend. Prune backend tags that no longer appear on any frontend conversation.
3. **Files**: Pull file metadata from backend into in-memory Zustand cache for autocomplete.

If the backend is unavailable, reconciliation is skipped — the frontend operates in browser-only mode.

### API Endpoints for Sync

```
POST /api/sync              -- bulk initial sync (projects + tags in one round-trip)
PUT  /api/projects          -- upsert project (idempotent)
DELETE /api/projects/:id    -- delete project and associated files
PUT  /api/tags              -- upsert tag
GET  /api/tags              -- list all tags (for autocomplete)
```

#### `POST /api/sync` — Bulk Initial Sync

Single round-trip endpoint for startup reconciliation. The frontend sends its current projects and tags; the backend reconciles and returns the full state.

```typescript
// Request
interface SyncRequest {
  projects: { action: 'upsert' | 'delete'; data: Project }[];
  tags: { action: 'upsert'; name: string }[];
}

// Response
interface SyncResponse {
  projects: Project[];          // full list of projects after sync
  tags: { name: string }[];    // full canonical tag list after sync
  files: ProjectFile[];         // all file metadata across all projects
}
```

The frontend calls this once at startup when the backend is available. It replaces N individual requests with a single round-trip:

1. **Projects**: upserts push local projects to backend; deletes remove orphan backend projects (deleted locally while offline).
2. **Tags**: upserts ensure all frontend-derived tags exist in the backend autocomplete cache. The backend may also prune tags not present in the request (per ADR-001 Decision 3).
3. **Response**: the backend returns the full post-sync state so the frontend can populate its in-memory caches (file metadata, tag autocomplete) without additional requests.

## Error Response Format

All API endpoints return errors in a consistent JSON format:

```typescript
interface ApiError {
  error: string;          // human-readable error message
  code?: string;          // machine-readable error code (e.g., 'FILE_NOT_FOUND', 'INVALID_MIME_TYPE')
  details?: unknown;      // optional structured details (validation errors, etc.)
}
```

### HTTP Status Codes

| Status | Usage |
|--------|-------|
| `400` | Invalid request body, missing required fields, unsupported file type |
| `404` | Resource not found (file, project) |
| `413` | File exceeds size limit |
| `422` | Semantically invalid request (e.g., project ID references non-existent project) |
| `500` | Internal server error (DB failure, file system error, ML inference error) |

### Examples

```json
// 400 — missing required field
{ "error": "Missing required field: query", "code": "MISSING_FIELD" }

// 404 — file not found
{ "error": "File not found", "code": "FILE_NOT_FOUND" }

// 413 — file too large
{ "error": "File exceeds maximum size of 10 MB", "code": "FILE_TOO_LARGE" }

// 500 — internal error
{ "error": "PDF text extraction failed", "code": "EXTRACTION_ERROR" }
```

### Frontend Error Handling

The `backendFetch` helper parses error responses and throws structured errors:

```typescript
export class BackendError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export async function backendFetch(path: string, options?: RequestInit) {
  if (!API_URL) throw new Error('Backend not configured');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new BackendError(body.error, res.status, body.code, body.details);
  }
  return res.json();
}
```

## CORS Configuration

The Fastify server enables CORS for the frontend origin:

```typescript
app.register(cors, {
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
```

## Health Check

`GET /api/health` → `{ status: 'ok', version: string }`

The frontend can ping this on load to determine if the backend is available and conditionally enable backend-dependent features.
