import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
	ChatTransport,
	ChatTransportContext,
	ContentPart,
	SSEEvent,
	UseStreamChatOptions,
} from "../src/types";
import { useStreamChat } from "../src/use-stream-chat";

// ---------------------------------------------------------------------------
// HookHarness — follows the existing pattern from use-auto-scroll.test.tsx
// ---------------------------------------------------------------------------

function HookHarness<TEvent extends { type: string } = SSEEvent>({
	options,
	onRender,
}: {
	options: UseStreamChatOptions<ContentPart, TEvent>;
	onRender: ReturnType<typeof vi.fn>;
}) {
	const value = useStreamChat<ContentPart, TEvent>(options);
	onRender(value);
	return null;
}

function createMockTransport<TEvent extends { type: string } = SSEEvent>() {
	const state: {
		capturedContext: ChatTransportContext<ContentPart, TEvent> | null;
	} = { capturedContext: null };

	const mockRun = {
		stop: vi.fn(),
		close: vi.fn(),
		runId: null as string | null,
	};

	const transport: ChatTransport<ContentPart, TEvent> & {
		resume: NonNullable<ChatTransport<ContentPart, TEvent>["resume"]>;
	} = {
		start: ({ context }) => {
			state.capturedContext = context;
			return mockRun;
		},
		resume: ({ context, runId }) => {
			state.capturedContext = context;
			mockRun.runId = runId;
			return mockRun;
		},
	};

	return { transport, state, mockRun };
}

function requireContext<TEvent extends { type: string }>(
	context: ChatTransportContext<ContentPart, TEvent> | null,
): ChatTransportContext<ContentPart, TEvent> {
	if (!context) {
		throw new Error("Expected transport context to be captured");
	}
	return context;
}

