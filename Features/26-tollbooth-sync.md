# 26 — Tollbooth Sync

## Summary

Auto-sync conversations intercepted by [Tollbooth](https://github.com/flechettelabs/tollbooth) (an LLM traffic proxy) into Baobab in real-time. Tollbooth intercepts HTTPS traffic from LLM coding agents (Claude Code, Cursor, Aider, etc.), parses API calls into structured conversations, and detects branching. This feature makes those conversations appear automatically in Baobab's tree visualization, tagged with `Tollbooth` for easy filtering.

Users can view Tollbooth-sourced conversations in tree or thread view, branch from any synced node (creating local branches), and use all of Baobab's tools (star, collapse, dead-end, search) on synced content.

## Priority

Tier 4 — integration feature.

## Dependencies

- **24 Tags**: Tollbooth conversations are tagged `Tollbooth` for filtering.
- **07 Inference Providers**: Provider mapping from Tollbooth's provider names.
- **External**: Requires a running Tollbooth instance (separate Docker Compose stack).

## Architecture

```
Tollbooth Backend (ports 3000 REST, 3002 WS)
       |
       |-- WS: {type: 'conversation', data: Conversation}   (real-time)
       |-- REST: GET /api/conversations                      (initial sync)
       |-- REST: GET /api/conversations/:id/tree             (merged tree)
       |
       v
Baobab Backend (port 3001) --- new: TollboothSyncService
       |
       |-- Connects to Tollbooth WS on startup
       |-- Fetches all conversations via REST (initial sync)
       |-- On each update: fetches tree, transforms to Baobab format
       |-- Pushes transformed data to frontend via new WS server
       |
       v
Baobab Frontend --- new: useTollboothSync hook
       |
       |-- Receives {conversation, nodes[]} from backend WS
       |-- Upserts into IndexedDB (Dexie)
       |-- Tagged with 'Tollbooth' for filtering and visual distinction
```

### Why Baobab Backend as Bridge (not direct frontend connection)

- **No CORS issues**: Server-to-server WebSocket has no cross-origin restrictions.
- **Single transform point**: Transformation logic runs once regardless of how many browser tabs are open.
- **Persistent connection**: Backend maintains the Tollbooth WS connection even when no browser is open.
- **Consistent with existing architecture**: Baobab backend already runs as a service; this extends it.

### Key Design Decisions

1. **IndexedDB remains single source of truth** — synced conversations stored alongside local ones using `db.conversations.put()` and `db.nodes.bulkPut()`.
2. **Deterministic IDs with `tb-` prefix** — enables idempotent upserts, avoids collisions with native Baobab conversations.
3. **One Tollbooth tree = one Baobab conversation** — Tollbooth's merged trie (multiple related conversations sharing a prefix) maps naturally to Baobab's single-conversation node tree with branches.
4. **Synced nodes are editable via branching** — users can branch from any synced node (creating local branches). Synced content updates from Tollbooth without overwriting user-applied properties (starred, collapsed, dead-end).

## Data Model

### Tollbooth Source Types

Tollbooth's tree endpoint (`GET /api/conversations/:id/tree`) returns:

```typescript
// From Tollbooth — what we consume
interface TollboothConversationTree {
  root_conversation_id: string;
  root_message: string;          // First user message (100 chars)
  nodes: TollboothTreeNode[];    // Nested children tree (merged trie)
  total_conversations: number;
  total_branches: number;
  merge_connectors?: Array<{ from_node_id: string; to_node_id: string }>;
}

interface TollboothTreeNode {
  conversation_id: string;
  turn_index: number;
  message_index: number;
  role: 'user' | 'assistant';
  message: string;               // Preview (100 chars)
  full_message: string;          // Complete content
  thinking?: string;
  timestamp: number;
  is_modified: boolean;
  model: string;
  provider: 'anthropic' | 'openai' | 'google' | 'ollama' | 'unknown';
  turn_id: string;
  flow_id: string;
  node_id: string;               // e.g. "trie:42"
  children: TollboothTreeNode[];
  parameter_modifications?: {
    hasModifications: boolean;
    modifications: Array<{
      field: 'system' | 'tools' | 'temperature' | 'max_tokens' | 'model';
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
}
```

### Mapping to Baobab Types

| Tollbooth (`TollboothTreeNode`) | Baobab (`TreeNode`) | Notes |
|---|---|---|
| `node_id` | `id` = deterministic hash | Content-based, stable across rebuilds |
| `role` | `role` | Direct mapping |
| `full_message` | `content` | Full text content |
| `thinking` | `thinking` | Extended thinking content |
| `model` | `model` | Model identifier string |
| `children[].node_id` | `childIds[]` | Array of child deterministic IDs |
| `is_modified` | `userModified` | Was the message modified by intercept/rules |
| `timestamp` | `createdAt` | Milliseconds since epoch |
| `provider` | (conversation-level `providerId`) | Mapped via provider table |

**Conversation record:**

```typescript
{
  id: `tb-${root_conversation_id}`,
  title: tree.root_message.slice(0, 80),    // First user message
  rootNodeId: `tb-root-${root_conversation_id}`,
  createdAt: earliestNodeTimestamp,
  updatedAt: latestNodeTimestamp,
  model: firstNode.model,
  tags: ['Tollbooth'],                       // For sidebar filtering
  providerId: mapProvider(firstNode.provider),
}
```

**Silent root node** (required by Baobab):

```typescript
{
  id: `tb-root-${root_conversation_id}`,
  conversationId: `tb-${root_conversation_id}`,
  parentId: null,
  role: 'assistant',
  content: '',
  childIds: [/* IDs of top-level tree nodes */],
  // ...standard defaults
}
```

### Node ID Stability

Tollbooth's `trie:N` counter resets per `buildConversationTree()` call, so `trie:42` may refer to different nodes between calls. Use **content-based deterministic hashing** instead:

```typescript
function stableNodeId(rootConvId: string, role: string, parentId: string, content: string): string {
  const hash = createHash('sha256')
    .update(`${role}:${parentId}:${content.slice(0, 300)}`)
    .digest('hex')
    .slice(0, 12);
  return `tb-${rootConvId.slice(0, 8)}-${hash}`;
}
```

This ensures:
- Same content at same position = same ID across rebuilds.
- User-applied properties (starred, collapsed, dead-end) are preserved across re-syncs.
- The `tb-` prefix prevents collisions with native Baobab UUIDs.

### Provider Mapping

```typescript
function mapProvider(tollboothProvider: string): string {
  const map: Record<string, string> = {
    'anthropic': 'anthropic',
    'openai': 'openai',
    'google': 'gemini',
    'ollama': 'ollama',
    'unknown': 'anthropic',
  };
  return map[tollboothProvider] ?? 'anthropic';
}
```

## Sync Protocol

### Initial Sync (on Baobab backend startup)

1. Connect to Tollbooth WebSocket at `ws://{TOLLBOOTH_HOST}:3002`.
2. Fetch all conversations: `GET /api/conversations` from Tollbooth REST API.
3. Identify root conversations (those with no `parent_conversation_id`).
4. For each root, fetch the merged tree: `GET /api/conversations/:id/tree`.
5. Transform each tree to `{conversation, nodes[]}` in Baobab format.
6. Push all transformed data to connected Baobab frontends via WebSocket.
7. Frontend upserts into IndexedDB.

### Incremental Sync (real-time)

When Tollbooth broadcasts `{type: 'conversation', data: Conversation}` via WebSocket:

1. **Debounce** (500ms per conversation ID) to batch rapid updates during streaming.
2. Determine the root conversation ID (walk `parent_conversation_id` chain if needed, or use `correlation_hash` grouping).
3. Fetch the updated tree: `GET /api/conversations/:rootId/tree`.
4. Transform to Baobab format with deterministic IDs.
5. Push to frontend: `{type: 'tollbooth_sync', data: {conversation, nodes}}`.
6. Frontend upserts:
   - `db.conversations.put(conversation)` — insert or update.
   - `db.nodes.bulkPut(nodes)` — insert or update, preserving user-local properties.

### Preserving User Properties on Re-Sync

When upserting nodes, the frontend must preserve user-applied properties that Tollbooth doesn't know about:

```typescript
async function upsertSyncedNodes(nodes: TreeNode[]) {
  for (const node of nodes) {
    const existing = await db.nodes.get(node.id);
    if (existing) {
      // Preserve user-local properties
      node.starred = existing.starred;
      node.collapsed = existing.collapsed;
      node.deadEnd = existing.deadEnd;
      node.manualPosition = existing.manualPosition;
      // Preserve local branches (childIds that aren't tb- prefixed)
      const localChildIds = existing.childIds.filter(id => !id.startsWith('tb-'));
      node.childIds = [...new Set([...node.childIds, ...localChildIds])];
    }
    await db.nodes.put(node);
  }
}
```

## WebSocket Messages

### Baobab Backend → Frontend

```typescript
// Synced conversation data
{
  type: 'tollbooth_sync',
  data: {
    conversation: Conversation,    // Baobab format
    nodes: TreeNode[],             // Baobab format, flat array
  }
}

// Connection status
{
  type: 'tollbooth_status',
  data: {
    connected: boolean,
    lastSync: number,              // Timestamp of last successful sync
    conversationCount: number,     // Total synced conversations
  }
}
```

## Branch Mapping

Tollbooth and Baobab represent branches differently:

- **Tollbooth**: Multiple `Conversation` objects share a message prefix. The tree endpoint merges them into a trie where branch points are nodes with multiple `children[]`.
- **Baobab**: A single `Conversation` has a tree of `TreeNode` objects. Branch points are nodes with multiple entries in `childIds[]`.

**The mapping is natural.** Tollbooth's `ConversationTreeNode.children[]` maps directly to Baobab's `TreeNode.childIds[]`. The trie-merge that Tollbooth already performs produces exactly the tree structure Baobab needs.

Example: A Tollbooth tree with 2 conversations branching at turn 2:

```
Tollbooth:                          Baobab:
Conv A: [U1, A1, U2, A2, U3, A3]   root
Conv B: [U1, A1, U2', A2']            |
  branch at turn 1                    U1
  divergence: different U2             |
                                      A1
Tree endpoint returns:               / \
  U1 -> A1 -> U2  -> A2 -> ...     U2   U2'
            -> U2' -> A2'           |     |
                                   A2    A2'
                                    |
                                   U3
                                    |
                                   A3
```

## Docker Networking

Both projects run separate docker-compose stacks. Connect them via a shared external network:

```bash
docker network create tollbooth-baobab
```

### Tollbooth `docker-compose.yml` changes

```yaml
backend:
  container_name: tollbooth-backend    # Stable hostname for Baobab to reach
  networks:
    - inspector-net
    - tollbooth-baobab               # Add shared network

networks:
  inspector-net:
    driver: bridge
  tollbooth-baobab:
    external: true
```

### Baobab `docker-compose.yml` changes

```yaml
api:
  environment:
    - TOLLBOOTH_REST_URL=http://tollbooth-backend:3000
    - TOLLBOOTH_WS_URL=ws://tollbooth-backend:3002
  networks:
    - default
    - tollbooth-baobab               # Add shared network

networks:
  tollbooth-baobab:
    external: true
```

### Graceful Degradation

If `TOLLBOOTH_REST_URL` is not set, the sync service does not start. Baobab works normally without Tollbooth.

## Files to Create

### Baobab Backend (`server/src/`)

| File | Purpose |
|---|---|
| `services/tollbooth-types.ts` | Type definitions for Tollbooth API responses (`TollboothConversationTree`, `TollboothTreeNode`, etc.) |
| `services/tollbooth-transform.ts` | Pure transformation: `transformTree(tree) -> {conversation, nodes[]}`. Content-based ID hashing, recursive node flattening, provider mapping. |
| `services/tollbooth-sync.ts` | `TollboothSyncService` class. WebSocket client to Tollbooth (auto-reconnect with backoff). Initial full sync. Incremental sync with debounce. Emits events for WS push. |
| `services/ws-server.ts` | WebSocket server (port 3003 or upgrade on existing Fastify). Broadcasts `tollbooth_sync` and `tollbooth_status` to connected Baobab frontends. |
| `routes/tollbooth.ts` | REST endpoints: `GET /api/tollbooth/status`, `POST /api/tollbooth/sync` (trigger full re-sync). |

### Baobab Frontend (`src/`)

| File | Purpose |
|---|---|
| `hooks/useTollboothSync.ts` | WebSocket connection to Baobab backend. Receives `tollbooth_sync` messages, upserts into Dexie, refreshes Zustand store. Exposes connection status. |
| `api/tollbooth.ts` | REST client: `getTollboothStatus()`, `triggerFullSync()`. |

## Files to Modify

### Baobab Backend

| File | Changes |
|---|---|
| `server/src/index.ts` | Register tollbooth routes. Start `TollboothSyncService` and WS server on startup. |
| `server/package.json` | Add `ws` dependency for WebSocket client and server. |

### Baobab Frontend

| File | Changes |
|---|---|
| `src/components/layout/MainLayout.tsx` | Initialize `useTollboothSync` hook (starts WS connection on mount). |
| `src/components/layout/Sidebar.tsx` | Show `Tollbooth` badge/icon on synced conversations. Baobab's existing tag filtering lets users click `Tollbooth` to show only synced conversations. |

### Docker

| File | Changes |
|---|---|
| Tollbooth `docker-compose.yml` | Add `container_name: tollbooth-backend`, add `tollbooth-baobab` external network to backend service. |
| Baobab `docker-compose.yml` | Add `tollbooth-baobab` external network to api service, add `TOLLBOOTH_REST_URL` and `TOLLBOOTH_WS_URL` env vars. |

## Edge Cases

- **Streaming responses**: Debounce (500ms) batches rapid Tollbooth updates during streaming. Final content syncs when stream completes.
- **Large trees**: If a tree has thousands of nodes, chunk the WS payload or paginate.
- **Tollbooth restart**: Baobab backend auto-reconnects with exponential backoff, triggers full re-sync on reconnect.
- **Baobab restart**: Initial full sync on startup recovers all state from Tollbooth.
- **Tollbooth not running**: Sync service logs a warning and retries periodically. Baobab works normally without it.
- **No `TOLLBOOTH_REST_URL` set**: Sync service does not start. No errors, no overhead.
- **Concurrent branches**: Multiple child conversations with same prefix produce multiple `childIds` on the divergence node — handled naturally by the trie structure.
- **User branches from synced node**: Local child nodes (non-`tb-` IDs) are preserved in `childIds` across re-syncs.

## Implementation Order

1. Docker networking (shared network, env vars, container name).
2. Tollbooth types + transform function (pure logic, unit-testable in isolation).
3. Backend WS server (push capability for frontend).
4. Tollbooth sync service (connects to Tollbooth, orchestrates sync).
5. Backend REST routes (status endpoint, manual sync trigger).
6. Frontend sync hook (receives and stores synced data).
7. Sidebar UI indicators (`Tollbooth` tag badge).

## Verification

1. Start both docker-compose stacks with shared network (`docker network create tollbooth-baobab`).
2. Run an LLM agent through Tollbooth (or load existing traffic from `tollbooth-data/`).
3. Verify Baobab backend connects to Tollbooth WS (check logs for connection message).
4. Verify conversations appear in Baobab sidebar with `Tollbooth` tag.
5. Verify clicking the `Tollbooth` tag in sidebar filters to only synced conversations.
6. Verify tree visualization shows correct branching structure.
7. Send a new message through Tollbooth; verify it appears incrementally in Baobab.
8. Verify user can branch from a synced node in Baobab (creating local branches).
9. Verify starring/collapsing synced nodes persists across re-syncs.
10. Stop Tollbooth; verify Baobab backend logs reconnection attempts and continues working normally.
