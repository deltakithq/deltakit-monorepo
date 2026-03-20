import { StreamingMarkdown } from "@deltakit/markdown";
import {
	type ContentPart,
	fromAgnoAgents,
	useAutoScroll,
	useStreamChat,
} from "@deltakit/react";
import { createFileRoute } from "@tanstack/react-router";
import { ToolCall } from "../components/tool-call";

const API_URL = "http://localhost:8000/api/chat-agno/";

async function fetchHistory() {
	const res = await fetch(API_URL);
	if (!res.ok) throw new Error("Failed to fetch history");
	// Backend returns raw Agno messages
	// We need to convert them to DeltaKit Message format
	const messages = await res.json();
	return fromAgnoAgents(messages);
}

export const Route = createFileRoute("/chat-agno")({
	loader: () => fetchHistory(),
	component: ChatAgno,
});

function ChatAgno() {
	const initialMessages = Route.useLoaderData();

	// Define custom event types for the demo
	type CustomEvent =
		| { type: "text_delta"; delta: string }
		| {
				type: "tool_call";
				tool_name: string;
				argument: string;
				call_id?: string;
		  }
		| { type: "tool_result"; call_id: string | null; output: string }
		| { type: "reasoning"; text: string };

	const { messages, isLoading, sendMessage, stop, setMessages } = useStreamChat<
		ContentPart,
		CustomEvent
	>({
		initialMessages,
		transport: "sse",
		transportOptions: {
			sse: {
				api: API_URL,
			},
		},
		onEvent: (event, helpers) => {
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
				// Find and update the matching tool_call with its result
				helpers.setMessages((prev) => {
					const last = prev[prev.length - 1];
					if (!last || last.role !== "assistant") return prev;

					const updatedParts = [...last.parts];
					// Find the tool_call with matching callId
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
				// Accumulate reasoning text into existing reasoning part or create new one
				helpers.setMessages((prev) => {
					const last = prev[prev.length - 1];
					if (!last || last.role !== "assistant") return prev;

					const parts = [...last.parts];
					const lastPart = parts[parts.length - 1];

					if (lastPart && lastPart.type === "reasoning") {
						// Append to existing reasoning part
						parts[parts.length - 1] = {
							...lastPart,
							text:
								(lastPart as { type: "reasoning"; text: string }).text +
								event.text,
						};
					} else {
						// Create new reasoning part
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

	const { ref, scrollToBottom, isAtBottom } = useAutoScroll([messages]);

	const clearChat = async () => {
		await fetch(`${API_URL}clear`, { method: "POST" });
		setMessages([]);
	};

	return (
		<div className="flex flex-1 flex-col min-h-0">
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
								Start a conversation with Agno.
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
													key={"text-${partIndex}"}
													className="prose prose-invert prose-sm max-w-none"
												>
													<StreamingMarkdown content={part.text} batchMs={8} />
												</div>
											);
										case "tool_call":
											return (
												<ToolCall
													key={"tool_call-${partIndex}"}
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
													key={"reasoning-${partIndex}"}
													className="rounded border border-neutral-700 bg-neutral-800/50 p-3 text-sm text-neutral-400 italic"
												>
													<div className="flex items-center gap-2 mb-2">
														<span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
															Thinking
														</span>
														{isLoading &&
															partIndex === msg.parts.length - 1 && (
																<span className="inline-block w-1.5 h-1.5 bg-neutral-500 rounded-full animate-pulse" />
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
							className={`flex-1 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-500 ${
								isLoading ? "caret-transparent" : ""
							}`}
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
