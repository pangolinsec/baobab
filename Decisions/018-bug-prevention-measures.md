# ADR-018: Bug Prevention Measures

**Date**: 2026-02-21
**Status**: Accepted
**Context**: After completing Features 14a–14c and 22, code reviews produced 72 findings across 4 bugdocs. Analysis revealed 8 recurring bug patterns (documented in `Bugs/00-cross-cutting-bug-patterns.md`). This ADR captures the three measures adopted to prevent these patterns from recurring.

---

## Decision 1: Add "Known Pitfalls" Section to CLAUDE.md

**Problem**: The same categories of bugs (Zustand selector instability, orphan AbortControllers, unvalidated numeric parsing, naive LLM output matching) appeared independently in multiple features, implemented in separate sessions. Each session's Claude Code instance had no awareness of patterns established in prior reviews.

**Options considered**:

1. **CLAUDE.md rules**: Permanent, passive — loaded into every Claude Code session automatically.
2. **Separate conventions document**: More space, but requires explicit reading.

**Decision**: Option 1 — add rules directly to CLAUDE.md under `### Known Pitfalls`.

**Rationale**: CLAUDE.md is always loaded. A separate file requires the developer (or Claude Code) to remember to read it. The pitfalls section is concise enough (~40 lines with code examples) to fit without bloating CLAUDE.md. It covers the top 5 patterns: Zustand selectors, numeric validation, AbortController lifecycle, LLM output parsing, and backend validation.

**Impact**: `CLAUDE.md` updated with `### Known Pitfalls` section under Conventions.

---

## Decision 2: Create `/review` Skill for Anti-Pattern Detection

**Problem**: CLAUDE.md rules are passive — they tell Claude Code what not to do, but don't verify compliance after implementation. The same anti-patterns could still be introduced and only caught in manual post-implementation review.

**Options considered**:

1. **`/review` skill (standalone)**: Explicit invocation after implementing a feature, scans changed files with Grep-based checks.
2. **Integrated into `/build-tests`**: Piggyback on the existing test-plan workflow.
3. **Git hook**: Runs automatically on commit.

**Decision**: Option 1 — standalone `/review` skill.

**Rationale**: Keeps concerns separated (`/build-tests` writes test plans, `/review` scans for anti-patterns). A git hook would need to run inside Docker and would slow down every commit, including trivial ones. The `/review` skill is invoked manually after implementation — the developer controls when the overhead is worthwhile. It can also be scoped to specific files or the staging area.

**Impact**: `.claude/skills/review/SKILL.md` created. Six check categories: Zustand selector instability, orphan AbortControllers, unvalidated numeric parsing, naive LLM output matching, UI-only validation, and dead code signals (including `tsc --noEmit`).

---

## Decision 3: Add Edge Cases Checklist to Feature Spec Template

**Problem**: 12 of the 72 findings were "spec gap" bugs — edge cases (empty input, unavailable dependency, concurrent execution, second invocation) that weren't addressed in the feature spec and led to silent failures or crashes in the implementation.

**Options considered**:

1. **Checklist in `_overview.md`**: Lives with the existing spec conventions, referenced from CLAUDE.md.
2. **Template file**: A `.template.md` file to copy when creating new specs.

**Decision**: Option 1 — checklist table in `Features/_overview.md` § "Feature Spec Edge Cases Checklist", referenced from CLAUDE.md.

**Rationale**: A template file would need to be copied manually and diverge from the canonical format over time. A checklist in the overview is visible to any session that reads the overview (which CLAUDE.md already instructs). The six questions (empty input, dependency unavailable, concurrent execution, second invocation, large data, state persistence) cover the categories that produced the 12 spec-gap findings.

**Impact**: `Features/_overview.md` updated with new section. `CLAUDE.md` updated to reference the checklist when writing specs.

---

## Spec Files Updated

| Spec File | Changes Applied |
|-----------|----------------|
| `CLAUDE.md` | Added `### Known Pitfalls` section (5 anti-patterns with code examples); added spec edge-case reference |
| `Features/_overview.md` | Added `## Feature Spec Edge Cases Checklist` section (6-question table) |
| `.claude/skills/review/SKILL.md` | New file — `/review` skill definition with 6 check categories |
