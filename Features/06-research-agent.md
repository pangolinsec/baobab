# 06 — Research Agent

## Summary

A unified research agent that gathers information from a source and synthesizes it into a markdown report. Supports two exclusive tool modes — **tree-search** (explore conversation branches in the local tree) and **web-search** (search the web via backend) — with a shared plan-then-execute architecture.

A plan-then-execute research pipeline with structured findings and a dedicated research view.

## Priority

Tier 4 — advanced feature.

## Dependencies

- **00 Backend Architecture**: required for web-search mode (search routes).
- **05 Web Search Tool**: web-search mode reuses the backend search endpoints.
- **07 Inference Providers**: planner/sub-agents may use different providers.
## Key Design Decisions

1. **Modes are exclusive** per run — a run is either tree-search or web-search. Mixed mode is a future TODO.
2. **Any subtree** can be researched (tree-search).
3. **Multi-agent from the start** — plan-then-execute with planner, sub-agents, and synthesizer.
4. **Two model selections** per run: planner/synthesizer (frontier-capable) and sub-agents (can be cheaper).
5. **Research view** is a dedicated view mode (alongside tree, thread).
6. **Output** is a markdown document stored on `ResearchRun`, downloadable, and addable to project knowledge.
7. **Incremental synthesis** rewrites the full document each time, with a configurable interval.
8. **Process tree** uses `ResearchProcessNode[]` stored on the `ResearchRun`, not main tree nodes.
9. **Green research icon** on trigger nodes in the main tree, similar to the web search globe on tool call nodules.

---

## Data Model

### New Type: `ResearchRun`

```typescript
interface ResearchRun {
  id: string;                          // GUID
  conversationId: string;
  triggerNodeId: string;               // node that triggered the research
  mode: 'tree-search' | 'web-search';

  // Configuration
  config: ResearchConfig;

  // Plan
  plan: ResearchPlan | null;           // null before planning completes

  // Process tree (internal agent work, NOT main tree nodes)
  processNodes: ResearchProcessNode[];

  // Output
  report: string | null;               // markdown document, null before synthesis
  reportUpdatedAt: number | null;

  // Status
  status: 'planning' | 'researching' | 'synthesizing' | 'complete' | 'error' | 'cancelled';
  error?: string;                      // error message if status is 'error'
  createdAt: number;
  updatedAt: number;
}

interface ResearchConfig {
  goal: string;                        // freeform description of what to research
  prompt: string;                      // system prompt for planner/synthesizer (mode-specific default)

  // Models
  plannerModelId: string;              // model for planner + synthesizer (frontier)
  plannerProviderId: string;
  subAgentModelId: string;             // model for sub-agents (can be cheaper)
  subAgentProviderId: string;

  // Limits
  maxSubTasks: number;                 // max sub-tasks in plan (default: 7)
  maxToolCallsPerSubAgent: number;     // max tool calls per sub-agent (default: 20)
  maxTotalToolCalls: number;           // global limit across all sub-agents (default: 100)

  // Incremental synthesis
  incrementalInterval?: number;        // auto-run every N new nodes (default: 10, undefined = disabled)
  previousReport?: string;             // previous report for incremental rewrite
}

interface ResearchPlan {
  subTasks: ResearchSubTask[];
  reasoning: string;                   // planner's reasoning for the decomposition
}

interface ResearchSubTask {
  id: string;                          // GUID
  title: string;
  description: string;                 // what the sub-agent should investigate
  status: 'pending' | 'running' | 'complete' | 'error';
  findingsCount: number;               // number of record_finding calls made
}

interface ResearchProcessNode {
  id: string;
  subTaskId: string;                   // which sub-task this belongs to
  type: 'tool_call' | 'finding' | 'error';
  toolName?: string;                   // for tool_call type
  input?: Record<string, unknown>;     // tool call input
  output?: string;                     // tool call result or finding content
  citation?: string;                   // source reference (node ID for tree-search, URL for web-search)
  createdAt: number;
}
```

### New Field on `TreeNode`

```typescript
interface TreeNode {
  // ... existing fields

  // Feature 06: Research run link
  researchRunId?: string;              // links this node to a ResearchRun (green icon trigger)
}
```

The `researchRunId` field is set on the trigger node (the node from which research was launched). It enables the green research icon overlay and click-to-navigate behavior.

### Dexie Schema Update

