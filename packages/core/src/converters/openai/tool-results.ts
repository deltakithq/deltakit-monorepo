import type { ContentPart, Message, ToolCallPart } from "../../types";
import type { RawItem } from "./shared";

export interface ToolOutputResult {
	callId: string | undefined;
	output: string;
}

export function extractFunctionCallOutput(
	item: RawItem,
): ToolOutputResult | null {
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

export function extractComputerCallOutput(
	item: RawItem,
): ToolOutputResult | null {
	const output = item.output;
	const callId = item.call_id;

	if (output && typeof output === "object") {
		const parsed = output as Record<string, unknown>;
		if (parsed.type === "computer_screenshot") {
			return {
				callId: typeof callId === "string" ? callId : undefined,
				output: "[Screenshot captured]",
			};
		}
	}

	return null;
}

export function extractShellOutput(item: RawItem): ToolOutputResult | null {
	const output = item.output;
	const id = item.id;

	let text: string;
	if (typeof output === "string") {
		text = output;
	} else if (Array.isArray(output)) {
		text = output
			.map((chunk: unknown) => {
				if (chunk && typeof chunk === "object") {
					const parsed = chunk as Record<string, unknown>;
					const parts: string[] = [];
					if (typeof parsed.stdout === "string" && parsed.stdout) {
						parts.push(`stdout: ${parsed.stdout}`);
					}
					if (typeof parsed.stderr === "string" && parsed.stderr) {
						parts.push(`stderr: ${parsed.stderr}`);
					}
					return parts.join("\n");
				}
				return "";
			})
			.filter(Boolean)
			.join("\n---\n");
	} else {
		text = String(output);
	}

	return {
		callId: typeof id === "string" ? id : undefined,
		output: text,
	};
}

export function extractApplyPatchOutput(
	item: RawItem,
): ToolOutputResult | null {
	const output = item.output;
	const callId = item.call_id;
	const status = item.status;

	return {
		callId: typeof callId === "string" ? callId : undefined,
		output: `Status: ${status}${output ? `\n${output}` : ""}`,
	};
}

export function extractCustomToolOutput(
	item: RawItem,
): ToolOutputResult | null {
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

export function attachToolResult(
	message: Message<ContentPart> | null,
	result: ToolOutputResult,
): void {
	if (!message) return;

	if (result.callId) {
		for (let index = message.parts.length - 1; index >= 0; index--) {
			const part = message.parts[index];
			if (part.type === "tool_call" && part.callId === result.callId) {
				(part as ToolCallPart).result = result.output;
				return;
			}
		}
	}

	for (let index = message.parts.length - 1; index >= 0; index--) {
		const part = message.parts[index];
		if (part.type === "tool_call" && !(part as ToolCallPart).result) {
			(part as ToolCallPart).result = result.output;
			return;
		}
	}
}
