# @deltakit/react

React hook for building streaming chat UIs over Server-Sent Events (SSE). Manages the entire lifecycle -- state, network requests, SSE parsing, cancellation, and event handling -- in a single `useStreamChat` hook.

## Installation

```bash
npm install @deltakit/react
```

Requires React 18+ and a backend endpoint that streams SSE.

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
  sendMessage, // (text: string) => void -- send and start streaming
  stop,        // () => void          -- abort current stream
  setMessages, // React setState      -- direct state control
} = useStreamChat({
  api: "/api/chat",           // Required. SSE endpoint URL
  initialMessages: [],        // Pre-populate conversation (e.g. from DB)
  headers: {},                // Extra fetch headers (e.g. Authorization)
  body: {},                   // Extra POST body fields
  onEvent: (event, helpers) => {},  // Custom event handler (replaces default)
  onFinish: (messages) => {},       // Stream ended
  onMessage: (message) => {},       // New message added
  onError: (error) => {},           // Fetch/stream error
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
