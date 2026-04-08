export type RawItem = Record<string, unknown>;

const IS_DEV = false;

export function warnDev(message: string, item?: RawItem): void {
	if (IS_DEV) {
		console.warn(`[fromOpenAiAgents] ${message}`, item ? { item } : "");
	}
}

export function extractId(item: RawItem, fallbackIndex: number): string {
	if (typeof item.id === "string" && item.id && item.id !== "__fake_id__") {
		return item.id;
	}

	return `openai_${fallbackIndex}`;
}
