import type { ToolCallPart } from "../../types";
import type { RawItem } from "./shared";
import { warnDev } from "./shared";

export function extractFunctionCall(item: RawItem): ToolCallPart | null {
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

export function extractWebSearchCall(item: RawItem): ToolCallPart | null {
	const action = item.action;
	const id = item.id;

	return {
		type: "tool_call",
		tool_name: "web_search",
		argument: JSON.stringify({ action }),
		callId: typeof id === "string" ? id : undefined,
	};
}

export function extractFileSearchCall(item: RawItem): ToolCallPart | null {
	const queries = item.queries;
	const id = item.id;

	return {
		type: "tool_call",
		tool_name: "file_search",
		argument: JSON.stringify({ queries }),
		callId: typeof id === "string" ? id : undefined,
	};
}

export function extractComputerCall(item: RawItem): ToolCallPart | null {
	const action = item.action;
	const actions = item.actions;
	const callId = item.call_id;

	return {
		type: "tool_call",
		tool_name: "computer",
		argument: JSON.stringify({ action: action ?? actions ?? {} }),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

export function extractShellCall(item: RawItem): ToolCallPart | null {
	const action = item.action;
	const callId = item.call_id;

	return {
		type: "tool_call",
		tool_name: "shell",
		argument: JSON.stringify({ action }),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

export function extractCodeInterpreterCall(item: RawItem): ToolCallPart | null {
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

export function extractApplyPatchCall(item: RawItem): ToolCallPart | null {
	const operation = item.operation;
	const callId = item.call_id;

	return {
		type: "tool_call",
		tool_name: "apply_patch",
		argument: JSON.stringify({ operation }),
		callId: typeof callId === "string" ? callId : undefined,
	};
}

export function extractMcpCall(item: RawItem): ToolCallPart | null {
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

export function extractCustomToolCall(item: RawItem): ToolCallPart | null {
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
