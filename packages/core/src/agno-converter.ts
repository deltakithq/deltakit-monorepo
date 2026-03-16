import type {
	ContentPart,
	Message,
	ReasoningPart,
	ToolCallPart,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw Agno message as returned by aget_session_messages().
 * This is intentionally loose since data comes from JSON deserialization.
 */
type AgnoMessage = Record<string, unknown>;

interface AgnoToolCall {
	id?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
	type?: string;
}

// ---------------------------------------------------------------------------
// Dev Mode Detection
// ---------------------------------------------------------------------------

const IS_DEV = false;

function warnDev(message: string, msg?: AgnoMessage): void {
	if (IS_DEV) {
		console.warn(`[fromAgnoAgents] ${message}`, msg ? { msg } : "");
	}
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

function extractId(msg: AgnoMessage, fallbackIndex: number): string {
	if (typeof msg.id === "string" && msg.id) {
		return msg.id;
	}
	return `agno_${fallbackIndex}`;
}

// ---------------------------------------------------------------------------
// Content Extraction Helpers
// ---------------------------------------------------------------------------

/**
 * Extract text content from user or assistant messages.
 */
function extractTextContent(msg: AgnoMessage): string {
	const content = msg.content;

	if (typeof content === "string") {
		return content;
	}

	if (content === null || content === undefined) {
		return "";
	}

	return String(content);
}

/**
 * Extract reasoning content from assistant messages.
 */
function extractReasoning(msg: AgnoMessage): ReasoningPart | null {
	const reasoning = msg.reasoning_content;

	if (typeof reasoning === "string" && reasoning) {
		return { type: "reasoning", text: reasoning };
	}

	return null;
}

/**
 * Extract tool calls from assistant messages.
 */
function extractToolCalls(msg: AgnoMessage): ToolCallPart[] {
	const parts: ToolCallPart[] = [];
	const toolCalls = msg.tool_calls;

	if (!Array.isArray(toolCalls)) {
		return parts;
	}

	for (const tc of toolCalls) {
		if (!tc || typeof tc !== "object") continue;

		const toolCall = tc as AgnoToolCall;
		const function_ = toolCall.function;

		if (!function_) continue;

		const name = function_.name;
		const args = function_.arguments;
		const callId = toolCall.id;

		if (typeof name !== "string") {
			warnDev("tool_call missing name", msg);
			continue;
		}

		parts.push({
			type: "tool_call",
			tool_name: name,
			argument: typeof args === "string" ? args : JSON.stringify(args),
			callId: typeof callId === "string" ? callId : undefined,
		});
	}

	return parts;
}

/**
 * Extract tool result from tool messages.
 */
function extractToolResult(
	msg: AgnoMessage,
): { callId: string | undefined; output: string } | null {
	const content = msg.content;
	if (
		typeof content !== "string" &&
		content !== null &&
		content !== undefined
	) {
		warnDev("tool message has non-string content", msg);
	}

	const output = typeof content === "string" ? content : String(content ?? "");

	// Agno tool messages don't have a direct call_id, we need to match by tool_name
	// The callId will be matched later in attachToolResult
	return {
		callId: undefined, // Will be matched by tool_name
		output,
	};
}

/**
 * Attach a tool output result to the matching ToolCallPart in the current
 * assistant message (matched by tool_name since Agno doesn't provide call_id
 * in tool result messages).
 */
function attachToolResult(
	message: Message<ContentPart> | null,
	result: { callId: string | undefined; output: string },
	toolName: string,
): void {
	if (!message) return;

	// Find the matching tool_call part by tool_name
	for (let j = message.parts.length - 1; j >= 0; j--) {
		const part = message.parts[j];
		if (
			part.type === "tool_call" &&
			part.tool_name === toolName &&
			!part.result
		) {
			(part as ToolCallPart).result = result.output;
			return;
		}
	}
}

// ---------------------------------------------------------------------------
// Main Conversion Function
// ---------------------------------------------------------------------------

/**
 * Convert Agno agent session messages into @deltakit/core Message format
 * for use with useStreamChat.
 *
 * This function handles Agno's message format from aget_session_messages(),
 * mapping them into a simplified Message<ContentPart>[] format suitable
 * for chat UI display.
 *
 * @param messages - Raw Agno messages from aget_session_messages() (JSON deserialized)
 * @returns Array of Message objects ready for useStreamChat({ initialMessages })
 *
 * @example
 * ```ts
 * // Load history from your API
 * const history = await fetch("/api/chat-agno/history").then((r) => r.json());
 *
 * // Convert to DeltaKit messages
 * const messages = fromAgnoAgents(history);
 * // => Message<ContentPart>[]
 *
 * const { messages } = useStreamChat({
 *   api: "/api/chat-agno",
 *   initialMessages: messages,
 * });
 * ```
 */
export function fromAgnoAgents(
	messages: AgnoMessage[],
): Message<ContentPart>[] {
	const result: Message<ContentPart>[] = [];
	let currentAssistantMessage: Message<ContentPart> | null = null;

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];

		if (!msg || typeof msg !== "object") {
			warnDev(`Skipping non-object message at index ${i}`, msg);
			continue;
		}

		const role = msg.role;

		if (typeof role !== "string") {
			warnDev(`Skipping message without role at index ${i}`, msg);
			continue;
		}

		// Handle user messages
		if (role === "user") {
			// Finalize any current assistant message
			if (currentAssistantMessage) {
				result.push(currentAssistantMessage);
				currentAssistantMessage = null;
			}

			const text = extractTextContent(msg);
			if (text) {
				result.push({
					id: extractId(msg, i),
					role: "user",
					parts: [{ type: "text", text }],
				});
			}
			continue;
		}

		// Handle assistant messages
		if (role === "assistant") {
			const parts: ContentPart[] = [];

			// Extract reasoning if present
			const reasoning = extractReasoning(msg);
			if (reasoning) {
				parts.push(reasoning);
			}

			// Extract tool calls if present
			const toolCalls = extractToolCalls(msg);
			if (toolCalls.length > 0) {
				parts.push(...toolCalls);
			}

			// Extract text content if present
			const text = extractTextContent(msg);
			if (text) {
				parts.push({ type: "text", text });
			}

			if (parts.length > 0) {
				if (currentAssistantMessage) {
					// Merge into existing assistant message
					currentAssistantMessage.parts.push(...parts);
				} else {
					currentAssistantMessage = {
						id: extractId(msg, i),
						role: "assistant",
						parts,
					};
				}
			}
			continue;
		}

		// Handle tool result messages
		if (role === "tool") {
			const toolResult = extractToolResult(msg);
			const toolName = msg.tool_name;

			if (toolResult && typeof toolName === "string") {
				attachToolResult(currentAssistantMessage, toolResult, toolName);
			}
			continue;
		}

		// Unknown role
		warnDev(`Unknown message role: ${role}`, msg);
	}

	// Don't forget to push the last assistant message
	if (currentAssistantMessage) {
		result.push(currentAssistantMessage);
	}

	return result;
}
