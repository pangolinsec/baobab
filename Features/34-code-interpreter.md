# 34 — Code Interpreter

## Summary

Give models the ability to write and execute code during conversations. The primary execution environment is a Docker-based sandbox managed by the backend (supports Python, JavaScript, and shell scripts with full library access). When the backend is unavailable, falls back to browser-based execution via Pyodide (Python) and a sandboxed JS eval. Output includes stdout, stderr, and rendered visualizations (matplotlib charts, HTML). Integrates with the existing tool dispatch pipeline as a `code_interpreter` tool.

## Priority

Tier 3 — requires backend for full functionality, browser fallback for basic use.

## Dependencies

- **00 Backend Architecture**: Docker sandbox management, execution endpoints.
- **05 Web Search Tool**: establishes the tool dispatch pipeline. Code interpreter plugs into the same system.
- **07 Inference Providers**: only providers with `supportsToolUse: true` can invoke the code interpreter.

## Phasing

| Phase | Scope | Prerequisites | Status |
|-------|-------|---------------|--------|
| **A** | Backend Docker sandbox: Python + JS execution, stdout/stderr capture, timeout/memory limits. Frontend tool integration with output display. | 00, 05 | — |
| **B** | Visualization: matplotlib/plotly rendering → base64 images displayed inline. HTML output rendering in sandboxed iframe. | A | — |
| **C** | Browser fallback: Pyodide for Python, sandboxed eval for JS. Graceful degradation when backend unavailable. | A | — |
| **D** | Persistent sandbox: maintain state across multiple code executions within a conversation (variables, imports, files persist). | A | — |

---

## Data Model Changes

### Tool Definition

```typescript
const codeInterpreterTool = {
  name: 'code_interpreter',
  description: 'Execute code to perform calculations, data analysis, generate visualizations, or process data. Supports Python and JavaScript. Use this when the task requires computation, data transformation, or when you need to verify a result programmatically.',
  input_schema: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: ['python', 'javascript', 'bash'],
        description: 'Programming language to execute',
      },
      code: {
        type: 'string',
        description: 'The code to execute',
      },
    },
    required: ['language', 'code'],
  },
};
```

### `ToolCallRecord` (providers/types.ts)

Existing `toolCalls[]` array on assistant nodes stores code interpreter results:

```typescript
interface ToolCallRecord {
  // ... existing fields
  codeExecution?: {
    language: string;
    code: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    images?: Array<{           // Phase B: rendered visualizations
      mimeType: string;        // 'image/png', 'image/svg+xml'
      data: string;            // base64-encoded
    }>;
    html?: string;             // Phase B: HTML output for iframe rendering
    executionTimeMs: number;
    sandbox: 'docker' | 'pyodide' | 'browser-js';
  };
}
```

### `AppSettings` (types/index.ts)

```typescript
interface AppSettings {
  // ... existing fields
  codeInterpreter: {
    enabled: boolean;            // Global enable/disable (default true)
    timeoutMs: number;           // Execution timeout (default 30000, max 120000)
    maxOutputBytes: number;      // Truncate stdout/stderr (default 102400 = 100KB)
    dockerImage?: string;        // Custom Docker image (default 'baobab-sandbox:latest')
  };
}
```

### `Conversation` (types/index.ts)

```typescript
interface Conversation {
  // ... existing fields
  codeInterpreterEnabled?: boolean;  // Per-conversation toggle (default follows global setting)
}
```

### Dexie Migration

No schema changes needed — `codeInterpreter` is added to `AppSettings`, and `codeInterpreterEnabled` is an optional field on `Conversation`.

---

## Backend — Docker Sandbox

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Backend (Fastify)                                       │
│                                                          │
│  POST /api/code/execute                                  │
│    │                                                     │
│    ├─ Validate input (language, code, timeout)           │
│    ├─ Write code to temp file                            │
│    ├─ docker run --rm --network=none                     │
│    │    --memory=256m --cpus=1                            │
│    │    --timeout={timeoutMs}                             │
│    │    baobab-sandbox:latest                           │
│    │    {language} /tmp/code.{ext}                        │
│    ├─ Capture stdout, stderr, exit code                  │
│    ├─ Scan output dir for generated images               │
│    └─ Return result                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Sandbox Docker Image

