# 33 — HTTP Tool Extensions

## Summary

Allow users to define custom tools via the Settings UI that call external HTTP endpoints. Each tool has a name, description, JSON Schema input definition, a webhook URL, and optional authentication headers. The backend proxies tool calls to avoid CORS issues. Tools integrate with the existing tool dispatch pipeline and are toggleable per-conversation, following the same pattern as MCP servers (Feature 27).

## Priority

Tier 3 — requires backend.

## Dependencies

- **00 Backend Architecture**: backend proxies HTTP tool calls to avoid CORS restrictions.
- **05 Web Search Tool**: establishes the tool dispatch pipeline (`registerToolHandler`, `dispatchToolCalls`, `toolCalls[]` on nodes). HTTP tools plug into this same pipeline.
- **07 Inference Providers**: tool definitions must be provider-agnostic; only providers with `supportsToolUse: true` can use HTTP tools.

## Phasing

| Phase | Scope | Prerequisites | Status |
|-------|-------|---------------|--------|
| **A** | Core: define tools in Settings, backend proxy, tool dispatch integration. Per-conversation toggle. | 00, 05 | — |
| **B** | Templates: import/export tool configs, community-shared tool packs (JSON format). | A | — |

---

## Data Model Changes

### `HTTPToolConfig` (new type in `types/index.ts`)

```typescript
interface HTTPToolConfig {
  id: string;                          // UUID
  name: string;                        // Tool name sent to the model (e.g. 'get_weather')
  description: string;                 // Description sent to the model
  inputSchema: Record<string, unknown>; // JSON Schema for tool input
  endpoint: string;                    // URL to call (e.g. 'https://api.example.com/weather')
  method: 'GET' | 'POST' | 'PUT';     // HTTP method (default POST)
  auth?: {
    type: 'bearer' | 'api-key' | 'custom-header';
    token?: string;                    // For bearer: the token value
    headerName?: string;               // For api-key/custom-header: header name (e.g. 'X-API-Key')
    headerValue?: string;              // For api-key/custom-header: header value
  };
  enabled: boolean;                    // Globally enabled (default true on creation)
  timeout: number;                     // Request timeout in ms (default 30000)
}
```

### `AppSettings` (types/index.ts)

```typescript
interface AppSettings {
  // ... existing fields
  httpTools: HTTPToolConfig[];         // Configured HTTP tools (default [])
}
```

### `Conversation` (types/index.ts)

```typescript
interface Conversation {
  // ... existing fields
  httpToolIds?: string[];              // HTTP tools enabled for this conversation
                                       // undefined = all globally-enabled tools
                                       // [] = none (explicitly disabled)
                                       // ['tool-id-1'] = specific subset
}
```

### `ToolCallRecord` (providers/types.ts)

```typescript
interface ToolCallRecord {
  // ... existing fields
  httpToolId?: string;                 // Which HTTP tool handled this (undefined for non-HTTP tools)
}
```

### Dexie Migration

No schema changes needed — `httpTools` is added to `AppSettings` (stored in the `settings` table as a single row), and `httpToolIds` is an optional field on `Conversation` (no new index needed).

---

## Backend — HTTP Tool Proxy

### Routes — `server/src/routes/tools.ts`

```typescript
// POST /api/tools/call
// Proxies an HTTP tool call to the configured endpoint
// Request: {
//   toolId: string,
//   config: HTTPToolConfig,
//   input: Record<string, unknown>
// }
// Response: { result: string } | { error: string }
```

The backend receives the full tool config from the frontend (same pattern as MCP server configs — frontend is source of truth). It:

1. Validates the config has a valid endpoint URL (rejects private/internal IPs: `127.0.0.1`, `localhost`, `10.*`, `192.168.*`, `172.16-31.*`).
2. Constructs the HTTP request:
   - **POST/PUT**: sends `input` as JSON body.
   - **GET**: maps `input` fields to query parameters.
3. Sets auth headers based on `config.auth`:
   - `bearer`: `Authorization: Bearer {token}`
   - `api-key`: `{headerName}: {headerValue}`
   - `custom-header`: `{headerName}: {headerValue}`
4. Sends request with the configured timeout.
5. Returns the response body as a string (truncated to 100KB if larger).

### SSRF Protection

The backend MUST validate that the endpoint URL does not resolve to a private/internal IP address. This prevents Server-Side Request Forgery attacks where a malicious tool config could probe internal services.

```typescript
function isPrivateUrl(url: string): boolean {
  const hostname = new URL(url).hostname;
  // Block: localhost, 127.*, 10.*, 172.16-31.*, 192.168.*, ::1, fc00::/7
  // Allow: everything else
}
```

If the URL resolves to a private IP after DNS resolution, reject with a `403` error: `"Tool endpoint resolves to a private IP address"`.

---

## Frontend — Tool Integration

### Tool Resolution (in `useStreamingResponse.ts`)

Extend `resolveToolsForConversation()` to include HTTP tools:

