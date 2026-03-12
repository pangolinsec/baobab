# CLAUDE.md

Instructions for Claude Code sessions in this repository.

## Build & Dev Environment

**Never run node, npx, or npm on the host.** All commands must run inside Docker containers.

```bash
# Dev server (hot reload on port 5173)
docker compose up

# Run a one-off command
docker compose run --rm app <command>

# Type-check
docker compose run --rm app npx tsc --noEmit
```

### Adding dependencies

1. Edit `package.json` on the host directly (don't `npm install` inside a container).
2. Rebuild the image: `docker compose build --no-cache`
3. Recreate containers with fresh node_modules volume: `docker compose up -V`

The anonymous `/app/node_modules` volume is separate per ephemeral container — `docker compose run --rm` won't persist installs.

## Project Overview

Baobab is a tree-based conversation UI for LLMs. Users branch from any assistant response to explore multiple threads, with full linear context preserved from root to leaf. Supports multiple LLM providers (Anthropic, OpenAI, Azure Foundry, Gemini, OpenRouter, HuggingFace, Ollama). See `README.md` for the full description and feature list.

**Key technologies**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Zustand v5, Dexie.js v4 (IndexedDB), @xyflow/react v12 (React Flow), dagre, react-router-dom 7, lucide-react.

## Architecture

```
src/
  types/
    index.ts               # TreeNode, Conversation, Project, AppSettings,
                           #   CoverageScore, ThinkingBlock
    research.ts            # ResearchRun, ResearchPlan, ResearchSubTask
  db/database.ts           # Dexie IndexedDB schema (v11, 7 tables)
  store/
    useTreeStore.ts        # Tree CRUD, node selection, reply target, streaming
    useSettingsStore.ts    # API keys, models, theme, provider configs
    useProjectStore.ts     # Projects and knowledge files
    useResearchStore.ts    # Research run state
  api/
    providers/             # LLMProvider interface + 7 provider implementations
      registry.ts          #   Provider registry and model dispatch
      types.ts             #   ProviderSendParams, ToolDefinition, shared types
      anthropic.ts         #   Anthropic (Claude)
      openai.ts            #   OpenAI (GPT, o-series)
      openai-chat-completions.ts  # Shared Chat Completions streaming (OpenAI + Azure)
      openai-responses-api.ts     # Responses API for reasoning models (o-series)
      azure.ts             #   Azure Foundry (per-deployment config)
      gemini.ts            #   Google Gemini
      openrouter.ts        #   OpenRouter
      huggingface.ts       #   HuggingFace Inference
      ollama.ts            #   Ollama (local)
      callProvider.ts      #   Shared provider call wrapper
    tools.ts               # Tool definitions and executors (web_search, read_file)
    search.ts              # Web search dispatch (DuckDuckGo, Tavily, Bing)
  agents/
    scorer.ts              # Coverage scoring against target terms
    research/
      researchRunner.ts    # Research orchestration pipeline
      planner.ts           # LLM-based research plan generation
      subAgent.ts          # Per-subtask tool-calling agent
      synthesizer.ts       # Combines findings into final report
  lib/
    tree.ts                # Path-to-root, React Flow graph builder, dagre layout
    messageBuilder.ts      # Build API messages from node path (thinking blocks, tool calls)
    pricing.ts             # Cost calculations, live pricing fetch
    generateTitle.ts       # LLM-based conversation title generation
    merge.ts               # Branch merge logic
    summarize.ts           # Branch summarization
    search.ts              # Full-text search over nodes
    fileReferences.ts      # @file mention parsing
  hooks/
    useStreamingResponse.ts  # Send flow: user node -> stream -> finalize
    useTreeLayout.ts         # Memoized dagre layout
    useContextMenu.ts        # Right-click context menu logic
  components/
    layout/                # MainLayout, Sidebar, SidebarConvItem
    pages/                 # LandingPage, ConversationView, SettingsPage,
                           #   ProjectDetailPage
    tree/                  # TreeView, MessageNode, NodeDetailPanel,
                           #   ContextMenu, MergeDialog, SummarizeDialog,
                           #   DuplicateEditModal, ManualNodeModal
    thread/                # ThreadView, ThreadMessage, BranchIndicator
    chat/                  # ChatInput, FileMentionDropdown
    research/              # ResearchConfigModal, ResearchView, ResearchReport
    project/               # ProjectDialog, ProjectFileList, FileUploadButton
    settings/              # ManageModelsDialog
    shared/                # ModelSelector, TagInput, ProjectAssignDropdown,
                           #   ReasoningBlocksSection
```

### Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `LandingPage` | Empty state / new conversation CTA |
| `/c/:conversationId` | `ConversationView` | Tree + thread views, chat input, panels |
| `/settings/:section?` | `SettingsPage` | Settings sections (general, providers, prompts, etc.) |
| `/project/:projectId` | `ProjectDetailPage` | Project files, conversations, knowledge mode |

### Data flow

- **Nodes** are stored in a flat map (`Record<string, TreeNode>`) for O(1) lookups. Each node has `parentId` (walk to root) and `childIds` (render children).
- **Context building**: when sending a message from node X, the app walks X to root via `parentId` links. The message builder (`lib/messageBuilder.ts`) converts this path into API messages, injecting thinking blocks (native or plaintext fallback) and expanding tool call history (grouped by round with `tool_invocations`/`tool_results` message types).
- **Provider dispatch**: all LLM calls go through the provider registry (`api/providers/registry.ts`). Each provider implements `LLMProvider` with `validateKey`, `fetchModels`, and `sendMessage`. Providers declare capabilities (`supportsStreaming`, `supportsThinking`, `supportsToolUse`).
- **Dual API strategy**: OpenAI/Azure reasoning models (o1-, o3-, o4- series) use the Responses API (`openai-responses-api.ts`) with encrypted reasoning round-tripping. Non-reasoning models use Chat Completions (`openai-chat-completions.ts`). Azure resolves per-deployment config and delegates based on `isReasoningModel`.
- **Thinking blocks**: `ThinkingBlock[]` on assistant nodes supports multiple providers. Anthropic blocks have signatures; OpenAI/Azure blocks have `encryptedContent`, `apiItemId`, and `apiSummary` for faithful re-injection. Blocks can be copied/pasted across nodes, toggled active/inactive, and positioned with `injectAtEnd` for steering (scoped to last assistant message only).
- **Cascades**: model, provider, and system prompt can be overridden at any node. Children inherit unless they have their own override. Resolution walks up the tree.
- **Persistence**: every Zustand mutation writes through to IndexedDB via Dexie (6 tables: conversations, nodes, settings, projects, projectFiles, researchRuns). Loading a conversation fetches all its nodes from Dexie into the store.
- **Selection vs Reply Target**: clicking a node selects it (shows detail panel) but does NOT change the reply target. Only the "Reply here" button or sending a message changes the reply target.

### Agent architecture

The `agents/` directory contains autonomous agent loops that run in the browser:

- **Research** (`research/`): plan-and-execute pipeline. The planner generates sub-tasks from a goal, sub-agents execute each task using tree-search or web-search tools, and the synthesizer combines findings into a report node.

The research agent is fully client-side — no backend required. It dispatches LLM calls through the same provider registry as manual chat.

## Conventions

### CSS & Theming

**Never hardcode hex color values in components.** Use `var(--color-*)` CSS variable references instead.

```tsx
// Good
className="bg-[var(--color-bg)] text-[var(--color-text)]"

// Bad
className="bg-[#FAF9F6] dark:bg-[#1C1917] text-[#3D3229] dark:text-[#E0D5CB]"
```

CSS variables are defined in `src/index.css` with `:root` (light) and `.dark` (dark) variants. One class auto-switches with theme — no need for `dark:` prefixes in most cases.

Exceptions where `dark:` prefix is acceptable:
- Cases where light and dark values don't map to a single variable (rare, ~5 places in SettingsDialog)
- `text-white` on accent backgrounds (not theme-dependent)
- Semantic colors (red/emerald for validation) that aren't part of the theme palette

### Components

- Tailwind v4 for styling — utility classes, no CSS modules
- Icons from `lucide-react`
- MiniMap `nodeColor` is a JS prop (not CSS) — requires `useSettingsStore` theme check, not `var()`

### Known Pitfalls

These patterns have caused recurring bugs across multiple features. See `Bugs/00-cross-cutting-bug-patterns.md` for full analysis.

**Zustand selectors — never return a new reference:**
```tsx
// BAD — creates new [] every render, causes infinite re-render loop
const files = useProjectStore((s) => s.filesByProject[id] || []);
const { nodes, selectedId } = useTreeStore();  // full-state destructure

// GOOD — stable references
const EMPTY: ProjectFile[] = [];  // module-level constant
const files = useProjectStore((s) => s.filesByProject[id] ?? EMPTY);
const nodes = useTreeStore((s) => s.nodes);  // individual field selector
```

**Numeric inputs — validate at system boundaries:**
```tsx
// BAD — parseFloat("") returns NaN, propagates silently
const cost = parseFloat(input) * rate;

// GOOD
const parsed = parseFloat(input);
const cost = Number.isNaN(parsed) ? 0 : parsed * rate;
```

**AbortController — always store for later cancellation:**
```tsx
// BAD — controller is immediately garbage-collected, request is uncancellable
fetch(url, { signal: new AbortController().signal });

// GOOD
const abortRef = useRef(new AbortController());
fetch(url, { signal: abortRef.current.signal });
// In cleanup: abortRef.current.abort();
```

**LLM output parsing — no naive regex or `.includes()`:**
- Extract JSON from LLM responses with bracket-depth parsing, not regex
- Match terms with word-boundary regex (`\b`), not substring `.includes()`
- Require confidence thresholds for classification

**Backend validation — don't rely on UI-only checks:**
- If a feature requires a capability (e.g., `provider.supportsToolUse`), validate when the feature runs, not just in the dialog that configures it. Sessions can be resumed after provider config changes.

### Commits

Commit messages should summarize what changed and why. The "why" matters most — the diff shows the code, but not the reasoning.

## Feature Specs & Decisions

- `Features/` — Feature specifications, organized by number. `_overview.md` has the full list and tier priorities.
- `Decisions/` — Architecture Decision Records (ADRs). Referenced by feature specs.
- `Features/_ui-fixes.md` — Smaller UI/UX fixes that don't warrant a full feature spec.

Read relevant specs before implementing a feature. They contain data model changes, UI mockups, edge cases, and cross-references to other features.

When writing or updating a feature spec, include an `## Edge Cases` section using the checklist in `Features/_overview.md` § "Feature Spec Edge Cases Checklist".

## Testing

Browser-based tests are executed by Claude Code using Chrome MCP tools against the dev server at `localhost:5173`.

- Test plans live in `Tests/` with descriptive names (e.g., `phase0-visual-and-interaction.md`)
- Results go in the same directory with `_results` appended (e.g., `phase0-visual-and-interaction_results.md`)
- Results include: PASS/FAIL/SKIPPED status, actions taken, observations, and detailed issue info for failures
- Summary table at the top of results files

## TODO

- [ ] Add contributor guidelines (code style, PR process, onboarding) — deferred to later
- [ ] GitHub Action to auto-update `src/data/pricing.json` from provider APIs
- [ ] Persist sidebar grouping choice (`groupBy`) in `useSettingsStore` so it survives page reloads

See `TODO.md` for feature-specific deferred items (per-feature backlog).