A minimal Docker image (`baobab-sandbox`) pre-built with:

- **Python 3.12**: with numpy, pandas, matplotlib, scipy, sympy, requests (disabled at network level), Pillow, openpyxl
- **Node.js 22**: with no additional packages (model can use built-in modules)
- **Bash**: standard coreutils

```dockerfile
# server/sandbox/Dockerfile
FROM python:3.12-slim

RUN pip install --no-cache-dir \
    numpy pandas matplotlib scipy sympy Pillow openpyxl \
    && apt-get update && apt-get install -y nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Output directory for generated files (images, etc.)
RUN mkdir -p /output
ENV MPLBACKEND=Agg
ENV OUTPUT_DIR=/output

WORKDIR /workspace
```

The Dockerfile is included in the repo at `server/sandbox/Dockerfile`. The backend builds it on first use if not present.

### Routes — `server/src/routes/code.ts`

```typescript
// POST /api/code/execute
// Request: {
//   language: 'python' | 'javascript' | 'bash',
//   code: string,
//   timeoutMs?: number  // default 30000, max 120000
// }
// Response: {
//   stdout: string,
//   stderr: string,
//   exitCode: number,
//   images?: Array<{ mimeType: string, data: string }>,
//   html?: string,
//   executionTimeMs: number
// }

// GET /api/code/status
// Response: { dockerAvailable: boolean, imageReady: boolean }
```

### Execution Flow

1. Validate `language` is in allowed set.
2. Write `code` to a temporary file with the appropriate extension (`.py`, `.js`, `.sh`).
3. Run Docker container:
   ```
   docker run --rm \
     --network=none \
     --memory=256m \
     --cpus=1 \
     --pids-limit=100 \
     --read-only \
     --tmpfs /tmp:rw,size=64m \
     --tmpfs /workspace:rw,size=64m \
     -v /output \
     -v {tempfile}:/workspace/code.{ext}:ro \
     baobab-sandbox:latest \
     {runtime} /workspace/code.{ext}
   ```
4. Apply timeout: kill container if execution exceeds `timeoutMs`.
5. Capture stdout and stderr from container logs.
6. Scan `/output` directory for generated files (images).
7. Read images as base64, classify MIME types.
8. Truncate stdout/stderr to `maxOutputBytes`.
9. Return result.

### Security

| Measure | Implementation |
|---------|----------------|
| **No network** | `--network=none` prevents all network access |
| **Memory limit** | `--memory=256m` prevents memory exhaustion |
| **CPU limit** | `--cpus=1` prevents CPU starvation |
| **PID limit** | `--pids-limit=100` prevents fork bombs |
| **Read-only filesystem** | `--read-only` with tmpfs for /tmp and /workspace |
| **Timeout** | Container killed after configured timeout |
| **No persistent state** | `--rm` removes container after execution (Phase D changes this) |
| **Output size limit** | stdout/stderr truncated; image files capped at 10MB total |

---

## Frontend — Tool Integration

### Tool Resolution

Extend `resolveToolsForConversation()`:

```typescript
// After web_search, read_file, MCP, HTTP tools:
if (isCodeInterpreterEnabled(conversation)) {
  tools.push(codeInterpreterTool);
}
```

### Tool Executor

```typescript
async function executeCode(input: { language: string; code: string }): Promise<string> {
  const settings = useSettingsStore.getState().codeInterpreter;

  if (useBackendStatus() && await isDockerAvailable()) {
    // Backend Docker sandbox
    const result = await backendFetch('/api/code/execute', {
      method: 'POST',
      body: JSON.stringify({
        language: input.language,
        code: input.code,
        timeoutMs: settings.timeoutMs,
      }),
    });
    return formatCodeResult(result);
  }

  // Browser fallback (Phase C)
  return executeBrowserFallback(input);
}
```

### Result Formatting

The tool result sent back to the model as a string:

```
Execution result (Python, 234ms):
stdout:
42
[1, 4, 9, 16, 25]

stderr:
(empty)

Exit code: 0
[1 image generated: chart.png]
```

---

## Phase B — Visualization

### Matplotlib / Plotly Detection

When Python code calls `plt.savefig()` or `plt.show()`, the sandbox patches matplotlib to save to `/output/`:

