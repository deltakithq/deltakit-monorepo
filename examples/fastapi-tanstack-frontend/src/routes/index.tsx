import { useChat } from "@deltakit/react";
import { createFileRoute } from "@tanstack/react-router";

const API_URL = "http://localhost:8000/api/chat/";

async function fetchHistory() {
	const res = await fetch(API_URL);
	if (!res.ok) throw new Error("Failed to fetch history");
	return res.json();
}

export const Route = createFileRoute("/")({
	loader: () => fetchHistory(),
	component: Chat,
});

function Chat() {
	const history = Route.useLoaderData();
	console.log(history);

	const { messages, isLoading, sendMessage, stop, setMessages } = useChat({
		api: API_URL,
	});

	const clearChat = async () => {
		await fetch(`${API_URL}clear`, { method: "POST" });
		setMessages([]);
	};

	return (
		<div className="mx-auto flex h-screen max-w-2xl flex-col p-4">
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
			<div className="flex-1 space-y-4 overflow-y-auto pb-4">
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
						{msg.parts.map((part) => {
							switch (part.type) {
								case "text":
									return (
										<span key={part.type} className="whitespace-pre-wrap">
											{part.text}
										</span>
									);
								case "tool_call":
									return (
										<pre
											key={`${part.type}-${part.tool_name}`}
											className="mt-1 rounded bg-neutral-800 p-2 text-xs text-neutral-400"
										>
											{`[Tool: ${part.tool_name}]\n${JSON.stringify(JSON.parse(part.argument), null, 2)}`}
										</pre>
									);
								default:
									return null;
							}
						})}
					</div>
				))}
			</div>

			<form
				className="flex gap-2 border-t border-neutral-800 pt-4"
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
					className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-500"
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
	);
}
