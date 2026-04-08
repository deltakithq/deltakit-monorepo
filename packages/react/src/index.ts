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
export { useAutoScroll } from "./hooks/use-auto-scroll";
export { useStreamChat } from "./hooks/use-stream-chat";

export type {
	BackgroundSSETransportOptions,
	ChatTransport,
	ChatTransportContext,
	ChatTransportRun,
	DirectSSETransportOptions,
	EventHelpers,
	StreamStatus,
	StreamStatusContext,
	StreamStatusReason,
	TransportOptions,
	UseAutoScrollOptions,
	UseAutoScrollReturn,
	UseStreamChatDebounceOptions,
	UseStreamChatOptions,
	UseStreamChatReturn,
	WebSocketTransportOptions,
} from "./types";
