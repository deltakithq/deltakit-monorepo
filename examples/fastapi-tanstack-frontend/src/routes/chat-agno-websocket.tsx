import { StreamingMarkdown } from "@deltakit/markdown";
import {
	type ContentPart,
	fromAgnoAgents,
	type Message,
	useAutoScroll,
	useStreamChat,
} from "@deltakit/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ToolCall } from "../components/tool-call";

const API_URL = "http://localhost:8000/api/chat-agno-websocket/";
const WS_URL = "ws://localhost:8000/api/chat-agno-websocket/ws";
const STORAGE_KEY = "chat-agno-websocket-run-id";

function readPersistedRunId(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	return window.sessionStorage.getItem(STORAGE_KEY);
}

function writePersistedRunId(runId: string | null) {
	if (typeof window === "undefined") {
		return;
	}
	if (runId) {
		window.sessionStorage.setItem(STORAGE_KEY, runId);
		return;
	}
	window.sessionStorage.removeItem(STORAGE_KEY);
}

async function fetchHistory() {
	const res = await fetch(API_URL);
	if (!res.ok) throw new Error("Failed to fetch history");
	const messages = await res.json();
	return fromAgnoAgents(messages);
}

async function fetchActiveRun() {
	const res = await fetch(`${API_URL}active-run`);
	if (!res.ok) throw new Error("Failed to fetch active websocket run");
	return (await res.json()) as {
		run_id?: string | null;
		message?: string | null;
		events?: Array<Record<string, unknown>>;
	};
}

function buildBufferedMessages(
	initialMessages: Message<ContentPart>[],
	activeRun: {
		run_id?: string | null;
		message?: string | null;
		events?: Array<Record<string, unknown>>;
	},
): Message<ContentPart>[] {
	if (!activeRun.run_id || !activeRun.message) {
		return initialMessages;
	}

	const bufferedMessages = [...initialMessages];
	const userMessage: Message<ContentPart> = {
		id: `buffered-user-${activeRun.run_id}`,
		parts: [{ type: "text", text: activeRun.message }],
		role: "user",
	};
	const assistantMessage: Message<ContentPart> = {
		id: `buffered-assistant-${activeRun.run_id}`,
		parts: [],
		role: "assistant",
	};

	bufferedMessages.push(userMessage, assistantMessage);

	for (const rawEvent of activeRun.events ?? []) {
		if (!rawEvent || typeof rawEvent !== "object" || !("type" in rawEvent)) {
			continue;
		}

		const eventType = rawEvent.type;
		if (eventType === "text_delta" && typeof rawEvent.delta === "string") {
			const lastPart =
				assistantMessage.parts[assistantMessage.parts.length - 1];
			if (lastPart?.type === "text") {
				lastPart.text += rawEvent.delta;
			} else {
				assistantMessage.parts.push({ type: "text", text: rawEvent.delta });
			}
		} else if (
			eventType === "tool_call" &&
			typeof rawEvent.tool_name === "string" &&
			typeof rawEvent.argument === "string"
		) {
			assistantMessage.parts.push({
				type: "tool_call",
				tool_name: rawEvent.tool_name,
				argument: rawEvent.argument,
				callId:
					typeof rawEvent.call_id === "string" ? rawEvent.call_id : undefined,
			});
		} else if (
			eventType === "tool_result" &&
			typeof rawEvent.output === "string"
		) {
			for (let i = assistantMessage.parts.length - 1; i >= 0; i--) {
				const part = assistantMessage.parts[i];
				if (
					part.type === "tool_call" &&
					part.callId ===
						(typeof rawEvent.call_id === "string"
							? rawEvent.call_id
							: undefined)
				) {
					part.result = rawEvent.output;
					break;
				}
			}
		} else if (eventType === "reasoning" && typeof rawEvent.text === "string") {
			const lastPart =
				assistantMessage.parts[assistantMessage.parts.length - 1];
			if (lastPart?.type === "reasoning") {
				lastPart.text += rawEvent.text;
			} else {
				assistantMessage.parts.push({ type: "reasoning", text: rawEvent.text });
			}
		}
	}

	return bufferedMessages;
}

