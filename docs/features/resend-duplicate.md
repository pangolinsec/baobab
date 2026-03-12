---
title: Resend & Duplicate
parent: Features
nav_order: 7
---

# Resend & Duplicate

Re-run messages and edit responses without losing the original.

## Resend

Right-click a **user node** and select **"Resend"** to send the same message again. This creates a new branch from the same parent with identical content, generating a fresh response. Useful for:

- Getting a different response to the same prompt
- Retrying after an error
- Comparing responses with different model settings

## Retry

Right-click an **error node** (assistant node with a failed response) and select **"Retry"** to attempt the API call again. This replaces the error node's content with the new response.

## Duplicate & Edit

Right-click an **assistant node** and select **"Duplicate & Edit"** to:

1. Create a copy of the assistant's response
2. Open it in an editor where you can modify the content
3. Save the edited version as a new node

The edited node is marked with `userModified: true` and displays an **(edited)** badge. This is useful for:

- Correcting factual errors in a response
- Adjusting the response before continuing the conversation
- Creating a "what if the model had said X" scenario
