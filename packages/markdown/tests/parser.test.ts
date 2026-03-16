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

		it("should buffer unclosed image alt marker", () => {
			const result = parseIncremental("Look ![cat", {
				bufferIncomplete: true,
			});
			expect(result.buffered).toContain("![");
		});

		it("should buffer unclosed image URL marker", () => {
			const result = parseIncremental(
				"Look ![cat](https://example.com/cat.png",
				{
					bufferIncomplete: true,
				},
			);
			expect(result.buffered).toContain("![");
			if (result.blocks[0]) {
				expect(result.blocks[0].raw).toBe("Look ");
			}
		});

		it("should resolve buffer when image syntax is complete", () => {
			const result = parseIncremental(
				"Look ![cat](https://example.com/cat.png)",
				{
					bufferIncomplete: true,
				},
			);
			expect(result.buffered).toBe("");
			expect(result.blocks).toHaveLength(1);
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

	describe("streaming flicker prevention for block-level markers", () => {
		it("should buffer heading marker with no text (e.g. '# ')", () => {
			const result = parseIncremental("# ", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("# ");
		});

		it("should buffer '## ' with no text", () => {
			const result = parseIncremental("## ", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("## ");
		});

		it("should buffer '### ' with no text", () => {
			const result = parseIncremental("### ", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("### ");
		});

		it("should buffer partial heading '#' without space", () => {
			const result = parseIncremental("#", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("#");
		});

		it("should buffer partial heading '##' without space", () => {
			const result = parseIncremental("##", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("##");
		});

		it("should render heading once text arrives after marker", () => {
			const result = parseIncremental("# Hello", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].raw).toBe("# Hello");
			expect(result.buffered).toBe("");
		});

		it("should buffer a lone list marker '- '", () => {
			const result = parseIncremental("- ", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("- ");
		});

		it("should buffer partial list marker '-' without space", () => {
			const result = parseIncremental("-", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("-");
		});

		it("should buffer partial list marker '*' without space", () => {
			const result = parseIncremental("*", { bufferIncomplete: true });
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("*");
		});

		it("should buffer partial ordered list marker '1' or '1.'", () => {
			const r1 = parseIncremental("1", { bufferIncomplete: true });
			expect(r1.blocks).toHaveLength(0);
			expect(r1.buffered).toBe("1");

			const r2 = parseIncremental("1.", { bufferIncomplete: true });
			expect(r2.blocks).toHaveLength(0);
			expect(r2.buffered).toBe("1.");
		});

		it("should buffer '-' when it appears after completed list item", () => {
			const result = parseIncremental("- item 1\n-", {
				bufferIncomplete: true,
			});
			// Should render the first item, not show raw '-'
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].raw).toBe("- item 1");
		});

		it("should buffer trailing empty list item '- item 1\\n- '", () => {
			const result = parseIncremental("- item 1\n- ", {
				bufferIncomplete: true,
			});
			// Should render only the first item, not the empty second marker
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].raw).toBe("- item 1");
		});

		it("should render full list once second item has text", () => {
			const result = parseIncremental("- item 1\n- item 2", {
				bufferIncomplete: true,
			});
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].raw).toBe("- item 1\n- item 2");
		});

		it("should buffer trailing empty ordered list item", () => {
			const result = parseIncremental("1. first\n2. ", {
				bufferIncomplete: true,
			});
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].raw).toBe("1. first");
		});

		it("should buffer '#' appearing after a completed paragraph", () => {
			const result = parseIncremental("some text\n\n#", {
				bufferIncomplete: true,
			});
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe("some text");
			expect(result.buffered).toBe("#");
		});

		it("should buffer '-' appearing after a completed paragraph", () => {
			const result = parseIncremental("some text\n\n-", {
				bufferIncomplete: true,
			});
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe("some text");
			expect(result.buffered).toBe("-");
		});

		it("full streaming simulation: list items arrive token by token", () => {
			const states = [
				"-",
				"- ",
				"- i",
				"- item 1",
				"- item 1\n",
				"- item 1\n-",
				"- item 1\n- ",
				"- item 1\n- i",
				"- item 1\n- item 2",
			];

			for (const s of states) {
				const r = parseIncremental(s, { bufferIncomplete: true });
				// Should never render raw '-' as a paragraph
				for (const b of r.blocks) {
					if (b.type === "paragraph") {
						expect(b.raw).not.toBe("-");
					}
				}
				// Should never render an empty list item
				if (r.blocks.length > 0 && r.blocks[0].type === "list") {
					const lines = r.blocks[0].raw.split("\n");
					for (const line of lines) {
						if (line.trim().length > 0) {
							const content = line
								.replace(/^\s*[-*+]\s+/, "")
								.replace(/^\s*\d+\.\s+/, "");
							expect(content.trim().length).toBeGreaterThan(0);
						}
					}
				}
			}
		});
	});

	describe("version number handling", () => {
		it("should not treat version numbers as ordered list items", () => {
			const result = parseIncremental("Node.js v25.0 and npm 11.8.0");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe("Node.js v25.0 and npm 11.8.0");
		});

		it("should handle IP addresses correctly", () => {
			const result = parseIncremental("Server at 192.168.1.1 is online");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe("Server at 192.168.1.1 is online");
		});

		it("should handle decimal numbers correctly", () => {
			const result = parseIncremental("The value is 3.14 or 2.718");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe("The value is 3.14 or 2.718");
		});

		it("should handle semantic versions correctly", () => {
			const result = parseIncremental("version 2.1.0-beta.3");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe("version 2.1.0-beta.3");
		});

		it("should still parse real ordered lists correctly", () => {
			const result = parseIncremental(
				"1. First item\n2. Second item\n3. Third item",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].listStyle).toBe("ordered");
		});

		it("should handle larger list numbers", () => {
			const result = parseIncremental(
				"25. Twenty-fifth item\n99. Ninety-ninth item",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].listStyle).toBe("ordered");
		});

		it("should handle streaming chunks with version numbers", () => {
			// Simulate streaming: "11.8.0 Let me create..." as a chunk
			const result = parseIncremental(".8.0 Let me create the app");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toBe(".8.0 Let me create the app");
		});

		it("should handle mixed content with versions and lists", () => {
			const content = "1. Install Node.js v18.0.0\n2. Run npm install";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[0].raw).toContain("Install Node.js v18.0.0");
			expect(result.blocks[0].raw).toContain("Run npm install");
		});
	});
});
