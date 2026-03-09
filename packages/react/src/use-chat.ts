import { useCallback, useEffect, useRef, useState } from "react";
import { parseSSEStream } from "./sse-parser";
import type {
  ContentPart,
  EventHelpers,
  Message,
  SSEEvent,
  UseChatOptions,
  UseChatReturn,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function generateId(): string {
  return `msg_${Date.now()}_${++counter}`;
}

function createMessage<TPart extends { type: string }>(
  role: Message["role"],
  parts: TPart[],
): Message<TPart> {
  return { id: generateId(), role, parts };
}

// ---------------------------------------------------------------------------
// Default event handler — accumulates `text_delta` into the last
// assistant message's parts.
// ---------------------------------------------------------------------------

function defaultOnEvent(
  event: SSEEvent,
  helpers: EventHelpers<ContentPart>,
): void {
  if (event.type === "text_delta") {
    helpers.appendText(event.delta);
  }
  // Other event types (e.g. tool_call) are silently ignored by default.
  // Users can provide their own `onEvent` to handle them.
}

// ---------------------------------------------------------------------------
// useChat
// ---------------------------------------------------------------------------

export function useChat<
  TPart extends { type: string } = ContentPart,
  TEvent extends { type: string } = SSEEvent,
>(options: UseChatOptions<TPart, TEvent>): UseChatReturn<TPart> {
  const {
    api,
    headers,
    body,
    initialMessages,
    onEvent,
    onMessage,
    onError,
    onFinish,
  } = options;

  const [messages, setMessages] = useState<Message<TPart>[]>(
    initialMessages ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // We use a ref for the latest messages so that callbacks created inside
  // `sendMessage` always see the current value without re-creating closures.
  const messagesRef = useRef<Message<TPart>[]>(messages);
  messagesRef.current = messages;

  // -----------------------------------------------------------------------
  // appendText — append a text delta to the last text part of the last
  // assistant message, or create a new text part if needed.
  // -----------------------------------------------------------------------

  const appendText = useCallback((delta: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;

      const parts = [...last.parts];
      const lastPart = parts[parts.length - 1];

      if (lastPart && lastPart.type === "text" && "text" in lastPart) {
        // Append to existing text part
        const textPart = lastPart as { type: "text"; text: string };
        parts[parts.length - 1] = {
          ...lastPart,
          text: textPart.text + delta,
        } as unknown as TPart;
      } else {
        // Create a new text part
        parts.push({ type: "text", text: delta } as unknown as TPart);
      }

      const updated: Message<TPart> = { ...last, parts };
      return [...prev.slice(0, -1), updated];
    });
  }, []);

  // -----------------------------------------------------------------------
  // appendPart — push a new content part to the last assistant message.
  // -----------------------------------------------------------------------

  const appendPart = useCallback((part: TPart) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;

      const updated: Message<TPart> = {
        ...last,
        parts: [...last.parts, part],
      };
      return [...prev.slice(0, -1), updated];
    });
  }, []);

  // -----------------------------------------------------------------------
  // stop
  // -----------------------------------------------------------------------

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  const sendMessage = useCallback(
    (text: string) => {
      // Prevent sending while already streaming.
      if (abortRef.current) {
        return;
      }

      const userMessage = createMessage<TPart>("user", [
        { type: "text", text } as unknown as TPart,
      ]);
      const assistantMessage = createMessage<TPart>("assistant", []);

      setMessages((prev) => {
        const next = [...prev, userMessage, assistantMessage];
        messagesRef.current = next;
        return next;
      });

      onMessage?.(userMessage);

      setError(null);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const eventHandler =
        onEvent ??
        (defaultOnEvent as unknown as (
          event: TEvent,
          helpers: EventHelpers<TPart>,
        ) => void);
      const helpers: EventHelpers<TPart> = {
        appendText,
        appendPart,
        setMessages,
      };

      // Fire-and-forget async IIFE — state is managed via React setState.
      (async () => {
        try {
          const response = await fetch(api, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({ message: text, ...body }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(
              `SSE request failed: ${response.status} ${response.statusText}`,
            );
          }

          if (!response.body) {
            throw new Error(
              "Response body is null — SSE streaming not supported",
            );
          }

          for await (const event of parseSSEStream(
            response.body,
            controller.signal,
          )) {
            eventHandler(event as unknown as TEvent, helpers);
          }

          // Stream finished — notify via callbacks.
          const finalMessages = messagesRef.current;
          const lastMessage = finalMessages[finalMessages.length - 1];

          if (lastMessage?.role === "assistant") {
            onMessage?.(lastMessage);
          }

          onFinish?.(finalMessages);
        } catch (err) {
          // AbortError is expected when the user calls `stop()`.
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }

          const error = err instanceof Error ? err : new Error(String(err));

          setError(error);
          onError?.(error);
        } finally {
          abortRef.current = null;
          setIsLoading(false);
        }
      })();
    },
    [api, headers, body, onEvent, onMessage, onError, onFinish, appendText, appendPart],
  );

  // -----------------------------------------------------------------------
  // Cleanup — abort any in-flight stream when the component unmounts.
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    setMessages,
  };
}
