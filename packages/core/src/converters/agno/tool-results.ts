import type { ContentPart, Message, ToolCallPart } from "../../types";
import type { AgnoMessage } from "./shared";
import { warnDev } from "./shared";

export interface ToolResultMatch {
	callId: string | undefined;
	output: string;
}

export function extractToolResult(msg: AgnoMessage): ToolResultMatch | null {
	const content = msg.content;

	if (
		typeof content !== "string" &&
		content !== null &&
		content !== undefined
	) {
		warnDev("tool message has non-string content", msg);
	}

	return {
		callId: undefined,
		output: typeof content === "string" ? content : String(content ?? ""),
	};
}

export function attachToolResult(
	message: Message<ContentPart> | null,
	result: ToolResultMatch,
	toolName: string,
): void {
	if (!message) return;

	for (let index = message.parts.length - 1; index >= 0; index--) {
		const part = message.parts[index];
		if (
			part.type === "tool_call" &&
			part.tool_name === toolName &&
			!(part as ToolCallPart).result
		) {
			(part as ToolCallPart).result = result.output;
			return;
		}
	}
}
