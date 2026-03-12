---
title: Project Knowledge
parent: Features
nav_order: 18
---

# Project Knowledge

Group conversations into projects and attach knowledge files that provide persistent context to the model.

## Projects

Projects are a top-level organizational unit. Each project has:

- **Name and description** — the description can optionally be injected into the system prompt
- **System prompt** — a project-level system prompt inherited by all conversations in the project
- **Knowledge mode** — controls how attached files are used (`off`, `direct`, `agentic`)
- **Conversations** — conversations assigned to the project

Create projects from the sidebar or the project detail page at `/project/:projectId`.

## Knowledge files

Upload files to a project to make their content available to the model during conversations. Supported file types include PDF, text, code, and other document formats. Files are stored locally in IndexedDB with extracted text.

### Injection modes

| Mode | Behavior |
|:-----|:---------|
| `off` | Files are stored but not injected into prompts |
| `direct` | Referenced files are injected verbatim into the system prompt via `@filename` mentions |
| `agentic` | The model receives a `read_file` tool and can retrieve file content on demand |

### @file mentions

In `direct` mode, type `@` in the chat input to see a dropdown of available project files. Selecting a file injects its content into the message context. File references render as styled pills in the conversation.

## Project detail page

Navigate to `/project/:projectId` to see:

- Project settings (name, description, system prompt, knowledge mode)
- File list with upload/delete
- Conversations assigned to this project

## Sidebar integration

The sidebar groups conversations by project when the "Projects" grouping mode is active. The project header is split: clicking the name navigates to the project detail page, clicking the chevron toggles collapse/expand. Conversations can be drag-and-dropped between projects.

See [Feature 13 spec](https://github.com/OWNER/baobab/blob/main/Features/13-project-knowledge.md) for the full design.
