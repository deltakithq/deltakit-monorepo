import { fromOpenAiAgents, useStreamChat } from "@deltakit/react";
import { createFileRoute } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { ToolCall } from "../components/tool-call";

const API_URL = "http://localhost:8000/api/chat/";

async function fetchHistory() {
	const res = await fetch(API_URL);
	if (!res.ok) throw new Error("Failed to fetch history");
	// Backend returns raw OpenAI Agents SDK items (TResponseInputItem[])
	// We need to convert them to DeltaKit Message format
	const openAiItems = await res.json();
	return fromOpenAiAgents(openAiItems);
}

export const Route = createFileRoute("/")({
	loader: () => fetchHistory(),
	component: Chat,
});

function Chat() {
	const initialMessages = Route.useLoaderData();
	console.log("Initial messages:", initialMessages);

	const { messages, isLoading, sendMessage, stop, setMessages } = useStreamChat(
		{
			api: API_URL,
			initialMessages,
			onEvent: (event, helpers) => {
				if (event.type === "text_delta") {
					helpers.appendText(event.delta);
				} else if (event.type === "tool_call") {
					helpers.appendPart({
						type: "tool_call",
						tool_name: event.tool_name,
						argument: event.argument,
					});
				}
			},
		},
	);

	const clearChat = async () => {
		await fetch(`${API_URL}clear`, { method: "POST" });
		setMessages([]);
	};

	return (
		<div className="flex h-screen flex-col">
			<div className="flex-1 overflow-y-auto">
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
								Start a conversation.
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
											<div key={`text-${partIndex}`} className="prose prose-invert prose-sm max-w-none">
												<Markdown>{part.text}</Markdown>
											</div>
										);
								case "tool_call":
									return (
										<ToolCall
											key={`tool_call-${partIndex}`}
											argument={part.argument}
										/>
									);
										default:
											return null;
									}
								})}
							</div>
						))}
					</div>
				</div>
			</div>

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