```typescript
// V7 migration — adds researchRuns table
// V7 migration — adds researchRuns table
db.version(7).stores({
  // ... all existing tables unchanged
  researchRuns: 'id, conversationId, triggerNodeId, status',
});
// No upgrade function needed — new table starts empty.
```

**Why no separate `researchProcessNodes` table?** Process nodes are stored as a JSON array on the `ResearchRun` record. They are always loaded/saved with the run and never queried independently. This keeps the schema simple and avoids a second table.

### `AppSettings` Additions

```typescript
interface AppSettings {
  // ... existing fields

  // Feature 06: Research defaults
  researchTreeSearchPrompt?: string;       // default planner prompt for tree-search mode
  researchWebSearchPrompt?: string;        // default planner prompt for web-search mode
  researchDefaultPlannerModelId?: string;
  researchDefaultPlannerProviderId?: string;
  researchDefaultSubAgentModelId?: string;
  researchDefaultSubAgentProviderId?: string;
  researchMaxSubTasks?: number;            // default: 7
  researchMaxToolCallsPerSubAgent?: number; // default: 20
  researchMaxTotalToolCalls?: number;       // default: 100
  researchIncrementalInterval?: number;     // default: 10
}
```

These are handled at the store level via defaults merge (no Dexie schema change for settings).

---

## Architecture

### Plan-Then-Execute Pipeline

```
1. USER triggers research (goal + config)
2. PLANNER agent receives goal + mode-specific context
   → Decomposes into 3–7 sub-tasks
3. SUB-AGENTS execute sequentially, one per sub-task
   → Each has mode-specific tools + record_finding
   → Findings are structured with citations
4. SYNTHESIZER agent receives all findings + goal
   → Produces markdown report with source citations
5. REPORT stored on ResearchRun, viewable in research view
```

### Model Routing

Two model selections per run:

| Role | Default | Purpose |
|------|---------|---------|
| **Planner + Synthesizer** | Frontier model (e.g., claude-sonnet-4-20250514) | Strategic decomposition + coherent writing |
| **Sub-agents** | Can be cheaper (e.g., claude-haiku-4-5-20251001) | Mechanical tool use + finding extraction |

### Mode-Specific Tools

Modes are exclusive per run. Each mode provides a different tool set to sub-agents, plus one shared tool.

---

## Tools

### Shared Tool (both modes)

#### `record_finding`

```typescript
{
  name: 'record_finding',
  description: 'Record a finding from your research. Each finding should be a discrete piece of information with a source citation.',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The finding — a clear, concise statement of what was discovered.'
      },
      citation: {
        type: 'string',
        description: 'Source reference. For tree-search: node ID. For web-search: URL.'
      },
      relevance: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How relevant this finding is to the sub-task goal.'
      }
    },
    required: ['content', 'citation', 'relevance']
  }
}
```

Each `record_finding` call creates a `ResearchProcessNode` of type `'finding'` on the run.

### Tree-Search Tools (5 tools)

Available only in `mode: 'tree-search'`. These give the sub-agent read-only access to the conversation tree.

#### `get_tree_overview`

```typescript
{
  name: 'get_tree_overview',
  description: 'Get a high-level overview of the conversation tree structure.',
  input_schema: { type: 'object', properties: {} }
}
// Returns: { totalNodes, branchCount, maxDepth, rootContent (first 200 chars) }
```

#### `search_nodes`

```typescript
{
  name: 'search_nodes',
  description: 'Search for nodes containing specific text or matching a pattern.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (substring match, case-insensitive)' },
      role: { type: 'string', enum: ['user', 'assistant'], description: 'Filter by role (optional)' },
      maxResults: { type: 'number', description: 'Max results to return (default: 10)' }
    },
    required: ['query']
  }
}
// Returns: [{ nodeId, role, snippet (200 chars around match), depth }]
```

#### `read_node`

```typescript
{
  name: 'read_node',
  description: 'Read the full content of a specific node.',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'The node ID to read' }
    },
    required: ['nodeId']
  }
}
// Returns: { nodeId, role, content, parentId, childCount, depth, model, createdAt }
```

#### `list_branches`

```typescript
{
  name: 'list_branches',
  description: 'List all branch points in the tree (nodes with multiple children).',
  input_schema: {
    type: 'object',
    properties: {
      fromNodeId: { type: 'string', description: 'Start from this node (default: root)' }
    }
  }
}
// Returns: [{ nodeId, childCount, snippet, depth }]
```

#### `get_conversation_path`

