# @deltakit/core

Framework-agnostic core for building streaming chat UIs over Server-Sent Events (SSE). Provides type-safe message structures, an SSE stream parser, and a converter for OpenAI Agents SDK history. Zero runtime dependencies.

## Installation

```bash
npm install @deltakit/core
```

> If you're using React, install `@deltakit/react` instead -- it re-exports everything from `@deltakit/core`.

## Quick Start

```ts
import { parseSSEStream } from "@deltakit/core";

const response = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ message: "Hello" }),
});

for await (const event of parseSSEStream(response.body!)) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.delta);
      break;
    case "tool_call":
      console.log("Tool call:", event.tool_name);
      break;
    case "tool_result":
      console.log("Result:", event.output);
      break;
  }
}
```

## API

### `parseSSEStream(stream, signal?)`

Async generator that converts a raw `ReadableStream<Uint8Array>` (from `fetch().body`) into parsed JSON events. Handles chunked data, skips malformed lines, and terminates on `data: [DONE]`.

```ts
async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent>
```

### `fromOpenAiAgents(items)`

Converts OpenAI Agents SDK response items into DeltaKit `Message[]` format. Handles all item types including messages, tool calls (`function_call`, `web_search_call`, `code_interpreter_call`, etc.), reasoning, and tool outputs.

```ts
import { fromOpenAiAgents } from "@deltakit/core";

const history = await fetch("/api/chat/history").then((r) => r.json());
const messages = fromOpenAiAgents(history);
```

### Types

#### Messages

```ts
interface Message<TPart extends { type: string } = ContentPart> {
  id: string;
  role: "user" | "assistant";
  parts: TPart[];
}
```

#### Content Parts

| Type | Description |
|------|-------------|
| `TextPart` | `{ type: "text", text: string }` |
| `ToolCallPart` | `{ type: "tool_call", tool_name, argument, callId?, result? }` |
| `ReasoningPart` | `{ type: "reasoning", text: string }` |
| `ContentPart` | Union of all built-in part types |

#### SSE Events

| Type | Description |
|------|-------------|
| `TextDeltaEvent` | `{ type: "text_delta", delta: string }` |
| `ToolCallEvent` | `{ type: "tool_call", tool_name, argument, call_id? }` |
| `ToolResultEvent` | `{ type: "tool_result", call_id, output }` |
| `SSEEvent` | Union of all built-in event types |

Both `ContentPart` and `SSEEvent` are extensible via generics for custom types.

## SSE Protocol

DeltaKit expects your backend to stream events in standard SSE format:

```
data: {"type":"text_delta","delta":"Hello"}

data: {"type":"text_delta","delta":" world!"}

data: [DONE]
```

## Documentation

Full documentation, guides, and examples at [deltakit.dev](https://deltakit.dev).

## License

MIT
