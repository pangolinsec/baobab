# Baobab Feature Specs

## Implementation Status (as of 2026-02-23)

### Status Key

- **Done** — fully implemented and tested
- **Partial** — core functionality works, specific gaps noted
- **Not started** — no implementation exists

### Tier 1 — Core UX

| # | Feature | Dependencies | Status | Remaining |
|---|---------|-------------|--------|-----------|
| 00 | [Backend Architecture](00-backend-architecture.md) | — | Partial | ML inference routes, sync endpoint, Drizzle migrations ([details](#feature-00--backend-remaining)) |
| 02 | [GUID-Based Routing](02-guid-routing.md) | — | Done | — |
| 04 | [Advanced API Configuration](04-advanced-config.md) | — | Done | — |
| 08 | [Model Cascade](08-model-cascade.md) | None (Phase 1), 07 (Phase 2) | Done | Phase 2 grouped dropdown deferred until 07 UI polish |
| 09 | [System Prompt Cascade](09-system-prompt-cascade.md) | — | Done | — |
| 10 | [Visual Indicators](10-visual-indicators.md) | 08, 09 | Partial | Cascade traceability tooltips, indicator chips on assistant nodes ([details](#feature-10--visual-indicators-remaining)) |
| 23 | [Resend / Duplicate](23-resend-duplicate.md) | — | Partial | Phase C: retry failed requests ([details](#feature-23--resend--duplicate-remaining)) |
| 32 | [Conversation Management](32-conversation-management.md) | — | Not started | Rename chats (inline + context menu + LLM titles), assign-to-project dropdown in conversation header |

### Tier 2 — Power Features

| # | Feature | Dependencies | Status | Remaining |
|---|---------|-------------|--------|-----------|
| 07 | [Inference Providers](07-inference-providers.md) | 00 | Done | 07b bugfixes all resolved (SSE, o1/o3, HF, OpenRouter, registry) |
| 11 | [Star Messages](11-star-messages.md) | — | Done | — |
| 12 | [Dead-End Branches](12-dead-end-branches.md) | — | Done | — |
| 15 | [Summarize Branches](15-summarize-branches.md) | — | Done | — |
| 20 | [Search](20-search.md) | — | Done | — |
| 21 | [Thread / Chat View](21-thread-view.md) | — | Done | — |
| 24 | [Tags](24-tags.md) | — | Done | — |
| 25 | [Thread View Metadata Parity](25-thread-view-metadata-parity.md) | 10, 21, 23 | Partial | Multiple gaps ([details](#feature-25--thread-view-metadata-parity-remaining)) |
| 28 | [Manual Tree Editing](28-manual-tree-editing.md) | 23, 13 | Partial | Phase C (knowledge toggle relocation) implemented but uncommitted |
| 29 | [Batch Prompt Execution](29-batch-prompt-execution.md) | 07, 08, 16 | Not started | Phased: A (core batch), B (system prompt variants), C (synthesis), D (templates) |
| 30 | [Project UX](30-project-ux.md) | 13 | Done | — |
| 38 | [Import/Export Enhancements](38-import-export-enhancements.md) | 13 | Not started | Phased: A (bulk), B (projects), C (markdown), D (ChatGPT import), E (settings) |

### Tier 3 — Requires Backend

| # | Feature | Dependencies | Status | Remaining |
|---|---------|-------------|--------|-----------|
| 05 | [Web Search Tool](05-web-search.md) | 00, 07 | Done | — |
| 13 | [Project Knowledge](13-project-knowledge.md) | 00, 24 | Done | All phases A–C complete |
| 16 | [Merge Branches](16-merge-branches.md) | 15 | Done | — |
| 22 | [Pricing Transparency](22-pricing.md) | 07 | Done | — |
| 33 | [HTTP Tool Extensions](33-http-tool-extensions.md) | 00, 05, 07 | Not started | Phased: A (core tools + proxy), B (import/export tool configs) |
| 34 | [Code Interpreter](34-code-interpreter.md) | 00, 05 | Not started | Phased: A (Docker sandbox), B (visualization), C (browser fallback), D (persistent sandbox) |
| 35 | [Web Search Enhancements](35-web-search-enhancements.md) | 00, 05 | Not started | Phased: A (SearXNG + Brave), B (citation tracking), C (URL fetching) |
| 36 | [Document RAG](36-document-rag.md) | 00, 13 | Not started | Embedding pipeline, chunking, vector search, knowledge mode extension |

### Tier 4 — Advanced / Research

| # | Feature | Dependencies | Status | Remaining |
|---|---------|-------------|--------|-----------|
| 06 | [Research Agent](06-research-agent.md) | 00 (web-search), 05 (web-search), 07 | Not started | Full feature — unified spec ([details](#feature-06--research-agent)) |
| 17 | [Compare & Classify](17-compare-classify.md) | 00 | Not started | Full feature ([details](#feature-17--compare--classify)) |
| 19 | [RAG Over Conversations](19-rag.md) | 00, 20 | Not started | Full feature ([details](#feature-19--rag-over-conversations)) |
| 26 | [Tollbooth Sync](26-tollbooth-sync.md) | 24, 07 | Not started | Full feature ([details](#feature-26--tollbooth-sync)) |
| 27 | [MCP Servers](27-mcp-servers.md) | 00, 05, 07 | Not started | Full feature ([details](#feature-27--mcp-servers)) |
| 37 | [Multi-User and Auth](37-multi-user-auth.md) | 00 (all features) | Not started | Phased: A (auth), B (data migration), C (admin), D (shared resources) |
| 39 | [Reasoning Block Injection](39-reasoning-block-injection.md) | 04, 07, 08, ADR-020 (Phase B) | Not started | Phased: A (Anthropic native + plaintext fallback), B (OpenAI Responses API migration) |
| 40 | [Azure Foundry + OpenAI Reasoning](40-azure-foundry-openai-reasoning.md) | 07, 39 (Phase A), ADR-023 | Not started | Phased: A (Azure provider, Chat Completions), B (Responses API + reasoning capture), C (cross-provider reasoning copy/paste) |

---

## Remaining Work Details

### Feature 00 — Backend Remaining

The Fastify backend exists and is functional (`server/` directory, Docker Compose `api` service on port 3001). What's implemented:

- Health endpoint, CORS, Docker service with data volume
- File routes: upload, list, get text, delete (with PDF extraction via pdf-parse and OCR via tesseract.js)
- Search routes: DuckDuckGo (lite + Instant Answer), Tavily, Bing — all fully working
- Project routes: list, upsert (no-op), cascade delete
- SQLite via better-sqlite3 with `project_files` and `tags` tables
- Frontend `backend.ts` client with health check caching

**Still missing per spec:**

1. **ML inference routes** — `POST /api/ml/classify`, `/api/ml/embed`, `/api/ml/compare`. These are needed by Feature 17 (Compare & Classify) and Feature 19 (RAG). Requires adding `@xenova/transformers` (or equivalent) to the server and building the inference pipeline.
2. **Bulk sync endpoint** — `POST /api/sync` for startup reconciliation (projects + tags in one round-trip). Currently the project upsert (`PUT /api/projects`) is a no-op, and there are no tag CRUD routes (`PUT /api/tags`, `GET /api/tags`). The frontend reconciliation in `reconcileProjects.ts` works around this with individual calls.
3. **Drizzle ORM migrations** — The spec calls for Drizzle ORM with a migration runner (`server/src/db/migrate.ts`). The current implementation uses raw `better-sqlite3` SQL with manual `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` column additions. Works, but doesn't match the spec's Drizzle-based approach.
4. **Models route** — `GET /api/models` is a placeholder returning `{ models: [] }`. Spec envisions this as a CORS proxy for providers that block browser requests. Low priority since all current providers work from the browser.

None of these gaps block any currently implemented feature. They become relevant when building Feature 06, 17, 19, or 27.

### Feature 10 — Visual Indicators Remaining

Core indicator logic exists in `src/lib/indicators.ts` and is wired into `MessageNode.tsx`. Gaps:

1. **Orange border only on user nodes** — `MessageNode.tsx` gates the override border on `isUser && hasAnyOverride`. Spec says any node with overrides gets the ring.
2. **Model/system chips only shown for overridden user nodes** — spec says model chip always displays on all nodes (useful context even without overrides).
3. **Cascade traceability tooltips** — spec requires hover tooltips showing the full resolution chain (global → chat → branch → message, with "← winner" marker). Not implemented.
4. **`settingsOverridden` hardcoded false** — `indicators.ts` line 38 always returns false for the settings chip. Needs per-node temperature/thinking override fields on `TreeNode` (which don't exist yet).

### Feature 23 — Resend / Duplicate Remaining

Phases A (resend) and B (duplicate & edit) are complete. Phase C (retry failed requests) is not:

1. **Retry button on error nodes** — detail panel action `[Retry]` and context menu item for nodes where the API call failed.
2. **Retry flow** — delete the error node, create a fresh assistant placeholder, rebuild context from the parent user node, resend with the same model/settings.
3. **Retry with different model** — Shift+click variant opens a model selector dropdown before retrying.

### Feature 25 — Thread View Metadata Parity Remaining

The thread view has basic model chips and some actions but is missing full parity with the tree view detail panel:

1. **Model chips always visible** — currently conditional on overrides. Spec: always show, muted when same as previous turn, accent when different.
2. **System prompt for all node types** — currently only resolved for user nodes with `systemPromptOverride`. Should show the effective system prompt for every node.
3. **Missing hover actions** — Duplicate & Edit (assistant nodes), dead-end toggle, delete subtree. Currently only has reply, resend, retry, copy, delete.
4. **Badge layout** — spec puts all badges (edited, summary, starred, dead-end, reply target) in a consistent header row after chips. Current implementation scatters them.

### Feature 06 — Research Agent

Plan-and-execute research pipeline. Two exclusive modes — tree-search (browser-only) and web-search. Scope:

- **Data model**: `ResearchRun` type with config, plan, process nodes, and report. New Dexie table. `TreeNode.researchRunId` field for linking.
- **Architecture**: Plan-then-execute with planner, sub-agents (sequential), and synthesizer. Two model selections per run (frontier planner + cheap sub-agents).
- **Tools**: 5 tree-search tools (`get_tree_overview`, `search_nodes`, `read_node`, `list_branches`, `get_conversation_path`), 2 web-search tools (`web_search`, `fetch_page`), 1 shared tool (`record_finding`).
- **UI**: Research view (4th view mode) with run list, report viewer (markdown with citations), process tree viewer, download/export, add-to-project. Green research icon on trigger nodes.
- **Entry points**: Chat input toggle (web-search), right-click node (tree-search).
- **Settings**: Research tab with default prompts (mode-specific), models, limits.

### Feature 17 — Compare & Classify

Full feature not started. Requires ML inference routes on backend (or client-side Transformers.js). Scope:

- **Three comparison modes**: Classifier (sentiment/zero-shot), Embeddings (cosine similarity), Prompt-based (LLM comparison)
- **Compare dialog** from multi-select (shared infra exists via Feature 16)
- **Scoring/heatmap overlay**: Ephemeral color gradient on tree nodes with legend
- **ML pipeline**: Transformers.js client-side and/or server-side via HuggingFace Inference API

### Feature 19 — RAG Over Conversations

Full feature not started. Requires embedding infrastructure. Scope:

- **Embedding pipeline**: Embed messages on creation (async), batch embed on first enable
- **Storage**: SQLite `message_embeddings` table (backend) or Dexie with Float32Array (browser-only)
- **Retrieval**: Top-k cosine similarity search, scoped to conversation/project/all
- **Augmentation**: Inject retrieved context into system prompt (stage 3 of assembly pipeline)
- **UI**: Toggle + scope selector in conversation header, "N refs" indicator on nodes

### Feature 26 — Tollbooth Sync

Full feature not started. Requires backend + external Tollbooth instance. Scope:

- **Backend WS service**: Connect to Tollbooth WS + REST APIs, transform tree format
- **Frontend hook**: `useTollboothSync` for real-time upserts preserving user properties
- **Docker networking**: Shared network between Tollbooth and Baobab stacks
- **Provider mapping**: Tollbooth providers → Baobab provider IDs

### Feature 27 — MCP Servers

Full feature not started. Requires backend for stdio process management. Scope:

- **Backend MCPManager**: Spawn/manage MCP server processes (JSON-RPC over stdio), tool discovery, execution, idle timeout
- **Backend routes**: Server lifecycle, tool call dispatch, Claude Desktop JSON import
- **Frontend**: Settings UI for server CRUD + import, per-conversation server toggles
- **Tool approval flow**: Pause streaming for user approval of tool calls
- **Integration**: Extend `resolveToolsForConversation()` to include MCP tools

### Feature 33 — HTTP Tool Extensions

Full feature not started. Requires backend for CORS proxy. Scope:

- **User-defined tools**: JSON Schema input definition + webhook URL + auth headers (bearer, API key, custom header)
- **Settings UI**: Tool CRUD, test button, import/export tool configs
- **Backend proxy**: CORS proxy with SSRF protection (block private IPs)
- **Per-conversation toggle**: Dropdown to select which HTTP tools are active
- **Tool dispatch integration**: Plugs into existing `registerToolHandler`/`dispatchToolCalls` pipeline

### Feature 34 — Code Interpreter

Full feature not started. Requires backend for Docker sandbox. Scope:

- **Docker sandbox**: Python 3.12 + Node.js 22 + bash, network-isolated, memory/CPU/timeout limited
- **Browser fallback**: Pyodide (Python WASM) + sandboxed JS eval when backend unavailable
- **Visualization**: matplotlib → base64 images rendered inline, HTML output in sandboxed iframe
- **Persistent sandbox** (Phase D): maintain state across code executions within a conversation
- **Tool integration**: `code_interpreter` tool with language + code inputs

### Feature 35 — Web Search Enhancements

Full feature not started. Extends Feature 05. Scope:

- **New providers**: SearXNG (self-hosted, no key) and Brave Search (free tier API)
- **Citation tracking**: Detect URLs referenced in assistant responses, store on node, render as footnote links
- **URL fetching**: `fetch_url` tool that retrieves and extracts readable text from web pages via `@mozilla/readability`

### Feature 36 — Document RAG

Full feature not started. Requires backend for embedding pipeline. Scope:

- **Chunking pipeline**: Split project files into ~500-token overlapping chunks
- **Embedding**: `all-MiniLM-L6-v2` via `@xenova/transformers` on backend (384-dim)
- **Vector storage**: SQLite with `sqlite-vec` (or brute-force fallback)
- **Retrieval**: Top-k cosine similarity search scoped to project
- **System prompt injection**: Stage 3 of assembly pipeline (after cascade + file index)
- **Knowledge mode extension**: Off / @Mention / Agentic / RAG
- **Browser fallback**: Transformers.js embeddings + IndexedDB storage + brute-force search

### Feature 37 — Multi-User and Auth

Full feature not started. Major architectural shift. Scope:

- **Phase A**: Local username/password auth, JWT sessions (httpOnly cookies), registration modes (open/admin-only/closed)
- **Phase B**: Data migration — IndexedDB → server-side SQLite as source of truth. Per-user data isolation. Migration tool for existing single-user installations.
- **Phase C**: Admin page for user management (2–5 users). Role-based access (admin/user).
- **Phase D** (optional): Shared conversations/projects between users.
- **Backwards compatible**: `AUTH_ENABLED=false` (default) preserves existing single-user behavior.

### Feature 38 — Import/Export Enhancements

Full feature not started. Extends existing per-conversation JSON import/export. Scope:

- **Bulk export**: All conversations or filtered by project/tag/date as a single JSON archive
- **Project-inclusive export**: Include project metadata and file extracted text
- **Markdown export**: Thread (linear) and full tree (hierarchical with branch annotations) formats
- **ChatGPT import**: Parse ChatGPT `conversations.json` export format, auto-detect format
- **Settings backup/restore**: Export/import AppSettings (API keys stripped for security)

### Minor UI Fixes Remaining

From `_ui-fixes.md`:

- **UI Fix 3 (error nodes)**: "Reply here" action should be excluded from error nodes; error content should render as human-readable message rather than raw JSON.
- **UI Fix 15 (active path)**: Code is wired in `buildReactFlowGraph` but CSS styling for `.active-path` class needs verification.

---

## Feature Number Gaps

Some feature numbers are intentionally absent from the spec set:

- **01**: Model selector with Haiku default + API key validation — already implemented in the initial codebase.
- **03**: Visual/UI/UX improvements — deferred as too broad; specific improvements are captured in individual feature specs and UI fixes.
- **18**: Combined with Feature 17 — the original scope "Comparing and classifying messages/branches" was written as a single spec (17).
- **29–32**: Added 2026-02-23 — batch execution, project UX, conversation management.
- **33–38**: Added 2026-02-23 — HTTP tool extensions, code interpreter, web search enhancements, document RAG, multi-user auth, import/export enhancements.

## Dependency Graph

```
                              08 Model Cascade (Phase 1) ──┐
00 Backend ──┬── 07 Providers ── 08 Phase 2 ───────────────├── 10 Visual Indicators
             │                   09 System Prompt ─────────┘
             ├── 05 Web Search ──┬── 27 MCP Servers (also depends on 07)
             │                   ├── 06 Research Agent (web-search mode; also depends on 07)
             │                   ├── 33 HTTP Tool Extensions (also depends on 07)
             │                   ├── 34 Code Interpreter
             │                   └── 35 Web Search Enhancements
             ├── 13 Project Knowledge ── 36 Document RAG
             ├── 17 Compare & Classify
             ├── 19 RAG
             └── 37 Multi-User and Auth (depends on all features being stable)

06 Research Agent tree-search mode has NO backend dependency (local IndexedDB only)
06 Research Agent web-search mode depends on 00 Backend + 05 Web Search
Independent: 02, 04, 11, 12, 15, 20, 21, 23, 24, 32, 38
25 Thread Metadata Parity depends on 10, 21, 23
28 Manual Tree Editing depends on 23 Resend/Duplicate, 13 Project Knowledge
29 Batch Prompt Execution depends on 07, 08; Phase C depends on 16 Merge
30 Project UX depends on 13 Project Knowledge
33 HTTP Tool Extensions depends on 00, 05 (tool dispatch), 07 (provider tool_use)
34 Code Interpreter depends on 00 (Docker sandbox), 05 (tool dispatch); Phase C browser fallback is independent
35 Web Search Enhancements depends on 00, 05 (extends search system)
36 Document RAG depends on 00 (embedding pipeline), 13 (project file storage)
37 Multi-User and Auth depends on 00; should be implemented after core features are stable
38 Import/Export Enhancements is independent; Phase B depends on 13 (project files)
26 Tollbooth Sync depends on 24 Tags, 07 Providers (+ external Tollbooth)
40 Azure Foundry + OpenAI Reasoning depends on 07 Providers, 39 Reasoning Block Injection (Phase A); Phase B supersedes ADR-020
             08 Phase 1 has NO dependency on 07 (Anthropic-only cascade)
             16 Merge depends on 15 Summarize (shared UX patterns)
             22 Pricing depends on 07 Providers (model-specific costs)
             27 MCP Servers depends on 00 Backend, 05 Web Search (tool dispatch), 07 Providers
```

---

## Architectural Conventions

These conventions apply across all feature specs. See [ADR-001](../Decisions/001-spec-reconciliation.md) for decision rationale.

### Node Types

Tree nodes are classified using a `nodeType` discriminated union:

```typescript
type NodeType = 'standard' | 'summary' | 'merge';
```

- A node is exactly one type. The default for regular messages is `'standard'`.
- Features 15 (Summarize) and 16 (Merge) use `'summary'` and `'merge'` respectively.
- The "synthetic" concept (a user-role node not typed by the user) is derived from `nodeType + role`: any user-role node with `nodeType !== 'standard'` is synthetic.
- Orthogonal boolean flags (`starred`, `deadEnd`, `userModified`, `collapsed`) apply to any node type independently.
- `MessageRole` is `'user' | 'assistant'` only. Tool calls are metadata on assistant nodes (see below), not separate tree nodes.
- `providerId: string` records which provider produced an assistant node's response (provenance). Written at response time, read-only after creation. Default `'anthropic'` in Phase 1. This is distinct from `providerOverride?: string`, which is a cascade control field ("use this provider for descendants"). See Feature 07 for details.

### Tool Use Display

Tool calls (Feature 05) are stored as a `toolCalls` array on the assistant node that made them. They are displayed as **colored nodules** on the side of the assistant message node — clickable to expand/collapse tool call details. Tool calls are NOT separate tree nodes and do not affect tree structure, dagre layout, or `getPathToRoot`.

### Tool Dispatch

When multiple features inject tools into the API call (Feature 05: web search, Feature 13: file access, future tools), a unified tool dispatch loop handles all tool types:

1. The streaming hook collects `tool_use` blocks from the API response.
2. Each tool call is dispatched by `toolName` to the appropriate handler via a handler registry.
3. Multiple tool calls in a single turn are executed in parallel (`Promise.all`), results collected, and sent back as a multi-tool `tool_result` turn.
4. The `toolCalls` array on the assistant node stores all tool calls regardless of type, each tagged with `toolName`.
5. The loop repeats (send tool results → receive next response) until the model produces a final text response with no further tool calls.

```typescript
// src/api/tools/registry.ts
type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

const handlers: Record<string, ToolHandler> = {};

export function registerToolHandler(name: string, handler: ToolHandler): void {
  handlers[name] = handler;
}

export async function dispatchToolCalls(
  toolCalls: Array<{ toolName: string; input: Record<string, unknown> }>
): Promise<Array<{ toolName: string; result: string }>> {
  return Promise.all(
    toolCalls.map(async (call) => {
      const handler = handlers[call.toolName];
      if (!handler) {
        return { toolName: call.toolName, result: `Error: unknown tool "${call.toolName}"` };
      }
      const result = await handler(call.input);
      return { toolName: call.toolName, result };
    })
  );
}
```

Features register their handlers at initialization:
- Feature 05: `registerToolHandler('web_search', webSearchHandler)`
- Feature 13: `registerToolHandler('read_file', readFileHandler)`
- Feature 27: MCP server tools are registered dynamically at message-send time — the enabled servers' tools are fetched from the backend and added to the tool list. MCP tool calls route through the backend's MCP proxy (`POST /api/mcp/tools/call`) rather than local handlers.
- Feature 33: HTTP tools are registered dynamically at message-send time from user-defined configs. Calls route through the backend's HTTP proxy (`POST /api/tools/call`).
- Feature 34: `registerToolHandler('code_interpreter', codeInterpreterHandler)` — routes to Docker sandbox (backend) or Pyodide/JS sandbox (browser fallback).
- Feature 35: `registerToolHandler('fetch_url', fetchUrlHandler)` — routes through backend (`POST /api/fetch`). Automatically included when web search is enabled.

### Cascade Resolution

All feature cascades (model override, system prompt override, future per-node settings) use the same resolution pattern:

```typescript
function resolveCascade<T>(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  getOverride: (node: TreeNode) => T | undefined,
  defaultValue: T
): T {
  const path = getPathToRoot(nodeId, nodes); // root → node order
  let resolved = defaultValue;
  for (const node of path) {
    const override = getOverride(node);
    if (override !== undefined && override !== null) {
      resolved = override;
    }
  }
  return resolved;
}
```

Walk root-to-node, last override wins. This shared utility lives in `src/lib/tree.ts` and is used by Features 08 and 09.

### System Prompt Assembly Pipeline

Multiple features modify the system prompt sent to the model. To prevent ordering ambiguity, the system prompt is assembled in a defined pipeline with explicit stages:

```
1. resolveCascade(systemPromptOverride)  →  base system prompt       (Feature 09)
2. append project file index             →  agentic file context     (Feature 13)
3. append document RAG context           →  retrieved document chunks (Feature 36)
4. append conversation RAG context       →  retrieved messages        (Feature 19)
```

Each stage appends to the resolved prompt with a clear separator (`\n\n---\n\n`). The pipeline runs at API-call time in `useStreamingResponse`.

```typescript
function assembleSystemPrompt(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  defaultSystemPrompt: string,
  options: {
    fileIndex?: string;              // Feature 13: project file listing
    documentRagContext?: string;     // Feature 36: retrieved document chunks
    conversationRagContext?: string; // Feature 19: retrieved conversation messages
  }
): string {
  // Stage 1: Cascade resolution
  let prompt = resolveCascade(nodeId, nodes, n => n.systemPromptOverride, defaultSystemPrompt);

  // Stage 2: File index augmentation (Feature 13)
  if (options.fileIndex) {
    prompt += '\n\n---\n\n' + options.fileIndex;
  }

  // Stage 3: Document RAG augmentation (Feature 36)
  if (options.documentRagContext) {
    prompt += '\n\n---\n\n' + options.documentRagContext;
  }

  // Stage 4: Conversation RAG augmentation (Feature 19)
  if (options.conversationRagContext) {
    prompt += '\n\n---\n\n' + options.conversationRagContext;
  }

  return prompt;
}
```

**Visual indicator rules**: Only explicit `systemPromptOverride` values on tree nodes trigger the Feature 10 "system" visual chip. Stages 2 and 3 are infrastructure augmentations — they do not count as user-set overrides and do not produce visual indicators.

### Sidebar Architecture

The sidebar uses a unified design shared across Features 11, 13, 20, and 24:

- **Persistent search bar** at the top (Feature 20).
- **`[Chats | Starred]` primary mode toggle**: Chats shows conversations, Starred shows starred messages.
- **`[None | Projects | Tags]` grouping selector** (in Chats view): None = flat chronological, Projects = grouped by project (Feature 13), Tags = grouped by tag hierarchy (deferred to v2).
- **Tag pills** on conversation items (Feature 24).
- **Settings link** at the bottom.

Projects are the primary grouping mechanism. Tags are a cross-cutting filter and metadata layer. Tag grouping in the sidebar is architecturally supported but UI-deferred to v2.

### Data Ownership

IndexedDB (frontend) is the source of truth for conversations, nodes, settings, projects, and tags. The backend SQLite stores files and provides an autocomplete cache for tags. See Feature 00 for the full ownership table and sync protocol.

| Data | Owner |
|------|-------|
| Conversations, Nodes, Settings | Frontend (IndexedDB) |
| Projects (metadata) | Frontend (IndexedDB), pushed to backend |
| Tags (canonical list) | Frontend (IndexedDB), cached in backend |
| Project Files | Backend (SQLite + disk) |
| MCP Server Configs | Frontend (IndexedDB), synced to backend |
| MCP Server Runtime State | Backend (in-memory, not persisted) |
| HTTP Tool Configs | Frontend (IndexedDB) |
| Document Chunk Embeddings | Backend (SQLite), browser fallback (IndexedDB) |
| User Accounts (Feature 37) | Backend (SQLite) — only when AUTH_ENABLED=true |

Startup reconciliation syncs frontend state to backend. No sync queue — reconciliation compares current state idempotently.

### Multi-Select Architecture

Features 16 (Merge) and 17 (Compare) both use `Ctrl+Click` (Mac: `Cmd+Click`) to select two nodes. This is a shared interaction pattern with a shared UI component:

#### Multi-Select State

```typescript
interface MultiSelectState {
  selectedIds: string[];          // ordered by selection time; max 2 in v1
  isActive: boolean;              // true when ≥2 nodes selected
}
```

Stored in a transient Zustand slice (not persisted). Cleared on `Escape`, clicking empty canvas, or switching conversations.

#### Multi-Select Mode Behavior

1. **First `Ctrl+Click`**: node gets blue highlight ring (`ring-2 ring-blue-400`). Single-select (orange ring) is cleared.
2. **Second `Ctrl+Click`**: second node highlighted. Multi-select action menu replaces the detail panel.
3. **Third `Ctrl+Click`**: replaces the second selection (v1 limits to 2 nodes).
4. **Click without `Ctrl`**: exits multi-select, returns to single-select on the clicked node.

#### Shared Action Menu

When 2 nodes are selected, the detail panel area shows:

```
┌──────────────────────────────────────┐
│ 2 nodes selected                     │
│                                      │
│ Node A: "The key finding is..."      │
│   in Branch 1 (5 messages deep)      │
│                                      │
│ Node B: "Another perspective..."     │
│   in Branch 2 (3 messages deep)      │
│                                      │
│ Common ancestor:                     │
│   "Tell me about climate change"     │
│                                      │
│ [🔀 Merge] [📊 Compare] [Cancel]    │
└──────────────────────────────────────┘
```

- **Merge** (Feature 16): opens the merge dialog. Only enabled when both nodes are in the same conversation.
- **Compare** (Feature 17): opens the compare dialog. Enabled for any two nodes.
- Buttons are conditionally rendered based on which features are available. If only one feature is implemented, only that button appears.

#### Component

```
components/
  tree/
    MultiSelectPanel.tsx    # Shared action menu; renders in place of NodeDetailPanel
```

Both Features 16 and 17 register their action handlers with this component rather than implementing separate multi-select UIs.

### Context Menu Architecture

Node context menus are organized into 5 groups with dividers:

1. **Primary Actions**: Reply here, Resend (user nodes), Retry (error nodes), Duplicate & Edit
2. **Annotations**: Star/Unstar, Flag as dead end
3. **Branch Operations**: Summarize branch, Score/Evaluate
4. **Clipboard**: Copy, Copy error
5. **Danger Zone**: Delete

Items are conditionally visible based on node state (role, error, streaming, has children) and feature flags. The same action handler functions are shared between the context menu and the detail panel action bar.

### Settings Architecture

Settings are rendered as a full routed page at `/settings/:section` (not a modal), routed at `/settings/:section?` (see Feature 02). Tabs are only rendered when their features are available.

#### Settings Tab Assignment

| Tab | Content | Source Feature(s) |
|-----|---------|-------------------|
| **General** | API key, default model, theme | Existing + Feature 04 |
| **Providers** | Provider configs (API keys, endpoints, model lists) | Feature 07 |
| **Advanced** | Thinking toggle, temperature, max tokens, top-p, top-k | Feature 04 |
| **Prompts** | Default system prompt, summarization prompt, merge prompt | Features 09, 15, 16 |
| **Search** | Search provider selection, API keys (Tavily, Bing) | Feature 05 |
| **Research** | Default planner prompts (tree-search + web-search), default models (planner + sub-agent), limits (sub-tasks, tool calls), incremental synthesis interval | Feature 06 |
| **Pricing** | Price table, display preferences | Feature 22 |
| **MCP Servers** | Server list, add/edit/remove, import from JSON, status | Feature 27 |
| **HTTP Tools** | Tool list, add/edit/remove, test, import from JSON | Feature 33 |
| **Code Interpreter** | Enable/disable, timeout, Docker image status | Feature 34 |
| **About** | Version, links, credits | — |

---

## Visual Channels Convention

Different features modify the visual appearance of tree nodes and edges. To prevent collisions, each visual property is reserved for a single purpose:

| Visual Property | Reserved For | Feature/Fix |
|----------------|-------------|-------------|
| **Edge color & thickness** | Active path highlighting (root → selected node) | [UI Fix 15](_ui-fixes.md) |
| **Edge opacity** | Dead-end branch dimming | Feature 12 |
| **Dashed cross-branch edges (blue-gray)** | Merge source links (overlay-only, excluded from dagre) | Feature 16 |
| **Node border color (red)** | Error state — failed API responses | [UI Fix 3](_ui-fixes.md) |
| **Node border style (dashed, blue-gray)** | Merge request synthetic node | Feature 16 |
| **Node outer ring (orange)** | Settings override indicator | Feature 10 |
| **Node opacity** | Dead-end branch dimming | Feature 12 |
| **Node left border (blue-gray, 3px)** | Summary / merge response type indicator | Features 15, 16 |
| **Node background tint (blue-gray)** | Summary / merge nodes | Features 15, 16 |
| **Node chips/badges** | Model name, "system", "settings", "(edited)", "Summary", "Merge" labels | Features 10, 15, 16, 23 |
| **Node header icon overlay** | User-modified indicator (pencil icon) | Feature 23 |
| **Node side nodule (green)** | Tool use indicator (expandable) | Feature 05 |
| **Node highlight ring (yellow/amber)** | Per-chat search result highlight | Feature 20 |
| **Node background tint (heatmap gradient)** | Ephemeral scoring overlay (red/yellow/green) — temporarily overrides summary/merge tint while active | Feature 17 |
| **Node side nodule (green, beaker icon)** | Research run trigger indicator (clickable → research view) | Feature 06 |

When implementing features that add visual treatment to nodes or edges, check this table first. If a new visual channel is needed, add it here before implementing.

**Stacking rules**: Multiple visual treatments can apply to the same node simultaneously. For example, an error node in a dead-end branch has both a red border and reduced opacity. An overridden node in a dead-end branch has both an orange ring and reduced opacity.

---

## Frontend Performance

Several cascade and detection functions (`isDeadEnd`, `resolveModel`, `resolveSystemPrompt`, `getNodeIndicators`) walk root-to-node per node during rendering. For trees with 1000+ nodes, this is O(n x depth).

**Memoization strategy**: Cascade results should be memoized per-node in `buildReactFlowGraph` and invalidated only when an ancestor's override field changes. Use `useMemo` keyed on the nodes map reference for Tier 1/2 scale. If profiling reveals bottlenecks at larger scale, consider pre-computing a resolved-values map in a single tree traversal pass, invalidated on any override change.

---

## Cross-Cutting Documents

- **[Dexie Migration Plan](_dexie-migrations.md)**: Coordinated schema version plan across all features. Prevents version conflicts when features are implemented in parallel.
- **[UI Fixes Reference](_ui-fixes.md)**: Behavioral specs for UI fixes referenced by feature specs (UI Fix 1, 3, 6, 15).
- **[ADR-001: Spec Reconciliation](../Decisions/001-spec-reconciliation.md)**: Architectural decisions and their rationale.
- **[ADR-005: Spec Review Refinements](../Decisions/005-spec-review-refinements.md)**: Cross-spec review findings — search in thread view, multi-select architecture, cascade traceability, error response format, feature gating, file upload limits.

## Feature Gating

Multiple features conditionally show/hide UI based on backend availability (Features 05, 06, 13, 17, 19) or other prerequisites. Rather than scattering `isBackendAvailable()` checks across components, use a centralized feature gating hook:

```typescript
// src/hooks/useFeatureGating.ts

interface FeatureCapabilities {
  webSearch: boolean;         // Feature 05: backend available
  researchAgentWebSearch: boolean;  // Feature 06: web-search mode — backend + web search available
  researchAgentTreeSearch: boolean; // Feature 06: tree-search mode — always available
  projectFiles: boolean;      // Feature 13: backend available (text-only fallback in browser)
  projectFilesFulll: boolean; // Feature 13: backend available (PDF/OCR support)
  serverSideML: boolean;      // Feature 17: backend available
  clientSideML: boolean;      // Feature 17: always true (Transformers.js)
  ragEmbeddings: boolean;     // Feature 19: backend available (SQLite-vec) or browser (brute-force)
  multiProvider: boolean;     // Feature 07: at least one non-Anthropic provider configured
  mcpServers: boolean;        // Feature 27: backend available + at least one MCP server configured
  tollboothSync: boolean;     // Feature 26: backend available + Tollbooth connection configured
}

function useFeatureGating(): FeatureCapabilities {
  const backendAvailable = useBackendStatus();  // cached health check result
  const providers = useSettingsStore(s => s.providers);

  return useMemo(() => ({
    webSearch: backendAvailable,
    researchAgentWebSearch: backendAvailable,
    researchAgentTreeSearch: true,            // tree-search reads local IndexedDB only
    projectFiles: true,                         // text-only always works
    projectFilesFull: backendAvailable,          // PDF/OCR needs backend
    serverSideML: backendAvailable,
    clientSideML: true,
    ragEmbeddings: true,                         // brute-force fallback always available
    ragDocuments: true,                          // Feature 36: brute-force fallback always available
    ragDocumentsFull: backendAvailable,          // Feature 36: sqlite-vec + PDF/OCR files
    multiProvider: Object.keys(providers).length > 1,
    mcpServers: backendAvailable,               // MCP needs backend for stdio process mgmt
    httpTools: backendAvailable,                 // Feature 33: backend proxies CORS
    codeInterpreter: true,                       // Feature 34: always available (browser fallback)
    codeInterpreterDocker: backendAvailable,     // Feature 34: Docker sandbox
    tollboothSync: backendAvailable,            // Tollbooth needs backend as WS bridge
  }), [backendAvailable, providers]);
}
```

### Backend Status

```typescript
// src/hooks/useBackendStatus.ts

function useBackendStatus(): boolean {
  // Pings GET /api/health once on app load
  // Caches result for the session
  // Re-checks on visibility change (tab refocus) with 60s debounce
  // Returns false if VITE_API_URL is not set
}
```

Components use `useFeatureGating()` to conditionally render UI elements. This prevents drift when new backend-dependent features are added — all gating logic lives in one place, and the capability map serves as documentation of what requires what.

## Feature Spec Edge Cases Checklist

Every feature spec should include an `## Edge Cases` section addressing these questions. This prevents the class of "spec gap" bugs documented in `Bugs/00-cross-cutting-bug-patterns.md` (Pattern 8).

| Question | Example |
|----------|---------|
| What happens with empty, null, or undefined input? | User submits empty search query, config field is blank |
| What if the external dependency is unavailable? | Provider API down, backend offline, model removed |
| What if this runs concurrently with itself? | Two sessions started simultaneously, double-click submit |
| What happens on the second invocation? | Resume after pause, re-open dialog with stale state |
| What if the user's data is larger than expected? | 1000-node tree, 50 target terms, 100KB message |
| What state persists vs. resets across page reload? | Transient UI state vs. IndexedDB-backed state |

Not every question applies to every feature — but each should be explicitly considered and either answered or marked "N/A" in the spec.

---

## Browser-Only Version Scope

The browser-only build includes all features except:
- **Disabled**: Web search (05), Research agent web-search mode (06), Server-side classifiers/embeddings (17 partial), MCP servers (27), Tollbooth sync (26), HTTP tool extensions (33), Multi-user auth (37)
- **Degraded**: Project knowledge (13) — text files only, stored in IndexedDB, no PDF/OCR. Research agent (06) — tree-search mode only (web-search hidden). Code interpreter (34) — Pyodide Python + JS sandbox only, no Docker, no bash. Document RAG (36) — Transformers.js embeddings, IndexedDB storage, brute-force search, text files only. Web search enhancements (35) — citation data persists if created with backend, but no new searches/fetches.
- **Full**: Everything else (including Research agent tree-search mode, import/export (38), batch execution (29))
