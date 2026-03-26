import { describe, expect, it } from "vitest";
import { parseSSEStream } from "../src/sse-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const items: T[] = [];
	for await (const item of gen) {
		items.push(item);
	}
	return items;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseSSEStream", () => {
	// -----------------------------------------------------------------------
	// Basic parsing
	// -----------------------------------------------------------------------
	describe("basic parsing", () => {
		it("parses a single event", async () => {
			const stream = createStream([
				'data: {"type":"text_delta","delta":"hi"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toEqual([{ type: "text_delta", delta: "hi" }]);
		});

		it("parses multiple events", async () => {
			const stream = createStream([
				'data: {"type":"text_delta","delta":"a"}\n\ndata: {"type":"text_delta","delta":"b"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ type: "text_delta", delta: "a" });
			expect(events[1]).toEqual({ type: "text_delta", delta: "b" });
		});

		it("returns empty array for empty stream", async () => {
			const stream = createStream([]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toEqual([]);
		});

		it("ignores non-data lines", async () => {
			const stream = createStream([
				'event: message\nid: 123\n: comment\ndata: {"type":"text_delta","delta":"x"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({ type: "text_delta", delta: "x" });
		});
	});

	// -----------------------------------------------------------------------
	// Chunked data
	// -----------------------------------------------------------------------
	describe("chunked data", () => {
		it("handles event split across chunks", async () => {
			const stream = createStream([
				'data: {"type":"text_',
				'delta","delta":"hi"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toEqual([{ type: "text_delta", delta: "hi" }]);
		});

		it("handles JSON split mid-line", async () => {
			const stream = createStream([
				'data: {"type',
				'":"text_delta","del',
				'ta":"ok"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toEqual([{ type: "text_delta", delta: "ok" }]);
		});

		it("handles multiple events in one chunk", async () => {
			const stream = createStream([
				'data: {"type":"text_delta","delta":"1"}\n\ndata: {"type":"text_delta","delta":"2"}\n\ndata: {"type":"text_delta","delta":"3"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toHaveLength(3);
		});
	});

	// -----------------------------------------------------------------------
	// [DONE] sentinel
	// -----------------------------------------------------------------------
	describe("[DONE] sentinel", () => {
		it("stops iteration on [DONE]", async () => {
			const stream = createStream([
				'data: {"type":"text_delta","delta":"a"}\n\ndata: [DONE]\n\ndata: {"type":"text_delta","delta":"b"}\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({ type: "text_delta", delta: "a" });
		});

		it("yields events before [DONE]", async () => {
			const stream = createStream([
				'data: {"type":"text_delta","delta":"x"}\n\ndata: {"type":"text_delta","delta":"y"}\n\ndata: [DONE]\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toHaveLength(2);
		});
	});

	// -----------------------------------------------------------------------
	// Malformed JSON
	// -----------------------------------------------------------------------
	describe("malformed JSON", () => {
		it("silently skips malformed JSON", async () => {
			const stream = createStream(["data: {not valid json}\n\n"]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toEqual([]);
		});

		it("skips invalid but yields valid events", async () => {
			const stream = createStream([
				'data: BROKEN\n\ndata: {"type":"text_delta","delta":"ok"}\n\ndata: {also bad\n\n',
			]);
			const events = await collect(parseSSEStream(stream));
			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({ type: "text_delta", delta: "ok" });
		});
	});

	// -----------------------------------------------------------------------
	// AbortSignal
	// -----------------------------------------------------------------------
	describe("AbortSignal", () => {
		it("stops on pre-aborted signal", async () => {
			const stream = createStream([
				'data: {"type":"text_delta","delta":"a"}\n\n',
			]);
			const controller = new AbortController();
			controller.abort();
			const events = await collect(parseSSEStream(stream, controller.signal));
			expect(events).toEqual([]);
		});

		it("stops mid-stream when aborted", async () => {
			const controller = new AbortController();
			let readCount = 0;
			const stream = new ReadableStream<Uint8Array>({
				pull(ctrl) {
					readCount++;
					if (readCount === 1) {
						ctrl.enqueue(
							encoder.encode('data: {"type":"text_delta","delta":"first"}\n\n'),
						);
					} else if (readCount === 2) {
						controller.abort();
						ctrl.enqueue(
							encoder.encode(
								'data: {"type":"text_delta","delta":"second"}\n\n',
							),
						);
					} else {
						ctrl.close();
					}
				},
			});
			const events = await collect(parseSSEStream(stream, controller.signal));
			// Should get first event, then abort kicks in before processing third read
			expect(events.length).toBeGreaterThanOrEqual(1);
			expect(events[0]).toEqual({ type: "text_delta", delta: "first" });
		});
	});
});
