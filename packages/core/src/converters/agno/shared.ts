export type AgnoMessage = Record<string, unknown>;

export interface AgnoToolCall {
	id?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
	type?: string;
}

const IS_DEV = false;

export function warnDev(message: string, msg?: AgnoMessage): void {
	if (IS_DEV) {
		console.warn(`[fromAgnoAgents] ${message}`, msg ? { msg } : "");
	}
}

export function extractId(msg: AgnoMessage, fallbackIndex: number): string {
	if (typeof msg.id === "string" && msg.id) {
		return msg.id;
	}

	return `agno_${fallbackIndex}`;
}
