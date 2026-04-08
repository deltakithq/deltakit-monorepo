import type { ContentPart, Message } from "../../types";
import { extractReasoning, extractTextContent } from "./content";
import { type AgnoMessage, extractId, warnDev } from "./shared";
import { extractToolCalls } from "./tool-calls";
import { attachToolResult, extractToolResult } from "./tool-results";

export function fromAgnoAgents(
	messages: AgnoMessage[],
): Message<ContentPart>[] {
	const result: Message<ContentPart>[] = [];
	let currentAssistantMessage: Message<ContentPart> | null = null;

	for (let index = 0; index < messages.length; index++) {
		const msg = messages[index];

		if (!msg || typeof msg !== "object") {
			warnDev(`Skipping non-object message at index ${index}`, msg);
			continue;
		}

		const role = msg.role;
		if (typeof role !== "string") {
			warnDev(`Skipping message without role at index ${index}`, msg);
			continue;
		}

		if (role === "user") {
			if (currentAssistantMessage) {
				result.push(currentAssistantMessage);
				currentAssistantMessage = null;
			}

			const text = extractTextContent(msg);
			if (text) {
				result.push({
					id: extractId(msg, index),
					role: "user",
					parts: [{ type: "text", text }],
				});
			}
			continue;
		}

		if (role === "assistant") {
			const parts: ContentPart[] = [];
			const reasoning = extractReasoning(msg);
			if (reasoning) {
				parts.push(reasoning);
			}

			const toolCalls = extractToolCalls(msg);
			if (toolCalls.length > 0) {
				parts.push(...toolCalls);
			}

			const text = extractTextContent(msg);
			if (text) {
				parts.push({ type: "text", text });
			}

			if (parts.length > 0) {
				if (currentAssistantMessage) {
					currentAssistantMessage.parts.push(...parts);
				} else {
					currentAssistantMessage = {
						id: extractId(msg, index),
						role: "assistant",
						parts,
					};
				}
			}
			continue;
		}

		if (role === "tool") {
			const toolResult = extractToolResult(msg);
			const toolName = msg.tool_name;

			if (toolResult && typeof toolName === "string") {
				attachToolResult(currentAssistantMessage, toolResult, toolName);
			}
			continue;
		}

		warnDev(`Unknown message role: ${role}`, msg);
	}

	if (currentAssistantMessage) {
		result.push(currentAssistantMessage);
	}

	return result;
}