describe("useStreamChat", () => {
	it("returns correct initial state", () => {
		const { transport } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		const state = onRender.mock.lastCall?.[0];
		expect(state.messages).toEqual([]);
		expect(state.isLoading).toBe(false);
		expect(state.error).toBeNull();
		expect(state.runId).toBeNull();
		expect(typeof state.sendMessage).toBe("function");
		expect(typeof state.stop).toBe("function");
	});

	it("initialMessages populates messages", () => {
		const { transport } = createMockTransport();
		const onRender = vi.fn();
		const initialMessages = [
			{
				id: "1",
				role: "user" as const,
				parts: [{ type: "text" as const, text: "hi" }],
			},
			{
				id: "2",
				role: "assistant" as const,
				parts: [{ type: "text" as const, text: "hey" }],
			},
		];

		render(
			<HookHarness
				options={{ transport, initialMessages }}
				onRender={onRender}
			/>,
		);

		expect(onRender.mock.lastCall?.[0].messages).toEqual(initialMessages);
	});

	it("sendMessage adds user + assistant messages and sets isLoading", () => {
		const { transport } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		const state = onRender.mock.lastCall?.[0];
		expect(state.isLoading).toBe(true);
		expect(state.messages).toHaveLength(2);
		expect(state.messages[0].role).toBe("user");
		expect(state.messages[0].parts[0].text).toBe("hello");
		expect(state.messages[1].role).toBe("assistant");
	});

	it("sendMessage while loading is no-op", () => {
		const { transport } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("first");
		});

		const msgCountAfterFirst = onRender.mock.lastCall?.[0].messages.length;

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("second");
		});

		expect(onRender.mock.lastCall?.[0].messages.length).toBe(
			msgCountAfterFirst,
		);
	});

	it("stop calls run.stop and clears isLoading", () => {
		const { transport, mockRun } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		expect(onRender.mock.lastCall?.[0].isLoading).toBe(true);

		act(() => {
			onRender.mock.lastCall?.[0].stop();
		});

		expect(mockRun.stop).toHaveBeenCalled();
		expect(onRender.mock.lastCall?.[0].isLoading).toBe(false);
	});

	it("context.emit with defaultOnEvent accumulates text_delta", () => {
		const { transport, state } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		// Emit text_delta events through captured context
		const context = requireContext(state.capturedContext);
		act(() => {
			context.emit({ type: "text_delta", delta: "hi " });
		});
		act(() => {
			context.emit({
				type: "text_delta",
				delta: "there",
			});
		});

		const msgs = onRender.mock.lastCall?.[0].messages;
		const assistantMsg = msgs[msgs.length - 1];
		expect(assistantMsg.role).toBe("assistant");
		expect(assistantMsg.parts[0].text).toBe("hi there");
	});

	it("context.finish sets isLoading false and calls onFinish", () => {
		const onFinish = vi.fn();
		const { transport, state } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness
				options={{ transport, api: "/chat", onFinish }}
				onRender={onRender}
			/>,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		const context = requireContext(state.capturedContext);
		act(() => {
			context.finish();
		});

		expect(onRender.mock.lastCall?.[0].isLoading).toBe(false);
		expect(onFinish).toHaveBeenCalled();
	});

	it("context.fail sets error and calls onError", () => {
		const onError = vi.fn();
		const { transport, state } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness
				options={{ transport, api: "/chat", onError }}
				onRender={onRender}
			/>,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		const error = new Error("stream failed");
		const context = requireContext(state.capturedContext);
		act(() => {
			context.fail(error);
		});

		expect(onRender.mock.lastCall?.[0].error).toBe(error);
		expect(onRender.mock.lastCall?.[0].isLoading).toBe(false);
		expect(onError).toHaveBeenCalledWith(error);
	});

	it("onMessage fires for user message on send", () => {
		const onMessage = vi.fn();
		const { transport } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness
				options={{ transport, api: "/chat", onMessage }}
				onRender={onRender}
			/>,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		expect(onMessage).toHaveBeenCalledWith(
			expect.objectContaining({ role: "user" }),
		);
	});

	it("custom onEvent replaces default handler", () => {
		type CustomEvent = { type: "custom_event"; data: string };
		const customOnEvent = vi.fn();
		const { transport, state } = createMockTransport<CustomEvent>();
		const onRender = vi.fn();

		render(
			<HookHarness<CustomEvent>
				options={{ transport, api: "/chat", onEvent: customOnEvent }}
				onRender={onRender}
			/>,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		const event = { type: "custom_event", data: "test" };
		const context = requireContext(state.capturedContext);
		act(() => {
			context.emit(event);
		});

		expect(customOnEvent).toHaveBeenCalledWith(
			event,
			expect.objectContaining({
				appendText: expect.any(Function),
				appendPart: expect.any(Function),
			}),
		);
	});

	it("setMessages allows programmatic manipulation", () => {
		const { transport } = createMockTransport();
		const onRender = vi.fn();

		render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		act(() => {
			onRender.mock.lastCall?.[0].setMessages([
				{ id: "x", role: "user", parts: [{ type: "text", text: "injected" }] },
			]);
		});

		expect(onRender.mock.lastCall?.[0].messages).toHaveLength(1);
		expect(onRender.mock.lastCall?.[0].messages[0].parts[0].text).toBe(
			"injected",
		);
	});

	it("auto-resume triggers transport.resume when candidateRunId provided", () => {
		const { transport } = createMockTransport();
		const resumeSpy = vi.spyOn(transport, "resume");
		const onRender = vi.fn();

		render(
			<HookHarness
				options={{
					transport,
					transportOptions: {
						backgroundSSE: {
							startApi: "/start",
							eventsApi: "/events/:runId",
							runId: "run_auto_resume",
						},
					},
				}}
				onRender={onRender}
			/>,
		);

		expect(resumeSpy).toHaveBeenCalledWith(
			expect.objectContaining({ runId: "run_auto_resume" }),
		);
		expect(onRender.mock.lastCall?.[0].isLoading).toBe(true);
	});

	it("cleanup calls run.close on unmount", () => {
		const { transport, mockRun } = createMockTransport();
		const onRender = vi.fn();

		const { unmount } = render(
			<HookHarness options={{ transport, api: "/chat" }} onRender={onRender} />,
		);

		act(() => {
			onRender.mock.lastCall?.[0].sendMessage("hello");
		});

		unmount();
		expect(mockRun.close).toHaveBeenCalled();
	});
});
