import type { UseStreamChatOptions } from "../../types";

export function getCandidateRunId<
	TPart extends { type: string },
	TEvent extends { type: string },
>(options: UseStreamChatOptions<TPart, TEvent>): string | null {
	return (
		options.transportOptions?.backgroundSSE?.runId ??
		options.transportOptions?.backgroundSSE?.getResumeKey?.() ??
		options.transportOptions?.websocket?.runId ??
		options.transportOptions?.websocket?.getResumeKey?.() ??
		null
	);
}