```typescript
async function resolveToolsForConversation(conversation: Conversation): Promise<{
  tools: ToolDefinition[];
  executor: (toolName: string, input: Record<string, unknown>) => Promise<string>;
}> {
  const tools: ToolDefinition[] = [];
  const httpToolMap: Map<string, HTTPToolConfig> = new Map();

  // 1. Web search tool (existing)
  // 2. File read tool (existing)
  // 3. MCP tools (Feature 27)

  // 4. HTTP tools (new)
  const enabledHttpTools = resolveEnabledHTTPTools(conversation);
  for (const tool of enabledHttpTools) {
    tools.push({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    });
    httpToolMap.set(tool.name, tool);
  }

  // 5. Unified executor (extend existing)
  const executor = async (toolName: string, input: Record<string, unknown>): Promise<string> => {
    // ... existing web_search, read_file, MCP handlers
    const httpTool = httpToolMap.get(toolName);
    if (httpTool) {
      return callHTTPTool(httpTool, input);
    }
    return `Unknown tool: ${toolName}`;
  };

  return { tools, executor };
}
```

### Tool Name Collision Priority

Same rules as MCP (Feature 27):

1. Built-in tools (`web_search`, `read_file`, `code_interpreter`) take priority.
2. MCP tools take priority over HTTP tools.
3. Among HTTP tools, first in list wins.
4. Collisions produce a console warning.

### Resolving Enabled Tools

```typescript
function resolveEnabledHTTPTools(conversation: Conversation): HTTPToolConfig[] {
  const settings = useSettingsStore.getState();
  const allEnabled = settings.httpTools.filter(t => t.enabled);

  if (conversation.httpToolIds === undefined) {
    return allEnabled;
  }
  return allEnabled.filter(t => conversation.httpToolIds!.includes(t.id));
}
```

---

## UI — Settings Page

### HTTP Tools Section

Added as a new section in the Settings page, after MCP Servers:

```
HTTP Tools

  ┌──────────────────────────────────────────────────────────────┐
  │  Get Weather                                    [Enabled ●]   │
  │  POST https://api.example.com/weather                         │
  │  Auth: Bearer token  │  Timeout: 30s                          │
  │                                          [Edit] [Remove]      │
  ├──────────────────────────────────────────────────────────────┤
  │  Translate Text                             [Enabled ●]       │
  │  POST https://api.deepl.com/v2/translate                      │
  │  Auth: API Key (DeepL-Auth-Key)                               │
  │                                          [Edit] [Remove]      │
  └──────────────────────────────────────────────────────────────┘

  [+ Add Tool]    [Import from JSON]
```

### Add/Edit Tool Dialog

```
┌─── Add HTTP Tool ──────────────────────────────────────────────┐
│                                                                 │
│  Tool Name (sent to model)                                      │
│  [get_weather                           ]                       │
│                                                                 │
│  Description (sent to model)                                    │
│  [Get current weather for a location.   ]                       │
│  [Returns temperature, conditions, and  ]                       │
│  [humidity.                             ]                       │
│                                                                 │
│  Input Schema (JSON)                                            │
│  ┌──────────────────────────────────────────────────┐           │
│  │ {                                                │           │
│  │   "type": "object",                              │           │
│  │   "properties": {                                │           │
│  │     "location": {                                │           │
│  │       "type": "string",                          │           │
│  │       "description": "City name"                 │           │
│  │     }                                            │           │
│  │   },                                             │           │
│  │   "required": ["location"]                       │           │
│  │ }                                                │           │
│  └──────────────────────────────────────────────────┘           │
│  [Validate Schema]                                              │
│                                                                 │
│  Endpoint URL                                                   │
│  [https://api.example.com/weather       ]                       │
│                                                                 │
│  Method: [POST ▾]                                               │
│                                                                 │
│  Authentication                                                 │
│  Type: [None ▾]  [Bearer Token] [API Key] [Custom Header]      │
│  Token: [••••••••••••••••••••••           ]                     │
│                                                                 │
│  Timeout: [30] seconds                                          │
│                                                                 │
│  ☑ Enabled                                                      │
│                                                                 │
│  ─── Test ─────────────────────────────────────────             │
│  [Test Tool]  → sends a sample call through the backend proxy   │
│  Result: ✓ 200 OK (245ms)                                      │
│                                                                 │
│                                    [Cancel]  [Save]             │
└─────────────────────────────────────────────────────────────────┘
```

**Schema validation**: "Validate Schema" parses the JSON and checks it's a valid JSON Schema object with `type: "object"` and `properties`. Invalid schemas show an inline error.

**Test Tool**: Sends a test call through the backend proxy with a sample input derived from the schema (empty strings for string fields, 0 for numbers, false for booleans). Shows the HTTP status, response time, and a preview of the response body.

**Auth token masking**: Auth tokens are masked after entry (shown as `••••••`), same pattern as MCP env vars (Feature 27).

