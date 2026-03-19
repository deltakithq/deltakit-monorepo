import type { ContentPart, Message, SSEEvent } from "@deltakit/core";
import type { Dispatch, RefObject, SetStateAction } from "react";

export type { ContentPart, Message, SSEEvent };

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
// Transports
// ---------------------------------------------------------------------------

export interface ChatTransportRun {
	/** Transport-specific run id for resumable backends. */
	runId?: string | null;

	/** Close local resources such as fetch streams or sockets. */
	close?: () => void | Promise<void>;

	/** Request cancellation when the backend supports it. */
	stop?: () => void | Promise<void>;
}

export interface ChatTransportContext<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	/** Emit a normalized event into the shared chat controller. */
	emit: (event: TEvent) => void;

	/** Mark the run as complete. */
	finish: () => void;

	/** Surface a transport error through the hook. */
	fail: (error: Error) => void;

	/** Ensure there is an assistant message available for streamed parts. */
	ensureAssistantMessage: () => void;

	/** Read the latest message state. */
	getMessages: () => Message<TPart>[];

	/** Update the active run id. */
	setRunId: (runId: string | null) => void;
}

export interface ChatTransportStartArgs<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	message: string;
	context: ChatTransportContext<TPart, TEvent>;
}

export interface ChatTransportResumeArgs<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	runId: string;
	context: ChatTransportContext<TPart, TEvent>;
}

export interface ChatTransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	start: (
		args: ChatTransportStartArgs<TPart, TEvent>,
	) => ChatTransportRun | undefined;
	resume?: (
		args: ChatTransportResumeArgs<TPart, TEvent>,
	) => ChatTransportRun | undefined;
}

export interface DirectSSETransportOptions {
	/** SSE endpoint URL. */
	api: string;

	/** Extra fetch headers merged into every POST request. */
	headers?: Record<string, string>;

	/** Extra fields merged into the POST body alongside `message`. */
	body?: Record<string, unknown>;

	/** Override the HTTP method used to start the stream. Default: `POST`. */
	method?: string;

	/** Override the global `fetch` implementation. */
	fetch?: typeof fetch;
}

export type RunIdResolver = (response: unknown) => string;

export type RunUrlResolver = string | ((runId: string) => string);

export interface BackgroundSSETransportOptions {
	/** Endpoint that starts a background job and returns a run id. */
	startApi: string;

	/** Endpoint used to connect to SSE events for a run id. */
	eventsApi: RunUrlResolver;

	/** Endpoint to cancel a running job. Called with POST when `stop()` is invoked. */
	cancelApi?: RunUrlResolver;

	/** Optional status endpoint for consumers that poll metadata out-of-band. */
	statusApi?: RunUrlResolver;

	/** Extra headers sent to the start request. */
	startHeaders?: Record<string, string>;

	/** Extra body fields merged into the start request alongside `message`. */
	startBody?: Record<string, unknown>;

	/** Extra headers sent when connecting to the SSE events endpoint. */
	eventHeaders?: Record<string, string>;

	/** Override the HTTP method used to start the background job. Default: `POST`. */
	startMethod?: string;

	/** Extract the run id from the start response. Defaults to `runId` or `job_id`. */
	resolveRunId?: RunIdResolver;

	/** Persisted run id to resume immediately on mount. */
	runId?: string | null;

	/** Read a persisted run id during mount. */
	getResumeKey?: () => string | null | undefined;

	/** Persist run id updates so the app can reconnect later. */
	onRunIdChange?: (runId: string | null) => void;

	/** Override the global `fetch` implementation. */
	fetch?: typeof fetch;
}

export interface WebSocketTransportOptions<
	TEvent extends { type: string } = SSEEvent,
