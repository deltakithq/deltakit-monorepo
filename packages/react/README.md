# @deltakit/react

React hook for building streaming chat UIs with pluggable transport strategies. `useStreamChat` manages message state, event handling, loading state, and transport lifecycle for direct SSE, resumable/background SSE, and WebSocket chat backends.

## Installation

```bash
npm install @deltakit/react
```

Requires React 18+.

## Quick Start

```tsx
import { useStreamChat } from "@deltakit/react";

function Chat() {
  const { messages, isLoading, sendMessage } = useStreamChat({
    api: "/api/chat",
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong>{" "}
          {msg.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("")}
        </div>
      ))}

      {isLoading && <span>Thinking...</span>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
          sendMessage(input.value);
          input.value = "";
        }}
      >
        <input name="message" placeholder="Type a message..." />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

## API

### `useStreamChat(options)`

```ts
const {
  messages,    // Message[]           -- live-updating conversation
  isLoading,   // boolean             -- true while streaming
  error,       // Error | null        -- latest error
  runId,       // string | null       -- resumable transport run id
  sendMessage, // (text: string) => void -- send and start streaming
  stop,        // () => void          -- request cancellation if supported
  setMessages, // React setState      -- direct state control
} = useStreamChat({
  api: "/api/chat",           // Backward-compatible direct SSE shorthand
  initialMessages: [],        // Pre-populate conversation (e.g. from DB)
  headers: {},                // Extra fetch headers (e.g. Authorization)
  body: {},                   // Extra POST body fields
  transport: "sse",           // "sse" | "background-sse" | "websocket" | custom adapter
  transportOptions: {},       // Grouped config for built-in transports
  onEvent: (event, helpers) => {},  // Custom event handler (replaces default)
  onFinish: (messages) => {},       // Stream ended
  onMessage: (message) => {},       // New message added
  onError: (error) => {},           // Fetch/stream error
});
```

### Transport Strategies

### Direct SSE

Existing callers continue to work:

```tsx
const chat = useStreamChat({
  api: "/api/chat",
});
```

Or use the grouped transport config:

```tsx
const chat = useStreamChat({
  transport: "sse",
  transportOptions: {
    sse: {
      api: "/api/chat",
      headers: { Authorization: "Bearer token" },
      body: { conversationId: "demo" },
    },
  },
});
```

### Background / Resumable SSE

Use this when the backend starts a job first, then exposes a reconnectable SSE stream by `runId`.

```tsx
const [activeRunId, setActiveRunId] = useState<string | null>(null);

const chat = useStreamChat({
  transport: "background-sse",
  transportOptions: {
    backgroundSSE: {
      startApi: "/api/chat/jobs",
      eventsApi: (runId) => `/api/chat/jobs/${runId}/events`,
      statusApi: (runId) => `/api/chat/jobs/${runId}`,
      runId: activeRunId,
      onRunIdChange: setActiveRunId,
    },
  },
});
```

If the component unmounts, the local stream disconnects. When the user returns, provide the stored `runId` again and the hook can reconnect with `resume`.

### WebSocket

Use this when the backend streams events over a socket instead of HTTP SSE.

```tsx
type ChatEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; tool_name: string; argument: string; call_id?: string };

const chat = useStreamChat<ContentPart, ChatEvent>({
  transport: "websocket",
  transportOptions: {
    websocket: {
      url: "ws://localhost:8000/ws/chat",
      body: { room: "demo" },
      parseMessage: (data) => {
        if (typeof data !== "string") return null;
        return JSON.parse(data) as ChatEvent;
      },
    },
  },
});
```

### Custom Transport Adapters

If your backend needs a different lifecycle, pass a custom `transport` object. The adapter only handles connection mechanics; the hook still owns message state, event helpers, loading state, and callbacks.

```tsx
const chat = useStreamChat({
  transport: {
    start: ({ context, message }) => {
      const socket = new WebSocket("ws://localhost:8000/ws/chat");

      socket.onopen = () => {
        context.ensureAssistantMessage();
        socket.send(JSON.stringify({ message }));
      };

      socket.onmessage = (event) => {
        context.emit(JSON.parse(event.data));
      };

      socket.onerror = () => {
        context.fail(new Error("Socket error"));
      };

      socket.onclose = () => {
        context.finish();
      };

      return {
        close: () => socket.close(),
      };
    },
  },
});
```

### Event Helpers

When using `onEvent`, you receive helpers for mutating message state during streaming:

```ts
onEvent: (event, { appendText, appendPart, setMessages }) => {
  switch (event.type) {
    case "text_delta":
      appendText(event.delta);
      break;
    case "tool_call":
      appendPart({
        type: "tool_call",
        tool_name: event.tool_name,
        argument: event.argument,
        callId: event.call_id,
      });
      break;
    case "tool_result":
      // Use setMessages for complex mutations
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          parts: msg.parts.map((p) =>
            p.type === "tool_call" && p.callId === event.call_id
              ? { ...p, result: event.output }
              : p
          ),
        }))
      );
      break;
  }
}
```

### Custom Content Parts

Extend with custom types using generics:

```tsx
type ImagePart = { type: "image"; url: string };
type MyPart = ContentPart | ImagePart;

const { messages } = useStreamChat<MyPart>({
  api: "/api/chat",
  onEvent: (event, { appendPart }) => {
    if (event.type === "image") {
      appendPart({ type: "image", url: event.url });
    }
  },
});
```

### Re-exports from `@deltakit/core`

This package re-exports everything from `@deltakit/core`, so you only need one import:

- `parseSSEStream` -- SSE stream parser
- `fromOpenAiAgents` -- OpenAI Agents SDK history converter
- All types: `Message`, `ContentPart`, `TextPart`, `ToolCallPart`, `ReasoningPart`, `SSEEvent`, `TextDeltaEvent`, `ToolCallEvent`, `ToolResultEvent`

## Documentation

Full documentation, guides, and examples at [deltakit.dev](https://deltakit.dev).

## License

MIT
