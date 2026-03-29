import { describe, expect, it } from "vitest";
import { fromOpenAiAgents } from "../src/openai-converter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RawItem = Record<string, unknown>;

function msg(role: string, content: unknown, extra?: RawItem): RawItem {
	return { type: "message", role, content, ...extra };
}

function easyMsg(role: string, content: unknown, extra?: RawItem): RawItem {
	return { role, content, ...extra };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fromOpenAiAgents", () => {
	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------
	describe("edge cases", () => {
		it("returns empty array for empty input", () => {
			expect(fromOpenAiAgents([])).toEqual([]);
		});

		it("skips non-object items", () => {
			const result = fromOpenAiAgents([
				null as unknown as RawItem,
				42 as unknown as RawItem,
				"str" as unknown as RawItem,
			]);
			expect(result).toEqual([]);
		});

		it("skips items missing type and role", () => {
			const result = fromOpenAiAgents([{ foo: "bar" }]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// User messages
	// -----------------------------------------------------------------------
	describe("user messages", () => {
		it("handles string content", () => {
			const result = fromOpenAiAgents([msg("user", "hello")]);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("user");
			expect(result[0].parts).toEqual([{ type: "text", text: "hello" }]);
		});

		it("handles array content with strings", () => {
			const result = fromOpenAiAgents([msg("user", ["a", "b"])]);
			expect(result[0].parts[0]).toEqual({ type: "text", text: "ab" });
		});

		it("handles array content with input_text parts", () => {
			const result = fromOpenAiAgents([
				msg("user", [{ type: "input_text", text: "hi" }]),
			]);
			expect(result[0].parts[0]).toEqual({ type: "text", text: "hi" });
		});

		it("handles EasyInputMessageParam (no type field)", () => {
			const result = fromOpenAiAgents([easyMsg("user", "easy")]);
			expect(result).toHaveLength(1);
			expect(result[0].parts[0]).toEqual({ type: "text", text: "easy" });
		});

		it("skips user message with empty content", () => {
			const result = fromOpenAiAgents([msg("user", "")]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// Assistant messages
	// -----------------------------------------------------------------------
	describe("assistant messages", () => {
		it("handles output_text content", () => {
			const result = fromOpenAiAgents([
				msg("assistant", [{ type: "output_text", text: "hi there" }]),
			]);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
			expect(result[0].parts).toEqual([{ type: "text", text: "hi there" }]);
		});

		it("handles refusal content", () => {
			const result = fromOpenAiAgents([
				msg("assistant", [{ type: "refusal", refusal: "I can't do that" }]),
			]);
			expect(result[0].parts[0]).toEqual({
				type: "text",
				text: "[Refusal]: I can't do that",
			});
		});

		it("merges consecutive assistant messages", () => {
			const result = fromOpenAiAgents([
				msg("assistant", [{ type: "output_text", text: "part1" }]),
				msg("assistant", [{ type: "output_text", text: "part2" }]),
			]);
			expect(result).toHaveLength(1);
			expect(result[0].parts).toHaveLength(2);
		});

		it("handles EasyInputMessageParam assistant (no type field)", () => {
			const result = fromOpenAiAgents([
				easyMsg("assistant", [{ type: "output_text", text: "easy" }]),
			]);
			expect(result).toHaveLength(1);
			expect(result[0].parts[0]).toEqual({ type: "text", text: "easy" });
		});

		it("handles assistant with non-array content", () => {
			const result = fromOpenAiAgents([msg("assistant", null)]);
			expect(result).toHaveLength(1);
			expect(result[0].parts).toEqual([]);
		});

		it("skips non-object items in content array", () => {
			const result = fromOpenAiAgents([
				msg("assistant", [null, { type: "output_text", text: "ok" }]),
			]);
			expect(result[0].parts).toEqual([{ type: "text", text: "ok" }]);
		});
	});

	// -----------------------------------------------------------------------
	// System/developer messages
	// -----------------------------------------------------------------------
	describe("system/developer messages", () => {
		it("skips system messages (type=message)", () => {
			const result = fromOpenAiAgents([msg("system", "sys prompt")]);
			expect(result).toEqual([]);
		});

		it("skips developer messages (type=message)", () => {
			const result = fromOpenAiAgents([msg("developer", "dev prompt")]);
			expect(result).toEqual([]);
		});

		it("skips system messages (no type field)", () => {
			const result = fromOpenAiAgents([easyMsg("system", "sys")]);
			expect(result).toEqual([]);
		});

		it("skips developer messages (no type field)", () => {
			const result = fromOpenAiAgents([easyMsg("developer", "dev")]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// ID extraction
	// -----------------------------------------------------------------------
	describe("ID extraction", () => {
		it("uses valid id", () => {
			const result = fromOpenAiAgents([msg("user", "hi", { id: "msg_123" })]);
			expect(result[0].id).toBe("msg_123");
		});

		it("falls back for __fake_id__", () => {
			const result = fromOpenAiAgents([
				msg("user", "hi", { id: "__fake_id__" }),
			]);
			expect(result[0].id).toBe("openai_0");
		});

		it("falls back for missing id", () => {
			const result = fromOpenAiAgents([msg("user", "hi")]);
			expect(result[0].id).toBe("openai_0");
		});

		it("falls back for empty string id", () => {
			const result = fromOpenAiAgents([msg("user", "hi", { id: "" })]);
			expect(result[0].id).toBe("openai_0");
		});
	});

	// -----------------------------------------------------------------------
	// Tool calls
	// -----------------------------------------------------------------------
	describe("tool calls", () => {
		it("handles function_call", () => {
			const result = fromOpenAiAgents([
				{
					type: "function_call",
					name: "get_weather",
					arguments: '{"city":"SF"}',
					call_id: "call_1",
				},
			]);
			expect(result).toHaveLength(1);
			const part = result[0].parts[0];
			expect(part.type).toBe("tool_call");
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("get_weather");
				expect(part.argument).toBe('{"city":"SF"}');
				expect(part.callId).toBe("call_1");
			}
		});

		it("handles function_call missing name/arguments", () => {
			const result = fromOpenAiAgents([
				{ type: "function_call", call_id: "c1" },
			]);
			expect(result).toEqual([]);
		});

		it("handles web_search_call", () => {
			const result = fromOpenAiAgents([
				{ type: "web_search_call", action: "search", id: "ws_1" },
			]);
			const part = result[0].parts[0];
			expect(part.type).toBe("tool_call");
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("web_search");
				expect(part.callId).toBe("ws_1");
			}
		});

		it("handles file_search_call", () => {
			const result = fromOpenAiAgents([
				{ type: "file_search_call", queries: ["foo"], id: "fs_1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("file_search");
				expect(part.argument).toBe(JSON.stringify({ queries: ["foo"] }));
			}
		});

		it("handles computer_call", () => {
			const result = fromOpenAiAgents([
				{ type: "computer_call", action: "click", call_id: "cc_1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("computer");
				expect(part.callId).toBe("cc_1");
			}
		});

		it("handles shell_call", () => {
			const result = fromOpenAiAgents([
				{ type: "shell_call", action: "ls", call_id: "sh_1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("shell");
				expect(part.callId).toBe("sh_1");
			}
		});

		it("handles local_shell_call", () => {
			const result = fromOpenAiAgents([
				{ type: "local_shell_call", action: "pwd", call_id: "lsh_1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("shell");
			}
		});

		it("handles code_interpreter_call", () => {
			const result = fromOpenAiAgents([
				{ type: "code_interpreter_call", code: "print(1)", id: "ci_1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("code_interpreter");
				expect(part.argument).toBe("print(1)");
			}
		});

		it("handles code_interpreter_call missing code", () => {
			const result = fromOpenAiAgents([
				{ type: "code_interpreter_call", id: "ci_2" },
			]);
			expect(result).toEqual([]);
		});

		it("handles apply_patch_call", () => {
			const result = fromOpenAiAgents([
				{ type: "apply_patch_call", operation: "patch data", call_id: "ap_1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("apply_patch");
				expect(part.callId).toBe("ap_1");
			}
		});

		it("handles mcp_call", () => {
			const result = fromOpenAiAgents([
				{
					type: "mcp_call",
					name: "my_tool",
					arguments: '{"x":1}',
					id: "mcp_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("my_tool");
				expect(part.argument).toBe('{"x":1}');
			}
		});

		it("handles mcp_call with object arguments", () => {
			const result = fromOpenAiAgents([
				{ type: "mcp_call", name: "tool", arguments: { x: 1 }, id: "mcp_2" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.argument).toBe(JSON.stringify({ x: 1 }));
			}
		});

		it("handles mcp_call missing name", () => {
			const result = fromOpenAiAgents([
				{ type: "mcp_call", arguments: "{}", id: "mcp_3" },
			]);
			expect(result).toEqual([]);
		});

		it("handles custom_tool_call", () => {
			const result = fromOpenAiAgents([
				{
					type: "custom_tool_call",
					name: "my_custom",
					input: '{"a":1}',
					call_id: "ct_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.tool_name).toBe("my_custom");
				expect(part.argument).toBe('{"a":1}');
			}
		});

		it("handles custom_tool_call with object input", () => {
			const result = fromOpenAiAgents([
				{
					type: "custom_tool_call",
					name: "tool",
					input: { a: 1 },
					call_id: "ct_2",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.argument).toBe(JSON.stringify({ a: 1 }));
			}
		});

		it("handles custom_tool_call missing name", () => {
			const result = fromOpenAiAgents([
				{ type: "custom_tool_call", input: "{}", call_id: "ct_3" },
			]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// Special parts
	// -----------------------------------------------------------------------
	describe("special parts", () => {
		it("handles image_generation_call", () => {
			const result = fromOpenAiAgents([
				{ type: "image_generation_call", id: "img_1" },
			]);
			expect(result[0].parts[0]).toEqual({
				type: "text",
				text: "[Image Generated]",
			});
		});

		it("handles reasoning with summary", () => {
			const result = fromOpenAiAgents([
				{
					type: "reasoning",
					id: "r_1",
					summary: [{ type: "summary_text", text: "I thought about it" }],
				},
			]);
			expect(result[0].parts[0]).toEqual({
				type: "reasoning",
				text: "I thought about it",
			});
		});

		it("handles reasoning without summary", () => {
			const result = fromOpenAiAgents([{ type: "reasoning", id: "r_2" }]);
			expect(result[0].parts[0]).toEqual({ type: "reasoning", text: "" });
		});

		it("handles reasoning with multiple summary items", () => {
			const result = fromOpenAiAgents([
				{
					type: "reasoning",
					id: "r_3",
					summary: [
						{ type: "summary_text", text: "step 1" },
						{ type: "summary_text", text: "step 2" },
					],
				},
			]);
			expect(result[0].parts[0]).toEqual({
				type: "reasoning",
				text: "step 1\nstep 2",
			});
		});

		it("handles reasoning summary with non-matching items", () => {
			const result = fromOpenAiAgents([
				{
					type: "reasoning",
					id: "r_4",
					summary: [{ type: "other", text: "ignored" }, "not_an_object"],
				},
			]);
			expect(result[0].parts[0]).toEqual({ type: "reasoning", text: "" });
		});
	});

	// -----------------------------------------------------------------------
	// Tool outputs
	// -----------------------------------------------------------------------
	describe("tool outputs", () => {
		it("handles function_call_output", () => {
			const result = fromOpenAiAgents([
				{
					type: "function_call",
					name: "fn",
					arguments: "{}",
					call_id: "c1",
				},
				{ type: "function_call_output", output: "result", call_id: "c1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("result");
			}
		});

		it("handles function_call_output with array output", () => {
			const result = fromOpenAiAgents([
				{
					type: "function_call",
					name: "fn",
					arguments: "{}",
					call_id: "c1",
				},
				{ type: "function_call_output", output: [1, 2], call_id: "c1" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("[1,2]");
			}
		});

		it("handles computer_call_output with screenshot", () => {
			const result = fromOpenAiAgents([
				{ type: "computer_call", action: "click", call_id: "cc_1" },
				{
					type: "computer_call_output",
					output: { type: "computer_screenshot" },
					call_id: "cc_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("[Screenshot captured]");
			}
		});

		it("handles computer_call_output with non-screenshot output", () => {
			const result = fromOpenAiAgents([
				{ type: "computer_call", action: "click", call_id: "cc_1" },
				{
					type: "computer_call_output",
					output: { type: "other" },
					call_id: "cc_1",
				},
			]);
			// extractComputerCallOutput returns null for non-screenshot
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBeUndefined();
			}
		});

		it("handles shell_call_output with string output", () => {
			const result = fromOpenAiAgents([
				{ type: "shell_call", action: "ls", call_id: "sh_1", id: "sh_1" },
				{
					type: "shell_call_output",
					output: "file.txt",
					id: "sh_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("file.txt");
			}
		});

		it("handles shell_call_output with array of chunks", () => {
			const result = fromOpenAiAgents([
				{ type: "shell_call", action: "ls", call_id: "sh_1", id: "sh_1" },
				{
					type: "shell_call_output",
					output: [
						{ stdout: "out1", stderr: "" },
						{ stdout: "", stderr: "err2" },
					],
					id: "sh_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toContain("stdout: out1");
				expect(part.result).toContain("stderr: err2");
			}
		});

		it("handles local_shell_call_output", () => {
			const result = fromOpenAiAgents([
				{
					type: "local_shell_call",
					action: "pwd",
					call_id: "lsh_1",
					id: "lsh_1",
				},
				{
					type: "local_shell_call_output",
					output: "/home",
					id: "lsh_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("/home");
			}
		});

		it("handles apply_patch_call_output", () => {
			const result = fromOpenAiAgents([
				{ type: "apply_patch_call", operation: "p", call_id: "ap_1" },
				{
					type: "apply_patch_call_output",
					status: "success",
					output: "Applied",
					call_id: "ap_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("Status: success\nApplied");
			}
		});

		it("handles apply_patch_call_output without output", () => {
			const result = fromOpenAiAgents([
				{ type: "apply_patch_call", operation: "p", call_id: "ap_2" },
				{
					type: "apply_patch_call_output",
					status: "failed",
					call_id: "ap_2",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("Status: failed");
			}
		});

		it("handles custom_tool_call_output", () => {
			const result = fromOpenAiAgents([
				{
					type: "custom_tool_call",
					name: "t",
					input: "{}",
					call_id: "ct_1",
				},
				{
					type: "custom_tool_call_output",
					output: "done",
					call_id: "ct_1",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("done");
			}
		});

		it("handles custom_tool_call_output with array output", () => {
			const result = fromOpenAiAgents([
				{
					type: "custom_tool_call",
					name: "t",
					input: "{}",
					call_id: "ct_2",
				},
				{
					type: "custom_tool_call_output",
					output: ["a", "b"],
					call_id: "ct_2",
				},
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe('["a","b"]');
			}
		});
	});

	// -----------------------------------------------------------------------
	// Tool result attachment
	// -----------------------------------------------------------------------
	describe("tool result attachment", () => {
		it("matches by callId", () => {
			const result = fromOpenAiAgents([
				{
					type: "function_call",
					name: "a",
					arguments: "{}",
					call_id: "c1",
				},
				{
					type: "function_call",
					name: "b",
					arguments: "{}",
					call_id: "c2",
				},
				{ type: "function_call_output", output: "res_b", call_id: "c2" },
				{ type: "function_call_output", output: "res_a", call_id: "c1" },
			]);
			const parts = result[0].parts;
			if (parts[0].type === "tool_call") expect(parts[0].result).toBe("res_a");
			if (parts[1].type === "tool_call") expect(parts[1].result).toBe("res_b");
		});

		it("falls back to last unresolved tool_call", () => {
			const result = fromOpenAiAgents([
				{
					type: "function_call",
					name: "fn",
					arguments: "{}",
				},
				{ type: "function_call_output", output: "fallback_result" },
			]);
			const part = result[0].parts[0];
			if (part.type === "tool_call") {
				expect(part.result).toBe("fallback_result");
			}
		});

		it("silently drops output with no matching tool call", () => {
			const result = fromOpenAiAgents([
				{ type: "function_call_output", output: "orphan", call_id: "nope" },
			]);
			expect(result).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// Skipped types
	// -----------------------------------------------------------------------
	describe("skipped types", () => {
		const skippedTypes = [
			"mcp_list_tools",
			"mcp_approval_request",
			"mcp_approval_response",
			"compaction",
			"item_reference",
			"tool_search_call",
			"tool_search_output",
		];

		for (const type of skippedTypes) {
			it(`silently skips ${type}`, () => {
				const result = fromOpenAiAgents([{ type, id: "skip_1" }]);
				expect(result).toEqual([]);
			});
		}
	});

	// -----------------------------------------------------------------------
	// Integration
	// -----------------------------------------------------------------------
	describe("integration", () => {
		it("handles full conversation flow", () => {
			const items: RawItem[] = [
				msg("user", "What's the weather?", { id: "u1" }),
				{
					type: "function_call",
					name: "get_weather",
					arguments: '{"city":"SF"}',
					call_id: "fc_1",
					id: "a1",
				},
				{
					type: "function_call_output",
					output: "72°F sunny",
					call_id: "fc_1",
				},
				msg(
					"assistant",
					[{ type: "output_text", text: "It's 72°F and sunny!" }],
					{
						id: "a2",
					},
				),
			];
			const result = fromOpenAiAgents(items);
			expect(result).toHaveLength(2); // user + assistant
			expect(result[0].role).toBe("user");
			expect(result[1].role).toBe("assistant");
			// assistant should have tool_call + text
			expect(result[1].parts).toHaveLength(2);
			expect(result[1].parts[0].type).toBe("tool_call");
			expect(result[1].parts[1].type).toBe("text");
		});

		it("user message finalizes pending assistant", () => {
			const items: RawItem[] = [
				msg("assistant", [{ type: "output_text", text: "hi" }], { id: "a1" }),
				msg("user", "thanks", { id: "u1" }),
			];
			const result = fromOpenAiAgents(items);
			expect(result).toHaveLength(2);
			expect(result[0].role).toBe("assistant");
			expect(result[1].role).toBe("user");
		});

		it("finalizes last assistant message at end", () => {
			const items: RawItem[] = [
				msg("assistant", [{ type: "output_text", text: "final" }], {
					id: "a1",
				}),
			];
			const result = fromOpenAiAgents(items);
			expect(result).toHaveLength(1);
			expect(result[0].role).toBe("assistant");
		});

		it("handles unknown message role gracefully", () => {
			const result = fromOpenAiAgents([msg("unknown_role", "x")]);
			expect(result).toEqual([]);
		});
	});
});