```typescript
{
  name: 'get_conversation_path',
  description: 'Get the full conversation path from root to a specific node.',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'The leaf node ID' },
      summarize: { type: 'boolean', description: 'If true, return summaries instead of full content (default: false)' }
    },
    required: ['nodeId']
  }
}
// Returns: [{ nodeId, role, content (or summary if summarize=true), depth }]
```

### Web-Search Tools (2 tools)

Available only in `mode: 'web-search'`. These give the sub-agent access to web search via the backend.

#### `web_search`

```typescript
{
  name: 'web_search',
  description: 'Search the web for information.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Max results (default: 5)' }
    },
    required: ['query']
  }
}
// Returns: [{ title, url, snippet }]
// Implementation: calls the existing backend search routes (DuckDuckGo/Tavily/Bing)
```

#### `fetch_page`

```typescript
{
  name: 'fetch_page',
  description: 'Fetch and extract text content from a web page.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      maxLength: { type: 'number', description: 'Max characters to return (default: 5000)' }
    },
    required: ['url']
  }
}
// Returns: { title, content (extracted text, truncated to maxLength), url }
// Implementation: fetches via backend proxy route, extracts text with readability-style parsing
```

---

## Planner Agent

The planner receives the research goal and mode context, then decomposes the goal into 3–7 sub-tasks.

### Planner System Prompt (tree-search mode default)

```
You are a research planner. Given a research goal and a conversation tree to analyze,
decompose the goal into 3–7 focused sub-tasks. Each sub-task should target a specific
aspect of the goal that can be investigated by searching and reading the conversation tree.

The conversation tree may have multiple branches exploring different topics or approaches.
Design sub-tasks that cover the tree comprehensively — different sub-tasks should target
different branches or aspects of the conversation.

Output a JSON object:
{
  "reasoning": "Brief explanation of your decomposition strategy",
  "subTasks": [
    {
      "title": "Short title for this sub-task",
      "description": "Detailed description of what to investigate. Include specific
                       search terms, topics to look for, or branches to explore."
    }
  ]
}
```

### Planner System Prompt (web-search mode default)

```
You are a research planner. Given a research goal, decompose it into 3–7 focused
sub-tasks. Each sub-task should target a specific aspect of the goal that can be
investigated through web searches.

Design sub-tasks that are complementary — they should cover different facets of the
topic without excessive overlap. Consider: different angles, subtopics, comparisons,
recent developments, expert perspectives, and counterarguments.

Output a JSON object:
{
  "reasoning": "Brief explanation of your decomposition strategy",
  "subTasks": [
    {
      "title": "Short title for this sub-task",
      "description": "Detailed description of what to investigate. Include specific
                       search queries to try, what kind of sources to look for,
                       and what information to extract."
    }
  ]
}
```

### Plan Parsing

The planner must output structured JSON. Implement a parsing fallback chain:
1. Try `JSON.parse(response)` on the full response.
2. Try extracting JSON from a markdown code block (` ```json ... ``` `).
3. Try bracket-depth extraction (find outermost `{...}`).
4. If all fail, mark the run as `'error'` with a descriptive message.

Validate that `subTasks` is an array with 1–10 items, each having `title` and `description` strings. Clamp to `maxSubTasks` from config.

---

## Sub-Agent Execution

Each sub-task spawns a sub-agent that runs with tools until it has gathered enough findings or hits limits.

### Sub-Agent System Prompt

```
You are a research sub-agent. Your task:

{subTask.description}

Use the available tools to investigate this topic. When you discover relevant
information, use the record_finding tool to save it with a source citation.

Guidelines:
- Be thorough but focused — investigate your specific sub-task, not tangential topics.
- Record findings as you go — don't wait until the end.
- Include direct quotes or specific data when possible.
- Rate each finding's relevance to your sub-task (high/medium/low).
- When you've gathered enough information or exhausted available sources, stop.
```

### Execution Loop

```
1. Send sub-task description + tools to sub-agent model
2. Sub-agent makes tool calls (search, read, record_finding, etc.)
3. Each tool call creates a ResearchProcessNode on the run
4. Tool results are returned to the sub-agent for next turn
5. Loop until:
   a. Sub-agent produces a final text response (no more tool calls)
   b. maxToolCallsPerSubAgent reached
   c. maxTotalToolCalls reached (global across all sub-agents)
   d. Abort signal received
6. Move to next sub-task
```

