---
title: Decisions
nav_order: 6
---

# Architecture Decision Records

Key design decisions and their rationale are documented as Architecture Decision Records (ADRs) in the `Decisions/` directory.

## ADR Index

| ADR | Title | Summary |
|:----|:------|:--------|
| 001 | Spec Reconciliation | Node types as discriminated union, flat boolean flags, tool calls on nodes (not separate tree nodes), cascade resolution pattern, system prompt assembly pipeline |
| 002 | Spec Review Findings | Initial cross-spec review observations and conflict identification |
| 003 | Tier 1 Implementation Plan | Implementation ordering and approach for core UX features |
| 004 | Pre-Tier 2 Issue Resolution | Bug fixes and cleanup required before Tier 2 work |
| 005 | Spec Review Refinements | Multi-select architecture, cascade traceability, error response format, feature gating, file upload limits |
| 006 | Tier 2 Implementation Plan | Implementation ordering for power features |
| 007 | Multi-Provider Refinements | Provider interface design decisions, streaming abstraction, model resolution |
| 008 | Provider Bugfix Analysis | Root cause analysis and fixes for provider streaming and compatibility issues |
| 009 | Auto-Sync Selection & Reply Target | When and how to synchronize node selection with reply target |
| 010 | Split Tree & Overlay Edges | Separating tree structure edges from overlay edges (merge links, dead-end dimming) to prevent dagre layout interference |
| 011 | Merge Prompt Meta-Style | Prompt engineering decisions for merge synthesis quality |
| 013 | Pricing Data Strategy | Live pricing from OpenRouter API, exact-first matching with confidence, static JSON fallback |
| 014 | DuckDuckGo Search Strategy | Replace duck-duck-scrape with DDG lite backend for reliable search |
| 015 | Pricing UI Redundancy | Won't-fix decision on duplicate pricing display across settings tabs |
| 016 | Settings Page Content Width | Widen settings page from max-w-lg to max-w-3xl for better form layouts |
| 017 | Zustand Selector Discipline | Mandatory individual selectors to prevent infinite re-render loops |
| 018 | Bug Prevention Measures | CLAUDE.md pitfalls, /review skill, spec edge-case checklist |
| 019 | New Feature Specifications | Decisions for Features 29–32: batch execution, project UX, conversation management |
| 020 | OpenAI Responses API Migration | Strategy for migrating OpenAI reasoning models (O1, O3) from Chat Completions to the Responses API for thinking block support |
| 022 | Tool Call History Reconstruction | Approach for reconstructing tool call/result pairs in context assembly from the manual tool loop, ensuring correct message sequencing |
| 023 | Azure Foundry Dual API Strategy | Per-deployment model configuration with `isReasoningModel` flag routing to Responses API vs Chat Completions; `azure::uuid` model identifiers |

## Reading ADRs

Each ADR follows a consistent format:

- **Context**: what problem needed solving
- **Decision**: what was decided
- **Consequences**: trade-offs and implications
- **Status**: accepted, superseded, or deprecated

ADRs are referenced by feature specifications when a design decision affects feature implementation.
