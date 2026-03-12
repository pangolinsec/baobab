/**
 * Shared SSE (Server-Sent Events) stream parser with proper line buffering.
 *
 * SSE data can arrive split across ReadableStream chunk boundaries.
 * This parser carries incomplete lines across reads to prevent silent
 * token drops when a `data:` line is split between two chunks.
 */

export interface SSEParseCallbacks {
  onData: (parsed: unknown) => void;
  onDone?: () => void;
}

export async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: SSEParseCallbacks
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Last element may be incomplete — keep it in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        callbacks.onDone?.();
        return;
      }
      try {
        callbacks.onData(JSON.parse(data));
      } catch {
        // Skip malformed JSON
      }
    }
  }

  // Flush any remaining buffered content
  if (buffer.trim().startsWith('data: ')) {
    const data = buffer.trim().slice(6);
    if (data !== '[DONE]') {
      try {
        callbacks.onData(JSON.parse(data));
      } catch {
        // Skip
      }
    }
  }
}