The sandbox entrypoint script (`server/sandbox/entrypoint.py`) patches `plt.show()` to save to `/output/plot_{n}.png` instead of displaying.

### Image Display in UI

Images from code execution are rendered inline in the tool call display:

```
Tool Use
  ┌─────────────────────────────────────────────────────────┐
  │ 💻 code_interpreter (Python, 1.2s)                       │
  │ Code:                                                    │
  │ ┌──────────────────────────────────────────────────────┐ │
  │ │ import matplotlib.pyplot as plt                      │ │
  │ │ import numpy as np                                   │ │
  │ │ x = np.linspace(0, 10, 100)                          │ │
  │ │ plt.plot(x, np.sin(x))                               │ │
  │ │ plt.title('Sine Wave')                               │ │
  │ │ plt.show()                                           │ │
  │ └──────────────────────────────────────────────────────┘ │
  │ Output: 42                                               │
  │ ┌──────────────────────────────────────┐                 │
  │ │        [rendered chart image]        │                 │
  │ └──────────────────────────────────────┘                 │
  └─────────────────────────────────────────────────────────┘
```

Code blocks use syntax highlighting (CodeMirror or rehype-highlight, consistent with existing markdown rendering).

### HTML Output

If the code writes to `/output/result.html`, it's rendered in a sandboxed iframe:

```html
<iframe
  srcDoc={html}
  sandbox="allow-scripts"
  style={{ width: '100%', height: '400px', border: '1px solid var(--color-border)' }}
/>
```

---

## Phase C — Browser Fallback

### Pyodide (Python)

When the backend is unavailable, Python execution uses Pyodide (Python compiled to WebAssembly):

```typescript
// src/lib/pyodide.ts
let pyodide: PyodideInterface | null = null;

async function initPyodide(): Promise<PyodideInterface> {
  if (!pyodide) {
    pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'pandas', 'matplotlib', 'scipy', 'sympy']);
  }
  return pyodide;
}

async function executePython(code: string): Promise<CodeResult> {
  const py = await initPyodide();
  // Redirect stdout/stderr
  py.runPython(`
    import sys, io
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()
  `);

  try {
    py.runPython(code);
    const stdout = py.runPython('sys.stdout.getvalue()');
    const stderr = py.runPython('sys.stderr.getvalue()');
    return { stdout, stderr, exitCode: 0, sandbox: 'pyodide' };
  } catch (err) {
    return { stdout: '', stderr: String(err), exitCode: 1, sandbox: 'pyodide' };
  }
}
```

**Limitations of Pyodide fallback**:
- No network access (same as Docker — consistent behavior)
- Limited package set (only packages available in Pyodide)
- No bash/shell execution
- Slower first execution (Pyodide download ~10MB)
- Matplotlib rendering via Pyodide's built-in support (saves to virtual filesystem)

### JavaScript Sandbox

Basic JS execution in an isolated context:

```typescript
async function executeJavaScript(code: string): Promise<CodeResult> {
  const logs: string[] = [];
  const errors: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => errors.push(args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
    },
    Math, JSON, Date, Array, Object, String, Number, Boolean, Map, Set,
    RegExp, Promise, parseInt, parseFloat, isNaN, isFinite,
  };

  try {
    const fn = new Function(...Object.keys(sandbox), code);
    await fn(...Object.values(sandbox));
    return { stdout: logs.join('\n'), stderr: errors.join('\n'), exitCode: 0, sandbox: 'browser-js' };
  } catch (err) {
    return { stdout: logs.join('\n'), stderr: String(err), exitCode: 1, sandbox: 'browser-js' };
  }
}
```

**Limitations**: No `require`/`import`, no filesystem, no network. Suitable for calculations and data processing only.

---

## Phase D — Persistent Sandbox

For multi-step code execution within a conversation, maintain a running Docker container:

- On first `code_interpreter` call in a conversation, start a container and keep it running.
- Subsequent calls in the same conversation execute in the same container (variables, files persist).
- Container is stopped after 10 minutes of inactivity or when the conversation is closed.
- The backend tracks active containers per conversation ID.

This enables workflows like:
1. Model: "Let me load the data" → `import pandas as pd; df = pd.read_csv(...)`
2. Model: "Now let me analyze it" → `df.describe()` (uses the same `df`)

---

## UI — Toggle

In the chat input area:

