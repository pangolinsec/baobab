// Module-level state for ChatInput overrides, readable by other components.
// Intentionally NOT reactive — components read at interaction time (e.g. on click).
// ChatInput syncs its local state here; NodeDetailPanel reads it for resend.

export const chatInputState = {
  modelOverride: undefined as string | undefined,
  systemPromptOverride: undefined as string | undefined,
  modelThisMessageOnly: true,
  systemPromptThisMessageOnly: true,
  resolvedProviderId: undefined as string | undefined,
};
