import { describe, expect, it, vi } from "vitest";
import type { ChatControllerOptions } from "../src/chat-controller";
import {
	createChatTransportContext,
	createMessage,
	generateId,
} from "../src/chat-controller";

function createMockOptions(
	overrides: Partial<ChatControllerOptions> = {},
): ChatControllerOptions {
	return {
		appendPart: vi.fn(),
		appendText: vi.fn(),
		eventHandler: vi.fn(),
		getMessages: vi.fn(() => []),
		setError: vi.fn(),
		setIsLoading: vi.fn(),
		setMessages: vi.fn((updater) => {
			if (typeof updater === "function") {
				return updater([]);
			}
		}),
		setRunId: vi.fn(),
		...overrides,
	};
}

describe("generateId", () => {
	it("returns a string with msg_ prefix", () => {
		const id = generateId();
		expect(id).toMatch(/^msg_/);
	});

	it("returns unique ids on consecutive calls", () => {
		const a = generateId();
		const b = generateId();
		expect(a).not.toBe(b);
	});
});

describe("createMessage", () => {
	it("creates a message with the given role and parts", () => {
		const msg = createMessage("user", [{ type: "text", text: "hello" }]);
		expect(msg.role).toBe("user");
		expect(msg.parts).toEqual([{ type: "text", text: "hello" }]);
		expect(msg.id).toMatch(/^msg_/);
	});

	it("creates an assistant message with empty parts", () => {
		const msg = createMessage("assistant", []);
		expect(msg.role).toBe("assistant");
		expect(msg.parts).toEqual([]);
	});
});

describe("createChatTransportContext", () => {
	describe("emit", () => {
		it("delegates to eventHandler with helpers", () => {
			const opts = createMockOptions();
			const ctx = createChatTransportContext(opts);
			const event = { type: "text_delta", delta: "hi" };
			ctx.emit(event);
			expect(opts.eventHandler).toHaveBeenCalledWith(
				event,
				expect.objectContaining({
					appendPart: opts.appendPart,
					appendText: opts.appendText,
					setMessages: opts.setMessages,
				}),
			);
		});
	});

	describe("ensureAssistantMessage", () => {
		it("is a no-op if last message is already assistant", () => {
			const messages = [{ id: "1", role: "assistant" as const, parts: [] }];
			const setMessages = vi.fn((updater: unknown) => {
				if (typeof updater === "function") {
					return (updater as (prev: typeof messages) => typeof messages)(
						messages,
					);
				}
			});
			const opts = createMockOptions({ setMessages });
			const ctx = createChatTransportContext(opts);

			ctx.ensureAssistantMessage();
			const result = setMessages.mock.results[0]?.value;
			expect(result).toBe(messages); // same reference = no-op
		});

		it("appends a new assistant message if last is not assistant", () => {
			const messages = [
				{
					id: "1",
					role: "user" as const,
					parts: [{ type: "text" as const, text: "hi" }],
				},
			];
			const setMessages = vi.fn((updater: unknown) => {
				if (typeof updater === "function") {
					return (updater as (prev: typeof messages) => unknown)(messages);
				}
			});
			const opts = createMockOptions({ setMessages });
			const ctx = createChatTransportContext(opts);

			ctx.ensureAssistantMessage();
			const result = setMessages.mock.results[0]?.value as typeof messages;
			expect(result).toHaveLength(2);
			expect(result[1].role).toBe("assistant");
		});
	});

	describe("fail", () => {
		it("sets error, calls onError, sets isLoading false, clears runId", () => {
			const onError = vi.fn();
			const opts = createMockOptions({ onError });
			const ctx = createChatTransportContext(opts);
			const error = new Error("oops");

			ctx.fail(error);

			expect(opts.setError).toHaveBeenCalledWith(error);
			expect(onError).toHaveBeenCalledWith(error);
			expect(opts.setIsLoading).toHaveBeenCalledWith(false);
			expect(opts.setRunId).toHaveBeenCalledWith(null);
		});

		it("works without onError callback", () => {
			const opts = createMockOptions();
			const ctx = createChatTransportContext(opts);
			ctx.fail(new Error("oops"));
			expect(opts.setIsLoading).toHaveBeenCalledWith(false);
		});
	});

	describe("finish", () => {
		it("sets isLoading false and clears runId", () => {
			const opts = createMockOptions();
			const ctx = createChatTransportContext(opts);
			ctx.finish();
			expect(opts.setIsLoading).toHaveBeenCalledWith(false);
			expect(opts.setRunId).toHaveBeenCalledWith(null);
		});

		it("calls onMessage for last assistant message", () => {
			const lastMsg = { id: "1", role: "assistant" as const, parts: [] };
			const onMessage = vi.fn();
			const opts = createMockOptions({
				getMessages: vi.fn(() => [lastMsg]),
				onMessage,
			});
			const ctx = createChatTransportContext(opts);

			ctx.finish();
			expect(onMessage).toHaveBeenCalledWith(lastMsg);
		});

		it("does not call onMessage if last message is user", () => {
			const lastMsg = {
				id: "1",
				role: "user" as const,
				parts: [{ type: "text" as const, text: "hi" }],
			};
			const onMessage = vi.fn();
			const opts = createMockOptions({
				getMessages: vi.fn(() => [lastMsg]),
				onMessage,
			});
			const ctx = createChatTransportContext(opts);

			ctx.finish();
			expect(onMessage).not.toHaveBeenCalled();
		});

		it("calls onFinish with all messages", () => {
			const messages = [
				{
					id: "1",
					role: "user" as const,
					parts: [{ type: "text" as const, text: "hi" }],
				},
				{ id: "2", role: "assistant" as const, parts: [] },
			];
			const onFinish = vi.fn();
			const opts = createMockOptions({
				getMessages: vi.fn(() => messages),
				onFinish,
			});
			const ctx = createChatTransportContext(opts);

			ctx.finish();
			expect(onFinish).toHaveBeenCalledWith(messages);
		});
	});

	describe("getMessages", () => {
		it("delegates to options.getMessages", () => {
			const messages = [{ id: "1", role: "user" as const, parts: [] }];
			const opts = createMockOptions({
				getMessages: vi.fn(() => messages),
			});
			const ctx = createChatTransportContext(opts);
			expect(ctx.getMessages()).toBe(messages);
		});
	});

	describe("setRunId", () => {
		it("delegates to options.setRunId", () => {
			const opts = createMockOptions();
			const ctx = createChatTransportContext(opts);
			ctx.setRunId("run_123");
			expect(opts.setRunId).toHaveBeenCalledWith("run_123");
		});
	});
});
