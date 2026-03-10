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
	/** Tool execution result. Present in agent history when the tool has completed. */
	result?: string;
}

export interface ReasoningPart {
	type: "reasoning";
	text: string;
}

/** Built-in content part types provided by the library. */
export type ContentPart = TextPart | ToolCallPart | ReasoningPart;

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
	call_id?: string;
}

export interface ToolResultEvent {
	type: "tool_result";
	call_id: string;
	output: string;
}

export type SSEEvent = TextDeltaEvent | ToolCallEvent | ToolResultEvent;