Sub-agents run **sequentially** (one at a time) to manage rate limits and keep the process observable. Parallel sub-agent execution is deferred to a future enhancement.

---

## Synthesis Agent

After all sub-agents complete (or the run is cancelled with partial results), the synthesizer assembles findings into a markdown report.

### Synthesizer System Prompt

```
You are a research synthesizer. Given a set of findings from multiple research
sub-agents, assemble them into a coherent, well-organized markdown document.

Research goal: {config.goal}

Guidelines:
- Organize by topic, not by sub-agent.
- Include source citations inline using [N] notation, with a references section at the end.
- For tree-search: cite node IDs. For web-search: cite URLs.
- Highlight key findings, patterns, and conclusions.
- Note any gaps — topics where findings were limited or absent.
- If there are contradictions between sources, note them explicitly.
- Write in a clear, professional tone.

{previousReportSection}
```

For incremental synthesis, the `previousReportSection` is:

```
IMPORTANT: A previous version of this report exists. You are updating it with new
findings. Preserve the structure and content of the previous report where it remains
accurate, and integrate the new findings. Here is the previous report:

---
{previousReport}
---

New findings since the last report are marked with [NEW] in the findings list.
```

### Citation Format

**Tree-search citations**:
```markdown
The model discussed three approaches to error handling [1].

## References
[1] Node abc123 (assistant, depth 5)
[2] Node def456 (assistant, depth 3)
```

**Web-search citations**:
```markdown
React Server Components enable streaming HTML [1].

## References
[1] https://react.dev/blog/2023/03/22/react-labs
[2] https://nextjs.org/docs/app/building-your-application/rendering
```

---

## Entry Points

### 1. Chat Input Toggle (web-search mode)

In the chat input area, alongside the existing web search toggle:

```
[🌐 Search] [🔬 Research]  [Send]
```

- **Research toggle**: when enabled, the next message triggers a web-search research run instead of a normal conversation turn.
- The user's message becomes the research goal.
- A `ResearchRun` is created with `mode: 'web-search'`, the trigger node is the user's message node.
- The toggle auto-disables after sending (one-shot, like web search).

**Visibility**: the research toggle is hidden in the browser-only build (web-search requires backend). Tree-search mode is always available via the context menu.

### 2. Right-Click Node (tree-search mode)

Right-click any node in the tree → "Research this subtree" in the context menu (Branch Operations group).

- Opens the Research Config Modal (see below) with `mode: 'tree-search'` pre-selected.
- The clicked node becomes the trigger node and the root of the subtree to search.
- Works on any node in any conversation.

---

## Research Config Modal

Opened before starting a research run. Pre-populated based on entry point.

```
+----------------------------------------------+
| Research                                [X]  |
+----------------------------------------------+
|                                              |
| Mode:                                        |
|   (*) Tree Search    ( ) Web Search          |
|                                              |
| Goal:                                        |
| +------------------------------------------+ |
| | Analyze the conversation branches to     | |
| | identify key findings about...           | |
| +------------------------------------------+ |
|                                              |
| Prompt: (planner/synthesizer instructions)   |
| +------------------------------------------+ |
| | You are a research planner. Given a...   | |
| | [mode-specific default shown]            | |
| +------------------------------------------+ |
| [Reset to default]                           |
|                                              |
| Models:                                      |
|   Planner/Synthesizer: [claude-sonnet ▾]     |
|   Sub-agents:          [claude-haiku  ▾]     |
|                                              |
| Limits:                                      |
|   Max sub-tasks:              [ 7 ]          |
|   Max tool calls per agent:   [20 ]          |
|   Max total tool calls:       [100]          |
|                                              |
|                      [Cancel] [Start]        |
+----------------------------------------------+
```

**Mode switching**: changing the mode updates the default prompt to the mode-specific default. If the user has edited the prompt, show a confirmation before replacing.

**Pre-population by entry point**:
- Chat input toggle: mode = web-search, goal = user's message
- Right-click node: mode = tree-search, goal = empty (user fills in)
---

## Research View (4th View Mode)

A new view mode `'research'` is added alongside `'tree'` and `'thread'`:

```typescript
viewMode: 'tree' | 'thread' | 'research';
```

The research button is conditionally styled:
- **No runs in conversation**: dimmed (still clickable — shows placeholder)
- **Run in progress**: accent color with subtle pulse animation
- **Completed runs exist**: normal appearance

### Research View Layout

