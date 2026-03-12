---
name: review
description: Scan recently changed files for known anti-patterns and common bugs.
---

# Review

Scan source files for known anti-patterns documented in `Bugs/00-cross-cutting-bug-patterns.md`. Produces a report with file:line references for each finding.

## Arguments

```
/review [scope]
```

- `[scope]` (optional): one of:
  - A file path or glob (e.g., `src/agents/scorer.ts`, `src/components/**/*.tsx`)
  - `staged` — only files in the git staging area
  - `branch` — all files changed on the current branch vs main
  - If omitted, defaults to `staged`. If nothing is staged, falls back to `branch`.

## Process

1. **Determine target files.** Based on the scope argument:
   - `staged`: run `git diff --cached --name-only --diff-filter=ACMR` to get staged files
   - `branch`: run `git diff --name-only main...HEAD --diff-filter=ACMR` to get branch-changed files
   - glob/path: expand the pattern
   - Filter to only `.ts` and `.tsx` files (skip `.md`, `.json`, config files)

2. **Run anti-pattern checks.** For each target file, use Grep and Read to check for the following patterns. Track findings as `{ file, line, check, severity, message }`.

### Check 1: Zustand selector instability (Critical)

Search for these patterns in target files:

- **Inline fallback arrays**: `|| []` or `?? []` inside a `useTreeStore`, `useSettingsStore`, `useProjectStore`, or any `use*Store` call. These create new array references every render.
  - Pattern: `use\w*Store\(` on the same line or within 2 lines of `\|\| \[\]` or `\?\? \[\]`
  - Exception: `?? EMPTY` or `?? EMPTY_` variants are fine (module-level constants)

- **Full-state destructure**: `use*Store()` called with no arguments, or with an empty arrow function that returns the full state.
  - Pattern: `use\w*Store\(\)` with no selector argument

- **Computed objects in selectors**: `use*Store((s) => ({ ... }))` — creates a new object reference each call.
  - Pattern: `use\w*Store\(\(.*\)\s*=>\s*\({` (arrow returning object literal)

### Check 2: Orphan AbortController (High)

- Pattern: `new AbortController\(\)\.signal` — creates a controller and immediately discards the reference, making the request uncancellable.

### Check 3: Unvalidated numeric parsing (Medium)

- Pattern: `parseFloat\(` or `parseInt\(` without a nearby `isNaN` or `Number.isNaN` check (within 3 lines).
- Ignore test files.

### Check 4: Naive LLM output matching (Medium)

Only check files in `src/agents/` and `src/components/elicitation/`:

- **Substring matching**: `.includes(` used to match LLM-generated content against a target term or pattern. Look for variables named `term`, `query`, `keyword` etc. on the same line.
- **Non-greedy bracket regex**: `\[[\s\S]*?\]` or `\[.*?\]` used to extract JSON from LLM output.

### Check 5: UI-only validation (Medium)

Search for capability checks (e.g., `supportsToolUse`, `supportsStreaming`, `supportsVision`) that appear ONLY in `src/components/` files but not in the corresponding agent/API files that use the capability. This is a heuristic — flag it for manual review rather than as a definite bug.

### Check 6: Dead code signals (Low)

- Run `docker compose run --rm app npx tsc --noEmit` and capture any errors.
- Search for `// TODO`, `// HACK`, `// FIXME` in target files — not bugs, but flag for awareness.

3. **Generate report.** Output a structured report:

```markdown
## Review Report

**Scope**: [description of what was scanned]
**Files scanned**: N
**Findings**: N (X critical, Y high, Z medium, W low)

### Critical

| # | Check | File:Line | Detail |
|---|-------|-----------|--------|
| 1 | Zustand selector | src/foo.tsx:42 | `|| []` fallback in useTreeStore selector |

### High
...

### Medium
...

### Low
...

### Clean
Files with no findings: [list]
```

4. **If no findings**, output:

```
Review complete. No anti-patterns found in N files.
```

## Notes

- This skill does NOT auto-fix anything. It reports findings for the developer to review.
- False positives are expected, especially for Check 4 and Check 5. Flag them as "review manually" rather than definite bugs.
- The checks are based on patterns documented in `Bugs/00-cross-cutting-bug-patterns.md`. Update both this skill and that document when new patterns are identified.
- Remember: all commands must run inside Docker (`docker compose run --rm app <command>`).
