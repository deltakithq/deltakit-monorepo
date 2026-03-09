export { useStreamChat } from "./use-stream-chat";

export type {
  EventHelpers,
  UseStreamChatOptions,
  UseStreamChatReturn,
} from "./types";

// Re-export core types so consumers only need to import from @deltakit/react
export type {
  TextPart,
  ToolCallPart,
  ContentPart,
  Message,
  TextDeltaEvent,
  ToolCallEvent,
  SSEEvent,
} from "@deltakit/core";

export { parseSSEStream, fromOpenAiAgents } from "@deltakit/core";