```
+----------------------------------------------+
| Research Runs                                |
+----------------------------------------------+
|                                              |
| +--- Run List (left panel) ----------------+|
| |                                           ||
| | [*] Analyze conversation findings         ||
| |     tree-search | complete | 2 min ago    ||
| |                                           ||
| | [ ] Web research on React patterns        ||
| |     web-search | researching (3/5) | now   ||
| |                                           ||
| +-------------------------------------------+|
|                                              |
| +--- Selected Run (right panel) -----------+|
| |                                           ||
| |  [Report] [Process] [Config]              ||
| |                                           ||
| |  (content of selected tab)                ||
| |                                           ||
| +-------------------------------------------+|
|                                              |
| Actions: [Download] [Add to Project] [Delete]|
+----------------------------------------------+
```

### Report Tab (default)

Renders the `ResearchRun.report` as formatted markdown. Supports:
- Standard markdown rendering (headers, lists, code blocks, etc.)
- Clickable citation references:
  - Tree-search: `[1]` links navigate to the referenced node in tree view
  - Web-search: `[1]` links open the URL in a new tab
- "Copy as markdown" button

### Process Tab

Read-only tree visualization of the research process:

```
              [Planner]
             /    |     \
    [Sub-task 1] [Sub-task 2] [Sub-task 3]
    /    |   \      |    \        |
  [search] [read] [finding] [search] [finding]  [search]
    |        |                 |                    |
 [finding] [finding]        [finding]           [finding]
```

Each node shows:
- **Planner**: plan reasoning + sub-task list
- **Sub-task**: title, status, finding count
- **Tool call**: tool name, input summary, output preview
- **Finding**: content + citation + relevance

