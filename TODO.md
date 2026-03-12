# TODO

Deferred items from feature discussions and reviews.

## Feature 28 — Manual Tree Editing

- [ ] **Duplicate entire branch**: duplicate a node and all its descendants as a subtree. Requires recursive tree cloning with new IDs and re-parenting.
- [ ] **Manual role selection**: allow overriding auto-alternation to create consecutive same-role messages. Auto-alternation covers >95% of use cases.
- [ ] **Per-conversation knowledge mode override**: optional per-conversation override that takes precedence over the project-level default.

## Feature 13b — Project Knowledge Review

- [ ] **Styled @mention pills**: render `@filename` references as styled pills in the textarea. Requires textarea overlay architecture.
- [ ] **Large file warning**: pre-send confirmation dialog when total injected text exceeds ~200K chars. Estimate from `sizeBytes` metadata in `handleSend`.

## Unified Research Agent (Features 06 + 14d)

- [ ] **Mixed mode (tree+web)**: Allow both tree-search and web-search tools simultaneously in a single research run. E.g., "research everything we discussed about economics, and supplement with current web data." Currently modes are exclusive; mixed mode would let the prompt/goal guide which tools the agent uses.
