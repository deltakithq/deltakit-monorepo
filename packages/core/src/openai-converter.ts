import type {
	ContentPart,
	Message,
	ReasoningPart,
	TextPart,
	ToolCallPart,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw OpenAI Agents SDK items as they come from JSON deserialization.
 * This is an intentionally loose type since data comes from `JSON.parse()`.
 */
type RawItem = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Dev Mode Detection
// ---------------------------------------------------------------------------

const IS_DEV = false; // Set to true manually during development if needed

function warnDev(message: string, item?: RawItem): void {
	if (IS_DEV) {
		console.warn(`[fromOpenAiAgents] ${message}`, item ? { item } : "");
	}
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

function extractId(item: RawItem, fallbackIndex: number): string {
	if (typeof item.id === "string" && item.id && item.id !== "__fake_id__") {
		return item.id;
	}
	return `openai_${fallbackIndex}`;
}

// ---------------------------------------------------------------------------
// Content Extraction Helpers
// ---------------------------------------------------------------------------

/**
 * Extract text content from user/system/developer messages.
 * Handles both string content and array of content items.
 */
function extractUserText(item: RawItem): string {
	const content = item.content;

	// String content (EasyInputMessageParam)
	if (typeof content === "string") {
		return content;
	}

	// Array content (Message, ResponseOutputMessageParam)
	if (Array.isArray(content)) {
		return content
			.map((part: unknown) => {
				if (typeof part === "string") return part;
				if (part && typeof part === "object") {
					const p = part as Record<string, unknown>;
					// input_text for user messages
					if (p.type === "input_text" && typeof p.text === "string") {
						return p.text;
					}
				}
				return "";
			})
			.filter(Boolean)
			.join("");
	}

	return "";
}

/**
 * Extract parts from assistant output messages.
 * Handles output_text and refusal content.
 */
function extractAssistantParts(item: RawItem): ContentPart[] {
	const parts: ContentPart[] = [];
	const content = item.content;

	if (!Array.isArray(content)) {
		return parts;
	}

	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const p = part as Record<string, unknown>;

		if (p.type === "output_text" && typeof p.text === "string") {
			parts.push({ type: "text", text: p.text });
		} else if (p.type === "refusal" && typeof p.refusal === "string") {
			parts.push({ type: "text", text: `[Refusal]: ${p.refusal}` });
		}
	}

	return parts;
}

// ---------------------------------------------------------------------------
// Tool Call Extraction
// ---------------------------------------------------------------------------

/**
 * Extract ToolCallPart from function_call items.
 */
function extractFunctionCall(item: RawItem): ToolCallPart | null {
	const name = item.name;
	const args = item.arguments;
	const callId = item.call_id;

	if (typeof name !== "string" || typeof args !== "string") {
		warnDev("function_call missing name or arguments", item);
		return null;
	}

	return {
		type: "tool_call",
		tool_name: name,
		argument: args,
		callId: typeof callId === "string" ? callId : undefined,
	};
}

/**
 * Extract ToolCallPart from web_search_call items.
 */
function extractWebSearchCall(item: RawItem): ToolCallPart | null {
	const action = item.action;
	const id = item.id;

	return {
		type: "tool_call",
		tool_name: "web_search",
		argument: JSON.stringify({ action }),
		callId: typeof id === "string" ? id : undefined,
	};
}

/**
 * Extract ToolCallPart from file_search_call items.
 */
function extractFileSearchCall(item: RawItem): ToolCallPart | null {
	const queries = item.queries;
	const id = item.id;

	return {
		type: "tool_call",
		tool_name: "file_search",
		argument: JSON.stringify({ queries }),
		callId: typeof id === "string" ? id : undefined,
	};
}

/**
 * Extract ToolCallPart from computer_call items.
 */
function extractComputerCall(item: RawItem): ToolCallPart | null {
	const action = item.action;
	const actions = item.actions;
	const callId = item.call_id;

	const payload = action ?? actions ?? {};

	return {
		type: "tool_call",
		tool_name: "computer",
		argument: JSON.stringify({ action: payload }),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

/**
 * Extract ToolCallPart from shell call items.
 */
function extractShellCall(item: RawItem): ToolCallPart | null {
	const action = item.action;
	const callId = item.call_id;

	return {
		type: "tool_call",
		tool_name: "shell",
		argument: JSON.stringify({ action }),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

/**
 * Extract ToolCallPart from code_interpreter_call items.
 */
function extractCodeInterpreterCall(item: RawItem): ToolCallPart | null {
	const code = item.code;
	const id = item.id;

	if (typeof code !== "string") {
		warnDev("code_interpreter_call missing code", item);
		return null;
	}

	return {
		type: "tool_call",
		tool_name: "code_interpreter",
		argument: code,
		callId: typeof id === "string" ? id : undefined,
	};
}

/**
 * Extract placeholder for image_generation_call items.
 */
function extractImageGeneration(_item: RawItem): TextPart {
	return { type: "text", text: "[Image Generated]" };
}

/**
 * Extract reasoning summary from reasoning items.
 */
function extractReasoning(item: RawItem): ReasoningPart {
	const summary = item.summary;

	if (Array.isArray(summary)) {
		const text = summary
			.map((s: unknown) => {
				if (s && typeof s === "object") {
					const sum = s as Record<string, unknown>;
					if (sum.type === "summary_text" && typeof sum.text === "string") {
						return sum.text;
					}
				}
				return "";
			})
			.filter(Boolean)
			.join("\n");

		return { type: "reasoning", text };
	}

	return { type: "reasoning", text: "" };
}

/**
 * Extract ToolCallPart from apply_patch_call items.
 */
function extractApplyPatchCall(item: RawItem): ToolCallPart | null {
	const operation = item.operation;
	const callId = item.call_id;

	return {
		type: "tool_call",
		tool_name: "apply_patch",
		argument: JSON.stringify({ operation }),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

/**
 * Extract ToolCallPart from mcp_call items.
 */
function extractMcpCall(item: RawItem): ToolCallPart | null {
	const name = item.name;
	const args = item.arguments;
	const id = item.id;

	if (typeof name !== "string") {
		warnDev("mcp_call missing name", item);
		return null;
	}

	return {
		type: "tool_call",
		tool_name: name,
		argument: typeof args === "string" ? args : JSON.stringify(args),
		callId: typeof id === "string" ? id : undefined,
	};
}

/**
 * Extract ToolCallPart from custom_tool_call items.
 */
function extractCustomToolCall(item: RawItem): ToolCallPart | null {
	const name = item.name;
	const input = item.input;
	const callId = item.call_id;

	if (typeof name !== "string") {
		warnDev("custom_tool_call missing name", item);
		return null;
	}

	return {
		type: "tool_call",
		tool_name: name,
		argument: typeof input === "string" ? input : JSON.stringify(input),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

// ---------------------------------------------------------------------------
// Tool Output Extraction
// ---------------------------------------------------------------------------

interface ToolOutputResult {
	callId: string | undefined;
	output: string;
}

/**
 * Extract output from function_call_output items.
 */
function extractFunctionCallOutput(item: RawItem): ToolOutputResult | null {
	const output = item.output;
	const callId = item.call_id;

	let text: string;
	if (typeof output === "string") {
		text = output;
	} else if (Array.isArray(output)) {
		text = JSON.stringify(output);
	} else {
		text = String(output);
	}

	return {
		callId: typeof callId === "string" ? callId : undefined,
		output: text,
	};
}

/**
 * Extract output from computer_call_output items.
 */
function extractComputerCallOutput(item: RawItem): ToolOutputResult | null {
	const output = item.output;
	const callId = item.call_id;

	if (output && typeof output === "object") {
		const out = output as Record<string, unknown>;
		if (out.type === "computer_screenshot") {
			return {
				callId: typeof callId === "string" ? callId : undefined,
				output: "[Screenshot captured]",
			};
		}
	}

	return null;
}

/**
 * Extract output from shell/local_shell output items.
 */
function extractShellOutput(item: RawItem): ToolOutputResult | null {
	const output = item.output;
	const id = item.id;

	let text: string;
	if (typeof output === "string") {
		text = output;
	} else if (Array.isArray(output)) {
		// ShellCallOutput with OutputChunk array
		text = output
			.map((chunk: unknown) => {
				if (chunk && typeof chunk === "object") {
					const c = chunk as Record<string, unknown>;
					const parts: string[] = [];
					if (typeof c.stdout === "string" && c.stdout)
						parts.push(`stdout: ${c.stdout}`);
					if (typeof c.stderr === "string" && c.stderr)
						parts.push(`stderr: ${c.stderr}`);
					return parts.join("\n");
				}
				return "";
			})
			.filter(Boolean)
			.join("\n---\n");
	} else {
		text = String(output);
	}

	return { callId: typeof id === "string" ? id : undefined, output: text };
}

/**
 * Extract output from apply_patch_call_output items.
 */
function extractApplyPatchOutput(item: RawItem): ToolOutputResult | null {
	const output = item.output;
	const callId = item.call_id;
	const status = item.status;

	const text = `Status: ${status}${output ? `\n${output}` : ""}`;
	return {
		callId: typeof callId === "string" ? callId : undefined,
		output: text,
	};
}

/**
 * Extract output from custom_tool_call_output items.
 */
function extractCustomToolOutput(item: RawItem): ToolOutputResult | null {
	const output = item.output;
	const callId = item.call_id;

	let text: string;
	if (typeof output === "string") {
		text = output;
	} else if (Array.isArray(output)) {
		text = JSON.stringify(output);
	} else {
		text = String(output);
	}

	return {
		callId: typeof callId === "string" ? callId : undefined,
		output: text,
	};
}

/**
 * Attach a tool output result to the matching ToolCallPart in the current
 * assistant message (matched by callId). If no match is found, the result
 * is silently dropped.
 */
function attachToolResult(
	message: Message<ContentPart> | null,
	result: ToolOutputResult,
): void {
	if (!message) return;

	// Find the matching tool_call part by callId
	if (result.callId) {
		for (let j = message.parts.length - 1; j >= 0; j--) {
			const part = message.parts[j];
			if (part.type === "tool_call" && part.callId === result.callId) {
				(part as ToolCallPart).result = result.output;
				return;
			}
		}
	}

	// Fallback: attach to the last tool_call part without a result
	for (let j = message.parts.length - 1; j >= 0; j--) {
		const part = message.parts[j];
		if (part.type === "tool_call" && !(part as ToolCallPart).result) {
			(part as ToolCallPart).result = result.output;
			return;
		}
	}
}

// ---------------------------------------------------------------------------
// Main Conversion Function
// ---------------------------------------------------------------------------

/**
 * Convert OpenAI Agents SDK response items (TResponseInputItem) into
 * @deltakit/core Message format for use with useStreamChat.
 *
 * This function handles all 28 item types from the OpenAI Agents SDK,
 * mapping them into a simplified Message<ContentPart>[] format suitable
 * for chat UI display.
 *
 * @param items - Raw OpenAI items from JSON deserialization (e.g., from API response)
 * @returns Array of Message objects ready for useStreamChat({ initialMessages })
 *
 * @example
 * ```ts
 * const history = await fetch("/api/chat/history").then(r => r.json());
 * const messages = fromOpenAiAgents(history);
 *
 * const { messages } = useStreamChat({
 *   api: "/api/chat",
 *   initialMessages: messages,
 * });
 * ```
 */
export function fromOpenAiAgents(items: RawItem[]): Message<ContentPart>[] {
	const messages: Message<ContentPart>[] = [];
	let currentAssistantMessage: Message<ContentPart> | null = null;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];

		if (!item || typeof item !== "object") {
			warnDev(`Skipping non-object item at index ${i}`, item);
			continue;
		}

		const type = item.type;

		// Handle items without a `type` field but with a `role` field.
		// The OpenAI Agents SDK stores user input as EasyInputMessageParam:
		// { role: "user", content: "hello" } — no `type` field.
		if (typeof type !== "string") {
			const role = item.role;
			if (
				typeof role === "string" &&
				(role === "user" ||
					role === "assistant" ||
					role === "system" ||
					role === "developer")
			) {
				// Treat as a message item
				if (role === "user") {
					if (currentAssistantMessage) {
						messages.push(currentAssistantMessage);
						currentAssistantMessage = null;
					}
					const text = extractUserText(item);
					if (text) {
						messages.push({
							id: extractId(item, i),
							role: "user",
							parts: [{ type: "text", text }],
						});
					}
				} else if (role === "assistant") {
					const parts = extractAssistantParts(item);
					if (currentAssistantMessage) {
						currentAssistantMessage.parts.push(...parts);
					} else {
						currentAssistantMessage = {
							id: extractId(item, i),
							role: "assistant",
							parts: parts.length > 0 ? parts : [],
						};
					}
				}
				// Skip system/developer
				continue;
			}

			warnDev(`Skipping item without type at index ${i}`, item);
			continue;
		}

		// Handle message items (user, assistant, system, developer)
		if (type === "message") {
			const role = item.role;

			if (role === "user") {
				// Finalize any current assistant message
				if (currentAssistantMessage) {
					messages.push(currentAssistantMessage);
					currentAssistantMessage = null;
				}

				const text = extractUserText(item);
				if (text) {
					messages.push({
						id: extractId(item, i),
						role: "user",
						parts: [{ type: "text", text }],
					});
				}
			} else if (role === "assistant") {
				const parts = extractAssistantParts(item);

				if (currentAssistantMessage) {
					// Merge into existing assistant message (e.g. reasoning + text)
					currentAssistantMessage.parts.push(...parts);
				} else {
					currentAssistantMessage = {
						id: extractId(item, i),
						role: "assistant",
						parts: parts.length > 0 ? parts : [],
					};
				}
			} else if (role === "system" || role === "developer") {
				// Skip system/developer messages (not displayable in chat UI)
				continue;
			} else {
				warnDev(`Unknown message role: ${role}`, item);
			}

			continue;
		}

		// Handle tool calls (append to current assistant message or create new one)
		let toolCallPart: ToolCallPart | null = null;

		switch (type) {
			case "function_call":
				toolCallPart = extractFunctionCall(item);
				break;
			case "web_search_call":
				toolCallPart = extractWebSearchCall(item);
				break;
			case "file_search_call":
				toolCallPart = extractFileSearchCall(item);
				break;
			case "computer_call":
				toolCallPart = extractComputerCall(item);
				break;
			case "local_shell_call":
			case "shell_call":
				toolCallPart = extractShellCall(item);
				break;
			case "code_interpreter_call":
				toolCallPart = extractCodeInterpreterCall(item);
				break;
			case "apply_patch_call":
				toolCallPart = extractApplyPatchCall(item);
				break;
			case "mcp_call":
				toolCallPart = extractMcpCall(item);
				break;
			case "custom_tool_call":
				toolCallPart = extractCustomToolCall(item);
				break;
			case "image_generation_call":
				// Special case: image generation becomes a text part
				if (!currentAssistantMessage) {
					currentAssistantMessage = {
						id: extractId(item, i),
						role: "assistant",
						parts: [],
					};
				}
				currentAssistantMessage.parts.push(extractImageGeneration(item));
				continue;
			case "reasoning":
				if (!currentAssistantMessage) {
					currentAssistantMessage = {
						id: extractId(item, i),
						role: "assistant",
						parts: [],
					};
				}
				currentAssistantMessage.parts.push(extractReasoning(item));
				continue;
		}

		if (toolCallPart) {
			if (!currentAssistantMessage) {
				currentAssistantMessage = {
					id: extractId(item, i),
					role: "assistant",
					parts: [],
				};
			}
			currentAssistantMessage.parts.push(toolCallPart);
			continue;
		}

		// Handle tool outputs — attach result to the matching tool_call part
		let toolOutput: ToolOutputResult | null = null;

		switch (type) {
			case "function_call_output":
				toolOutput = extractFunctionCallOutput(item);
				break;
			case "computer_call_output":
				toolOutput = extractComputerCallOutput(item);
				break;
			case "local_shell_call_output":
			case "shell_call_output":
				toolOutput = extractShellOutput(item);
				break;
			case "apply_patch_call_output":
				toolOutput = extractApplyPatchOutput(item);
				break;
			case "custom_tool_call_output":
				toolOutput = extractCustomToolOutput(item);
				break;
		}

		if (toolOutput) {
			attachToolResult(currentAssistantMessage, toolOutput);
			continue;
		}

		// Handle internal/skip types silently
		switch (type) {
			case "mcp_list_tools":
			case "mcp_approval_request":
			case "mcp_approval_response":
			case "compaction":
			case "item_reference":
			case "tool_search_call":
			case "tool_search_output":
				// Internal items, silently skip
				continue;
		}

		// Unknown type
		warnDev(`Unknown item type: ${type}`, item);
	}

	// Don't forget to push the last assistant message
	if (currentAssistantMessage) {
		messages.push(currentAssistantMessage);
	}

	return messages;
}
