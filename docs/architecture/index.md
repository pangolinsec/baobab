---
title: Architecture
nav_order: 3
has_children: true
---

# Architecture Overview

Baobab is a client-side React application with an optional lightweight backend. All conversation data lives in the browser's IndexedDB — no server is required for the core experience.

## High-level architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  React UI  │←→│  Zustand  │←→│  Dexie (IndexedDB)│ │
│  │ Components │  │  Stores   │  │  Persistence      │ │
│  └─────┬─────┘  └────┬─────┘  └──────────────────┘ │
│        │              │                               │
│        │         ┌────┴──────┐                        │
│        │         │ Provider  │                        │
│        │         │ Registry  │                        │
│        │         └────┬──────┘                        │
└────────│──────────────│──────────────────────────────┘
         │              │
         │    ┌─────────┴────────────────┐
         │    │  LLM Provider APIs       │
         │    │  (Anthropic, OpenAI,     │
         │    │   Azure Foundry, Gemini, │
         │    │   OpenRouter, Ollama,    │
         │    │   HuggingFace)           │
         │    └──────────────────────────┘
         │
    ┌────┴──────────────────┐
    │  Optional Backend     │
    │  (Fastify + SQLite)   │
    │  - Health check       │
    │  - Planned: search,  │
    │    files, ML          │
    └───────────────────────┘
```

## Core principles

### Client-first

The browser is the source of truth for all data: conversations, nodes, settings, projects, and research runs. All implemented features — including web search, project knowledge, and research agents — run entirely client-side.

### Flat node map

Nodes are stored in a flat `Record<string, TreeNode>` for O(1) lookups. Tree structure is encoded via `parentId` (walk to root) and `childIds` (render children) — no nested objects, no recursion needed for basic operations.

### Cascade resolution

Per-node overrides (model, system prompt, provider) use a walk-to-root resolution pattern: start at the node, walk up to root, and the last override encountered wins. This gives inheritance semantics without storing resolved values.

### Write-through persistence

Every Zustand store mutation writes through to IndexedDB via Dexie. On app load, state is hydrated from IndexedDB. There's no separate sync queue or eventual consistency — writes are immediate.

## Source layout

```
src/
  types/
    index.ts               # TreeNode, Conversation, Project, AppSettings,
                           #   CoverageScore
    research.ts            # ResearchRun, ResearchPlan, ResearchSubTask
  db/database.ts           # Dexie IndexedDB schema (v11, 7 tables)
  store/
    useTreeStore.ts        # Tree CRUD, node selection, streaming
    useSettingsStore.ts    # API keys, models, theme, provider configs
    useProjectStore.ts     # Projects and knowledge files
    useResearchStore.ts    # Research run state
    useSearchStore.ts      # Search state & results
    chatInputState.ts      # Chat input transient state
  api/
    claude.ts              # Anthropic SDK wrapper (streaming, model fetch)
    backend.ts             # Backend API client
    search.ts              # Web search dispatch (DuckDuckGo, Tavily, Bing)
    tools.ts               # Tool definitions for providers (web_search, read_file)
    providers/             # Multi-provider abstraction
      types.ts             # LLMProvider interface, ProviderConfig, ToolDefinition
      registry.ts          # Provider registry
      callProvider.ts      # Unified dispatch (dual API strategy)
      anthropic.ts         # Anthropic provider
      openai.ts            # OpenAI provider (routes to completions or responses)
      openai-chat-completions.ts  # OpenAI Chat Completions API (non-reasoning)
      openai-responses-api.ts     # OpenAI Responses API (reasoning models)
      azure.ts             # Azure Foundry provider (per-deployment config)
      gemini.ts            # Google Gemini provider
      openrouter.ts        # OpenRouter aggregator
      ollama.ts            # Ollama local inference
      huggingface.ts       # Hugging Face Inference API
      sse.ts               # Server-Sent Events helpers
  agents/
    scorer.ts              # Coverage scoring
    research/
      researchRunner.ts    # Research orchestration pipeline
      planner.ts           # LLM-based plan generation
      subAgent.ts          # Per-subtask tool-calling agent
      synthesizer.ts       # Combines findings into report
  lib/
    tree.ts                # Path traversal, cascades, graph building
    messageBuilder.ts      # Central message assembly for LLM API calls
    models.ts              # Model utilities
    pricing.ts             # Cost calculation & live pricing fetch
    search.ts              # Full-text search
    indicators.ts          # Visual indicator computation
    summarize.ts           # Branch summarization
    merge.ts               # Branch merge operations
    generateTitle.ts       # LLM-based title generation
    fileReferences.ts      # @file mention parsing
  hooks/
    useStreamingResponse.ts  # Message send flow
    useTreeLayout.ts         # Memoized dagre layout
    useContextMenu.ts        # Context menu state
    useBackendStatus.ts      # Backend health check
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
    search/                # SearchResults, SearchFilters
    settings/              # ManageModelsDialog
    shared/                # ModelSelector, TagInput, ProjectAssignDropdown
  data/
    pricing.json           # Static model pricing table
  index.css                # CSS variables & global styles
  App.tsx                  # Root component with routing
  main.tsx                 # Entry point
```

## Dual API strategy (OpenAI / Azure)

OpenAI and Azure Foundry use two distinct API paths depending on the model:

- **Reasoning models** (o1-, o3-, o4- series) route through the **Responses API** (`openai-responses-api.ts`), which supports native reasoning output, encrypted thinking blocks, and reasoning effort control.
- **Non-reasoning models** (GPT-4, GPT-4o, etc.) route through the **Chat Completions API** (`openai-chat-completions.ts`).

Azure resolves which API to use per-deployment based on an `isReasoningModel` flag in its deployment configuration. The shared dispatch logic lives in `callProvider.ts`, and message assembly is centralized in `lib/messageBuilder.ts`.
