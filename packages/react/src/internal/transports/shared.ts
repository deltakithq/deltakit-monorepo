import { parseSSEStream } from "@deltakit/core";
import type { ChatTransportContext } from "../../types";

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

export function resolveRunId(response: unknown): string {
	if (!response || typeof response !== "object") {
		throw new Error("Background SSE start response did not contain a run id");
	}

	const maybeRunId =
		"runId" in response
			? response.runId
			: "job_id" in response
				? response.job_id
				: null;

	if (typeof maybeRunId !== "string" || maybeRunId.length === 0) {
		throw new Error("Background SSE start response did not contain a run id");
	}

	return maybeRunId;
}

export function resolveUrl(
	url: string | ((runId: string) => string),
	runId: string,
): string {
	return typeof url === "function" ? url(runId) : url.replace(":runId", runId);
}

export async function streamFetchSSE<
	TPart extends { type: string },
	TEvent extends { type: string },
>(
	response: Response,
	context: ChatTransportContext<TPart, TEvent>,
	signal: AbortSignal,
): Promise<void> {
	if (!response.ok) {
		throw new Error(
			`SSE request failed: ${response.status} ${response.statusText}`,
		);
	}

	if (!response.body) {
		throw new Error("Response body is null — SSE streaming not supported");
	}

	for await (const event of parseSSEStream(response.body, signal)) {
		context.emit(event as unknown as TEvent);
	}
}
