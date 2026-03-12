---
title: Usage Guide
nav_order: 3
---

# Usage Guide

This guide walks through every implemented feature in Baobab, from basic conversations to autonomous research agents. Everything described here is functional today.

---

## 1. Conversations and branching

### Starting a conversation

Click **New Chat** in the sidebar, type a message, and press **Enter**. The response streams in real-time — you can press **Escape** or click the stop button to abort mid-stream (partial content is saved).

### The tree

Every conversation is a tree, not a linear thread. Each message is a node with edges connecting parent to child. You can:

- **Pan**: click and drag empty space
- **Zoom**: scroll wheel
- **Fit to view**: button in the toolbar
- **Minimap**: bird's-eye view in the corner for orientation

### Branching

To explore a different direction from any point:

1. Click an assistant node in the tree
2. Click **Reply here** in the detail panel (or right-click > Reply here)
3. Type a new message — this creates a new branch while the original branch stays intact

Each branch maintains full linear context from root to leaf. The LLM sees the entire path as a single conversation.

### Selection vs reply target

These are deliberately separate:

- **Selecting** a node (single click) shows its content in the detail panel — orange ring
- **Reply target** is the node your next message will be attached to — green ring

Clicking a node does *not* change the reply target. Use "Reply here" or send a message to change it. The chat input shows a warning when the selected node differs from the reply target.

### Thread view

Toggle between **Tree** and **Thread** view using the toolbar. Thread view shows the current branch as a linear chat with:

- Full markdown rendering and syntax highlighting
- Branch indicators at fork points showing other branches (click to switch)
- Expandable reasoning/thinking blocks
- Same chat input — messages go to the current reply target

---

## 2. Providers and models

### Supported providers

| Provider | Setup | Notes |
|:---------|:------|:------|
| **Anthropic** | API key | Claude models, full thinking support |
| **OpenAI** | API key | GPT-4, o1/o3/o4 reasoning models |
| **Azure Foundry** | Per-deployment endpoint + key | See below |
| **Google Gemini** | API key | Google generative models |
| **OpenRouter** | API key | 100+ models from various providers |
| **Ollama** | Local install, no key | Local inference |
| **Hugging Face** | API key | HF Inference API |

### Adding a provider

1. Open **Settings** (gear icon at bottom of sidebar)
2. Go to the **Providers** tab
3. Expand a provider, paste your API key, and click **Test Connection**
4. Once validated, available models are fetched automatically
5. Click **Manage Models** to choose which models appear in selectors

### Azure Foundry setup

Azure uses per-deployment configuration instead of a single API key:

1. In **Settings > Providers**, expand Azure Foundry
2. Click **Manage Models**
3. Click **Add Model** and fill in:
   - **Deployment name** (shown in model selectors)
   - **Base URL** (your Azure endpoint)
   - **API key** (deployment-specific)
   - **Is reasoning model** toggle (routes o-series to the Responses API)
4. Test the connection — models appear with `azure::` prefix

### Default provider and model

Set your default provider and model in **Settings > Providers** at the top of the section. These apply to all new conversations unless overridden.

---

## 3. Model and system prompt cascades

### Model cascade

Override the model at any node — all descendants inherit the override until another node overrides it again.

- **Right-click a node** > choose a model from the picker
- Or use the **model selector** in the chat input (with "Persist override" checkbox)
- A **model chip** appears on nodes where the model differs from the conversation default

Use this to compare models on different branches, or to switch to a cheaper model for simple follow-ups.

### System prompt cascade

Override the system prompt at three levels:

1. **Global default**: Settings > Prompts > Default System Prompt
2. **Per-conversation**: set when creating a conversation or in conversation settings
3. **Per-node**: right-click > set system prompt, or use the system prompt button in chat input

A **"system" chip** appears on nodes with a custom system prompt. Descendants inherit until overridden.

### Visual indicators

Nodes display chips and badges showing active overrides:

| Indicator | Meaning |
|:----------|:--------|
| Model chip | Model differs from conversation default |
| "system" badge | Custom system prompt |
| "Summary" badge | Generated summary node |
| "Merge" badge | Merge synthesis node |
| "(edited)" badge | Manually edited content |
| Orange ring | Selected node |
| Green ring | Reply target |
| Red border | Error response |
| Reduced opacity | Dead-end branch |
| Amber ring | Search match |

---

## 4. Editing and organizing

### Resend, retry, and duplicate

