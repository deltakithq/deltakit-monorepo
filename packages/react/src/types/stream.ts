import type { Dispatch, SetStateAction } from "react";
import type { ContentPart, Message, SSEEvent } from "./shared";
import type {
	ChatTransport,
	EventHelpers,
	TransportOptions,
} from "./transport";

export type StreamStatus =
	| "starting"
	| "resuming"
	| "stopped"
	| "finished"
	| "error";

export type StreamStatusReason = "user" | "unmount";

export interface StreamStatusContext<
	TPart extends { type: string } = ContentPart,
> {
	messages: Message<TPart>[];
	runId: string | null;
	error?: Error;
	reason?: StreamStatusReason;
}

export interface UseStreamChatDebounceOptions {
	// Counts incoming appendText/text_delta calls, which often map to
	// streamed token boundaries depending on the transport/backend.
	tokens: number;
}

export interface UseStreamChatOptions<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	transport?:
		| "sse"
		| "background-sse"
		| "websocket"
		| ChatTransport<TPart, TEvent>;
	transportOptions?: TransportOptions<TEvent>;
	api?: string;
	initialMessages?: Message<TPart>[];
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	debounced?: UseStreamChatDebounceOptions;
	onEvent?: (event: TEvent, helpers: EventHelpers<TPart>) => void;
	onFinish?: (messages: Message<TPart>[]) => void;
	onMessage?: (message: Message<TPart>) => void;
	onError?: (error: Error) => void;
	onStatusChange?: (
		status: StreamStatus,
		context: StreamStatusContext<TPart>,
	) => void;
}

export interface UseStreamChatReturn<
	TPart extends { type: string } = ContentPart,
> {
	messages: Message<TPart>[];
	isLoading: boolean;
	error: Error | null;
	runId: string | null;
	sendMessage: (text: string) => void;
	stop: () => void;
	setMessages: Dispatch<SetStateAction<Message<TPart>[]>>;
}
