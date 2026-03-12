---
title: Project Structure
parent: Development
nav_order: 2
---

# Project Structure

## Top-level layout

```
baobab/
├── src/                    # Frontend React application
├── server/                 # Optional backend (Fastify + SQLite)
├── Features/               # Feature specifications
├── Decisions/              # Architecture Decision Records
├── Tests/                  # Test plans and results
├── Bugs/                   # Bug reports and analysis
├── docs/                   # This documentation site
├── Dockerfile              # Multi-stage frontend container
├── docker-compose.yml      # Development environment
├── package.json            # Frontend dependencies
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── index.html              # HTML entry point
├── CLAUDE.md               # Developer instructions
└── README.md               # Project README
```

## Source directory (`src/`)

### Types

```
src/types/
├── index.ts               # TreeNode, Conversation, Project, AppSettings,
│                          #   CoverageScore
└── research.ts            # ResearchRun, ResearchPlan, ResearchSubTask,
                           #   ResearchProcessNode
```

All TypeScript interfaces and type aliases for the application domain.

### Database

```
src/db/database.ts
```

Dexie.js database class with schema definitions and version migrations (6 tables). See [Data Model]({% link architecture/data-model.md %}).

### State stores

```
src/store/
├── useTreeStore.ts        # Tree CRUD, selection, streaming
├── useSettingsStore.ts    # Settings, providers, models
├── useProjectStore.ts     # Projects and knowledge files
├── useResearchStore.ts    # Research run state
├── useSearchStore.ts      # Search state
└── chatInputState.ts      # Chat input transient state
```

See [State Management]({% link architecture/state-management.md %}).

### API layer

```
src/api/
├── claude.ts              # Anthropic SDK wrapper (streaming, model fetch)
├── backend.ts             # Backend API client
├── search.ts              # Web search dispatch (DuckDuckGo, Tavily, Bing)
├── tools.ts               # Tool definitions for providers (web_search, read_file)
└── providers/             # Multi-provider abstraction
    ├── types.ts           # LLMProvider interface, ProviderConfig, ToolDefinition
    ├── registry.ts        # Provider registry
    ├── callProvider.ts    # Unified dispatch (dual API strategy)
    ├── anthropic.ts
    ├── openai.ts          # OpenAI provider (routes to completions or responses)
    ├── openai-chat-completions.ts  # Chat Completions API (non-reasoning)
    ├── openai-responses-api.ts     # Responses API (reasoning models)
    ├── azure.ts           # Azure Foundry (per-deployment config)
    ├── gemini.ts
    ├── openrouter.ts
    ├── ollama.ts
    ├── huggingface.ts
    └── sse.ts             # SSE streaming helpers
```

See [Provider System]({% link architecture/providers.md %}).

### Agents

```
src/agents/
├── scorer.ts              # Coverage scoring against target terms
└── research/
    ├── researchRunner.ts  # Research orchestration pipeline
    ├── planner.ts         # LLM-based plan generation
    ├── subAgent.ts        # Per-subtask tool-calling agent
    └── synthesizer.ts     # Combines findings into report
```

The research agent runs in the browser and dispatches LLM calls through the same provider registry as manual chat.

### Libraries

```
src/lib/
├── tree.ts                # Path traversal, cascade resolution, graph building
├── messageBuilder.ts      # Central message assembly for LLM API calls
├── models.ts              # Model utility functions
├── pricing.ts             # Cost calculation & live pricing fetch
├── search.ts              # Full-text search implementation
├── indicators.ts          # Visual indicator computation
├── summarize.ts           # Branch summarization helpers
├── merge.ts               # Branch merge helpers
├── generateTitle.ts       # LLM-based conversation title generation
├── fileReferences.ts      # @file mention parsing
├── fileStorage.ts         # File blob storage helpers
└── reconcileProjects.ts   # Project consistency checks
```

### Hooks

```
src/hooks/
├── useStreamingResponse.ts  # Complete message send flow
├── useTreeLayout.ts         # Memoized dagre layout
├── useContextMenu.ts        # Context menu state management
├── useResizablePanel.ts     # Drag-to-resize panel
└── useBackendStatus.ts      # Backend health check
```

### Components

```
src/components/
├── layout/                # App shell
│   ├── MainLayout.tsx     # Top-level layout with sidebar
│   ├── Sidebar.tsx        # Conversation list, grouping, project dropdown
│   └── SidebarConvItem.tsx # Per-conversation item (inline rename, actions)
├── pages/                 # Routed pages
│   ├── LandingPage.tsx
│   ├── ConversationView.tsx
│   ├── SettingsPage.tsx   # Multi-section settings
│   └── ProjectDetailPage.tsx # Project files, conversations, knowledge mode
├── tree/                  # Tree visualization
│   ├── TreeView.tsx       # React Flow wrapper
│   ├── MessageNode.tsx    # Custom node component
│   ├── NodeDetailPanel.tsx # Detail panel for selected node
│   ├── ContextMenu.tsx    # Right-click context menu
│   ├── MultiSelectPanel.tsx # Multi-node selection actions
│   ├── SummarizeDialog.tsx # Summarize branch dialog
│   ├── MergeDialog.tsx    # Merge branches dialog
│   ├── DuplicateEditModal.tsx # Edit node with tool calls & thinking
│   ├── ManualNodeModal.tsx # Create arbitrary nodes
│   ├── RawContextTab.tsx  # Raw API context viewer
│   └── WelcomeScreen.tsx  # Empty state
├── thread/                # Linear thread view
│   ├── ThreadView.tsx     # Chat-style message list
│   ├── ThreadMessage.tsx  # Individual message component
│   └── BranchIndicator.tsx # Branch point display
├── chat/
│   ├── ChatInput.tsx      # Message composition & send
│   └── FileMentionDropdown.tsx # @file autocomplete
├── research/              # Research agent UI
│   ├── ResearchConfigModal.tsx
│   ├── ResearchView.tsx
│   ├── ResearchRunCard.tsx
│   └── ResearchReport.tsx
├── project/               # Project management
│   ├── ProjectDialog.tsx
│   ├── ProjectFileList.tsx
│   └── FileUploadButton.tsx
├── search/
│   ├── SearchResults.tsx
│   └── SearchFilters.tsx
├── settings/
│   └── ManageModelsDialog.tsx # Provider + model management
└── shared/
    ├── ModelSelector.tsx  # Model picker dropdown
    ├── TagInput.tsx       # Tag input with autocomplete
    ├── ProjectAssignDropdown.tsx # Project selector
    ├── MarkdownWithFilePills.tsx # Markdown with @file pills
    ├── ReasoningBlocksSection.tsx # Reasoning blocks display & management
    ├── ThinkingEditor.tsx # Thinking block editor
    ├── ToolCallEditor.tsx # Tool call editor
    └── ToolCallListEditor.tsx # Tool call list editor
```

### Static data

```
src/data/pricing.json      # Bundled model pricing table
```

### Styles

```
src/index.css              # CSS variables, global styles, React Flow overrides
```

## Feature specs (`Features/`)

Detailed specifications for each feature, organized by number. `_overview.md` has the full list with tiers and dependencies. Cross-cutting documents:

- `_overview.md` — master feature list and dependency graph
- `_dexie-migrations.md` — coordinated schema version plan
- `_ui-fixes.md` — behavioral specs for referenced UI fixes

## Architecture decisions (`Decisions/`)

ADRs documenting key design choices and their rationale. Numbered sequentially (001–019).
