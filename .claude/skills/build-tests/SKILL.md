---
name: build-tests
description: Create a browser-based test plan for recently implemented features.
---

# Build Tests

Create a test plan document that can be executed by a separate Claude Code instance using the `/run-tests` skill with Chrome MCP browser automation.

## Arguments

```
/build-tests <phase-or-feature-name>
```

- `<phase-or-feature-name>` (required): a short identifier used in the filename, e.g. `phase1-search` or `fix-collapse-bug`.

## Process

1. Identify what was changed. Check recent commits, the current git diff, or ask the user what features/fixes need testing.
2. Read the relevant source files to understand the new or changed behavior.
3. Read `Tests/phase0-visual-and-interaction.md` as the **reference format** — match its structure exactly.
4. Write the test plan to `Tests/<phase-or-feature-name>.md`.

## Test plan format

Follow the structure in `Tests/phase0-visual-and-interaction.md`:

- **Header**: title, one-line description of what's being tested, prerequisites.
- **Prerequisites section**: what must be true before running (dev server up, API key set, specific data present).
- **Test sections**: grouped by feature or fix, each with a section header.
- **Individual tests**: numbered ID (e.g. `T1-1`, `T1-2`), descriptive title, then:
  - Numbered steps describing exact actions to take (click, type, navigate, etc.)
  - `**Verify**:` lines stating what to check after the actions.

### Writing guidelines

The test plan must be **self-contained**. A tester running these in a separate Claude Code instance will have:
- Access to Chrome MCP tools and the dev server at `localhost:5173`
- No additional context about the implementation

So each test must include:
- Exact UI elements to interact with (button labels, locations, selectors if needed).
- Exact expected outcomes (what text appears, what visual state changes, what DOM state to verify).
- Setup steps if the test requires specific data (e.g. "create a new conversation and send a message to generate nodes").
- Whether the test is **destructive** (modifies/deletes data that other tests depend on) — mark these clearly and place them last.

## Output

After writing the test plan, print the following so the user can copy it into their testing instance:

```
Test plan written to Tests/<phase-or-feature-name>.md

To run these tests in your testing agent:
/run-tests Tests/<phase-or-feature-name>.md
```
