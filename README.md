# Baobab

A tree-based conversation UI for LLMs. Branch from any response to explore multiple threads of thought, with full linear context preserved from root to leaf.

Built as a standalone web app that calls LLM APIs directly from the browser — no backend required for core functionality. Conversations render as an interactive node-and-edge graph.

## Features

### Core Conversation
- **Tree-structured conversations** — branch from any assistant response to start independent threads, each maintaining linear context from root to that branch
- **Multi-provider support** — Anthropic, OpenAI, Azure Foundry, Google Gemini, OpenRouter, Hugging Face, and Ollama (local models), with per-provider API key management and model discovery
- **Streaming responses** — real-time token streaming with visual indicators
- **Interactive graph** — zoom, pan, collapse/expand subtrees, minimap navigation
- **Thread view** — toggle between tree graph and linear chat view with branch indicators
- **Model & system prompt cascades** — override model or system prompt at any node; children inherit unless overridden
- **Reasoning block management** — view, copy, paste, and inject thinking/reasoning blocks across nodes and conversations; supports Anthropic extended thinking (with signatures) and OpenAI/Azure encrypted reasoning (with faithful roundtrip)
- **Reasoning injection** — paste encrypted reasoning blocks onto nodes to steer model responses; inject-at-end positioning for OpenAI Responses API steering tests
- **Reasoning effort control** — configurable low/medium/high effort for OpenAI/Azure reasoning models

### Tree Operations
- **Branching** — click any assistant node and "Reply here" to fork the conversation
- **Resend & duplicate** — resend a prompt to get a new response, or duplicate-and-edit any node
- **Merge branches** — combine two or more branches into a synthesis node
- **Summarize branches** — condense a branch into a summary node
- **Manual tree editing** — create arbitrary user/assistant nodes, duplicate tool calls and thinking blocks
- **Star & dead-end markers** — flag important nodes or mark dead-end branches; dead-end status propagates to branch points

### Research
- **Research agent** — plan-and-execute research across conversation trees or the web, with sub-task decomposition, tool-calling sub-agents, and synthesized reports

### Organization
- **Projects** — group conversations, attach knowledge files (PDF, text, code), inject project context into prompts via @mention or agentic retrieval
- **Conversation management** — inline rename, LLM-generated titles, assign-to-project dropdown
- **Tags** — tag conversations for filtering and organization
- **Search** — full-text search across all conversations with real-time filtering

### Tools & Analysis
- **Web search** — DuckDuckGo, Tavily, and Bing search integrated as tool calls
- **Pricing transparency** — per-message cost tracking with live pricing data, cost breakdowns, and custom pricing overrides
- **Raw API capture** — inspect actual request/response payloads for debugging
- **Export** — download conversations as JSON

### Design
- **Dark mode** — warm-toned dark theme with CSS variable theming
- **Persistent storage** — conversations, settings, and sessions stored in IndexedDB via Dexie.js

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- At least one LLM provider API key (Anthropic, OpenAI, etc.) — or a local Ollama instance

No Node.js installation required on the host — everything runs inside Docker.

## Quick Start

```bash
git clone <repo-url> && cd baobab
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173), go to **Settings > Providers**, add your API key, and start chatting.

## Development

All commands run via Docker — nothing touches the host `node_modules`.

```bash
# Start dev server with hot reload
docker compose up

# Type-check
docker compose run --rm app npx tsc --noEmit

# Rebuild after dependency changes (edit package.json on host, then:)
docker compose build --no-cache
docker compose up -V
```

### Production Build

```bash
docker build --target production -t baobab .
docker run -p 8080:80 baobab
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Routing | react-router-dom 7 |
| Graph | @xyflow/react v12 (React Flow) + dagre |
| State | Zustand v5 |
| Persistence | Dexie.js v4 (IndexedDB) |
| Styling | Tailwind CSS v4 |
| LLM Providers | Anthropic, OpenAI, Azure Foundry, Gemini, OpenRouter, HuggingFace, Ollama |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Icons | lucide-react |

