# 27 — MCP Servers

## Summary

Add support for Model Context Protocol (MCP) servers, letting users connect external tool servers that Claude (and other models) can invoke during conversations. MCP servers are managed by the Fastify backend via stdio transport — the backend spawns server processes, discovers their tools, and proxies tool calls. Users configure servers in Settings (with Claude Desktop JSON import), toggle them per-conversation, and optionally require approval before each tool execution.

Initial scope is **tools only**. Resources and prompts are deferred until Feature 13 (Project Knowledge) is complete — see TODO at the end.

## Priority

Tier 4 — requires backend (Feature 00).

## Dependencies

- **00 Backend Architecture**: the backend spawns and manages MCP server processes.
- **05 Web Search Tool**: establishes the tool dispatch pipeline (`ToolDefinition`, `createToolExecutor`, `onToolCall` callbacks, `toolCalls[]` on nodes). MCP tools plug into this same pipeline.
- **07 Inference Providers**: tool definitions must be provider-agnostic; only providers with `supportsToolUse: true` can use MCP tools.

## MCP Protocol Background

MCP (Model Context Protocol) is a standard for connecting LLMs to external tool servers. Key concepts:

- **Server**: a process that exposes tools (and optionally resources/prompts) over a JSON-RPC transport.
- **Transport**: communication channel. **stdio** (stdin/stdout JSON-RPC) is the most common; SSE/HTTP is emerging but rare.
- **Tools**: functions the model can call, defined with a name, description, and JSON Schema input. Identical in shape to the `ToolDefinition` interface already used by Baobab.
- **Lifecycle**: `initialize` → `tools/list` → (tool calls) → `shutdown`.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React)                                                     │
│                                                                      │
│  useStreamingResponse                                                │
│    │                                                                 │
│    ├─ resolveToolsForConversation()                                  │
│    │    ├─ web_search tool (if enabled)                               │
│    │    └─ MCP tools (fetched from backend for enabled servers)       │
│    │                                                                 │
│    ├─ dispatchToProvider() → includes all tools in API request       │
│    │                                                                 │
│    └─ onToolCall(toolName, input)                                    │
│         ├─ web_search → backend /api/search (existing)               │
│         └─ mcp:* → approval check → backend /api/mcp/tools/call     │
│                                                                      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ REST API
┌───────────────────────────────▼──────────────────────────────────────┐
│  Backend (Fastify, port 3001)                                        │
│                                                                      │
│  MCPManager                                                          │
│    ├─ spawn/stop server processes (stdio)                            │
│    ├─ JSON-RPC client per server                                     │
│    ├─ tool discovery (tools/list)                                    │
│    └─ tool execution (tools/call)                                    │
│                                                                      │
│  Routes: /api/mcp/*                                                  │
│    ├─ GET  /servers           → list servers + status                │
│    ├─ GET  /servers/:id/tools → list tools from a running server     │
│    ├─ POST /servers/:id/start → start a server on demand             │
│    ├─ POST /servers/:id/stop  → stop a server                        │
│    ├─ POST /tools/call        → execute a tool call                  │
│    └─ POST /config/import     → import Claude Desktop JSON           │
│                                                                      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ stdio (JSON-RPC)
              ┌────────────▼────────────┐
              │  MCP Server Process     │
              │  e.g. filesystem,       │
              │  github, postgres, ...  │
              └─────────────────────────┘
```

## Data Model Changes

### `MCPServerConfig` (new type in `types/index.ts`)

```typescript
interface MCPServerConfig {
  id: string;                          // deterministic slug from name, e.g. 'filesystem'
  name: string;                        // display name, e.g. 'Filesystem'
  command: string;                     // executable, e.g. 'npx', 'node', 'python'
  args: string[];                      // arguments, e.g. ['@anthropic/mcp-server-filesystem', '/home']
  env?: Record<string, string>;        // extra environment variables
  enabled: boolean;                    // globally enabled (default true on creation)
  requireApproval: boolean;            // require user approval before tool execution (default true)
}
```

### `MCPToolInfo` (runtime type, not persisted)

```typescript
interface MCPToolInfo {
  serverId: string;                    // which MCP server provides this tool
  serverName: string;                  // display name of the server
  name: string;                        // tool name as declared by the server
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}
```

### `AppSettings` (types/index.ts)

```typescript
interface AppSettings {
  // ... existing fields
  mcpServers: MCPServerConfig[];       // configured MCP servers (default [])
}
```

### `Conversation` (types/index.ts)

```typescript
interface Conversation {
  // ... existing fields
  mcpServerIds?: string[];             // MCP servers enabled for this conversation
                                       // undefined = all globally-enabled servers
                                       // [] = none (explicitly disabled)
                                       // ['filesystem', 'github'] = specific subset
}
```

### `TreeNode` (types/index.ts)

No changes to the `TreeNode` type. MCP tool calls are stored in the existing `toolCalls` array:

```typescript
// Existing field, reused as-is
toolCalls?: Array<{
  toolName: string;                    // e.g. 'read_file' (from MCP server)
  input: Record<string, unknown>;
  result?: string;
  searchProvider?: string;             // only for web_search, undefined for MCP
  mcpServerId?: string;                // NEW: which MCP server handled this (undefined for non-MCP tools)
}>;
```

The `ToolCallRecord` type in `providers/types.ts` gains one optional field:

```typescript
interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  searchProvider?: string;
  mcpServerId?: string;                // identifies the MCP server (for display & routing)
}
```

### Dexie Migration

No schema changes needed — `mcpServers` is added to `AppSettings` (stored in the `settings` table as a single row), and `mcpServerIds` is an optional field on `Conversation` (no new index needed). `ToolCallRecord.mcpServerId` is stored inside the existing `toolCalls` JSON on nodes.

## Backend — MCP Manager

### `server/src/services/mcp.ts`

Core service that manages MCP server processes.

```typescript
interface MCPServerState {
  config: MCPServerConfig;
  status: 'stopped' | 'starting' | 'running' | 'error';
  process?: ChildProcess;
  client?: MCPJsonRpcClient;           // JSON-RPC client wrapping stdio
  tools: MCPToolInfo[];                // cached from tools/list
  error?: string;                      // last error message
  lastActivity: number;                // timestamp for idle timeout
}

class MCPManager {
  private servers: Map<string, MCPServerState>;
  private idleTimeoutMs: number = 5 * 60 * 1000; // 5 minutes

  // Lifecycle
  async startServer(config: MCPServerConfig): Promise<void>;
  async stopServer(id: string): Promise<void>;
  async stopAll(): Promise<void>;

  // Discovery
  async getTools(serverId: string): Promise<MCPToolInfo[]>;
  async getAllTools(serverIds: string[]): Promise<MCPToolInfo[]>;

  // Execution
  async callTool(serverId: string, toolName: string, input: Record<string, unknown>): Promise<string>;

  // Status
  getStatus(serverId: string): MCPServerState['status'];
  getAll(): MCPServerState[];
}
```

**Server Lifecycle (on-demand):**

1. Server starts when `getTools()` or `callTool()` is called and it's not running.
2. On start: spawn process → send `initialize` → call `tools/list` → cache tools → mark `running`.
3. Idle timeout: if no `callTool()` for 5 minutes, send `shutdown` and kill the process.
4. If process crashes, mark `error` with the stderr output. Next `callTool()` attempts restart.

**JSON-RPC over stdio:**

```typescript
// Outgoing (to server stdin)
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "baobab", "version": "1.0.0"}}}
{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "read_file", "arguments": {"path": "/tmp/example.txt"}}}

// Incoming (from server stdout)
{"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05", ...}}
{"jsonrpc": "2.0", "id": 2, "result": {"tools": [{"name": "read_file", "description": "...", "inputSchema": {...}}]}}
{"jsonrpc": "2.0", "id": 3, "result": {"content": [{"type": "text", "text": "file contents here"}]}}
```

### Backend Routes — `server/src/routes/mcp.ts`

```typescript
// GET /api/mcp/servers
// Returns list of configured servers with their current status
// Response: { servers: Array<{ id, name, status, toolCount, error? }> }

// GET /api/mcp/servers/:id/tools
// Returns tools from a server (starts server on-demand if needed)
// Response: { tools: MCPToolInfo[] }

// POST /api/mcp/servers/:id/start
// Explicitly start a server
// Response: { status: 'running' | 'error', error?: string }

// POST /api/mcp/servers/:id/stop
// Stop a running server
// Response: { status: 'stopped' }

// POST /api/mcp/tools/call
// Execute a tool call on a specific server
// Request: { serverId: string, toolName: string, input: Record<string, unknown> }
// Response: { result: string } | { error: string }

// POST /api/mcp/config/import
// Import servers from Claude Desktop JSON format
// Request: { config: { mcpServers: Record<string, { command, args, env }> } }
// Response: { imported: MCPServerConfig[] }
```

### Configuration Persistence

MCP server configs are stored in the frontend's `AppSettings` (Dexie) and passed to the backend on each relevant call. The backend does **not** persist its own copy — it receives configs from the frontend and manages only the runtime process state. This keeps the frontend as the single source of truth, consistent with how provider configs work today.

When the frontend loads, it sends the current `mcpServers` config to the backend so it knows what's available (but doesn't start any servers until needed).

## Frontend — Tool Integration

### Tool Resolution (in `useStreamingResponse.ts`)

The existing `resolveToolsForConversation()` function is extended:

```typescript
async function resolveToolsForConversation(conversation: Conversation): Promise<{
  tools: ToolDefinition[];
  executor: (toolName: string, input: Record<string, unknown>) => Promise<string>;
}> {
  const tools: ToolDefinition[] = [];
  const mcpToolMap: Map<string, string> = new Map(); // toolName → serverId

  // 1. Web search tool (existing)
  if (conversation.webSearchEnabled) {
    tools.push(webSearchTool);
  }

  // 2. MCP tools (new)
  const enabledServerIds = resolveEnabledMCPServers(conversation);
  if (enabledServerIds.length > 0) {
    const mcpTools = await fetchMCPTools(enabledServerIds);
    for (const tool of mcpTools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      });
      mcpToolMap.set(tool.name, tool.serverId);
    }
  }

  // 3. Unified executor
  const executor = async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    if (toolName === 'web_search') {
      return webSearchExecutor(toolName, input);
    }
    const serverId = mcpToolMap.get(toolName);
    if (serverId) {
      return callMCPTool(serverId, toolName, input);
    }
    return `Unknown tool: ${toolName}`;
  };

  return { tools, executor };
}
```

### Tool Name Collisions

If two MCP servers expose tools with the same name, or an MCP tool collides with `web_search`:

- **MCP vs built-in**: built-in tools take priority. The MCP tool is skipped with a console warning.
- **MCP vs MCP**: last server in the list wins. The Settings UI shows a warning icon on conflicting servers.

A future enhancement could namespace tools as `serverId.toolName`, but for now simple name priority matches Claude Desktop behavior.

### Approval Flow

When the model requests a tool call from an MCP server with `requireApproval: true`:

1. The `onToolCall` handler pauses before executing.
2. A `ToolApprovalDialog` component appears, showing:
   - Server name and tool name
   - Input parameters (formatted JSON)
   - **Approve** — execute this call
   - **Approve All** — auto-approve remaining calls from this server for this turn
   - **Deny** — return error to model
3. If approved, the tool call proceeds through the backend.
4. If denied, a `tool_result` with `"User denied this tool call"` is sent to the model.

```typescript
// State for approval flow
interface PendingApproval {
  serverId: string;
  serverName: string;
  toolName: string;
  input: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}
```

The approval dialog hooks into the existing streaming flow by returning a Promise from the `onToolCall` handler that resolves when the user makes a decision.

### Resolving Enabled Servers

```typescript
function resolveEnabledMCPServers(conversation: Conversation): string[] {
  const settings = useSettingsStore.getState();
  const allEnabled = settings.mcpServers.filter(s => s.enabled).map(s => s.id);

  if (conversation.mcpServerIds === undefined) {
    // No per-conversation override → use all globally enabled
    return allEnabled;
  }
  // Per-conversation list — intersect with globally enabled
  return conversation.mcpServerIds.filter(id => allEnabled.includes(id));
}
```

## UI — Settings Page

### MCP Servers Section

Added as a new section in the Settings page, after Providers and before Advanced:

```
MCP Servers

  ┌──────────────────────────────────────────────────────────────┐
  │  Filesystem                                    [Running ●]   │
  │  npx @anthropic/mcp-server-filesystem /home                  │
  │  Approval: Required  │  Tools: 4                             │
  │                                          [Edit] [Remove]     │
  ├──────────────────────────────────────────────────────────────┤
  │  GitHub                                    [Stopped ○]       │
  │  npx @anthropic/mcp-server-github                            │
  │  Approval: Auto  │  Tools: —                                 │
  │                                          [Edit] [Remove]     │
  └──────────────────────────────────────────────────────────────┘

  [+ Add Server]    [Import from JSON]
```

### Add/Edit Server Dialog

```
┌─── Add MCP Server ──────────────────────────────────────────┐
│                                                              │
│  Name                                                        │
│  [Filesystem                              ]                  │
│                                                              │
│  Command                                                     │
│  [npx                                     ]                  │
│                                                              │
│  Arguments (one per line)                                    │
│  ┌──────────────────────────────────────┐                    │
│  │ @anthropic/mcp-server-filesystem     │                    │
│  │ /home/user/documents                 │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  Environment Variables (optional)                            │
│  ┌──────────────────────────────────────┐                    │
│  │ GITHUB_TOKEN=ghp_xxxxxxxxxxxx       │                    │
│  │                                      │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ☑ Enabled                                                   │
│  ☑ Require approval before tool execution                    │
│                                                              │
│                              [Cancel]  [Save]                │
└──────────────────────────────────────────────────────────────┘
```

### Import from JSON

Accepts Claude Desktop config format:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/home"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

The import dialog:
1. User pastes JSON or selects a file.
2. Parsed servers are shown in a preview list with checkboxes.
3. User selects which to import.
4. Imported servers default to `enabled: true`, `requireApproval: true`.
5. Duplicate names are suffixed with `(2)`.

## UI — Per-Conversation Toggle

In the chat input area, alongside the existing web search toggle:

```
🔍 Web Search [on/off]    🔧 MCP Servers [on/off ▾]
```

Clicking the MCP toggle opens a dropdown showing available servers with checkboxes:

```
┌── MCP Servers ──────────────────────┐
│ ☑ Filesystem         4 tools        │
│ ☑ GitHub             8 tools        │
│ ☐ PostgreSQL         3 tools        │
│                                     │
│ All globally enabled servers are    │
│ active by default.                  │
└─────────────────────────────────────┘
```

When the user customizes the selection, it writes `mcpServerIds` to the conversation. A reset option ("Use defaults") clears it back to `undefined`.

## UI — Tool Call Display

MCP tool calls reuse the existing tool call display system (Feature 05):

- **Tree view**: green nodule on assistant nodes (existing behavior). MCP and web_search calls are visually identical — tool type is visible on expansion.
- **Detail panel**: tool calls section shows the server name alongside the tool name:

```
Tool Use
  ┌─────────────────────────────────────────────────────────┐
  │ 🔧 Filesystem → read_file                               │
  │ Input: { "path": "/home/user/config.yaml" }             │
  │ ▶ Result (click to expand)                               │
  ├─────────────────────────────────────────────────────────┤
  │ 🔍 Web Search → web_search                               │
  │ Input: { "query": "YAML schema validation" }             │
  │ ▶ Result (click to expand)                               │
  └─────────────────────────────────────────────────────────┘
```

- **Thread view (Feature 21)**: collapsible inline block, same as web search but with server icon/name:

```
┌─ 🔧 Filesystem: read_file ────────────────────────────────┐
│ ▶ Input & result (click to expand)                         │
└────────────────────────────────────────────────────────────┘
```

## UI — Tool Approval Dialog

When `requireApproval` is true and the model requests a tool call, streaming pauses and a modal appears:

```
┌─── Tool Call Approval ──────────────────────────────────────┐
│                                                              │
│  Filesystem wants to call: read_file                         │
│                                                              │
│  Input:                                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ {                                                    │    │
│  │   "path": "/home/user/documents/report.txt"          │    │
│  │ }                                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  [Deny]     [Approve All This Turn]     [Approve]            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Backend — Server Configuration Sync

On app load, the frontend sends the current `mcpServers` config to the backend:

```
POST /api/mcp/config/sync
Body: { servers: MCPServerConfig[] }
```

This tells the backend what servers exist and their settings, without starting any. The backend uses this to validate requests — it won't start a server that isn't in the synced config.

On settings change (add/edit/remove server), the frontend re-syncs.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Backend unavailable | MCP toggle disabled with tooltip: "Backend required for MCP servers." |
| Server fails to start | Status shows "Error" with message. Tool calls to this server return error text to the model. |
| Server crashes mid-conversation | Next tool call attempts restart. If restart fails, error returned to model. |
| Tool call timeout | 30-second timeout per call. Returns "Tool call timed out" to model. |
| Server in `tools/list` returns 0 tools | Server marked as running but shows "0 tools" warning in Settings. |
| Invalid import JSON | Parse error shown in import dialog. Partial imports not applied. |
| Tool name collision | Console warning. Built-in tools take priority; between MCP servers, last in list wins. |

## Security Considerations

- **Environment variables**: may contain secrets (API keys, tokens). The Settings UI masks env var values after entry (shown as `••••••`). They are stored in Dexie (client-side) and sent to the backend only during config sync.
- **Filesystem access**: MCP servers like `filesystem` can read/write files. The `requireApproval: true` default mitigates this — users see exactly what the model is requesting before execution.
- **Process isolation**: MCP servers run as child processes of the backend with the backend's user permissions. No additional sandboxing is applied (same trust model as Claude Desktop).
- **No remote servers**: This feature only supports local stdio servers managed by the backend. Remote/SSE servers are out of scope (see TODO).

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/services/mcp.ts` | MCPManager class — process lifecycle, JSON-RPC client, tool discovery/execution |
| `server/src/routes/mcp.ts` | Fastify routes for `/api/mcp/*` |
| `src/api/mcp.ts` | Frontend API client for MCP backend endpoints |
| `src/components/settings/MCPServersSection.tsx` | Settings page section for managing MCP servers |
| `src/components/settings/MCPServerDialog.tsx` | Add/edit server dialog |
| `src/components/settings/MCPImportDialog.tsx` | Claude Desktop JSON import dialog |
| `src/components/chat/ToolApprovalDialog.tsx` | Tool call approval modal |
| `src/components/chat/MCPServerToggle.tsx` | Per-conversation MCP server toggle dropdown |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `MCPServerConfig`, `MCPToolInfo` types; add `mcpServerIds` to `Conversation`; add `mcpServers` to `AppSettings` |
| `src/api/providers/types.ts` | Add `mcpServerId` to `ToolCallRecord` |
| `src/api/tools.ts` | Extend `createToolExecutor` to route MCP tool calls to backend |
| `src/hooks/useStreamingResponse.ts` | Integrate MCP tool resolution and approval flow into `resolveToolsForConversation` and `onToolCall` |
| `src/store/useSettingsStore.ts` | Add `mcpServers` to state, add CRUD actions for server configs |
| `src/components/settings/SettingsPage.tsx` (or equivalent) | Add MCP Servers section |
| `src/components/chat/ChatInput.tsx` | Add MCP server toggle alongside web search toggle |
| `src/components/tree/NodeDetailPanel.tsx` | Show MCP server name in tool call display |
| `server/src/index.ts` | Register MCP routes, initialize MCPManager |
| `server/package.json` | Add `@anthropic-ai/sdk` or `@modelcontextprotocol/sdk` dependency for JSON-RPC client |

## Implementation Order

1. **Backend MCPManager**: process spawning, stdio JSON-RPC, `initialize`/`tools/list`/`tools/call` protocol.
2. **Backend routes**: REST endpoints for server management and tool execution.
3. **Data model**: types, settings store, Dexie defaults.
4. **Settings UI**: server list, add/edit dialog, import from JSON.
5. **Tool integration**: extend tool resolution and executor to include MCP tools.
6. **Approval flow**: `ToolApprovalDialog`, pause/resume streaming.
7. **Per-conversation toggle**: MCP server dropdown in chat input.
8. **Display refinements**: server name in tool call display, thread view blocks.

## Edge Cases

- **Server takes too long to start**: 15-second startup timeout. If exceeded, mark as error and return failure to the tool call. User can retry.
- **Many tools across many servers**: if total tool count exceeds the model's tool limit (varies by provider), truncate with a warning. Anthropic supports up to 128 tools.
- **Model calls a tool from a stopped server**: on-demand start kicks in. The tool call waits for the server to start (up to 15s) before executing.
- **Conversation loaded with MCP servers that no longer exist**: `mcpServerIds` references are stale. Silently filter out unknown IDs — the conversation works with whatever servers are still configured.
- **Backend restarts**: all MCP server processes are lost. On-demand start recreates them as needed.
- **Concurrent tool calls**: the MCP protocol supports concurrent `tools/call` requests on a single server connection. The MCPManager serializes calls per server to avoid interleaving stdio (simplest correct approach; can be optimized later with request IDs).

## TODO

- [ ] **MCP Resources**: allow MCP servers to expose resources (files, data) that can be injected into conversation context. Blocked on Feature 13 (Project Knowledge) completion — resources should integrate with the same knowledge injection system.
- [ ] **MCP Prompts**: allow MCP servers to expose prompt templates. Depends on resources implementation.
- [ ] **SSE/HTTP transport**: support MCP servers that expose an SSE endpoint for browser-direct connections (no backend required). Lower priority since most servers use stdio.
- [ ] **Server health monitoring**: periodic pings, auto-restart policies, uptime stats in Settings.
- [ ] **Tool-level approval**: instead of per-server, allow marking individual tools as auto-approve vs require-approval.
