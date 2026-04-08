import type { ContentPart, SSEEvent } from "@deltakit/core";
import type {
	ChatTransport,
	ChatTransportContext,
	WebSocketTransportOptions,
} from "../../types";
import { resolveUrl, toError } from "./shared";

function defaultParseWebSocketMessage<TEvent extends { type: string }>(
	data: unknown,
): TEvent | TEvent[] | null {
	if (typeof data !== "string") {
		return null;
	}

	return JSON.parse(data) as TEvent | TEvent[];
}

function attachSocketLifecycle<
	TPart extends { type: string },
	TEvent extends { type: string },
>(
	socket: WebSocket,
	context: ChatTransportContext<TPart, TEvent>,
	parseMessage: (data: unknown) => TEvent | TEvent[] | null,
	resolveRunId: ((event: TEvent) => string | null) | undefined,
	onResolvedRunId: (runId: string | null) => void,
	onManualCloseState: () => boolean,
): void {
	socket.onmessage = (event) => {
		try {
			const parsed = parseMessage(event.data);
			const events = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
			for (const item of events) {
				const nextRunId = resolveRunId?.(item) ?? null;
				if (nextRunId) {
					onResolvedRunId(nextRunId);
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
		} catch (error) {
			context.fail(toError(error));
		}
	};

	socket.onerror = () => {
		context.fail(new Error("WebSocket connection failed"));
	};

	socket.onclose = () => {
		if (!onManualCloseState()) {
			context.finish();
		}
	};
}

export function createWebSocketTransport<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(config: WebSocketTransportOptions<TEvent>): ChatTransport<TPart, TEvent> {
	const parseMessage = config.parseMessage ?? defaultParseWebSocketMessage;
	const serializeMessage = config.serializeMessage ?? JSON.stringify;
	let resolvedRunId: string | null = null;

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
			attachSocketLifecycle(
				socket,
				context,
				parseMessage,
				config.resolveRunId,
				(nextRunId) => {
					resolvedRunId = nextRunId;
				},
				() => manuallyClosed,
			);
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
			attachSocketLifecycle(
				socket,
				context,
				parseMessage,
				config.resolveRunId,
				(nextRunId) => {
					resolvedRunId = nextRunId;
				},
				() => manuallyClosed,
			);
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
