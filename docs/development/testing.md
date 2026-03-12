---
title: Testing
parent: Development
nav_order: 5
---

# Testing

Baobab uses browser-based testing executed against the running dev server.

## Test infrastructure

Tests are executed via Chrome MCP tools against the dev server at `localhost:5173`. This enables testing real browser behavior including:

- Visual rendering verification
- User interaction simulation
- Component state transitions
- Theme switching
- Responsive layout

## Test plans

Test plans live in the `Tests/` directory with descriptive names:

```
Tests/
├── phase0-visual-and-interaction.md
├── phase0-visual-and-interaction_results.md
├── batch1-feature-tests.md
├── batch1-feature-tests_results.md
└── ...
```

## Test result format

Results files include:

- **Summary table** at the top with PASS/FAIL/SKIPPED counts
- **Per-test entries** with:
  - Status (PASS, FAIL, SKIPPED)
  - Actions taken
  - Observations
  - Detailed issue info for failures

## Running tests

Tests are run manually using the `/run-tests` skill, which launches Chrome and executes the test plan against the dev server.

```bash
# Ensure dev server is running
docker compose up

# Then run tests via the test runner
```

## Writing tests

When adding a new feature, create a test plan covering:

1. **Happy path**: the feature works as expected
2. **Edge cases**: boundary conditions, empty states
3. **Visual**: correct styling, theme compatibility
4. **Interactions**: keyboard, mouse, context menu
5. **Persistence**: data survives page reload