export const Route = createFileRoute("/chat-agno-websocket")({
	loader: async () => {
		const [activeRun, historyMessages] = await Promise.all([
			fetchActiveRun(),
			fetchHistory(),
		]);

		return {
			activeRun,
			initialMessages: buildBufferedMessages(historyMessages, activeRun),
		};
	},
	component: ChatAgnoWebSocket,
});

function ChatAgnoWebSocket() {
	const { activeRun, initialMessages } = Route.useLoaderData();
	const loaderRunId = activeRun.run_id ?? null;
	const loaderLastEventId = (activeRun.events?.length ?? 0) - 1;
	const [activeRunId, setActiveRunId] = useState<string | null>(() => {
		const persistedRunId = readPersistedRunId();
		return persistedRunId ?? loaderRunId;
	});
	const pendingResumeLogRef = useRef(false);

	type CustomEvent =
		| { type: "run_started"; runId: string }
		| { type: "text_delta"; delta: string }
		| {
				type: "tool_call";
				tool_name: string;
				argument: string;
				call_id?: string;
		  }
		| { type: "tool_result"; call_id: string | null; output: string }
		| { type: "reasoning"; text: string }
		| { type: "done" }
		| { type: "error"; message: string };

	const { messages, isLoading, sendMessage, stop, setMessages, runId } =
		useStreamChat<ContentPart, CustomEvent>({
			initialMessages,
			transport: "websocket",
			transportOptions: {
				websocket: {
					cancelUrl: (id) => `${API_URL}jobs/${id}/cancel`,
					buildResumePayload: (id) => ({
						runId: id,
						lastEventId: loaderLastEventId,
					}),
					getResumeKey: () => readPersistedRunId(),
					onRunIdChange: (nextRunId) => {
						const currentPersistedRunId = readPersistedRunId();
						if (nextRunId && nextRunId === currentPersistedRunId) {
							console.info(
								"[chat-agno-websocket] reconnecting to run",
								nextRunId,
							);
							pendingResumeLogRef.current = true;
						} else if (nextRunId) {
							console.info("[chat-agno-websocket] started run", nextRunId);
						}
						writePersistedRunId(nextRunId);
						setActiveRunId(nextRunId);
					},
					parseMessage: (data) => {
						if (typeof data !== "string") {
							return null;
						}
						console.info("[chat-agno-websocket] received socket frame", data);
						return JSON.parse(data) as CustomEvent;
					},
					serializeMessage: (payload) => {
						console.info(
							"[chat-agno-websocket] sending socket payload",
							payload,
						);
						return JSON.stringify(payload);
					},
					resolveRunId: (event) =>
						event.type === "run_started" ? event.runId : null,
					runId: activeRunId,
					url: WS_URL,
				},
			},
			onEvent: (event, helpers) => {
				if (event.type === "run_started") {
					return;
				}

				if (pendingResumeLogRef.current) {
					console.info(
						"[chat-agno-websocket] received resumed event",
						event.type,
						"for run",
						runId ?? activeRunId,
					);
					pendingResumeLogRef.current = false;
				}

				if (event.type === "text_delta") {
					helpers.appendText(event.delta);
				} else if (event.type === "tool_call") {
					helpers.appendPart({
						type: "tool_call",
						tool_name: event.tool_name,
						argument: event.argument,
						callId: event.call_id,
					});
				} else if (event.type === "tool_result") {
					helpers.setMessages((prev) => {
						const last = prev[prev.length - 1];
						if (!last || last.role !== "assistant") return prev;

						const updatedParts = [...last.parts];
						for (let i = updatedParts.length - 1; i >= 0; i--) {
							const p = updatedParts[i];
							if (p.type === "tool_call" && p.callId === event.call_id) {
								updatedParts[i] = { ...p, result: event.output };
								break;
							}
						}

						const updated = { ...last, parts: updatedParts };
						return [...prev.slice(0, -1), updated];
					});
				} else if (event.type === "reasoning") {
					helpers.setMessages((prev) => {
						const last = prev[prev.length - 1];
						if (!last || last.role !== "assistant") return prev;

						const parts = [...last.parts];
						const lastPart = parts[parts.length - 1];

						if (lastPart && lastPart.type === "reasoning") {
							parts[parts.length - 1] = {
								...lastPart,
								text:
									(lastPart as { type: "reasoning"; text: string }).text +
									event.text,
							};
						} else {
							parts.push({
								type: "reasoning",
								text: event.text,
							} as ContentPart);
						}

						const updated = { ...last, parts };
						return [...prev.slice(0, -1), updated];
					});
				}
			},
		});

	const hasAttemptedResumeRef = useRef(false);

	useEffect(() => {
		if (hasAttemptedResumeRef.current) {
			return;
		}

		const candidateRunId = readPersistedRunId() ?? loaderRunId;
		if (candidateRunId) {
			hasAttemptedResumeRef.current = true;
			console.info(
				"[chat-agno-websocket] attempting reconnect with run",
				candidateRunId,
			);
			pendingResumeLogRef.current = true;
			writePersistedRunId(candidateRunId);
			setActiveRunId(candidateRunId);
		}
	}, [loaderRunId]);

	const { ref, scrollToBottom, isAtBottom } = useAutoScroll([messages]);

	const clearChat = async () => {
		await fetch(`${API_URL}clear`, { method: "POST" });
		writePersistedRunId(null);
		setActiveRunId(null);
		setMessages([]);
	};

	return (
		<div className="flex flex-1 flex-col min-h-0">
			<div className="border-b border-neutral-800 bg-neutral-950/80">
				<div className="mx-auto max-w-2xl px-4 py-3 text-xs text-neutral-400">
					WebSocket demo. Messages stream over a socket instead of a
					request-bound SSE response, and reconnect using the current run id
					after navigation.
					{(runId ?? activeRunId) && (
						<span className="ml-2 text-neutral-500">
							Run: {runId ?? activeRunId}
						</span>
					)}
				</div>
			</div>

			<div ref={ref} className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl p-4">
					{messages.length > 0 && (
						<div className="flex justify-end pb-2">
							<button
								type="button"
								onClick={clearChat}
								className="rounded px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
							>
								Clear
							</button>
						</div>
					)}
					<div className="space-y-4 pb-4">
						{messages.length === 0 && (
							<p className="mt-8 text-center text-neutral-500">
								Start a WebSocket conversation with Agno.
							</p>
						)}
						{messages.map((msg) => (
							<div key={msg.id}>
								<p className="mb-1 text-xs font-semibold text-neutral-400">
									{msg.role === "user" ? "You" : "Assistant"}
								</p>
								{msg.parts.map((part, partIndex) => {
									switch (part.type) {
										case "text":
											return (
												<div
													key={`text-${partIndex}`}
													className="prose prose-invert prose-sm max-w-none"
												>
													<StreamingMarkdown content={part.text} batchMs={8} />
												</div>
											);
										case "tool_call":
											return (
												<ToolCall
													key={`tool_call-${partIndex}`}
													argument={part.argument}
													result={part.result}
												/>
											);
										case "reasoning": {
											const reasoningPart = part as {
												type: "reasoning";
												text: string;
											};
											return (
												<div
													key={`reasoning-${partIndex}`}
													className="rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm text-neutral-400 italic"
												>
													<div className="mb-2 flex items-center gap-2">
														<span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
															Thinking
														</span>
														{isLoading &&
															partIndex === msg.parts.length - 1 && (
																<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500" />
															)}
													</div>
													<p className="whitespace-pre-wrap">
														{reasoningPart.text}
													</p>
												</div>
											);
										}
										default:
											return null;
									}
								})}
							</div>
						))}
					</div>
				</div>
			</div>

			{!isAtBottom && (
				<div className="flex justify-center py-1">
					<button
						type="button"
						onClick={scrollToBottom}
						className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
					>
						Scroll to bottom
					</button>
				</div>
			)}

			<div className="border-t border-neutral-800 bg-neutral-900">
				<div className="mx-auto max-w-2xl p-4">
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							const input = e.currentTarget.elements.namedItem(
								"message",
							) as HTMLInputElement;
							if (!input.value.trim()) return;
							sendMessage(input.value);
							scrollToBottom();
							input.value = "";
						}}
					>
						<input
							name="message"
							placeholder="Type a message..."
							autoComplete="off"
							className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-500"
						/>
						{isLoading ? (
							<button
								type="button"
								onClick={stop}
								className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
							>
								Stop
							</button>
						) : (
							<button
								type="submit"
								className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
							>
								Send
							</button>
						)}
					</form>
				</div>
			</div>
		</div>
	);
}