```
🔍 Web Search [on/off]    💻 Code [on/off]    🔧 MCP [on/off ▾]    🔗 Tools [on/off ▾]
```

Code interpreter is a simple on/off toggle (no sub-items to configure per-conversation).

### Settings

In the Settings page, Advanced tab:

```
Code Interpreter
  ☑ Enable code interpreter

  Execution timeout: [30] seconds
  Max output size: [100] KB

  Docker sandbox image: [baobab-sandbox:latest]
  Status: ✓ Docker available, image ready
          ○ Docker not available — browser fallback active
```

---

## Feature Gating

Add to `useFeatureGating`:

```typescript
codeInterpreter: boolean;        // always true (browser fallback exists)
codeInterpreterDocker: boolean;  // backend available AND Docker available
```

The code interpreter is always available (browser fallback), but the Settings UI shows which execution environment is active.

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/src/routes/code.ts` | Fastify routes for `/api/code/execute`, `/api/code/status` |
| `server/src/services/code/docker.ts` | Docker container management, execution, image building |
| `server/src/services/code/entrypoint.py` | Python entrypoint that patches matplotlib |
| `server/sandbox/Dockerfile` | Sandbox Docker image definition |
| `src/lib/pyodide.ts` | Browser-side Pyodide initialization and execution |
| `src/lib/code-sandbox.ts` | Browser-side JS sandbox execution |
| `src/components/tree/CodeExecutionDisplay.tsx` | Code + output + image rendering in tool call display |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `codeExecution` to `ToolCallRecord`; add `codeInterpreter` to `AppSettings`; add `codeInterpreterEnabled` to `Conversation` |
| `src/api/tools.ts` | Add `code_interpreter` tool definition and executor |
| `src/hooks/useStreamingResponse.ts` | Include `code_interpreter` in tool resolution |
| `src/store/useSettingsStore.ts` | Add `codeInterpreter` settings |
| `src/hooks/useFeatureGating.ts` | Add `codeInterpreter` and `codeInterpreterDocker` capabilities |
| `src/components/chat/ChatInput.tsx` | Add code interpreter toggle |
| `src/components/tree/NodeDetailPanel.tsx` | Render code execution results with syntax highlighting and images |
| `server/src/index.ts` | Register code execution routes |
| `server/package.json` | Add `dockerode` dependency for Docker management |
| `docker-compose.yml` | Mount Docker socket into API container for sandbox management |

## Implementation Order

1. **Phase A**: Backend Docker sandbox → routes → tool definition → frontend executor → basic output display.
2. **Phase B**: Matplotlib patching → image capture → inline image rendering → HTML iframe.
3. **Phase C**: Pyodide integration → JS sandbox → fallback logic → feature gating updates.
4. **Phase D**: Persistent container management → conversation-scoped sessions.

## Edge Cases

| Question | Answer |
|----------|--------|
| What happens with empty, null, or undefined input? | Empty code string → return immediately with "No code provided" as stderr. Unknown language → return error "Unsupported language: {x}". |
| What if the external dependency is unavailable? | Docker unavailable → fall back to browser execution (Phase C). Backend unavailable → browser execution. Pyodide download fails → show error "Code interpreter unavailable — could not load Python runtime." |
| What if this runs concurrently with itself? | Multiple code executions from the same conversation (batch or multi-tool) → each gets its own Docker container (Phase A/B/C). Phase D persistent sandbox serializes execution within a conversation. |
| What happens on the second invocation? | Phase A-C: stateless — each execution is independent. Phase D: stateful — previous variables and files are available. |
| What if the user's data is larger than expected? | stdout/stderr truncated to maxOutputBytes. Images capped at 10MB total. Container memory limited to 256MB. Timeout kills runaway code. |
| What state persists vs. resets across page reload? | Code execution results persist in toolCalls on nodes (IndexedDB). Docker containers are ephemeral — reload loses persistent sandbox state (Phase D). Pyodide state is lost on reload. |

## Browser-Only Mode

Code interpreter is available with reduced capability:
- **Python**: via Pyodide (numpy, pandas, matplotlib, scipy, sympy available)
- **JavaScript**: via sandboxed eval (built-in objects only)
- **Bash**: disabled (no browser equivalent)
- **Visualization**: matplotlib works via Pyodide; no HTML iframe rendering
