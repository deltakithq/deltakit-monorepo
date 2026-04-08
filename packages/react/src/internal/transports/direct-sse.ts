import type { ContentPart, SSEEvent } from "@deltakit/core";
import type {
	ChatTransport,
	ChatTransportRun,
	DirectSSETransportOptions,
} from "../../types";
import { isAbortError, streamFetchSSE, toError } from "./shared";

export function createDirectSSETransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(config: DirectSSETransportOptions): ChatTransport<TPart, TEvent> {
	return {
		start: ({ context, message }) => {
			const controller = new AbortController();
			const run: ChatTransportRun = {
				close: () => {
					controller.abort();
				},
				stop: () => {
					controller.abort();
				},
			};

			const fetchImpl = config.fetch ?? fetch;

			void (async () => {
				try {
					const response = await fetchImpl(config.api, {
						body: JSON.stringify({ message, ...config.body }),
						headers: {
							"Content-Type": "application/json",
							...config.headers,
						},
						method: config.method ?? "POST",
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

			return run;
		},
	};
}
