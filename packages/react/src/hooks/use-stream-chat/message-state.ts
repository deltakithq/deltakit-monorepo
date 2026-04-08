import type { Message } from "@deltakit/core";

export function appendTextToMessages<TPart extends { type: string }>(
	prev: Message<TPart>[],
	delta: string,
): Message<TPart>[] {
	const last = prev[prev.length - 1];
	if (!last || last.role !== "assistant") return prev;

	const parts = [...last.parts];
	const lastPart = parts[parts.length - 1];

	if (lastPart && lastPart.type === "text" && "text" in lastPart) {
		const textPart = lastPart as { type: "text"; text: string };
		parts[parts.length - 1] = {
			...lastPart,
			text: textPart.text + delta,
		} as unknown as TPart;
	} else {
		parts.push({ type: "text", text: delta } as unknown as TPart);
	}

	return [...prev.slice(0, -1), { ...last, parts }];
}

export function appendPartToMessages<TPart extends { type: string }>(
	prev: Message<TPart>[],
	part: TPart,
): Message<TPart>[] {
	const last = prev[prev.length - 1];
	if (!last || last.role !== "assistant") return prev;

	return [
		...prev.slice(0, -1),
		{
			...last,
			parts: [...last.parts, part],
		},
	];
}
