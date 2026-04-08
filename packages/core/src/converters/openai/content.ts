import type { ContentPart, ReasoningPart, TextPart } from "../../types";
import type { RawItem } from "./shared";

export function extractUserText(item: RawItem): string {
	const content = item.content;

	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part: unknown) => {
				if (typeof part === "string") return part;
				if (part && typeof part === "object") {
					const parsed = part as Record<string, unknown>;
					if (parsed.type === "input_text" && typeof parsed.text === "string") {
						return parsed.text;
					}
				}
				return "";
			})
			.filter(Boolean)
			.join("");
	}

	return "";
}

export function extractAssistantParts(item: RawItem): ContentPart[] {
	const parts: ContentPart[] = [];
	const content = item.content;

	if (!Array.isArray(content)) {
		return parts;
	}

	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const parsed = part as Record<string, unknown>;

		if (parsed.type === "output_text" && typeof parsed.text === "string") {
			parts.push({ type: "text", text: parsed.text });
		} else if (
			parsed.type === "refusal" &&
			typeof parsed.refusal === "string"
		) {
			parts.push({ type: "text", text: `[Refusal]: ${parsed.refusal}` });
		}
	}

	return parts;
}

export function extractImageGeneration(_item: RawItem): TextPart {
	return { type: "text", text: "[Image Generated]" };
}

export function extractReasoning(item: RawItem): ReasoningPart {
	const summary = item.summary;

	if (Array.isArray(summary)) {
		const text = summary
			.map((entry: unknown) => {
				if (entry && typeof entry === "object") {
					const parsed = entry as Record<string, unknown>;
					if (
						parsed.type === "summary_text" &&
						typeof parsed.text === "string"
					) {
						return parsed.text;
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
