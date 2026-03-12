---
title: Research Agent
parent: Features
nav_order: 21
---

# Research Agent

A plan-and-execute research pipeline that decomposes a goal into sub-tasks, executes them with tool-calling agents, and synthesizes findings into a report.

## Overview

The research agent follows a three-phase pipeline:

1. **Planning** — an LLM planner decomposes the research goal into concrete sub-tasks
2. **Execution** — sub-agents execute each task using tree-search or web-search tools
3. **Synthesis** — findings are combined into a structured report node

The entire system runs client-side in the browser.

## Research modes

| Mode | Tools Available | Use Case |
|:-----|:---------------|:---------|
| `tree-search` | Search across conversation nodes in the current tree | Analyze and summarize existing discussions |
| `web-search` | DuckDuckGo, Tavily, or Bing search | Gather new information from the web |

## Configuration

Launch a research run from the context menu on any node. The configuration modal includes:

- **Goal** — what to research
- **Mode** — tree-search or web-search
- **Planner model/provider** — which model generates the research plan
- **Sub-agent model/provider** — which model executes sub-tasks
- **Limits** — max sub-tasks, max tool calls per agent, max total tool calls

## Sub-agents

Each sub-task is assigned to an independent sub-agent that can make tool calls:

- **Tree search**: `search_nodes` tool queries the conversation tree by keyword, returning relevant node content
- **Web search**: `web_search` tool queries the configured search provider

Sub-agents report findings back to the orchestrator as structured results.

## Synthesis

After all sub-tasks complete, the synthesizer combines findings into a report node attached to the conversation tree. The report includes:

- Structured findings organized by sub-task
- Source references (node IDs for tree search, URLs for web search)
- A narrative summary tying the findings together

## Research run status

The research view shows:

- Current phase (planning / researching / synthesizing)
- Sub-task progress with individual status
- Process tree visualization
- Final report when complete

Research runs are persisted in IndexedDB (`researchRuns` table) and survive page reloads.

## Current status

Phase A (core pipeline + tree-search mode) is implemented. Web-search mode and mixed mode (tree+web simultaneously) are planned for future phases.

See [Feature 06 spec](https://github.com/OWNER/baobab/blob/main/Features/06-research-agent.md) for the full design.
