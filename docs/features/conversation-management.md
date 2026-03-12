---
title: Conversation Management
parent: Features
nav_order: 8
---

# Conversation Management

Quality-of-life improvements for managing conversations: inline rename, LLM-generated titles, and project assignment from the conversation view.

## Rename conversations

### Double-click inline edit

Double-click a conversation title in the sidebar to activate inline editing. The text becomes a focused input field with the current title pre-selected. Press **Enter** or click away to save; press **Escape** to cancel. Empty input reverts to the previous title.

### Context menu

Right-click a conversation in the sidebar and select "Rename" to activate the same inline edit mode.

### LLM-generated titles

When enabled in **Settings > General**, Baobab generates a short descriptive title after the first assistant response completes. The LLM sees both the user's question and the assistant's answer to produce a 5-8 word summary.

| Setting | Default | Description |
|:--------|:--------|:------------|
| Auto-generate titles | Off | Toggle LLM title generation |
| Title generation model | Same as chat | Which model generates titles |

LLM titles do not overwrite user-set titles. If title generation fails, the truncated-message fallback is used silently.

## Project assignment

A searchable dropdown in the conversation header lets you assign or change a conversation's project without leaving the conversation view. Select "No project" to remove the assignment.

See [Feature 32 spec](https://github.com/OWNER/baobab/blob/main/Features/32-conversation-management.md) for the full design.