> {
	/** WebSocket URL or resolver. */
	url: string | ((runId: string | null) => string);

	/** HTTP endpoint to cancel a running job. Called with POST when `stop()` is invoked. */
	cancelUrl?: string | ((runId: string) => string);

	/** Optional subprotocols passed to the WebSocket constructor. */
	protocols?: string | string[];

	/** Extra payload merged into every outbound message frame. */
	body?: Record<string, unknown>;

	/** Persisted run id to resume immediately on mount. */
	runId?: string | null;

	/** Read a persisted run id during mount. */
	getResumeKey?: () => string | null | undefined;

	/** Persist run id updates so the app can reconnect later. */
	onRunIdChange?: (runId: string | null) => void;

	/** Parse incoming WebSocket frames into chat events. Defaults to JSON.parse. */
	parseMessage?: (data: unknown) => TEvent | TEvent[] | null;

	/** Derive a resumable run id from an inbound event. */
	resolveRunId?: (event: TEvent) => string | null;

	/** Serialize outbound frames. Defaults to JSON.stringify. */
	serializeMessage?: (payload: Record<string, unknown>) => string;

	/** Request payload key used for the run id. Default: `runId`. */
	runIdKey?: string;

	/** Build the payload sent when reconnecting to an existing run. */
	buildResumePayload?: (runId: string) => Record<string, unknown>;
}

export interface TransportOptions<TEvent extends { type: string } = SSEEvent> {
	sse?: DirectSSETransportOptions;
	backgroundSSE?: BackgroundSSETransportOptions;
	websocket?: WebSocketTransportOptions<TEvent>;
}

// ---------------------------------------------------------------------------
// Hook Options
// ---------------------------------------------------------------------------

export interface UseStreamChatOptions<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	/**
	 * Transport strategy. Defaults to `"sse"` when omitted.
	 * Pass a custom transport object to fully control connection behavior.
	 */
	transport?:
		| "sse"
		| "background-sse"
		| "websocket"
		| ChatTransport<TPart, TEvent>;

	/**
	 * Grouped transport configuration for built-in adapters.
	 * Existing direct-SSE callers may continue to use the top-level `api`,
	 * `headers`, and `body` fields.
	 */
	transportOptions?: TransportOptions<TEvent>;

	/** Direct SSE endpoint URL. Backward-compatible alias for `transportOptions.sse.api`. */
	api?: string;

	/** Initial messages to prepopulate the chat (e.g. from a database or previous session). */
	initialMessages?: Message<TPart>[];

	/** Extra headers merged into every direct-SSE fetch request. */
	headers?: Record<string, string>;

	/** Extra fields merged into the direct-SSE POST body alongside `message`. */
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

export interface UseStreamChatReturn<
	TPart extends { type: string } = ContentPart,
> {
	/** Chronological list of messages in the conversation. */
	messages: Message<TPart>[];

	/** `true` while the assistant is streaming a response. */
	isLoading: boolean;

	/** The most recent error, or `null`. */
	error: Error | null;

	/** Current resumable run id, if the active transport exposes one. */
	runId: string | null;

	/** Send a user message and begin streaming the assistant response. */
	sendMessage: (text: string) => void;

	/** Abort the current stream. */
	stop: () => void;

	/** Direct setter for programmatic message manipulation (clear, prepopulate, etc.). */
	setMessages: Dispatch<SetStateAction<Message<TPart>[]>>;
}

// ---------------------------------------------------------------------------
// useAutoScroll
// ---------------------------------------------------------------------------

export interface UseAutoScrollOptions {
	/** Scroll behavior when auto-scrolling. Default: `"instant"`. */
	behavior?: ScrollBehavior;

	/** Whether auto-scroll is enabled. Default: `true`. */
	enabled?: boolean;

	/** Distance (px) from the bottom to consider "at bottom". Default: `50`. */
	threshold?: number;
}

export interface UseAutoScrollReturn<T extends HTMLElement = HTMLDivElement> {
	/** Attach this ref to your scrollable container element. */
	ref: RefObject<T | null>;

	/** Imperatively scroll to the bottom and re-pin auto-scroll. */
	scrollToBottom: () => void;

	/** Whether the scroll container is currently at/near the bottom. */
	isAtBottom: boolean;
}
