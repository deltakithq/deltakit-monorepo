// Re-export core types so consumers only need to import from @deltakit/react
export type {
	ContentPart,
	Message,
	ReasoningPart,
	SSEEvent,
	TextDeltaEvent,
	TextPart,
	ToolCallEvent,
	ToolCallPart,
	ToolResultEvent,
} from "@deltakit/core";
export {
	fromAgnoAgents,
	fromOpenAiAgents,
	parseSSEStream,
} from "@deltakit/core";

export type {
	BackgroundSSETransportOptions,
	ChatTransport,
	ChatTransportContext,
	ChatTransportRun,
	DirectSSETransportOptions,
	EventHelpers,
	TransportOptions,
	UseAutoScrollOptions,
	UseAutoScrollReturn,
	UseStreamChatOptions,
	UseStreamChatReturn,
	WebSocketTransportOptions,
} from "./types";
export { useAutoScroll } from "./use-auto-scroll";
export { useStreamChat } from "./use-stream-chat";
