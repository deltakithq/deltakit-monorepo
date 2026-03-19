import type { ContentPart, Message, SSEEvent } from "@deltakit/core";
import type { Dispatch, SetStateAction } from "react";
import type {
	ChatTransportContext,
	EventHelpers,
	UseStreamChatOptions,
} from "./types";

export interface ChatControllerOptions<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	appendPart: EventHelpers<TPart>["appendPart"];
	appendText: EventHelpers<TPart>["appendText"];
	eventHandler: (event: TEvent, helpers: EventHelpers<TPart>) => void;
	getMessages: () => Message<TPart>[];
	onError?: UseStreamChatOptions<TPart, TEvent>["onError"];
	onFinish?: UseStreamChatOptions<TPart, TEvent>["onFinish"];
	onMessage?: UseStreamChatOptions<TPart, TEvent>["onMessage"];
	setError: Dispatch<SetStateAction<Error | null>>;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
	setMessages: Dispatch<SetStateAction<Message<TPart>[]>>;
	setRunId: (runId: string | null) => void;
}

let counter = 0;

export function generateId(): string {
	return `msg_${Date.now()}_${++counter}`;
}

export function createMessage<TPart extends { type: string }>(
	role: Message["role"],
	parts: TPart[],
): Message<TPart> {
	return { id: generateId(), role, parts };
}

export function createChatTransportContext<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(
	options: ChatControllerOptions<TPart, TEvent>,
): ChatTransportContext<TPart, TEvent> {
	const helpers: EventHelpers<TPart> = {
		appendPart: options.appendPart,
		appendText: options.appendText,
		setMessages: options.setMessages,
	};

	return {
		emit: (event) => {
			options.eventHandler(event, helpers);
		},
		ensureAssistantMessage: () => {
			options.setMessages((prev) => {
				const last = prev[prev.length - 1];
				if (last?.role === "assistant") {
					return prev;
				}

				return [...prev, createMessage<TPart>("assistant", [])];
			});
		},
		fail: (error) => {
			options.setError(error);
			options.onError?.(error);
			options.setIsLoading(false);
			options.setRunId(null);
		},
		finish: () => {
			options.setIsLoading(false);
			options.setRunId(null);

			const finalMessages = options.getMessages();
			const lastMessage = finalMessages[finalMessages.length - 1];

			if (lastMessage?.role === "assistant") {
				options.onMessage?.(lastMessage);
			}

			options.onFinish?.(finalMessages);
		},
		getMessages: options.getMessages,
		setRunId: (runId) => {
			options.setRunId(runId);
		},
	};
}
