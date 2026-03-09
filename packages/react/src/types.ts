import type { Dispatch, SetStateAction } from "react";

// ---------------------------------------------------------------------------
// Content Parts
// ---------------------------------------------------------------------------

export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool_call";
  tool_name: string;
  argument: string;
  /** Unique ID to correlate a tool call with its result. Present in agent history, absent during SSE streaming. */
  callId?: string;
}

/** Built-in content part types provided by the library. */
export type ContentPart = TextPart | ToolCallPart;

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export interface Message<TPart extends { type: string } = ContentPart> {
  id: string;
  role: "user" | "assistant";
  parts: TPart[];
}

// ---------------------------------------------------------------------------
// SSE Events
// ---------------------------------------------------------------------------

export interface TextDeltaEvent {
  type: "text_delta";
  delta: string;
}

export interface ToolCallEvent {
  type: "tool_call";
  tool_name: string;
  argument: string;
}

export type SSEEvent = TextDeltaEvent | ToolCallEvent;

// ---------------------------------------------------------------------------
// Event Helpers — passed to the `onEvent` callback so consumers can
// mutate message state from within their handler.
// ---------------------------------------------------------------------------

export interface EventHelpers<TPart extends { type: string } = ContentPart> {
  /** Append a text delta to the last text part of the current assistant message, or create a new text part. */
  appendText: (delta: string) => void;

  /** Append a new content part to the current assistant message. */
  appendPart: (part: TPart) => void;

  /** Direct access to the messages state setter for advanced use-cases. */
  setMessages: Dispatch<SetStateAction<Message<TPart>[]>>;
}

// ---------------------------------------------------------------------------
// Hook Options
// ---------------------------------------------------------------------------

export interface UseChatOptions<
  TPart extends { type: string } = ContentPart,
  TEvent extends { type: string } = SSEEvent,
> {
  /** SSE endpoint URL. */
  api: string;

  /** Initial messages to prepopulate the chat (e.g. from a database or previous session). */
  initialMessages?: Message<TPart>[];

  /** Extra headers merged into every fetch request. */
  headers?: Record<string, string>;

  /** Extra fields merged into the POST body alongside `message`. */
  body?: Record<string, unknown>;

  /**
   * Custom handler for each SSE event. When provided, this **replaces** the
   * default `text_delta` handling — giving you full control over how events
   * are mapped to message state.
   *
   * The `event` parameter is typed as `TEvent`, which defaults to `SSEEvent`.
   * Pass a custom event union as the second generic to handle additional event types.
   */
  onEvent?: (event: TEvent, helpers: EventHelpers<TPart>) => void;

  /** Called when the assistant message is complete (stream ended). */
  onFinish?: (messages: Message<TPart>[]) => void;

  /** Called whenever a new complete message (user or assistant) is added. */
  onMessage?: (message: Message<TPart>) => void;

  /** Called when a fetch or stream error occurs. */
  onError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Hook Return
// ---------------------------------------------------------------------------

export interface UseChatReturn<TPart extends { type: string } = ContentPart> {
  /** Chronological list of messages in the conversation. */
  messages: Message<TPart>[];

  /** `true` while the assistant is streaming a response. */
  isLoading: boolean;

  /** The most recent error, or `null`. */
  error: Error | null;

  /** Send a user message and begin streaming the assistant response. */
  sendMessage: (text: string) => void;

  /** Abort the current stream. */
  stop: () => void;

  /** Direct setter for programmatic message manipulation (clear, prepopulate, etc.). */
  setMessages: Dispatch<SetStateAction<Message<TPart>[]>>;
}
