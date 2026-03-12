import { useSettingsStore } from '../store/useSettingsStore';
import { useTreeStore } from '../store/useTreeStore';
import { getProvider } from '../api/providers/registry';
import type { ProviderConfig, ProviderSendParams } from '../api/providers/types';

/**
 * Fire-and-forget LLM title generation for a conversation.
 * Sends a short prompt to generate a 5–8 word title and updates the conversation.
 *
 * Race condition guard: re-reads the conversation title before applying.
 * If the title has changed (user renamed while LLM was running), we bail.
 */
export async function generateTitle(
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
  model: string,
  expectedCurrentTitle: string,
): Promise<void> {
  try {
    const { allProviderModels, providers } = useSettingsStore.getState();

    // Resolve provider for this model
    const modelInfo = allProviderModels.find(m => m.id === model);
    if (!modelInfo) return;

    const providerId = modelInfo.providerId;
    const provider = getProvider(providerId);
    const providerConfig = providers.find(p => p.id === providerId);
    if (!provider || !providerConfig || !providerConfig.enabled) return;
    if (provider.requiresApiKey && !providerConfig.apiKey) return;

    const truncatedResponse = assistantResponse.slice(0, 500);

    const prompt = `Summarize this conversation in 5-8 words as a title. Return only the title, no quotes or punctuation.

User: ${userMessage}
Assistant: ${truncatedResponse}`;

    const generatedTitle = await new Promise<string>((resolve, reject) => {
      provider.sendMessage(providerConfig as ProviderConfig, {
        model,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You generate short conversation titles. Respond with only the title.',
        maxOutputTokens: 30,
        onToken: () => {},
        onComplete: (fullText: string) => {
          resolve(fullText.trim());
        },
        onError: (error: Error) => {
          reject(error);
        },
      } as ProviderSendParams);
    });

    if (!generatedTitle) return;

    // Race condition guard: check title hasn't been changed by user
    const conv = useTreeStore.getState().conversations.find(c => c.id === conversationId);
    if (!conv || conv.title !== expectedCurrentTitle) return;

    await useTreeStore.getState().updateConversationTitle(conversationId, generatedTitle);
  } catch {
    // Silent catch — truncated title stays on error
  }
}
