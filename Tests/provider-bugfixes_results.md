# Provider Bugfixes — Test Results

**Date**: 2026-02-20
**Environment**: Docker Compose (app on 5173), Chrome MCP
**Providers available**: Anthropic (key configured), Ollama (localhost:11434, llama3.1:8b)
**Providers unavailable**: OpenAI, OpenRouter, HuggingFace, Google Gemini (no valid keys)

## Summary

| Test | Status | Notes |
|------|--------|-------|
| **Section 1 — SSE Parser Integration** | | |
| T1-1: Anthropic streaming regression | PASS | Haiku 4.5 streams coherent paragraph, 14 in / 120 out |
| T1-2: Streaming completes and node finalizes | PASS | All 20 numbers present, node finalized at 152 in / 43 out |
| T1-3: Cancel mid-stream | PASS | Ollama stream cancelled, partial response (1,513 tokens) preserved |
| **Section 2 — OpenAI Reasoning Models** | | |
| T2-1 to T2-4 | SKIPPED | No OpenAI API key available |
| **Section 3 — HuggingFace Model Discovery** | | |
| T3-1: HuggingFace provider can be added | PASS | Provider added with Enable toggle, API Key field, Test Connection |
| T3-1 (continued): Invalid key test | PASS (minor) | Shows "0 models available" in green instead of error — misleading UX |
| T3-2: Valid key shows models | SKIPPED | No HuggingFace API key |
| T3-3: Partial model availability | SKIPPED | No HuggingFace API key |
| **Section 4 — OpenRouter Model Limit** | | |
| T4-1 to T4-2 | SKIPPED | No OpenRouter API key |
| **Section 5 — Provider Routing Heuristics** | | |
| T5-1: Anthropic model routes correctly | PASS | Claude messages sent successfully via Anthropic |
| T5-2: Model selector shows correct optgroups | PASS | Anthropic (9 models) + Ollama (19 models), default first |
| T5-3: Ollama model with colon format | PASS | llama3.1:8b routed to Ollama, streamed correctly |
| T5-4: Switching between providers | PASS | Anthropic → Ollama switching works without errors |
| **Section 6 — Provider Settings UI** | | |
| T6-1: Adding providers | PASS | Google Gemini added with toggle OFF, API Key field shown |
| T6-2: Test Connection with no key | PASS | "Failed to fetch Gemini models" error, app stable |
| T6-3: Default provider selector | PASS | Only enabled providers appear; disabled ones removed |
| T6-4: Settings persist across reload | PASS | All provider configs survived page reload |
| **Section 7 — Cross-Provider Streaming** | | |
| T7-1: OpenAI streaming | SKIPPED | No OpenAI API key |
| T7-2: Ollama streaming smoke test | PASS | 5 animals listed, llama3.1:8b, "Free (local)" |
| T7-3: Multi-message cross-provider | PASS | Ollama then Anthropic in same conversation |
| T7-4: Branching with non-Anthropic | PASS | Branch created from Ollama assistant node, tree shows 2 children |
| **Section 8 — Error Handling** | | |
| T8-1: Invalid API key shows error | PASS | "Failed to fetch OpenAI models" in red, app stable |
| T8-2: Network error during streaming | SKIPPED | Requires DevTools offline toggle (not available via MCP) |

**Result: 16 PASS, 0 FAIL, 7 SKIPPED**

---

## Detailed Results

### Section 1 — SSE Parser Integration

**T1-1: Anthropic streaming regression**
- Selected Anthropic Haiku 4.5 as default
- Sent "Write a short paragraph about the weather"
- Text streamed incrementally as "A Beautiful Day" paragraph
- Response coherent, no missing words or garbled text
- Node finalized: 14 in / 120 out tokens

**T1-2: Streaming completes and node finalizes**
- Sent "Count from 1 to 20, each number on its own line"
- Response completed with all 20 numbers (1-20) visible in tree and detail panel
- Node finalized: 152 in / 43 out, no spinner remains

**T1-3: Cancel mid-stream**
- Switched to Ollama llama3.1:8b for slower streaming
- Sent long story request (2000+ words)
- Clicked red stop button during streaming after ~3 seconds
- Streaming stopped, partial response preserved (1,513 tokens, text ends mid-sentence)
- App responsive after cancel — send button returned, can navigate/send new messages

### Section 5 — Provider Routing Heuristics

**T5-1**: Already verified via T1-1/T1-2 — Anthropic models route correctly.

**T5-2**: JavaScript inspection of model dropdown:
- Anthropic optgroup: 9 models (Haiku 4.5, Haiku 3, Sonnet 4.6, etc.)
- Ollama optgroup: 19 models (llama3.1:8b, nomic-embed-text, Qwen2:7b, etc.)
- Default provider (Anthropic) listed first

**T5-3**: llama3.1:8b (colon format) routed to Ollama, response streamed successfully.

**T5-4**: Sent messages alternating between Anthropic and Ollama providers. Both worked without errors.

### Section 6 — Provider Settings UI

**T6-1**: Clicked "+ Google Gemini" → provider appeared with gray dot, Enable OFF, API Key field.

**T6-2**: Clicked "Test Connection" for Gemini with no API key → "Failed to fetch Gemini models" in red.

**T6-3**: Default Provider dropdown checked via JS:
- With 3 enabled providers: showed Anthropic, Ollama, Google Gemini
- After disabling Gemini: only showed Anthropic, Ollama

**T6-4**: Reloaded page, all providers persisted with correct enabled/disabled states and base URLs.

### Section 7 — Cross-Provider Streaming

**T7-2**: Selected llama3.1:8b, sent "List 5 animals" → received Lion, Elephant, Kangaroo, Gorilla, Dolphin. Streamed incrementally, 14 in / 28 out, "Free (local)".

**T7-3**: First message via Ollama, follow-up via Anthropic Haiku 4.5 in same conversation. Both responses in tree, parent-child relationships intact.

**T7-4**: From Ollama assistant node, sent branching message. Tree shows user node with "↕ 2" badge (two children). Both branches visible and responses correct.

### Section 8 — Error Handling

**T8-1**: Added OpenAI with key "bad-key-12345", enabled, clicked Test Connection → "Failed to fetch OpenAI models" in red. No models shown in dropdown (correct — prevents selecting broken models). App remained functional.

**T8-2**: SKIPPED — requires setting browser to offline mode via DevTools, which isn't accessible via Chrome MCP tools.

## Issues Found

1. **Minor UX**: HuggingFace Test Connection with invalid key shows "0 models available" in green (success color) rather than a clear error message. It should show a red error like other providers do.
