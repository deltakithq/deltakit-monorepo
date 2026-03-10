import { describe, expect, it } from "vitest";
import { parseIncremental } from "../src/core/parser.js";

describe("parseIncremental", () => {
	describe("block detection", () => {
		it("should parse a heading", () => {
			const result = parseIncremental("# Hello\n\nWorld");
			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].level).toBe(1);
			expect(result.blocks[0].complete).toBe(true);
			expect(result.blocks[1].type).toBe("paragraph");
		});

		it("should parse h1 through h6", () => {
			const content =
				"# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n\n";
			const result = parseIncremental(content);
			const headings = result.blocks.filter((b) => b.type === "heading");
			expect(headings).toHaveLength(6);
			expect(headings[0].level).toBe(1);
			expect(headings[1].level).toBe(2);
			expect(headings[2].level).toBe(3);
			expect(headings[3].level).toBe(4);
			expect(headings[4].level).toBe(5);
			expect(headings[5].level).toBe(6);
		});

		it("should parse a paragraph", () => {
			const result = parseIncremental("Hello world\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].complete).toBe(true);
			expect(result.blocks[0].raw).toBe("Hello world");
		});

		it("should parse a code block", () => {
			const result = parseIncremental("```js\nconsole.log('hi')\n```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].complete).toBe(true);
			expect(result.blocks[0].language).toBe("js");
		});

		it("should parse a blockquote", () => {
			const result = parseIncremental("> Hello world\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should parse an unordered list", () => {
			const result = parseIncremental("- Item 1\n- Item 2\n- Item 3\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].listStyle).toBe("unordered");
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should parse an ordered list", () => {
			const result = parseIncremental("1. First\n2. Second\n3. Third\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].listStyle).toBe("ordered");
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should parse a horizontal rule", () => {
			const result = parseIncremental("---\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should parse a table", () => {
			const result = parseIncremental("| A | B |\n|---|---|\n| 1 | 2 |\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
			expect(result.blocks[0].complete).toBe(true);
		});
	});

	describe("block completion", () => {
		it("heading is complete after newline", () => {
			const incomplete = parseIncremental("# Hello");
			expect(incomplete.blocks[0].complete).toBe(false);

			const complete = parseIncremental("# Hello\n\nNext");
			expect(complete.blocks[0].complete).toBe(true);
		});

		it("paragraph is complete after blank line", () => {
			const incomplete = parseIncremental("Hello world");
			expect(incomplete.blocks[0].complete).toBe(false);

			const complete = parseIncremental("Hello world\n\n");
			expect(complete.blocks[0].complete).toBe(true);
		});

		it("code block is complete after closing fence", () => {
			const incomplete = parseIncremental("```js\nconsole.log('hi')");
			expect(incomplete.blocks[0].type).toBe("code");
			expect(incomplete.blocks[0].complete).toBe(false);

			const complete = parseIncremental("```js\nconsole.log('hi')\n```");
			expect(complete.blocks[0].complete).toBe(true);
		});

		it("blockquote is complete after blank line", () => {
			const incomplete = parseIncremental("> Hello");
			expect(incomplete.blocks[0].complete).toBe(false);

			const complete = parseIncremental("> Hello\n\n");
			expect(complete.blocks[0].complete).toBe(true);
		});

		it("list is complete after blank line", () => {
			const incomplete = parseIncremental("- Item 1\n- Item 2");
			expect(incomplete.blocks[0].complete).toBe(false);

			const complete = parseIncremental("- Item 1\n- Item 2\n\n");
			expect(complete.blocks[0].complete).toBe(true);
		});
	});

	describe("multiple blocks", () => {
		it("should parse heading + paragraph", () => {
			const result = parseIncremental("# Title\n\nSome paragraph text\n\n");
			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].complete).toBe(true);
			expect(result.blocks[1].type).toBe("paragraph");
			expect(result.blocks[1].complete).toBe(true);
		});

		it("should parse mixed content (heading → paragraph → code → paragraph)", () => {
			const content =
				"# Hello\n\nSome text\n\n```js\ncode\n```\n\nMore text\n\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(4);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[1].type).toBe("paragraph");
			expect(result.blocks[2].type).toBe("code");
			expect(result.blocks[3].type).toBe("paragraph");
			for (const block of result.blocks) {
				expect(block.complete).toBe(true);
			}
		});

		it("completed blocks are stable (never change) when new content arrives", () => {
			const stream1 = parseIncremental("# Hello\n\nThis is ");
			expect(stream1.blocks[0].type).toBe("heading");
			expect(stream1.blocks[0].complete).toBe(true);
			expect(stream1.blocks[0].raw).toBe("# Hello");

			const stream2 = parseIncremental("# Hello\n\nThis is a paragraph");
			expect(stream2.blocks[0].type).toBe("heading");
			expect(stream2.blocks[0].complete).toBe(true);
			expect(stream2.blocks[0].raw).toBe("# Hello");
		});
	});

	describe("incomplete syntax buffering", () => {
		it("should buffer unclosed bold marker", () => {
			const result = parseIncremental("Hello **wor", {
				bufferIncomplete: true,
			});
			expect(result.buffered).toContain("**");
		});

		it("should not buffer when bufferIncomplete is false", () => {
			const result = parseIncremental("Hello **wor", {
				bufferIncomplete: false,
			});
			expect(result.buffered).toBe("");
			expect(result.blocks).toHaveLength(1);
		});

		it("should resolve buffer when bold is closed", () => {
			const result = parseIncremental("Hello **world**", {
				bufferIncomplete: true,
			});
			expect(result.buffered).toBe("");
			expect(result.blocks).toHaveLength(1);
		});

		it("should buffer unclosed link", () => {
			const result = parseIncremental("Click [here", {
				bufferIncomplete: true,
			});
			expect(result.buffered).toContain("[");
		});

		it("should force-flush buffer over 200 chars", () => {
			const longText = "Hello **" + "a".repeat(250);
			const result = parseIncremental(longText, { bufferIncomplete: true });
			// Should not buffer since it exceeds 200 chars
			expect(result.blocks).toHaveLength(1);
			expect(result.buffered).toBe("");
		});
	});

	describe("edge cases", () => {
		it("should handle empty content", () => {
			const result = parseIncremental("");
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("");
		});

		it("should handle whitespace-only content", () => {
			const result = parseIncremental("   \n   \n   ");
			expect(result.blocks).toHaveLength(0);
		});

		it("should handle very long single paragraph", () => {
			const longText = "a".repeat(10000);
			const result = parseIncremental(longText);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle code block with tilde fences", () => {
			const result = parseIncremental("~~~python\nprint('hi')\n~~~\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].language).toBe("python");
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should handle code block without language", () => {
			const result = parseIncremental("```\nsome code\n```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].language).toBeUndefined();
		});

		it("should handle HR with ***", () => {
			const result = parseIncremental("***\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
		});

		it("should handle multi-line blockquote", () => {
			const result = parseIncremental("> Line 1\n> Line 2\n> Line 3\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should handle nested list items with indentation", () => {
			const content = "- Item 1\n  - Sub item\n- Item 2\n\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
		});
	});
});
