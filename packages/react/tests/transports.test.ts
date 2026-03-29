import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createBackgroundSSETransport,
	createDirectSSETransport,
	createWebSocketTransport,
	resolveTransport,
} from "../src/transports";
import type { ChatTransportContext } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(): ChatTransportContext & {
	emit: ReturnType<typeof vi.fn>;
	finish: ReturnType<typeof vi.fn>;
	fail: ReturnType<typeof vi.fn>;
	ensureAssistantMessage: ReturnType<typeof vi.fn>;
	getMessages: ReturnType<typeof vi.fn>;
	setRunId: ReturnType<typeof vi.fn>;
} {
	return {
		emit: vi.fn(),
		finish: vi.fn(),
		fail: vi.fn(),
		ensureAssistantMessage: vi.fn(),
		getMessages: vi.fn(() => []),
		setRunId: vi.fn(),
	};
}

function sseBody(events: Array<{ event?: string; data: string }>): string {
	return events
		.map((e) => {
			const lines: string[] = [];
			if (e.event) lines.push(`event: ${e.event}`);
			lines.push(`data: ${e.data}`);
			lines.push("");
			return lines.join("\n");
		})
		.join("\n");
}

function mockFetch(
	body: string,
	status = 200,
	statusText = "OK",
): ReturnType<typeof vi.fn> {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(body));
			controller.close();
		},
	});

	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		statusText,
		body: stream,
		json: () => Promise.resolve(JSON.parse(body)),
	});
}

function mockFetchJson(
	data: unknown,
	status = 200,
	statusText = "OK",
): ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		statusText,
		body: null,
		json: () => Promise.resolve(data),
	});
}

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WSHandler = ((event: { data: unknown }) => void) | null;

class MockWebSocket {
	static OPEN = 1;
	static instances: MockWebSocket[] = [];

	url: string;
	protocols?: string | string[];
	readyState = MockWebSocket.OPEN;
	onopen: (() => void) | null = null;
	onmessage: WSHandler = null;
	onerror: (() => void) | null = null;
	onclose: (() => void) | null = null;
	sent: string[] = [];
	closed = false;

	constructor(url: string, protocols?: string | string[]) {
		this.url = url;
		this.protocols = protocols;
		MockWebSocket.instances.push(this);
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.closed = true;
		this.readyState = 3;
		this.onclose?.();
	}

	triggerOpen() {
		this.readyState = MockWebSocket.OPEN;
		this.onopen?.();
	}

	triggerMessage(data: unknown) {
		this.onmessage?.({ data });
	}

	triggerError() {
		this.onerror?.();
	}
}

// ---------------------------------------------------------------------------
// resolveTransport
// ---------------------------------------------------------------------------

describe("resolveTransport", () => {
	it("returns custom transport object directly", () => {
		const custom = { start: vi.fn() };
		const result = resolveTransport({ transport: custom });
		expect(result).toBe(custom);
	});

	it("defaults to SSE from api option", () => {
		const transport = resolveTransport({ api: "/chat" });
		expect(transport).toHaveProperty("start");
	});

	it("throws when api is missing for default SSE", () => {
		expect(() => resolveTransport({})).toThrow(
			"`api` or `transportOptions.sse.api` is required",
		);
	});

	it("creates background-sse transport when config provided", () => {
		const transport = resolveTransport({
			transport: "background-sse",
			transportOptions: {
				backgroundSSE: {
					startApi: "/start",
					eventsApi: "/events/:runId",
				},
			},
		});
		expect(transport).toHaveProperty("start");
		expect(transport).toHaveProperty("resume");
	});

	it("throws when background-sse config is missing", () => {
		expect(() => resolveTransport({ transport: "background-sse" })).toThrow(
			"`transportOptions.backgroundSSE` is required",
		);
	});

	it("creates websocket transport when config provided", () => {
		const transport = resolveTransport({
			transport: "websocket",
			transportOptions: {
				websocket: { url: "wss://example.com" },
			},
		});
		expect(transport).toHaveProperty("start");
	});

	it("throws when websocket config is missing", () => {
		expect(() => resolveTransport({ transport: "websocket" })).toThrow(
			"`transportOptions.websocket` is required",
		);
	});
});

