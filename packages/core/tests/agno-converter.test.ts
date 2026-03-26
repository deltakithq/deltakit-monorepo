import { describe, expect, it } from "vitest";
import { fromAgnoAgents } from "../src/agno-converter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AgnoMessage = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fromAgnoAgents", () => {
	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------
	describe("edge cases", () => {
		it("returns empty array for empty input", () => {
			expect(fromAgnoAgents([])).toEqual([]);
		});

		it("skips non-object items", () => {
			const result = fromAgnoAgents([null as any, 42 as any]);
			expect(result).toEqual([]);
		});

		it("skips messages without role", () => {
			const result = fromAgnoAgents([{ content: "no role" }]);
			expect(result).toEqual([]);
		});

		it("skips unknown roles", () => {
			const result = fromAgnoAgents([{ role: "system", content: "sys" }]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// User messages
	// -----------------------------------------------------------------------
	describe("user messages", () => {
		it("handles string content", () => {
			const result = fromAgnoAgents([{ role: "user", content: "hello" }]);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("user");
			expect(result[0].parts).toEqual([{ type: "text", text: "hello" }]);
		});

		it("skips null content", () => {
			const result = fromAgnoAgents([{ role: "user", content: null }]);
			expect(result).toEqual([]);
		});

		it("skips undefined content", () => {
			const result = fromAgnoAgents([{ role: "user", content: undefined }]);
			expect(result).toEqual([]);
		});

		it("stringifies numeric content", () => {
			const result = fromAgnoAgents([{ role: "user", content: 42 }]);
			expect(result[0].parts[0]).toEqual({ type: "text", text: "42" });
		});
	});

	// -----------------------------------------------------------------------
	// Assistant messages
	// -----------------------------------------------------------------------
	describe("assistant messages", () => {
		it("handles text content", () => {
			const result = fromAgnoAgents([
				{ role: "assistant", content: "response" },
			]);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
			expect(result[0].parts).toEqual([{ type: "text", text: "response" }]);
		});

		it("handles reasoning content", () => {
			const result = fromAgnoAgents([
				{ role: "assistant", reasoning_content: "thinking..." },
			]);
			expect(result[0].parts).toEqual([
				{ type: "reasoning", text: "thinking..." },
			]);
		});

		it("handles tool_calls", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{
							id: "tc_1",
							function: { name: "search", arguments: '{"q":"test"}' },
						},
					],
				},
			]);
			expect(result[0].parts).toHaveLength(1);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("search");
				expect(part.argument).toBe('{"q":"test"}');
				expect(part.callId).toBe("tc_1");
			}
		});

		it("handles all combined: reasoning + tool_calls + text", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					content: "done",
					reasoning_content: "let me think",
					tool_calls: [
						{ id: "tc_1", function: { name: "fn", arguments: "{}" } },
					],
				},
			]);
			expect(result[0].parts).toHaveLength(3);
			expect(result[0].parts[0].type).toBe("reasoning");
			expect(result[0].parts[1].type).toBe("tool_call");
			expect(result[0].parts[2].type).toBe("text");
		});

		it("merges consecutive assistant messages", () => {
			const result = fromAgnoAgents([
				{ role: "assistant", content: "part1" },
				{ role: "assistant", content: "part2" },
			]);
			expect(result).toHaveLength(1);
			expect(result[0].parts).toHaveLength(2);
		});

		it("skips assistant with no content, no reasoning, no tool_calls", () => {
			const result = fromAgnoAgents([{ role: "assistant" }]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// ID extraction
	// -----------------------------------------------------------------------
	describe("ID extraction", () => {
		it("uses provided id", () => {
			const result = fromAgnoAgents([
				{ role: "user", content: "hi", id: "msg_1" },
			]);
			expect(result[0].id).toBe("msg_1");
		});

		it("falls back to agno_{index} without id", () => {
			const result = fromAgnoAgents([{ role: "user", content: "hi" }]);
			expect(result[0].id).toBe("agno_0");
		});
	});

	// -----------------------------------------------------------------------
	// Tool calls details
	// -----------------------------------------------------------------------
	describe("tool call details", () => {
		it("handles non-string arguments (stringified)", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{ id: "tc_1", function: { name: "fn", arguments: { x: 1 } } },
					],
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.argument).toBe(JSON.stringify({ x: 1 }));
			}
		});

		it("skips tool_call without function", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [{ id: "tc_1" }],
					content: "text",
				},
			]);
			// only text part, tool_call is skipped
			expect(result[0].parts).toHaveLength(1);
			expect(result[0].parts[0].type).toBe("text");
		});

		it("skips tool_call missing name", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [{ id: "tc_1", function: { arguments: "{}" } }],
					content: "text",
				},
			]);
			expect(result[0].parts).toHaveLength(1);
			expect(result[0].parts[0].type).toBe("text");
		});

		it("skips non-object tool_calls", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [null, "bad"],
					content: "text",
				},
			]);
			expect(result[0].parts).toHaveLength(1);
		});

		it("handles tool_call without callId", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [{ function: { name: "fn", arguments: "{}" } }],
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.callId).toBeUndefined();
			}
		});
	});

	// -----------------------------------------------------------------------
	// Tool results
	// -----------------------------------------------------------------------
	describe("tool results", () => {
		it("matches tool result by tool_name", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{ id: "tc_1", function: { name: "search", arguments: "{}" } },
					],
				},
				{ role: "tool", tool_name: "search", content: "found it" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("found it");
			}
		});

		it("stringifies non-string content in tool result", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{ id: "tc_1", function: { name: "fn", arguments: "{}" } },
					],
				},
				{ role: "tool", tool_name: "fn", content: 42 },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("42");
			}
		});

		it("handles null content in tool result", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{ id: "tc_1", function: { name: "fn", arguments: "{}" } },
					],
				},
				{ role: "tool", tool_name: "fn", content: null },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("");
			}
		});

		it("silently drops tool result with no matching tool_name", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{ id: "tc_1", function: { name: "search", arguments: "{}" } },
					],
				},
				{ role: "tool", tool_name: "other", content: "nope" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBeUndefined();
			}
		});

		it("drops tool result without tool_name", () => {
			const result = fromAgnoAgents([
				{
					role: "assistant",
					tool_calls: [
						{ id: "tc_1", function: { name: "fn", arguments: "{}" } },
					],
				},
				{ role: "tool", content: "orphan" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBeUndefined();
			}
		});
	});

	// -----------------------------------------------------------------------
	// Integration
	// -----------------------------------------------------------------------
	describe("integration", () => {
		it("handles full user -> assistant -> tool -> assistant flow", () => {
			const msgs: AgnoMessage[] = [
				{ role: "user", content: "search for cats", id: "u1" },
				{
					role: "assistant",
					tool_calls: [
						{
							id: "tc_1",
							function: { name: "web_search", arguments: '{"q":"cats"}' },
						},
					],
					id: "a1",
				},
				{
					role: "tool",
					tool_name: "web_search",
					content: "Found 10 results about cats",
				},
				{
					role: "assistant",
					content: "I found 10 results about cats!",
					id: "a2",
				},
			];
			const result = fromAgnoAgents(msgs);
			expect(result).toHaveLength(2); // user + merged assistant
			expect(result[0].role).toBe("user");
			expect(result[1].role).toBe("assistant");
			// assistant parts: tool_call (with result) + text
			expect(result[1].parts).toHaveLength(2);
			expect(result[1].parts[0].type).toBe("tool_call");
			if (result[1].parts[0].type === "tool_call") {
				expect(result[1].parts[0].result).toBe("Found 10 results about cats");
			}
			expect(result[1].parts[1].type).toBe("text");
		});

		it("finalizes last assistant message", () => {
			const result = fromAgnoAgents([
				{ role: "assistant", content: "final", id: "a1" },
			]);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
		});

		it("user message finalizes pending assistant", () => {
			const result = fromAgnoAgents([
				{ role: "assistant", content: "hi", id: "a1" },
				{ role: "user", content: "thanks", id: "u1" },
			]);
			expect(result).toHaveLength(2);
			expect(result[0].role).toBe("assistant");
			expect(result[1].role).toBe("user");
		});
	});
});
