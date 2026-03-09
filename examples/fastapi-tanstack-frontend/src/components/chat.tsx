import { useState } from "react";
import { ArrowUp } from "lucide-react";
import type { Message } from "#/lib/mock-data";

interface ChatProps {
	messages: Message[];
	onSendMessage: (content: string) => void;
}

export function Chat({ messages, onSendMessage }: ChatProps) {
	const [input, setInput] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = input.trim();
		if (!trimmed) return;
		onSendMessage(trimmed);
		setInput("");
	};

	return (
		<div className="flex h-full flex-col bg-neutral-950">
			{/* Messages */}
			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
					{messages.length === 0 ? (
						<div className="flex h-full items-center justify-center pt-32">
							<p className="text-sm text-neutral-500">
								Start a conversation.
							</p>
						</div>
					) : (
						messages.map((message) => (
							<div key={message.id} className="flex flex-col gap-1">
								<span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
									{message.role === "user" ? "You" : "Assistant"}
								</span>
								<div
									className={`text-sm leading-relaxed whitespace-pre-wrap ${
										message.role === "assistant"
											? "text-neutral-300"
											: "text-neutral-100"
									}`}
								>
									{message.content}
								</div>
							</div>
						))
					)}
				</div>
			</div>

			{/* Input */}
			<div className="border-t border-neutral-800 px-4 py-4">
				<form
					onSubmit={handleSubmit}
					className="mx-auto flex max-w-2xl items-center gap-2"
				>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Send a message..."
						className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-neutral-500"
					/>
					<button
						type="submit"
						disabled={!input.trim()}
						className="flex shrink-0 items-center justify-center rounded-lg bg-neutral-100 p-2.5 text-neutral-900 transition-opacity hover:opacity-80 disabled:opacity-30"
					>
						<ArrowUp size={16} />
					</button>
				</form>
			</div>
		</div>
	);
}