- **Resend**: right-click a user node > Resend — sends the same message again for a different response
- **Retry**: right-click an error node > Retry — retries the failed API call
- **Duplicate & Edit**: right-click an assistant node > Duplicate & Edit — copies the response into an editable node marked "(edited)"

### Manual tree editing

Right-click any node > **Add child node** to create an arbitrary user or assistant node with custom content. Useful for constructing synthetic conversation trees or injecting context.

### Stars and dead ends

- **Star**: click the star icon in the detail panel or context menu to bookmark important nodes. Toggle **Starred** in the sidebar tab bar to see all starred nodes across conversations.
- **Dead end**: right-click > Flag as dead end to dim unproductive branches. The visual effect (reduced opacity) propagates — a node is effectively dead if all its descendant paths lead to dead ends.

### Tags

Add tags to any conversation for organization:

1. Open a conversation
2. In the conversation header, type a tag name and press Enter
3. Tags appear as pills — click X to remove
4. Existing tags autocomplete as you type

### Search

Use the **search bar** at the top of the sidebar for cross-conversation search:

- Case-insensitive substring matching
- Filter by role (user/assistant/both) and starred status
- Matching nodes get an **amber highlight ring** in the tree
- Click a result to jump to that conversation and select the node

### Conversation management

- **Rename**: double-click the title in the sidebar, or right-click > Rename
- **Auto-generated titles**: enable in Settings > General — generates a 5-8 word title after the first response
- **Project assignment**: use the dropdown in the conversation header to assign/remove from a project
- **Export**: download any conversation as JSON from the context menu
- **Delete**: right-click > Delete in the sidebar

---

## 5. Tree operations

### Merge branches

Combine insights from two branches:

1. **Ctrl+Click** (Cmd+Click on Mac) two nodes in different branches to multi-select
2. Click **Merge** in the toolbar or context menu
3. Choose **merge mode**:
   - **Summarize**: condense both branches first (shorter, fewer tokens)
   - **Full Context**: include complete branch content (detailed)
4. Optionally edit the merge prompt and choose a model
5. The result is a merge node (dashed border) with a synthesized response

Dashed blue-gray overlay edges connect the merge node back to its source branches.

### Summarize branches

Right-click a node with descendants > **Summarize branch**:

1. Choose a model and optionally edit the summarization prompt
2. A summary node is created with a blue-gray border and "Summary" badge
3. The summary covers all descendant content from the selected node

Default prompts for both merge and summarize are configurable in **Settings > Prompts**.

---

## 6. Web search and tools

### Enabling web search

1. Configure a search provider in **Settings > Search**:
   - **DuckDuckGo**: works out of the box, no API key
   - **Tavily**: higher quality, requires API key
   - **Bing**: requires API key
2. Toggle the **search icon** in the chat input to enable for the current conversation
3. Choose the search provider from the dropdown next to the toggle

When enabled, the model receives a `web_search` tool and can invoke it mid-response. Search results appear in the detail panel with source URLs.

**Note**: web search requires a provider that supports tool use (Anthropic, OpenAI, Azure).

### Raw API capture

Enable **Capture Raw API Data** in Settings > Advanced to inspect the actual request and response payloads for any message. The raw data appears in the detail panel's Raw tab — useful for debugging provider issues.

---

## 7. Pricing and cost tracking

Every assistant response shows token counts (input/output) and estimated cost in the detail panel.

Pricing is resolved in priority order:

1. **Custom overrides** in Settings > Pricing (add per-model pricing)
2. **Live pricing** from the OpenRouter API (100+ models, auto-synced)
3. **Bundled pricing** from the static pricing file

In **Settings > Pricing** you can:

- View the full pricing table grouped by provider
- Add custom price overrides for any model pattern
- Refresh or clear the live pricing cache

---

## 8. Projects and knowledge

### Creating a project

1. Click **New Project** in the sidebar (when grouped by Projects) or from the project page
2. Give it a name, description, and optionally a project-level system prompt

### Attaching files

On the project detail page (`/project/:id`):

1. Click **Upload** to add files (PDF, text, code)
2. Files are stored locally in IndexedDB with extracted text
3. Choose a **knowledge mode**:
   - **Off**: files stored but not injected into prompts
   - **Direct**: type `@filename` in the chat input — a dropdown autocompletes matching files, and the file content is injected into the message
   - **Agentic**: the model receives a `read_file` tool and can retrieve file content on demand

### Organizing conversations

- Assign conversations to projects via the dropdown in the conversation header
- When the sidebar is grouped by **Projects**, conversations appear under their project
- Drag and drop conversations between projects
- Click a project name in the sidebar to open its detail page

