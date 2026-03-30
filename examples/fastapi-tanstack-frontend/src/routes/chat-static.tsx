import { StreamingMarkdown } from "@deltakit/markdown";
import {
	type ContentPart,
	useAutoScroll,
	useStreamChat,
} from "@deltakit/react";
import { createFileRoute } from "@tanstack/react-router";

const API_URL = "http://localhost:8000/api/chat-static/";

export const Route = createFileRoute("/chat-static")({
	component: ChatStatic,
});

function ChatStatic() {
	type CustomEvent = { type: "text_delta"; delta: string } | { type: "done" };

	const { messages, isLoading, sendMessage, stop, setMessages } = useStreamChat<
		ContentPart,
		CustomEvent
	>({
		initialMessages: [],
		transport: "sse",
		transportOptions: {
			sse: {
				api: API_URL,
			},
		},
		onEvent: (event, helpers) => {
			if (event.type === "text_delta") {
				helpers.appendText(event.delta);
			}
		},
	});

	const { ref, scrollToBottom, isAtBottom } = useAutoScroll([messages]);

	return (
		<div className="relative flex flex-1 flex-col min-h-0">
			<div ref={ref} className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl p-4">
					<div className="space-y-4 pb-4">
						{messages.length === 0 && !isLoading && (
							<div className="mt-8 text-center">
								<p className="text-neutral-500 mb-4">
									Stream static markdown text — no AI agent needed.
								</p>
								<button
									type="button"
									onClick={() => sendMessage("stream")}
									className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
								>
									Start Streaming
								</button>
							</div>
						)}
						{messages
							.filter((msg) => msg.role === "assistant")
							.map((msg) => (
								<div key={msg.id}>
									{msg.parts.map((part, partIndex) => {
										if (part.type === "text") {
											return (
												<div
													key={partIndex}
													className="prose prose-invert prose-sm max-w-none [&_table]:w-max [&_table]:min-w-full [&_table]:table-auto [&_table]:border-collapse [&_table]:whitespace-normal [&_th]:align-top [&_td]:align-top [&_pre]:whitespace-pre-wrap [&_code]:break-words [&_table]:block [&_table]:overflow-x-auto"
												>
													<StreamingMarkdown content={part.text} batchMs={8} />
												</div>
											);
										}
										return null;
									})}
								</div>
							))}
					</div>
				</div>
			</div>

			{!isAtBottom && (
				<div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center px-4">
					<button
						type="button"
						onClick={scrollToBottom}
						className="pointer-events-auto rounded-full bg-neutral-800/95 px-3 py-1 text-xs text-neutral-300 shadow-lg backdrop-blur hover:bg-neutral-700"
					>
						Scroll to bottom
					</button>
				</div>
			)}

			<div className="border-t border-neutral-800 bg-neutral-900">
				<div className="mx-auto max-w-2xl p-4">
					<div className="flex gap-2">
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
								type="button"
								onClick={() => {
									setMessages([]);
									sendMessage("stream");
									scrollToBottom();
								}}
								className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
							>
								{messages.length > 0 ? "Restart" : "Start Streaming"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
