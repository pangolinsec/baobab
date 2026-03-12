# ADR-006: Tier 2 Implementation Plan

**Status**: Accepted
**Date**: 2026-02-19

## Context

All Tier 1 features are implemented (02 Routing, 04 Thinking, 08-P1 Advanced API, 09 System Prompt Cascade, 10 Resend/Duplicate/Retry, 23 Visual Indicators). The codebase has Dexie V2 with forward-compatible fields (`starred`, `deadEnd`, `nodeType`, `userModified`), cascade resolution via `resolveCascade<T>()`, and a context menu system. The user chose to include Feature 00 (Backend) in Tier 2 to fully enable Feature 07 (Providers).

## Decision

### Batch Ordering

Six sequential batches with two independent tracks (frontend features 2-4, backend 5-6):

| Batch | Features | Rationale |
|-------|----------|-----------|
| 1 | 11 (Stars) + 12 (Dead-Ends) + 24 (Tags) | Lightest features, shared Dexie V3 migration, overlapping files |
| 2 | 15 (Summarize Branches) | Creates summary node styling before thread view needs it |
| 3 | 21 (Thread View) | Benefits from stars, dead-ends, and summary styling |
| 4 | 20 (Search) | Depends on tree + thread views for result highlighting |
| 5 | 00 (Backend) | Infrastructure for providers, independent of batches 2-4 |
| 6 | 07 (Providers) + Dexie V4 | Largest change, restructures API layer, comes last |

### Dexie V4 Deferral

The pre-assigned migration plan mapped V4 to Features 07+15 jointly. We defer V4 to Batch 6 only because Feature 15 doesn't need the `nodeType` index — it uses the field but never queries via `where()`. V4 ships with Feature 07 and pre-adds the `projects` table for Tier 3.

| Version | Batch | Changes |
|---------|-------|---------|
| V3 | Batch 1 | `starred` index on nodes; `*tags` multi-entry index on conversations; upgrade sets `tags: []` |
| V4 | Batch 6 | `nodeType` index on nodes; `projectId` index on conversations; `projects` table |

### Dependency Graph

```
Batch 1: 11+12+24 (V3)
    ├── Batch 2: 15 (summary styling)
    │       └── Batch 3: 21 (thread view)
    │               └── Batch 4: 20 (search)
    └── Batch 5: 00 (backend)
            └── Batch 6: 07 (providers, V4)
```

Batches 2-4 and Batch 5 are independent tracks.

## Consequences

- Features are implemented in dependency order, preventing rework
- V3 migration is isolated to Batch 1, keeping the schema change small
- Thread view (Batch 3) gets stars, dead-ends, and summary styling "for free"
- Backend (Batch 5) can be built in parallel with frontend features
- Provider refactor (Batch 6) is last, so all API-calling code can be updated at once
