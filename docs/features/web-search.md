---
title: Web Search
parent: Features
nav_order: 17
---

# Web Search

Give the model access to real-time web search results during conversations via a tool-call mechanism.

## How it works

When web search is enabled for a conversation, the model can invoke a `web_search` tool during its response. The search is executed client-side (no backend required) through one of the supported providers, and results are injected back into the conversation as tool call results.

## Search providers

| Provider | API Key Required | Notes |
|:---------|:----------------|:------|
| DuckDuckGo | No | Default. Uses the DDG lite backend for reliable scraping. |
| Tavily | Yes | Higher quality results with AI-extracted snippets. |
| Bing | Yes | Microsoft Bing Web Search API. |

Configure API keys in **Settings > General** (Tavily/Bing API key fields). The default search provider can be set globally or per-conversation.

## Enabling search

1. Open a conversation
2. Toggle the search icon in the chat input area, or set `webSearchEnabled` on the conversation
3. Choose a search provider (defaults to the global setting)

When enabled, the model receives a `web_search` tool definition in its system prompt and can invoke it to search the web mid-response.

## Search results in the tree

Tool calls (including search) are stored on assistant nodes in the `toolCalls` array. The node detail panel and thread view display search results with the provider name (DuckDuckGo/Tavily/Bing) shown inline.

## Configuration

| Setting | Location | Default |
|:--------|:---------|:--------|
| Tavily API key | Settings > General | — |
| Bing API key | Settings > General | — |
| Default search provider | Settings > General | DuckDuckGo |
| Per-conversation toggle | Conversation header | Off |

See [Feature 05 spec](https://github.com/OWNER/baobab/blob/main/Features/05-web-search.md) for the full design.
