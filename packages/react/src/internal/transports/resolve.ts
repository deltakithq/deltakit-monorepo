import type { ContentPart, SSEEvent } from "@deltakit/core";
import type { ChatTransport, UseStreamChatOptions } from "../../types";
import { createBackgroundSSETransport } from "./background-sse";
import { createDirectSSETransport } from "./direct-sse";
import { createWebSocketTransport } from "./websocket";

export function resolveTransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(options: UseStreamChatOptions<TPart, TEvent>): ChatTransport<TPart, TEvent> {
	if (typeof options.transport === "object" && options.transport) {
		return options.transport;
	}

	const transportKind = options.transport ?? "sse";

	if (transportKind === "background-sse") {
		const config = options.transportOptions?.backgroundSSE;
		if (!config) {
			throw new Error(
				'`transportOptions.backgroundSSE` is required when transport is "background-sse"',
			);
		}
		return createBackgroundSSETransport(config);
	}

	if (transportKind === "websocket") {
		const config = options.transportOptions?.websocket;
		if (!config) {
			throw new Error(
				'`transportOptions.websocket` is required when transport is "websocket"',
			);
		}
		return createWebSocketTransport(config);
	}

	const sseConfig = options.transportOptions?.sse ?? {
		api: options.api,
		body: options.body,
		headers: options.headers,
	};

	if (!sseConfig.api) {
		throw new Error(
			"`api` or `transportOptions.sse.api` is required when using the default SSE transport",
		);
	}

	return createDirectSSETransport({
		...sseConfig,
		api: sseConfig.api,
	});
}
