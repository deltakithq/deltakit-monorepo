import type { Dispatch, SetStateAction } from "react";
import type { ContentPart, Message, SSEEvent } from "./shared";

export interface EventHelpers<TPart extends { type: string } = ContentPart> {
	appendText: (delta: string) => void;
	appendPart: (part: TPart) => void;
	setMessages: Dispatch<SetStateAction<Message<TPart>[]>>;
}

export interface ChatTransportRun {
	runId?: string | null;
	close?: () => void | Promise<void>;
	stop?: () => void | Promise<void>;
}

export interface ChatTransportContext<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
> {
	emit: (event: TEvent) => void;
	finish: () => void;
	fail: (error: Error) => void;
	ensureAssistantMessage: () => void;
	getMessages: () => Message<TPart>[];
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
	api: string;
	headers?: Record<string, string>;
	body?: Record<string, unknown>;
	method?: string;
	fetch?: typeof fetch;
}

export type RunIdResolver = (response: unknown) => string;
export type RunUrlResolver = string | ((runId: string) => string);

export interface BackgroundSSETransportOptions {
	startApi: string;
	eventsApi: RunUrlResolver;
	cancelApi?: RunUrlResolver;
	statusApi?: RunUrlResolver;
	startHeaders?: Record<string, string>;
	startBody?: Record<string, unknown>;
	eventHeaders?: Record<string, string>;
	startMethod?: string;
	resolveRunId?: RunIdResolver;
	runId?: string | null;
	getResumeKey?: () => string | null | undefined;
	onRunIdChange?: (runId: string | null) => void;
	fetch?: typeof fetch;
}

export interface WebSocketTransportOptions<
	TEvent extends { type: string } = SSEEvent,
> {
	url: string | ((runId: string | null) => string);
	cancelUrl?: string | ((runId: string) => string);
	protocols?: string | string[];
	body?: Record<string, unknown>;
	runId?: string | null;
	getResumeKey?: () => string | null | undefined;
	onRunIdChange?: (runId: string | null) => void;
	parseMessage?: (data: unknown) => TEvent | TEvent[] | null;
	resolveRunId?: (event: TEvent) => string | null;
	serializeMessage?: (payload: Record<string, unknown>) => string;
	runIdKey?: string;
	buildResumePayload?: (runId: string) => Record<string, unknown>;
}

export interface TransportOptions<TEvent extends { type: string } = SSEEvent> {
	sse?: DirectSSETransportOptions;
	backgroundSSE?: BackgroundSSETransportOptions;
	websocket?: WebSocketTransportOptions<TEvent>;
}