### Phase B — Import/Export

```
[Import from JSON]
```

Accepts a JSON format for sharing tool configs:

```json
{
  "httpTools": [
    {
      "name": "get_weather",
      "description": "Get current weather for a location.",
      "inputSchema": { ... },
      "endpoint": "https://api.example.com/weather",
      "method": "POST",
      "auth": { "type": "bearer" }
    }
  ]
}
```

Note: auth tokens are NOT included in exports for security. The user must fill them in after import. The import dialog shows a warning: "Auth tokens are not included in imports. You'll need to configure authentication after importing."

---

## UI — Per-Conversation Toggle

In the chat input area, alongside existing toggles:

```
🔍 Web Search [on/off]    🔧 MCP [on/off ▾]    🔗 Tools [on/off ▾]
```

Clicking the Tools toggle opens a dropdown showing available HTTP tools with checkboxes:

```
┌── HTTP Tools ───────────────────────┐
│ ☑ Get Weather         1 param       │
│ ☑ Translate Text      2 params      │
│ ☐ Code Search         1 param       │
│                                     │
│ All globally enabled tools are      │
│ active by default.                  │
└─────────────────────────────────────┘
```

---

## UI — Tool Call Display

HTTP tool calls reuse the existing tool call display system (Feature 05):

- **Tree view**: green nodule on assistant nodes. HTTP and other tool calls are visually identical — tool type is visible on expansion.
- **Detail panel**: shows the tool name and endpoint:

```
Tool Use
  ┌─────────────────────────────────────────────────────────┐
  │ 🔗 get_weather                                           │
  │ Endpoint: api.example.com                                │
  │ Input: { "location": "San Francisco" }                   │
  │ ▶ Result (click to expand)                               │
  └─────────────────────────────────────────────────────────┘
```

---

## Feature Gating

Add to `useFeatureGating`:

```typescript
httpTools: boolean;  // backend available (for CORS proxy)
```

When the backend is unavailable, the HTTP Tools section in Settings and the per-conversation toggle are hidden.

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/routes/tools.ts` | Fastify routes for `/api/tools/call` |
| `src/components/settings/HTTPToolsSection.tsx` | Settings page section for managing HTTP tools |
| `src/components/settings/HTTPToolDialog.tsx` | Add/edit tool dialog |
| `src/components/chat/HTTPToolToggle.tsx` | Per-conversation HTTP tool toggle dropdown |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `HTTPToolConfig` type; add `httpToolIds` to `Conversation`; add `httpTools` to `AppSettings` |
| `src/api/providers/types.ts` | Add `httpToolId` to `ToolCallRecord` |
| `src/api/tools.ts` | Add HTTP tool executor; extend `createToolExecutor` to route HTTP tool calls through backend proxy |
| `src/hooks/useStreamingResponse.ts` | Integrate HTTP tool resolution into `resolveToolsForConversation` |
| `src/store/useSettingsStore.ts` | Add `httpTools` to state, add CRUD actions for tool configs |
| `src/hooks/useFeatureGating.ts` | Add `httpTools` capability |
| `src/components/chat/ChatInput.tsx` | Add HTTP tool toggle alongside web search and MCP toggles |
| `src/components/tree/NodeDetailPanel.tsx` | Show endpoint domain in tool call display |
| `server/src/index.ts` | Register tool proxy routes |

## Implementation Order

1. **Data model**: types, settings store, Dexie defaults.
2. **Backend proxy**: tool call route with SSRF protection.
3. **Settings UI**: tool list, add/edit dialog, test button.
4. **Tool integration**: extend tool resolution and executor.
5. **Per-conversation toggle**: HTTP tool dropdown in chat input.
6. **Display refinements**: endpoint domain in tool call display.
7. **Phase B**: import/export of tool configs.

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Tool with no name or no endpoint → "Save" button disabled. Empty input schema → treated as `{ type: "object", properties: {} }` (no parameters). |
| What if the external dependency is unavailable? | Endpoint returns error or times out → error string returned to model as tool_result. Model handles gracefully. Backend proxy unavailable → HTTP tools hidden via feature gating. |
| What if this runs concurrently with itself? | Multiple tool calls from same turn execute in parallel (existing `Promise.all` behavior). Each call is independent. |
| What happens on the second invocation? | Opening the edit dialog loads current config. Saving overwrites. No versioning. |
| What if the user's data is larger than expected? | Response bodies truncated to 100KB. Timeout enforced per-call. Many tools (20+): per-conversation toggle dropdown scrolls. |
| What state persists vs. resets across page reload? | Tool configs persist in AppSettings (IndexedDB). Test results are transient. Per-conversation tool selection persists on Conversation. |

## Browser-Only Mode

HTTP tools are entirely disabled in the browser-only build. The Settings section and per-conversation toggle are hidden. Direct browser-to-endpoint calls would work for CORS-permissive APIs, but the SSRF protection and consistent behavior make backend proxying the right default.
