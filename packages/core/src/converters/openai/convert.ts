import type { ContentPart, Message, ToolCallPart } from "../../types";
import {
	extractAssistantParts,
	extractImageGeneration,
	extractReasoning,
	extractUserText,
} from "./content";
import { extractId, type RawItem, warnDev } from "./shared";
import {
	extractApplyPatchCall,
	extractCodeInterpreterCall,
	extractComputerCall,
	extractCustomToolCall,
	extractFileSearchCall,
	extractFunctionCall,
	extractMcpCall,
	extractShellCall,
	extractWebSearchCall,
} from "./tool-calls";
import {
	attachToolResult,
	extractApplyPatchOutput,
	extractComputerCallOutput,
	extractCustomToolOutput,
	extractFunctionCallOutput,
	extractShellOutput,
	type ToolOutputResult,
} from "./tool-results";

function createAssistantMessage(
	item: RawItem,
	fallbackIndex: number,
	parts: ContentPart[] = [],
): Message<ContentPart> {
	return {
		id: extractId(item, fallbackIndex),
		role: "assistant",
		parts,
	};
}

export function fromOpenAiAgents(items: RawItem[]): Message<ContentPart>[] {
	const messages: Message<ContentPart>[] = [];
	let currentAssistantMessage: Message<ContentPart> | null = null;

	for (let index = 0; index < items.length; index++) {
		const item = items[index];

		if (!item || typeof item !== "object") {
			warnDev(`Skipping non-object item at index ${index}`, item);
			continue;
		}

		const type = item.type;

		if (typeof type !== "string") {
			const role = item.role;
			if (
				typeof role === "string" &&
				(role === "user" ||
					role === "assistant" ||
					role === "system" ||
					role === "developer")
			) {
				if (role === "user") {
					if (currentAssistantMessage) {
						messages.push(currentAssistantMessage);
						currentAssistantMessage = null;
					}

					const text = extractUserText(item);
					if (text) {
						messages.push({
							id: extractId(item, index),
							role: "user",
							parts: [{ type: "text", text }],
						});
					}
				} else if (role === "assistant") {
					const parts = extractAssistantParts(item);
					if (currentAssistantMessage) {
						currentAssistantMessage.parts.push(...parts);
					} else {
						currentAssistantMessage = createAssistantMessage(
							item,
							index,
							parts,
						);
					}
				}
				continue;
			}

			warnDev(`Skipping item without type at index ${index}`, item);
			continue;
		}

		if (type === "message") {
			const role = item.role;

			if (role === "user") {
				if (currentAssistantMessage) {
					messages.push(currentAssistantMessage);
					currentAssistantMessage = null;
				}

				const text = extractUserText(item);
				if (text) {
					messages.push({
						id: extractId(item, index),
						role: "user",
						parts: [{ type: "text", text }],
					});
				}
			} else if (role === "assistant") {
				const parts = extractAssistantParts(item);
				if (currentAssistantMessage) {
					currentAssistantMessage.parts.push(...parts);
				} else {
					currentAssistantMessage = createAssistantMessage(item, index, parts);
				}
			} else if (role !== "system" && role !== "developer") {
				warnDev(`Unknown message role: ${role}`, item);
			}

			continue;
		}

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
				if (!currentAssistantMessage) {
					currentAssistantMessage = createAssistantMessage(item, index);
				}
				currentAssistantMessage.parts.push(extractImageGeneration(item));
				continue;
			case "reasoning":
				if (!currentAssistantMessage) {
					currentAssistantMessage = createAssistantMessage(item, index);
				}
				currentAssistantMessage.parts.push(extractReasoning(item));
				continue;
		}

		if (toolCallPart) {
			if (!currentAssistantMessage) {
				currentAssistantMessage = createAssistantMessage(item, index);
			}
			currentAssistantMessage.parts.push(toolCallPart);
			continue;
		}

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

		switch (type) {
			case "mcp_list_tools":
			case "mcp_approval_request":
			case "mcp_approval_response":
			case "compaction":
			case "item_reference":
			case "tool_search_call":
			case "tool_search_output":
				continue;
		}

		warnDev(`Unknown item type: ${type}`, item);
	}

	if (currentAssistantMessage) {
		messages.push(currentAssistantMessage);
	}

	return messages;
}