## Project Structure

```
baobab/
  Dockerfile                 # Multi-stage: dev / build / production
  docker-compose.yml         # Dev environment with hot reload
  Features/                  # Feature specifications (numbered)
  Decisions/                 # Architecture Decision Records (ADRs)
  Tests/                     # Test plans and results
  src/
    types/
      index.ts               # TreeNode, Conversation, Project, AppSettings,
                             #   CoverageScore, ThinkingBlock
      research.ts            # ResearchRun, ResearchPlan, ResearchSubTask
    db/database.ts           # Dexie IndexedDB schema
    store/
      useTreeStore.ts        # Tree CRUD, node selection, reply target, streaming
      useSettingsStore.ts    # API keys, models, theme, provider configs
      useProjectStore.ts     # Projects and knowledge files
      useResearchStore.ts    # Research run state
    api/
      providers/             # LLMProvider interface + per-provider implementations
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
        researchRunner.ts    # Research orchestration
        planner.ts           # LLM-based plan generation
        subAgent.ts          # Per-subtask research agent
        synthesizer.ts       # Findings synthesis into report
    lib/
      tree.ts                # Path-to-root, React Flow graph, dagre layout
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
      useContextMenu.ts        # Right-click context menu
    components/
      layout/                # MainLayout, Sidebar
      pages/                 # LandingPage, ConversationView, SettingsPage,
                             #   ProjectDetailPage
      tree/                  # TreeView, MessageNode, NodeDetailPanel,
                             #   ContextMenu, MergeDialog, SummarizeDialog
      thread/                # ThreadView, ThreadMessage, BranchIndicator
      chat/                  # ChatInput, FileMentionDropdown
      research/              # ResearchConfigModal, ResearchView,
                             #   ResearchReport
      project/               # ProjectDialog, ProjectFileList
      settings/              # ManageModelsDialog
      shared/                # ModelSelector, TagInput, ProjectAssignDropdown,
                             #   ReasoningBlocksSection
```

## How It Works

**Context building**: when you send a message from node X, the app walks from X to the root via `parentId` links. The message builder (`lib/messageBuilder.ts`) converts this path into API messages, handling thinking block injection (native or plaintext fallback), tool call history expansion (grouped by round), and per-provider format requirements. Each branch maintains its own independent context path.

**Data model**: nodes are stored in a flat map (`Record<string, TreeNode>`) for O(1) lookups. Each node has a `parentId` (for walking to root) and `childIds` (for rendering children). Nodes carry metadata for model/provider/system-prompt cascades, token usage, tool calls, thinking blocks (`ThinkingBlock[]`), and feature flags.

**Thinking blocks**: each assistant node can have multiple `ThinkingBlock` entries supporting different providers. Anthropic blocks carry cryptographic signatures for round-trip verification. OpenAI/Azure blocks carry encrypted content and API item IDs for faithful re-injection via the Responses API. Blocks can be copied between nodes and conversations, toggled active/inactive, and positioned for injection steering.

**Persistence**: every Zustand mutation writes through to IndexedDB via Dexie. The database has 6 tables: conversations, nodes, settings, projects, projectFiles, and researchRuns.

**Provider abstraction**: all LLM providers implement a common `LLMProvider` interface with `validateKey`, `fetchModels`, and `sendMessage`. The provider registry dispatches API calls to the correct implementation based on provider ID. Each provider declares capabilities (`supportsStreaming`, `supportsThinking`, `supportsToolUse`).

**Dual API strategy (OpenAI/Azure)**: reasoning models (o1-, o3-, o4- series) use the Responses API (`openai-responses-api.ts`) which supports encrypted reasoning content round-tripping. Non-reasoning models use the Chat Completions API (`openai-chat-completions.ts`). Azure Foundry resolves per-deployment configuration and delegates to the appropriate API based on each model entry's `isReasoningModel` flag.

## License

MIT