This can be implemented as a simple nested list/accordion (not React Flow — it's a much simpler structure than the main conversation tree).

### Config Tab

Read-only display of the run's configuration: goal, prompt, models, limits, mode.

### Run Actions

- **Download**: exports the report as a `.md` file
- **Add to Project**: if the conversation belongs to a project, adds the report as a project knowledge file (Feature 13 integration)
- **Delete**: deletes the research run (confirmation required)
- **Cancel** (while running): aborts the current run, saves partial results

---

## Visual Indicators

### Green Research Icon on Trigger Nodes

Nodes with `researchRunId` set display a green research icon (beaker or flask from lucide-react) as a side nodule, similar to the green tool use nodule for web search.

- **Clickable**: navigates to the research view, selecting the linked run
- **Tooltip**: "Research run: {run status}" (e.g., "Research run: complete")

### Progress Indicator

While a research run is in progress, the trigger node's research icon shows a subtle animation (pulse or spinner). The research view's run card shows detailed progress:

```
Status: Researching (3/5 sub-tasks complete)
  Sub-task 1: Analyze error handling branches  ✓ (4 findings)
  Sub-task 2: Compare performance approaches   ✓ (3 findings)
  Sub-task 3: Identify security patterns       ● Running...
  Sub-task 4: Review testing strategies        ○ Pending
  Sub-task 5: Summarize architecture decisions ○ Pending
```

---

## Incremental Synthesis

When a research run is triggered with `incrementalInterval` set, it operates in incremental mode:

1. **First run**: normal plan-then-execute → full report.
2. **Subsequent runs** (every N new nodes): the previous report is passed to the synthesizer as context. The synthesizer rewrites the full document, integrating new findings while preserving existing structure.

The incremental run creates a new `ResearchRun` record each time (not updating the old one). This preserves history — the user can see how the report evolved over time.

---

## Settings — Research Tab

Global defaults that apply to new research runs unless overridden in the config modal:

```
Research Settings

  Default Prompts:
    Tree-Search Planner:
    +--------------------------------------------+
    | You are a research planner. Given a...     |
    +--------------------------------------------+
    [Reset to default]

    Web-Search Planner:
    +--------------------------------------------+
    | You are a research planner. Given a...     |
    +--------------------------------------------+
    [Reset to default]

  Default Models:
    Planner/Synthesizer: [claude-sonnet-4-20250514 ▾]
    Sub-agents:          [claude-haiku-4-5-20251001 ▾]

  Default Limits:
    Max sub-tasks:              [ 7 ]
    Max tool calls per agent:   [20 ]
    Max total tool calls:       [100]

  Incremental Synthesis:
    Auto-research interval:     [10 ] nodes
```

---

## Implementation

### File Structure

```
src/
  agents/
    research/
      researchRunner.ts       # Main orchestration: plan → execute → synthesize
      planner.ts              # Planner agent: goal → sub-tasks
      subAgent.ts             # Sub-agent execution loop with tools
      synthesizer.ts          # Synthesizer: findings → markdown report
      tools/
        treeSearch.ts         # Tree-search tool implementations
        webSearch.ts          # Web-search tool implementations
        shared.ts             # record_finding implementation
  store/
    useResearchStore.ts       # Research run CRUD, persistence, active run state
  components/
    research/
      ResearchView.tsx        # 4th view mode: run list + selected run
      ResearchRunCard.tsx     # Run summary in list
      ResearchReport.tsx      # Markdown report renderer with citations
      ResearchProcess.tsx     # Process tree viewer
      ResearchConfigModal.tsx # Config modal for starting a run
```

### Abort Architecture

```typescript
interface ResearchRunControl {
  runAbort: AbortController;           // cancels the entire run
  currentAbort: AbortController;       // cancels the current sub-agent API call
}
```

- **Cancel button**: triggers `runAbort.abort()`. The current API call is cancelled via `currentAbort` (chained). Partial results (completed sub-tasks + findings) are saved. Status → `'cancelled'`.
- Each sub-agent API call creates a new `currentAbort` controller.

### State Persistence

After each sub-agent completes:
1. Update `ResearchRun.processNodes` with new entries
2. Update the sub-task's `status` and `findingsCount` in the plan
3. Persist to Dexie

This enables:
- Live progress display in the research view
- Recovery after page reload (orphaned runs in `'planning'` or `'researching'` status)

### Page Reload Recovery

- **Detection**: on app load, scan `researchRuns` table for runs with status `'planning'` or `'researching'`.
- **Recovery**: transition orphaned runs to `'error'` with message "Run interrupted by page reload. Partial results may be available."
- Partial results (completed sub-tasks + findings) remain viewable.
- User can start a new run from the same trigger node.

---

## Error Handling

### Partial Results

If a sub-agent fails (API error, rate limit, provider down):
1. Mark the sub-task as `'error'`.
2. Log the error as a `ResearchProcessNode` of type `'error'`.
3. Continue to the next sub-task.
4. At synthesis time, synthesize from available findings only. Note missing sub-tasks in the report.

If the planner fails:
1. Mark the run as `'error'`.
2. No sub-agents are dispatched.
3. User can retry from the config modal.

If the synthesizer fails:
1. Mark the run as `'error'`.
2. Findings are still viewable in the Process tab.
3. User can manually copy findings.

### Retry

No automatic retry — failures are logged and the run continues (for sub-agents) or stops (for planner/synthesizer). The user can start a new run.

### Cancel

Cancel is supported at any point:
- During planning: aborts the planner API call, run → `'cancelled'`.
- During sub-agent execution: aborts the current sub-agent, saves completed work, run → `'cancelled'`.
- During synthesis: aborts the synthesizer, findings are viewable but no report, run → `'cancelled'`.

---

## Interaction with Other Features

- **05 Web Search**: web-search mode reuses the backend search endpoints. The `web_search` tool calls the same DuckDuckGo/Tavily/Bing routes.
- **07 Inference Providers**: planner and sub-agents can use any configured provider. Model selectors in the config modal list all available models across providers.
- **13 Project Knowledge**: "Add to Project" action in the research view adds the report as a project file (text, not PDF).
- **22 Pricing**: token usage from research runs should be tracked. Each API call (planner, sub-agents, synthesizer) records token usage on the run.

---

## Visual Channels Update

Add to the visual channels table in `_overview.md`:

| Visual Property | Reserved For | Feature/Fix |
|----------------|-------------|-------------|
| **Node side nodule (green, beaker icon)** | Research run trigger indicator | Feature 06 |

---

## Browser-Only Mode

- **Web-search mode**: hidden in browser-only build (requires backend for search routes).
- **Tree-search mode**: fully functional in browser-only build (reads local IndexedDB data only).
- **Research view**: always available (may show only tree-search runs in browser-only mode).

---

## Edge Cases

- **Empty tree**: tree-search on a node with no descendants — planner receives minimal context. The sub-agents' `search_nodes` and `get_tree_overview` will return near-empty results. The synthesizer produces a report noting insufficient data. This is allowed — not blocked at the UI level.
- **Large trees (1000+ nodes)**: `search_nodes` returns paginated results (max 10 per call). `get_conversation_path` returns full paths but with optional summarization. `get_tree_overview` returns aggregate stats without loading all content. Sub-agent tool call limits prevent runaway exploration.
- **Concurrent runs**: multiple research runs can exist on the same conversation (different trigger nodes). Only one run executes at a time — starting a new run while one is in progress shows a confirmation: "A research run is already in progress. Start a new one? (The existing run will continue in the background.)" Both runs are independent and appear in the research view list.
- **Page reload during run**: orphaned runs are detected and marked as `'error'` with partial results preserved. See Page Reload Recovery.
- **Provider becomes unavailable mid-run**: treated as a sub-agent failure — sub-task marked as `'error'`, run continues with remaining sub-tasks. If the planner's provider fails, the entire run fails.
- **Very large report**: no hard limit on report size. The markdown renderer handles large documents. Download exports the full text.
- **Run on root node**: allowed — tree-search scans the entire conversation tree. May be slow for large trees but tool call limits bound the work.
- **Trigger node deleted after run**: the run persists in the research view (data is on `ResearchRun`, not the node). The green icon is gone since the node is gone, but the run is accessible from the research view.
- **Mixed mode (tree + web)**: not supported in v1. Tracked in TODO.md as a future enhancement.
- **External dependency unavailable (backend down)**: web-search mode's tools fail. Sub-agents record errors. The run completes with whatever findings were possible (likely none). Tree-search is unaffected (local data).
- **Second invocation on same node**: allowed — creates a new `ResearchRun`. The trigger node's `researchRunId` is updated to point to the latest run. Previous runs remain in the research view list.

---

## Implementation Status

### Phase A — Core Pipeline + Tree-Search (complete)

Commit `3c305ae` — "Add research agent core pipeline and tree-search mode (Feature 06 Phase A)"

**New files (12)**:

| File | Purpose |
|------|---------|
| `src/types/research.ts` | All research types |
| `src/store/useResearchStore.ts` | Zustand store with Dexie persistence |
| `src/agents/research/planner.ts` | Planner: goal → sub-tasks, JSON parsing fallback chain |
| `src/agents/research/subAgent.ts` | Sub-agent execution loop with tool calling + limits |
| `src/agents/research/synthesizer.ts` | Findings → markdown report with citations |
| `src/agents/research/researchRunner.ts` | Pipeline orchestration: plan → research → synthesize |
| `src/agents/research/tools/treeSearch.ts` | 5 tree-search tools |
| `src/agents/research/tools/shared.ts` | `record_finding` tool (shared across modes) |
| `src/components/research/ResearchConfigModal.tsx` | Config modal: mode, goal, prompt, models, limits |
| `src/components/research/ResearchView.tsx` | 4th view mode: run list + report/config tabs |
| `src/components/research/ResearchRunCard.tsx` | Run summary card with status badges |
| `src/components/research/ResearchReport.tsx` | Markdown renderer with clickable tree-search citations |

**Modified files (7)**:

| File | Change |
|------|--------|
| `src/types/index.ts` | `researchRunId` on `TreeNode`, research fields on `AppSettings`, re-export |
| `src/db/database.ts` | V7 migration adding `researchRuns` table |
| `src/store/useTreeStore.ts` | `viewMode` union includes `'research'` |
| `src/hooks/useContextMenu.ts` | "Research this subtree" menu item |
| `src/components/tree/ContextMenu.tsx` | FlaskConical icon mapping |
| `src/components/tree/TreeView.tsx` | `start-research` action dispatches custom event |
| `src/components/pages/ConversationView.tsx` | 4th view toggle, research modal, run loading on init |

**Verification** (automated review using `/review` skill against `Bugs/00-cross-cutting-bug-patterns.md`):

| Check | Severity | Result |
|-------|----------|--------|
| Zustand selector instability | Critical | Pass — all selectors use individual field accessors |
| Orphan AbortController | High | Pass — controllers stored in `activeControls` Map |
| Unvalidated numeric parsing | Medium | Pass — all `parseInt()` guarded with `Number.isNaN()` |
| Naive LLM output matching | Medium | Pass — planner uses bracket-depth JSON extraction |
| Hardcoded hex colors | Medium | Pass — all components use `var(--color-*)` |
| Dead code signals | Low | Pass — `tsc --noEmit` clean, no TODO/HACK/FIXME |

### Phase B — Web-Search + Backend

Not started.

### Phase C — Polish

Not started.
