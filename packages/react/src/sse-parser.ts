import type { SSEEvent } from "./types";

/**
 * Parse a `ReadableStream<Uint8Array>` (from a `fetch` response body)
 * that carries Server-Sent Events in `data: {JSON}\n\n` format.
 *
 * Yields one `SSEEvent` per `data:` line. Handles partial chunks that
 * are split across multiple `read()` calls.
 *
 * @param stream  — `response.body` from a `fetch()` call.
 * @param signal  — optional `AbortSignal` for cancellation.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Append the decoded chunk to our buffer.
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines.
      const parts = buffer.split("\n\n");

      // The last element is either empty (complete event) or a partial
      // chunk that hasn't been fully received yet — keep it in the buffer.
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");

        for (const line of lines) {
          // Only process `data:` lines; ignore comments, event:, id:, etc.
          if (!line.startsWith("data:")) {
            continue;
          }

          const payload = line.slice("data:".length).trim();

          // The spec uses `data: [DONE]` as a sentinel in some implementations.
          if (payload === "[DONE]") {
            return;
          }

          try {
            const event = JSON.parse(payload) as SSEEvent;
            yield event;
          } catch {
            // Skip malformed JSON lines — don't blow up the stream.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
