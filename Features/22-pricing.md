# 22 — Pricing Transparency

## Summary

Show token counts and estimated costs per message, per branch, and per conversation. Uses a static price table (committed to the repo) keyed by model ID. Displayed in the detail panel and as a running total for the conversation.

## Priority

Tier 3 — nice-to-have.

## Dependencies

- **07 Inference Providers**: costs vary by model and provider.

## Price Table

A static JSON file committed to the repo:

```typescript
// src/data/pricing.ts

interface ModelPricing {
  inputPerMillion: number;   // $ per 1M input tokens
  outputPerMillion: number;  // $ per 1M output tokens
}

export const PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-haiku-4-5-20241022':   { inputPerMillion: 0.80,  outputPerMillion: 4.00 },
  'claude-sonnet-4-20250514':    { inputPerMillion: 3.00,  outputPerMillion: 15.00 },
  'claude-opus-4-20250514':      { inputPerMillion: 15.00, outputPerMillion: 75.00 },

  // OpenAI
  'gpt-4o':                      { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  'gpt-4o-mini':                 { inputPerMillion: 0.15,  outputPerMillion: 0.60 },

  // Google
  'gemini-2.0-flash':            { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  'gemini-2.0-pro':              { inputPerMillion: 1.25,  outputPerMillion: 10.00 },

  // Ollama — local, no cost
  // OpenRouter — varies by model, use their pricing API
};
```

Updated periodically and committed to git. Could be automated via a GitHub Action that fetches current pricing from provider APIs.

For models not in the table (custom, OpenRouter, HuggingFace), show "pricing unavailable" or allow the user to set custom pricing in settings.

## Token Counting

### From API Responses

Most providers return token usage in the response:

- **Anthropic**: `message.usage.input_tokens`, `message.usage.output_tokens`
- **OpenAI**: `completion.usage.prompt_tokens`, `completion.usage.completion_tokens`
- **Gemini**: `usageMetadata.promptTokenCount`, `usageMetadata.candidatesTokenCount`

Capture these from the API response and store on the node.

### Data Model

```typescript
interface TreeNode {
  // ... existing
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

Only assistant nodes have token usage (that's where the API response comes from). User nodes don't have separate token counts — their tokens are counted as part of the input to the next assistant message.

## UI — Detail Panel

In the `NodeDetailPanel`, for assistant messages:

```
┌──────────────────────────────────────┐
│ 🔮 Claude (Haiku 4.5)          [X]  │
├──────────────────────────────────────┤
│ Here is my response...               │
│ ...                                  │
├──────────────────────────────────────┤
│ 📊 1,240 in / 856 out tokens        │
│    Branch context: ~4,200 tokens     │
│    Est. cost: $0.0047                │
├──────────────────────────────────────┤
│ [Reply here] [Copy] [Delete]         │
└──────────────────────────────────────┘
```

### Token Info Line

A small, muted info section above the action buttons:

- **Token counts**: `1,240 in / 856 out tokens` — from the API response.
- **Branch context**: estimated total tokens in the path from root to this node (sum of all content in the branch). This gives the user a sense of how much context is being used.
- **Estimated cost**: calculated from the token counts and the model's pricing.

### Cost Calculation

```typescript
function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number | null {
  const pricing = PRICING[modelId];
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}
```

## UI — Conversation Running Total

In the sidebar, next to the conversation name, or in the conversation header:

```
Biology Chat                    $0.12 / 45K tokens
```

Or in the conversation header bar:

```
┌─────────────────────────────────────────────────────────────┐
│ Biology Chat            💰 $0.12 (45K tok)    [🌳] [💬]    │
└─────────────────────────────────────────────────────────────┘
```

### Calculation

Sum all assistant nodes' token usage in the conversation:

```typescript
function getConversationCost(nodes: Record<string, TreeNode>): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  costBreakdown: Record<string, number>;  // per model
} {
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  const breakdown: Record<string, number> = {};

  for (const node of Object.values(nodes)) {
    if (node.tokenUsage) {
      totalInput += node.tokenUsage.inputTokens;
      totalOutput += node.tokenUsage.outputTokens;
      const cost = estimateCost(
        node.tokenUsage.inputTokens,
        node.tokenUsage.outputTokens,
        node.model
      );
      if (cost !== null) {
        totalCost += cost;
        breakdown[node.model] = (breakdown[node.model] || 0) + cost;
      }
    }
  }

  return { totalInputTokens: totalInput, totalOutputTokens: totalOutput, totalCost, costBreakdown: breakdown };
}
```

### Multi-Model Breakdown

Since different messages may use different models (feature 08), the running total accounts for each model's pricing separately. The detail view could show a breakdown:

```
Cost breakdown:
  Haiku 4.5:  $0.03 (32 messages)
  Sonnet 4:   $0.09 (4 messages)
  Total:      $0.12
```

## Chat Input Context Indicator

Before sending a message, show an estimate of the context being sent:

```
┌─────────────────────────────────────────────────┐
│ ↳ Replying to: Frogs are amphibians...          │
│   ~4,200 tokens in context • est. $0.003        │
├─────────────────────────────────────────────────┤
│ [Type a message...]                    [Send ▶] │
└─────────────────────────────────────────────────┘
```

This is an estimate based on character count (~4 chars per token) since exact tokenization requires model-specific tokenizers. The actual count comes from the API response.

## Token Capture in API Layer

In each provider's `sendMessage` implementation, capture usage from the response:

```typescript
// Anthropic
const finalMessage = await stream.finalMessage();
const tokenUsage = {
  inputTokens: finalMessage.usage.input_tokens,
  outputTokens: finalMessage.usage.output_tokens,
};

// OpenAI
// Usage comes in the final SSE chunk or response
```

Store on the assistant node via `finalizeNode`:

```typescript
finalizeNode: async (nodeId: string, content: string, tokenUsage?: TokenUsage) => {
  const updates: Partial<TreeNode> = { content };
  if (tokenUsage) updates.tokenUsage = tokenUsage;
  // ... persist
}
```

## Ollama / Local Models

Local models via Ollama have zero cost. Show token counts but display "Free (local)" instead of a dollar amount.

## OpenRouter

OpenRouter's API returns cost information directly in the response headers or metadata. Use that instead of the static table for OpenRouter models.

## Cost Attribution by Node Type

All assistant nodes contribute to the conversation cost total, regardless of `nodeType` (standard, summary, merge). The `getConversationCost` function sums across all assistant nodes indiscriminately. In addition to the per-model breakdown, a per-`nodeType` breakdown is available:

```typescript
function getConversationCost(nodes: Record<string, TreeNode>): {
  // ... existing fields
  costByNodeType: Record<string, number>;  // e.g. { standard: 0.10, summary: 0.02, merge: 0.01 }
} {
  // ... existing loop, plus:
  const byNodeType: Record<string, number> = {};
  // Inside the loop:
  //   const nt = node.nodeType || 'standard';
  //   byNodeType[nt] = (byNodeType[nt] || 0) + cost;
}
```

The UI can display this as: "Conversation: $0.10 | Summaries: $0.02 | Merges: $0.01".

Research runs (Feature 06) create assistant nodes that also roll up into conversation totals. Research-specific cost tracking is handled per-run in the research UI, but the underlying nodes are included here for consistency.

## Edge Cases

- **Model not in pricing table**: show token counts but "Pricing unavailable" for cost.
- **Streaming interrupted**: token usage may not be available if the stream was aborted. Show "—" for those messages.
- **Very large conversations**: the running total sums all nodes. This is O(n) but only recalculated when the conversation is loaded or a new message is added.
