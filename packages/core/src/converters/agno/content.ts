import type { ReasoningPart } from "../../types";
import type { AgnoMessage } from "./shared";

export function extractTextContent(msg: AgnoMessage): string {
	const content = msg.content;

	if (typeof content === "string") {
		return content;
	}

	if (content === null || content === undefined) {
		return "";
	}

	return String(content);
}

export function extractReasoning(msg: AgnoMessage): ReasoningPart | null {
	const reasoning = msg.reasoning_content;

	if (typeof reasoning === "string" && reasoning) {
		return { type: "reasoning", text: reasoning };
	}

	return null;
}
