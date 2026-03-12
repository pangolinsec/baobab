---
name: run-tests
description: Run browser-based visual/interaction tests via Chrome MCP against the dev server.
---

# Run Tests

Execute a browser-based test plan using Chrome MCP tools against the running dev server at `http://localhost:5173`.

## Arguments

```
/run-tests <test-plan-file>
```

- `<test-plan-file>` (required): path to the test plan markdown file, e.g. `Tests/phase0-visual-and-interaction.md`

## Prerequisites

1. Dev server is running (`docker compose up`) and accessible at `localhost:5173`
2. Chrome MCP tab group is initialized (`tabs_context_mcp`)
3. A valid API key is configured in the app's Settings (needed for tests that send messages)

## Execution

1. Read the test plan file provided as the argument.
2. Create a new Chrome MCP tab and navigate to `http://localhost:5173`.
3. Execute each test in order:
   - Follow the numbered steps exactly as written in the test plan.
   - Use screenshots, `find`, `read_page`, `javascript_tool`, and other Chrome MCP tools as needed.
   - For visual verifications, take screenshots and zoom into relevant areas.
   - For DOM verifications, use JavaScript execution or element inspection.
4. Record the result for each test: **PASS**, **FAIL**, or **SKIPPED**.
   - **PASS**: all verify conditions met.
   - **FAIL**: one or more verify conditions not met. Record exactly what was wrong.
   - **SKIPPED**: test could not be executed (missing prerequisite data, destructive test, etc.). Record the reason.

## Output

Write results to a file in `Tests/` with `_results` appended to the test plan filename.

Example: if the test plan is `Tests/phase1-features.md`, write results to `Tests/phase1-features_results.md`.

### Results format

Follow the format established in `Tests/phase0-visual-and-interaction_results.md`:

- **Header**: execution date, environment, starting state.
- **Summary table**: section name, total/pass/fail/skipped counts.
- **Per-test sections**: test ID, result, actions taken, observations. For FAIL/ERROR include detailed issue description.

## Important

- Do NOT modify application code during testing.
- If a test requires specific data (e.g. a conversation with certain nodes), set it up as part of the test rather than assuming it exists.
- Use the Save button to close the Settings dialog (the X button may not respond reliably).
- Click the Send button explicitly rather than pressing Enter to send messages.
