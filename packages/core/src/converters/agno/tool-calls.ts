import type { ToolCallPart } from "../../types";
import type { AgnoMessage, AgnoToolCall } from "./shared";
import { warnDev } from "./shared";

export function extractToolCalls(msg: AgnoMessage): ToolCallPart[] {
	const parts: ToolCallPart[] = [];
	const toolCalls = msg.tool_calls;

	if (!Array.isArray(toolCalls)) {
		return parts;
	}

	for (const entry of toolCalls) {
		if (!entry || typeof entry !== "object") continue;

		const toolCall = entry as AgnoToolCall;
		const fn = toolCall.function;
		if (!fn) continue;

		if (typeof fn.name !== "string") {
			warnDev("tool_call missing name", msg);
			continue;
		}

		parts.push({
			type: "tool_call",
			tool_name: fn.name,
			argument:
				typeof fn.arguments === "string"
					? fn.arguments
					: JSON.stringify(fn.arguments),
			callId: typeof toolCall.id === "string" ? toolCall.id : undefined,
		});
	}

	return parts;
}
