import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";
import { parseIncremental } from "../src/core/parser.js";

/**
 * Flicker Regression Tests
 *
 * These tests verify that partial markdown never renders broken syntax
 * (raw asterisks, backticks, brackets) during streaming.
 *
 * Based on SPEC.md section 8.1.
 */
describe("flicker regression", () => {
	/**
	 * CASE 1: Bold word
	 * Stream: "Hello **" → "Hello **world" → "Hello **world**"
	 * Assert: DOM never shows "Hello **" or "Hello **world" as plain text
	 */
	it("CASE 1: Bold word — no raw asterisks visible during streaming", () => {
		// State 1: "Hello **"
		const { container: c1 } = render(
			createElement(StreamingMarkdown, {
				content: "Hello **",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		// Should NOT show raw "**" in visible text
		const text1 = c1.textContent ?? "";
		expect(text1).not.toContain("**");

		// State 2: "Hello **world"
		const { container: c2 } = render(
			createElement(StreamingMarkdown, {
				content: "Hello **world",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text2 = c2.textContent ?? "";
		expect(text2).not.toContain("**");

		// State 3: "Hello **world**" — resolved
		const { container: c3 } = render(
			createElement(StreamingMarkdown, {
				content: "Hello **world**",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		expect(c3.querySelector("strong")).toBeTruthy();
		expect(c3.textContent).toContain("world");
	});

	/**
	 * CASE 2: Italic word
	 * Stream: "This is *" → "This is *important" → "This is *important*"
	 * Assert: No raw asterisks visible at any point
	 */
	it("CASE 2: Italic word — no raw asterisks visible during streaming", () => {
		// State 1: "This is *"
		const { container: c1 } = render(
			createElement(StreamingMarkdown, {
				content: "This is *",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text1 = c1.textContent ?? "";
		expect(text1).not.toMatch(/\*/);

		// State 2: "This is *important"
		const { container: c2 } = render(
			createElement(StreamingMarkdown, {
				content: "This is *important",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text2 = c2.textContent ?? "";
		expect(text2).not.toMatch(/\*/);

		// State 3: "This is *important*" — resolved
		const { container: c3 } = render(
			createElement(StreamingMarkdown, {
				content: "This is *important*",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		expect(c3.querySelector("em")).toBeTruthy();
		expect(c3.textContent).toContain("important");
	});

	/**
	 * CASE 3: Code block
	 * Stream: "```\n" → "```\nconsole" → "```\nconsole.log()\n```"
	 * Assert: Never renders as <p>, always resolves to <pre><code>
	 */
	it("CASE 3: Code block — never renders as paragraph, always as code", () => {
		// State 1: "```\n"
		const r1 = parseIncremental("```\n");
		expect(r1.blocks[0].type).toBe("code");
		expect(r1.blocks[0].type).not.toBe("paragraph");

		// State 2: "```\nconsole"
		const r2 = parseIncremental("```\nconsole");
		expect(r2.blocks[0].type).toBe("code");
		expect(r2.blocks[0].type).not.toBe("paragraph");

		// State 3: "```\nconsole.log()\n```" — resolved
		const r3 = parseIncremental("```\nconsole.log()\n```");
		expect(r3.blocks[0].type).toBe("code");
		expect(r3.blocks[0].complete).toBe(true);

		// Verify DOM rendering at each state
		const { container: c1 } = render(
			createElement(StreamingMarkdown, {
				content: "```\n",
				batchMs: 0,
			}),
		);
		expect(c1.querySelector("p")).toBeFalsy();
		// Should have a pre/code skeleton
		expect(c1.querySelector("pre") || c1.querySelector("code")).toBeTruthy();

		const { container: c3 } = render(
			createElement(StreamingMarkdown, {
				content: "```\nconsole.log()\n```",
				batchMs: 0,
			}),
		);
		expect(c3.querySelector("pre")).toBeTruthy();
		expect(c3.querySelector("code")).toBeTruthy();
	});

	/**
	 * CASE 4: Inline code
	 * Stream: "Use `cons" → "Use `console" → "Use `console.log()`"
	 * Assert: Backticks never visible in DOM
	 */
	it("CASE 4: Inline code — backticks never visible during streaming", () => {
		// State 1: "Use `cons"
		const { container: c1 } = render(
			createElement(StreamingMarkdown, {
				content: "Use `cons",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text1 = c1.textContent ?? "";
		expect(text1).not.toContain("`");

		// State 2: "Use `console"
		const { container: c2 } = render(
			createElement(StreamingMarkdown, {
				content: "Use `console",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text2 = c2.textContent ?? "";
		expect(text2).not.toContain("`");

		// State 3: "Use `console.log()`" — resolved
		const { container: c3 } = render(
			createElement(StreamingMarkdown, {
				content: "Use `console.log()`",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		expect(c3.querySelector("code")).toBeTruthy();
		expect(c3.textContent).toContain("console.log()");
	});

	/**
	 * CASE 5: Link
	 * Stream: "[click" → "[click here" → "[click here](https://deltakit.dev)"
	 * Assert: No raw brackets visible before URL resolves
	 */
	it("CASE 5: Link — no raw brackets visible during streaming", () => {
		// State 1: "[click"
		const { container: c1 } = render(
			createElement(StreamingMarkdown, {
				content: "[click",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text1 = c1.textContent ?? "";
		expect(text1).not.toContain("[");
		expect(text1).not.toContain("]");

		// State 2: "[click here"
		const { container: c2 } = render(
			createElement(StreamingMarkdown, {
				content: "[click here",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const text2 = c2.textContent ?? "";
		expect(text2).not.toContain("[");

		// State 3: "[click here](https://deltakit.dev)" — resolved
		const { container: c3 } = render(
			createElement(StreamingMarkdown, {
				content: "[click here](https://deltakit.dev)",
				batchMs: 0,
				bufferIncomplete: true,
			}),
		);
		const link = c3.querySelector("a");
		expect(link).toBeTruthy();
		expect(link?.getAttribute("href")).toBe("https://deltakit.dev");
		expect(c3.textContent).toContain("click here");
	});
});

describe("stable block rerender count", () => {
	/**
	 * Prior blocks never rerender:
	 * Stream 3 complete paragraphs + 1 active paragraph
	 * Blocks 0-2 should be complete and stable
	 */
	it("completed blocks should be marked stable across stream states", () => {
		const states = [
			"Para one.\n\n",
			"Para one.\n\nPara two.\n\n",
			"Para one.\n\nPara two.\n\nPara three.\n\n",
			"Para one.\n\nPara two.\n\nPara three.\n\nActive para being stre",
		];

		const finalResult = parseIncremental(states[3]);

		// First 3 blocks should be complete
		expect(finalResult.blocks[0].complete).toBe(true);
		expect(finalResult.blocks[1].complete).toBe(true);
		expect(finalResult.blocks[2].complete).toBe(true);

		// 4th block should be incomplete (active)
		expect(finalResult.blocks[3].complete).toBe(false);

		// Verify raw content of stable blocks doesn't change across states
		for (let stateIdx = 1; stateIdx < states.length; stateIdx++) {
			const result = parseIncremental(states[stateIdx]);
			expect(result.blocks[0].raw).toBe("Para one.");
			if (stateIdx >= 2) {
				expect(result.blocks[1].raw).toBe("Para two.");
			}
			if (stateIdx >= 3) {
				expect(result.blocks[2].raw).toBe("Para three.");
			}
		}
	});
});
