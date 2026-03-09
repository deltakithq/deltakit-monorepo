export interface Session {
	id: number;
	title: string;
}

export interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: Date;
}

export const API_URL = "http://localhost:8000";

export async function fetchSessions(): Promise<Session[]> {
	const res = await fetch(`${API_URL}/api/chat-sessions/`);
	if (!res.ok) {
		throw new Error("Failed to fetch sessions");
	}
	return res.json();
}

export const mockMessages: Message[] = [
	{
		id: "1",
		role: "user",
		content: "Can you explain TypeScript generics with a simple example?",
		createdAt: new Date("2026-03-09T10:00:00"),
	},
	{
		id: "2",
		role: "assistant",
		content:
			"Generics let you write reusable code that works with multiple types. Here's a simple example:\n\n```ts\nfunction identity<T>(value: T): T {\n  return value;\n}\n\nconst num = identity(42);       // type: number\nconst str = identity(\"hello\");  // type: string\n```\n\nThe `T` is a type parameter that gets inferred from the argument you pass in. This way the function works with any type while preserving type safety.",
		createdAt: new Date("2026-03-09T10:00:05"),
	},
	{
		id: "3",
		role: "user",
		content: "How would I use generics with interfaces?",
		createdAt: new Date("2026-03-09T10:01:00"),
	},
	{
		id: "4",
		role: "assistant",
		content:
			"You can use conditional types to narrow the generic parameter. For example:\n\n```ts\ninterface ApiResponse<T> {\n  data: T;\n  status: number;\n  message: string;\n}\n\nconst userResponse: ApiResponse<{ name: string; email: string }> = {\n  data: { name: \"Alice\", email: \"alice@example.com\" },\n  status: 200,\n  message: \"OK\",\n};\n```\n\nThis pattern is especially useful for API responses where the shape of `data` varies between endpoints.",
		createdAt: new Date("2026-03-09T10:01:10"),
	},
];