// ---------------------------------------------------------------------------
// createDirectSSETransport
// ---------------------------------------------------------------------------

describe("createDirectSSETransport", () => {
	it("happy path: fetch → SSE events → finish", async () => {
		const body = sseBody([
			{ event: "text_delta", data: '{"type":"text_delta","delta":"hi"}' },
		]);
		const fetchFn = mockFetch(body);
		const transport = createDirectSSETransport({
			api: "/chat",
			fetch: fetchFn,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });

		// Wait for async operations
		await vi.waitFor(() => {
			expect(ctx.finish).toHaveBeenCalled();
		});

		expect(fetchFn).toHaveBeenCalledWith(
			"/chat",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ message: "hello" }),
			}),
		);
	});

	it("HTTP error → fail", async () => {
		const fetchFn = mockFetch("", 500, "Internal Server Error");
		const transport = createDirectSSETransport({
			api: "/chat",
			fetch: fetchFn,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });

		await vi.waitFor(() => {
			expect(ctx.fail).toHaveBeenCalled();
		});

		const error = ctx.fail.mock.calls[0][0] as Error;
		expect(error.message).toContain("500");
	});

	it("includes custom headers and body", async () => {
		const body = sseBody([]);
		const fetchFn = mockFetch(body);
		const transport = createDirectSSETransport({
			api: "/chat",
			fetch: fetchFn,
			headers: { Authorization: "Bearer token" },
			body: { model: "gpt-4" },
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });

		await vi.waitFor(() => {
			expect(ctx.finish).toHaveBeenCalled();
		});

		const [, options] = fetchFn.mock.calls[0];
		expect(options.headers).toEqual(
			expect.objectContaining({ Authorization: "Bearer token" }),
		);
		expect(JSON.parse(options.body)).toEqual(
			expect.objectContaining({ model: "gpt-4", message: "hello" }),
		);
	});

	it("abort on stop does not call fail", async () => {
		// A fetch that never resolves until aborted
		const fetchFn = vi.fn(
			(_url: string, opts: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					opts.signal.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					});
				}),
		);

		const transport = createDirectSSETransport({
			api: "/chat",
			fetch: fetchFn as unknown as typeof fetch,
		});
		const ctx = createMockContext();

		const run = transport.start({ context: ctx, message: "hello" });
		run.stop();

		// Give time for the rejection to propagate
		await new Promise((r) => setTimeout(r, 10));
		expect(ctx.fail).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// createBackgroundSSETransport
// ---------------------------------------------------------------------------

