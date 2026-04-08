import type { ContentPart, SSEEvent } from "@deltakit/core";
import type {
	BackgroundSSETransportOptions,
	ChatTransport,
	ChatTransportContext,
	ChatTransportRun,
} from "../../types";
import {
	isAbortError,
	resolveRunId,
	resolveUrl,
	streamFetchSSE,
	toError,
} from "./shared";

function connectBackgroundRun<
	TPart extends { type: string },
	TEvent extends { type: string },
>(
	config: BackgroundSSETransportOptions,
	fetchImpl: typeof fetch,
	runId: string,
	context: ChatTransportContext<TPart, TEvent>,
): ChatTransportRun {
	const controller = new AbortController();

	void (async () => {
		try {
			context.ensureAssistantMessage();
			const response = await fetchImpl(resolveUrl(config.eventsApi, runId), {
				headers: config.eventHeaders,
				method: "GET",
				signal: controller.signal,
			});
			await streamFetchSSE(response, context, controller.signal);
			context.finish();
		} catch (error) {
			if (!isAbortError(error)) {
				context.fail(toError(error));
			}
		}
	})();

	return {
		close: () => {
			controller.abort();
		},
		stop: () => {
			controller.abort();
			if (config.cancelApi) {
				void fetchImpl(resolveUrl(config.cancelApi, runId), {
					method: "POST",
				});
			}
		},
		runId,
	};
}

export function createBackgroundSSETransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(config: BackgroundSSETransportOptions): ChatTransport<TPart, TEvent> {
	const fetchImpl = config.fetch ?? fetch;

	return {
		resume: ({ context, runId }) => {
			context.setRunId(runId);
			return connectBackgroundRun(config, fetchImpl, runId, context);
		},
		start: ({ context, message }) => {
			const startController = new AbortController();
			let activeRun: ChatTransportRun | undefined;

			void (async () => {
				try {
					const response = await fetchImpl(config.startApi, {
						body: JSON.stringify({ message, ...config.startBody }),
						headers: {
							"Content-Type": "application/json",
							...config.startHeaders,
						},
						method: config.startMethod ?? "POST",
						signal: startController.signal,
					});

					if (!response.ok) {
						throw new Error(
							`Background SSE start failed: ${response.status} ${response.statusText}`,
						);
					}

					const data = (await response.json()) as unknown;
					const runId = (config.resolveRunId ?? resolveRunId)(data);
					context.setRunId(runId);
					activeRun = connectBackgroundRun(config, fetchImpl, runId, context);
				} catch (error) {
					if (!isAbortError(error)) {
						context.fail(toError(error));
					}
				}
			})();

			return {
				close: () => {
					startController.abort();
					void activeRun?.close?.();
				},
				stop: () => {
					startController.abort();
					activeRun?.stop?.();
				},
				runId: null,
			};
		},
	};
}
