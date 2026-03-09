import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "#/components/sidebar";
import { Chat } from "#/components/chat";
import { fetchSessions, mockMessages } from "#/lib/mock-data";
import type { Message } from "#/lib/mock-data";

export const Route = createFileRoute("/")({
	loader: () => fetchSessions(),
	component: App,
});

function App() {
	const sessions = Route.useLoaderData();
	const [activeSessionId, setActiveSessionId] = useState<number | null>(
		sessions[0]?.id ?? null,
	);
	const [messages, setMessages] = useState<Message[]>(mockMessages);

	const handleNewChat = () => {
		setActiveSessionId(null);
		setMessages([]);
	};

	const handleSelectSession = (id: number) => {
		setActiveSessionId(id);
		setMessages(id === sessions[0]?.id ? mockMessages : []);
	};

	const handleSendMessage = (content: string) => {
		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			createdAt: new Date(),
		};
		setMessages((prev) => [...prev, userMessage]);
	};

	return (
		<div className="flex h-screen">
			<Sidebar
				sessions={sessions}
				activeSessionId={activeSessionId}
				onNewChat={handleNewChat}
				onSelectSession={handleSelectSession}
			/>
			<main className="flex-1">
				<Chat messages={messages} onSendMessage={handleSendMessage} />
			</main>
		</div>
	);
}