---

## 9. Reasoning blocks

### Viewing reasoning

When a model produces reasoning (Anthropic extended thinking, OpenAI/Azure o-series reasoning), it appears as expandable blocks in the detail panel under **Reasoning Blocks**. Each block shows:

- Character count or "Encrypted" label (OpenAI reasoning is opaque)
- Provider badge (Anthropic / OpenAI)
- "original" or "injected" label

Click the chevron to expand and read the reasoning content (when available — encrypted blocks show placeholder text).

### Copying and pasting

1. Click the **copy button** on any reasoning block
2. Navigate to a different node (same or different conversation)
3. Click **Paste Reasoning Block** at the bottom of the reasoning section

Pasted blocks are labeled "injected" and can be removed without affecting the original.

### Inject at end (OpenAI/Azure steering)

Encrypted reasoning blocks from OpenAI/Azure have an **inject at end** toggle (arrow-down icon):

- **On** (default for pasted blocks): the reasoning block is appended after the last user message in the API request, placing it in the position where the model treats it as its own prior reasoning. This steers the model's next response.
- **Off**: the block sits in its normal chronological position, where OpenAI's server silently filters it (no effect on the response).

Injection is automatically scoped to one turn — it only applies when the node with the block is the last assistant message in the path. Once the model responds and the conversation continues, the injection stops.

### Block controls

Each reasoning block has these toggle buttons:

| Control | Icon | Purpose |
|:--------|:-----|:--------|
| Active | Toggle switch | Include/exclude from API calls |
| Inject at end | Arrow down | Reposition for steering (encrypted only) |
| Plaintext | Toggle switch | Send as plaintext instead of native format |
| Copy | Clipboard | Copy to reasoning clipboard |
| Remove | Trash | Delete the block (confirmation for originals) |

### Reasoning effort

For OpenAI/Azure reasoning models, configure effort level in **Settings > Advanced**:

- **Low**: faster, less thorough reasoning
- **Medium**: balanced (default)
- **High**: slower, more thorough reasoning

---

## 10. Advanced API configuration

In **Settings > Advanced**:

| Setting | Range | Notes |
|:--------|:------|:------|
| Temperature | 0.0 - 1.0 | Lower = more deterministic |
| Max output tokens | 256 - 128,000 | Upper bound on response length |
| Top P | 0 - 1 | Nucleus sampling (optional) |
| Top K | integer | Token limit for sampling (optional) |
| Extended thinking | on/off | Anthropic only — model shows reasoning |
| Thinking budget | 1K - 100K tokens | Max tokens for thinking (when enabled) |
| Reasoning effort | low/medium/high | OpenAI/Azure reasoning models |
| Capture raw API data | on/off | Debug: inspect request/response payloads |

---

## 11. Research agent

The research agent decomposes a goal into sub-tasks, executes them with tool-calling agents, and synthesizes findings into a report.

### Starting a research run

1. Right-click any node > **Start Research**
2. Configure in the dialog:

| Field | Purpose |
|:------|:--------|
| **Goal** | What to research |
| **Mode** | Tree search (search conversation nodes) or Web search |
| **Planner model** | Model that creates the research plan |
| **Sub-agent model** | Model that executes sub-tasks |
| **Max sub-tasks** | 1-10 |
| **Calls per agent** | Max tool calls per sub-agent |
| **Total calls** | Overall tool call budget |

3. Click **Start** — the pipeline runs in the browser

### Pipeline phases

1. **Planning**: the planner model decomposes your goal into sub-tasks
2. **Execution**: sub-agents run each task using search tools (`search_nodes` for tree search, `web_search` for web search)
3. **Synthesis**: findings are combined into a report node attached to the tree

The status display shows current phase, sub-task progress, and the final report with structured findings, source references, and narrative summary.

Research runs persist across page reloads (stored in IndexedDB).

---

## 13. Dark mode and theming

Toggle between light and dark themes in **Settings > General**. The dark theme uses warm tones throughout the UI. All colors are CSS variable-based, so the entire interface switches consistently.

---

## 14. Keyboard shortcuts

| Key | Action |
|:----|:-------|
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Cancel streaming / close panels and dialogs |
| `Ctrl+Click` | Multi-select nodes (for merge) |
| `@` in chat input | Open file mention autocomplete |
| Arrow keys | Navigate autocomplete dropdowns |
| `Tab` or `Enter` | Select autocomplete suggestion |