describe("createBackgroundSSETransport", () => {
	it("start → runId → connect → events → finish", async () => {
		const startFetch = mockFetchJson({ runId: "run_abc" });
		const eventsBody = sseBody([
			{ event: "text_delta", data: '{"type":"text_delta","delta":"ok"}' },
		]);
		let callCount = 0;
		const fetchFn = vi.fn((...args: unknown[]) => {
			callCount++;
			if (callCount === 1) {
				return startFetch(...args);
			}
			return mockFetch(eventsBody)(...args);
		}) as unknown as typeof fetch;

		const transport = createBackgroundSSETransport({
			startApi: "/start",
			eventsApi: "/events/:runId",
			fetch: fetchFn,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hi" });

		await vi.waitFor(() => {
			expect(ctx.finish).toHaveBeenCalled();
		});

		expect(ctx.setRunId).toHaveBeenCalledWith("run_abc");
		expect(ctx.ensureAssistantMessage).toHaveBeenCalled();
	});

	it("start failure → fail", async () => {
		const fetchFn = mockFetch("", 500, "Error");
		const transport = createBackgroundSSETransport({
			startApi: "/start",
			eventsApi: "/events/:runId",
			fetch: fetchFn as unknown as typeof fetch,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hi" });

		await vi.waitFor(() => {
			expect(ctx.fail).toHaveBeenCalled();
		});
	});

	it("resume connects directly to events endpoint", async () => {
		const eventsBody = sseBody([
			{ event: "text_delta", data: '{"type":"text_delta","delta":"ok"}' },
		]);
		const fetchFn = mockFetch(eventsBody);
		const transport = createBackgroundSSETransport({
			startApi: "/start",
			eventsApi: (runId) => `/events/${runId}`,
			fetch: fetchFn as unknown as typeof fetch,
		});
		const ctx = createMockContext();

		if (!transport.resume) {
			throw new Error("Expected background SSE transport resume");
		}
		transport.resume({ context: ctx, runId: "run_xyz" });

		await vi.waitFor(() => {
			expect(ctx.finish).toHaveBeenCalled();
		});

		expect(ctx.setRunId).toHaveBeenCalledWith("run_xyz");
		expect(fetchFn).toHaveBeenCalledWith(
			"/events/run_xyz",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("stop calls cancelApi when provided", async () => {
		const startFetch = mockFetchJson({ runId: "run_cancel" });
		// Make events hang forever
		const hangingFetch = vi.fn(
			() =>
				new Promise(() => {
					/* never resolves */
				}),
		);
		let callCount = 0;
		const fetchFn = vi.fn((...args: unknown[]) => {
			callCount++;
			if (callCount === 1) return startFetch(...args);
			if (callCount === 2) return hangingFetch(...args);
			// cancel call
			return Promise.resolve({ ok: true });
		}) as unknown as typeof fetch;

		const transport = createBackgroundSSETransport({
			startApi: "/start",
			eventsApi: "/events/:runId",
			cancelApi: "/cancel/:runId",
			fetch: fetchFn,
		});
		const ctx = createMockContext();

		const run = transport.start({ context: ctx, message: "hi" });

		// Wait for start to resolve and events connection to start
		await vi.waitFor(() => {
			expect(ctx.setRunId).toHaveBeenCalledWith("run_cancel");
		});

		run.stop();
		// Allow cancel fetch to be initiated
		await new Promise((r) => setTimeout(r, 10));
		// At least 3 calls: start, events, cancel
		expect(callCount).toBeGreaterThanOrEqual(3);
	});

	it("uses custom resolveRunId", async () => {
		const startFetch = mockFetchJson({ custom_id: "custom_run" });
		const eventsBody = sseBody([]);
		let callCount = 0;
		const fetchFn = vi.fn((...args: unknown[]) => {
			callCount++;
			if (callCount === 1) return startFetch(...args);
			return mockFetch(eventsBody)(...args);
		}) as unknown as typeof fetch;

		const transport = createBackgroundSSETransport({
			startApi: "/start",
			eventsApi: "/events/:runId",
			fetch: fetchFn,
			resolveRunId: (data: unknown) =>
				(data as { custom_id: string }).custom_id,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hi" });

		await vi.waitFor(() => {
			expect(ctx.setRunId).toHaveBeenCalledWith("custom_run");
		});
	});

	it("throws if resolveRunId returns empty", async () => {
		const startFetch = mockFetchJson({});
		const fetchFn = vi.fn((...args: unknown[]) => {
			return startFetch(...args);
		}) as unknown as typeof fetch;

		const transport = createBackgroundSSETransport({
			startApi: "/start",
			eventsApi: "/events/:runId",
			fetch: fetchFn,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hi" });

		await vi.waitFor(() => {
			expect(ctx.fail).toHaveBeenCalled();
		});

		const error = ctx.fail.mock.calls[0][0] as Error;
		expect(error.message).toContain("run id");
	});
});

// ---------------------------------------------------------------------------
// createWebSocketTransport
// ---------------------------------------------------------------------------

describe("createWebSocketTransport", () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		vi.stubGlobal("WebSocket", MockWebSocket);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("start → onopen → send payload → onmessage → done → finish", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });

		// Wait for queueMicrotask
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		expect(ws).toBeDefined();
		expect(ws.url).toBe("wss://example.com");

		ws.triggerOpen();

		expect(ws.sent).toHaveLength(1);
		expect(JSON.parse(ws.sent[0])).toEqual(
			expect.objectContaining({ message: "hello" }),
		);

		ws.triggerMessage(JSON.stringify({ type: "text_delta", delta: "hi" }));
		expect(ctx.emit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "text_delta" }),
		);

		ws.triggerMessage(JSON.stringify({ type: "done" }));
		expect(ctx.finish).toHaveBeenCalled();
	});

	it("onerror → fail", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		ws.triggerError();

		expect(ctx.fail).toHaveBeenCalledWith(
			expect.objectContaining({ message: "WebSocket connection failed" }),
		);
	});

	it("onclose without manual close → finish", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		// Simulate server closing
		ws.onclose?.();

		expect(ctx.finish).toHaveBeenCalled();
	});

	it("manual stop does not trigger finish", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
		});
		const ctx = createMockContext();

		const run = transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		run.stop();
		// onclose fires from ws.close() but manuallyClosed is true
		expect(ctx.finish).not.toHaveBeenCalled();
	});

	it("stop calls cancelUrl when provided", async () => {
		const globalFetchSpy = vi
			.fn()
			.mockResolvedValue({ ok: true }) as unknown as typeof fetch;
		vi.stubGlobal("fetch", globalFetchSpy);

		const transport = createWebSocketTransport({
			url: "wss://example.com",
			cancelUrl: "/cancel/:runId",
			runId: "run_ws_cancel",
		});
		const ctx = createMockContext();

		const run = transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		run.stop();

		expect(globalFetchSpy).toHaveBeenCalledWith("/cancel/run_ws_cancel", {
			method: "POST",
		});
	});

	it("resume sends resume payload and sets runId", async () => {
		const transport = createWebSocketTransport({
			url: (runId) => `wss://example.com/${runId}`,
		});
		const ctx = createMockContext();

		if (!transport.resume) {
			throw new Error("Expected websocket transport resume");
		}
		transport.resume({ context: ctx, runId: "run_resume" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		expect(ws.url).toBe("wss://example.com/run_resume");

		ws.triggerOpen();
		expect(ws.sent).toHaveLength(1);
		expect(JSON.parse(ws.sent[0])).toEqual(
			expect.objectContaining({ runId: "run_resume" }),
		);
		expect(ctx.setRunId).toHaveBeenCalledWith("run_resume");
		expect(ctx.ensureAssistantMessage).toHaveBeenCalled();
	});

	it("error event type → fail with message", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		ws.triggerMessage(
			JSON.stringify({ type: "error", message: "rate limited" }),
		);

		expect(ctx.fail).toHaveBeenCalledWith(
			expect.objectContaining({ message: "rate limited" }),
		);
	});

	it("resolveRunId extracts runId from events", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
			resolveRunId: (event) =>
				"runId" in event ? (event.runId as string) : null,
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		ws.triggerMessage(
			JSON.stringify({
				type: "text_delta",
				delta: "hi",
				runId: "resolved_run",
			}),
		);

		expect(ctx.setRunId).toHaveBeenCalledWith("resolved_run");
	});

	it("handles array of events in single message", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
		});
		const ctx = createMockContext();

		transport.start({ context: ctx, message: "hello" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		ws.triggerMessage(
			JSON.stringify([
				{ type: "text_delta", delta: "a" },
				{ type: "text_delta", delta: "b" },
			]),
		);

		expect(ctx.emit).toHaveBeenCalledTimes(2);
	});

	it("uses custom buildResumePayload", async () => {
		const transport = createWebSocketTransport({
			url: "wss://example.com",
			buildResumePayload: (runId) => ({ action: "resume", id: runId }),
		});
		const ctx = createMockContext();

		if (!transport.resume) {
			throw new Error("Expected websocket transport resume");
		}
		transport.resume({ context: ctx, runId: "run_custom" });
		await new Promise((r) => setTimeout(r, 0));

		const ws = MockWebSocket.instances[0];
		ws.triggerOpen();

		expect(JSON.parse(ws.sent[0])).toEqual({
			action: "resume",
			id: "run_custom",
		});
	});
});
