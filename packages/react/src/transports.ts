import type { ContentPart, SSEEvent } from "@deltakit/core";
import { parseSSEStream } from "@deltakit/core";
import type {
	BackgroundSSETransportOptions,
	ChatTransport,
	ChatTransportContext,
	ChatTransportRun,
	DirectSSETransportOptions,
	UseStreamChatOptions,
	WebSocketTransportOptions,
} from "./types";

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function resolveRunId(response: unknown): string {
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

function resolveUrl(
	url: string | ((runId: string) => string),
	runId: string,
): string {
	return typeof url === "function" ? url(runId) : url.replace(":runId", runId);
}

async function streamFetchSSE<
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

export function createBackgroundSSETransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(config: BackgroundSSETransportOptions): ChatTransport<TPart, TEvent> {
	const fetchImpl = config.fetch ?? fetch;

	const connect = (
		runId: string,
		context: ChatTransportContext<TPart, TEvent>,
	): ChatTransportRun => {
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
	};

	return {
		resume: ({ context, runId }) => {
			context.setRunId(runId);
			return connect(runId, context);
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
					activeRun = connect(runId, context);
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

function defaultParseWebSocketMessage<TEvent extends { type: string }>(
	data: unknown,
): TEvent | TEvent[] | null {
	if (typeof data !== "string") {
		return null;
	}

	const parsed = JSON.parse(data) as TEvent | TEvent[];
	return parsed;
}

export function createWebSocketTransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(config: WebSocketTransportOptions<TEvent>): ChatTransport<TPart, TEvent> {
	const parseMessage = config.parseMessage ?? defaultParseWebSocketMessage;
	const serializeMessage = config.serializeMessage ?? JSON.stringify;

	let resolvedRunId: string | null = null;

	const applyIncomingEvents = (
		parsed: TEvent | TEvent[] | null,
		context: ChatTransportContext<TPart, TEvent>,
	) => {
		const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
		for (const item of events) {
			const nextRunId = config.resolveRunId?.(item) ?? null;
			if (nextRunId) {
				resolvedRunId = nextRunId;
				context.setRunId(nextRunId);
			}
			context.emit(item);

			if (item.type === "done") {
				context.finish();
			} else if (item.type === "error") {
				context.fail(
					new Error(
						"message" in item && typeof item.message === "string"
							? item.message
							: "Stream error",
					),
				);
			}
		}
	};

	return {
		resume: ({ context, runId }) => {
			context.setRunId(runId);
			context.ensureAssistantMessage();

			const socket = new WebSocket(
				typeof config.url === "function" ? config.url(runId) : config.url,
				config.protocols,
			);
			let manuallyClosed = false;
			let sentResumePayload = false;

			const sendResumePayload = () => {
				if (sentResumePayload || socket.readyState !== WebSocket.OPEN) {
					return;
				}
				sentResumePayload = true;
				const payload =
					config.buildResumePayload?.(runId) ??
					({ [config.runIdKey ?? "runId"]: runId } as Record<string, unknown>);
				socket.send(serializeMessage(payload));
			};

			socket.onopen = sendResumePayload;

			socket.onmessage = (event) => {
				try {
					applyIncomingEvents(parseMessage(event.data), context);
				} catch (error) {
					context.fail(toError(error));
				}
			};

			socket.onerror = () => {
				context.fail(new Error("WebSocket connection failed"));
			};

			socket.onclose = () => {
				if (!manuallyClosed) {
					context.finish();
				}
			};

			queueMicrotask(sendResumePayload);

			return {
				close: () => {
					manuallyClosed = true;
					socket.close();
				},
				stop: () => {
					manuallyClosed = true;
					const stopRunId = resolvedRunId ?? runId;
					if (stopRunId && config.cancelUrl) {
						void fetch(resolveUrl(config.cancelUrl, stopRunId), {
							method: "POST",
						});
					}
					socket.close();
				},
				runId,
			};
		},
		start: ({ context, message }) => {
			const runId = config.runId ?? config.getResumeKey?.() ?? null;
			const socket = new WebSocket(
				typeof config.url === "function" ? config.url(runId) : config.url,
				config.protocols,
			);
			let manuallyClosed = false;
			let sentStartPayload = false;

			const sendStartPayload = () => {
				if (sentStartPayload || socket.readyState !== WebSocket.OPEN) {
					return;
				}
				sentStartPayload = true;
				context.ensureAssistantMessage();
				const payload: Record<string, unknown> = {
					message,
					...config.body,
				};

				if (runId) {
					payload[config.runIdKey ?? "runId"] = runId;
				}

				socket.send(serializeMessage(payload));
			};

			socket.onopen = sendStartPayload;

			socket.onmessage = (event) => {
				try {
					applyIncomingEvents(parseMessage(event.data), context);
				} catch (error) {
					context.fail(toError(error));
				}
			};

			socket.onerror = () => {
				context.fail(new Error("WebSocket connection failed"));
			};

			socket.onclose = () => {
				if (!manuallyClosed) {
					context.finish();
				}
			};

			queueMicrotask(sendStartPayload);

			return {
				close: () => {
					manuallyClosed = true;
					socket.close();
				},
				stop: () => {
					manuallyClosed = true;
					const stopRunId = resolvedRunId ?? runId;
					if (stopRunId && config.cancelUrl) {
						void fetch(resolveUrl(config.cancelUrl, stopRunId), {
							method: "POST",
						});
					}
					socket.close();
				},
				runId,
			};
		},
	};
}

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
