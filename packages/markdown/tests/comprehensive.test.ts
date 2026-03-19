import { describe, expect, it } from "vitest";
import { parseIncremental } from "../src/core/parser.js";

describe("comprehensive markdown parsing", () => {
	describe("heading variations", () => {
		it("should handle headings with no space after hash", () => {
			const result = parseIncremental("#Heading\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle headings with multiple spaces", () => {
			const result = parseIncremental("#   Heading\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].level).toBe(1);
		});

		it("should handle headings with trailing hashes", () => {
			const result = parseIncremental("# Heading ###\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
		});

		it("should handle h7+ as paragraph", () => {
			const result = parseIncremental("####### Too many\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle heading with inline formatting in raw", () => {
			const result = parseIncremental("# Hello **world**\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].raw).toBe("# Hello **world**");
		});

		it("should handle empty heading", () => {
			const result = parseIncremental("# \n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
		});

		it("should handle heading at end without newline", () => {
			const result = parseIncremental("# Heading");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].complete).toBe(false);
		});
	});

	describe("list comprehensive", () => {
		describe("unordered lists", () => {
			it("should handle all bullet types", () => {
				const result = parseIncremental("- dash\n* star\n+ plus\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
				expect(result.blocks[0].listStyle).toBe("unordered");
				expect(result.blocks[0].raw).toContain("- dash");
				expect(result.blocks[0].raw).toContain("* star");
				expect(result.blocks[0].raw).toContain("+ plus");
			});

			it("should handle lists with mixed indentation", () => {
				const result = parseIncremental("- item 1\n  - nested\n- item 2\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});

			it("should handle bullet immediately followed by text", () => {
				const result = parseIncremental("-item\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("paragraph");
			});

			it("should handle bullet with tab after", () => {
				const result = parseIncremental("-\ttab item\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});

			it("should handle empty list item", () => {
				const result = parseIncremental("- \n- item\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});

			it("should handle list interrupted by paragraph", () => {
				const result = parseIncremental(
					"- item 1\n\nparagraph\n\n- item 2\n\n",
				);
				expect(result.blocks).toHaveLength(3);
				expect(result.blocks[0].type).toBe("list");
				expect(result.blocks[1].type).toBe("paragraph");
				expect(result.blocks[2].type).toBe("list");
			});

			it("should handle list with indented continuation after blank line", () => {
				// Multi-paragraph list item: blank line followed by indented text
				const result = parseIncremental("- item 1\n\n  continuation\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
				expect(result.blocks[0].raw).toContain("item 1");
				expect(result.blocks[0].raw).toContain("continuation");
			});

			it("should handle deeply nested lists", () => {
				const content = "- 1\n  - 2\n    - 3\n      - 4\n\n";
				const result = parseIncremental(content);
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});
		});

		describe("ordered lists", () => {
			it("should handle single digit ordered lists", () => {
				const result = parseIncremental("1. one\n2. two\n3. three\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
				expect(result.blocks[0].listStyle).toBe("ordered");
			});

			it("should handle multi-digit ordered lists", () => {
				const result = parseIncremental(
					"10. ten\n11. eleven\n100. hundred\n\n",
				);
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});

			it("should handle ordered list with no space after dot", () => {
				const result = parseIncremental("1.item\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("paragraph");
			});

			it("should handle ordered list with parentheses", () => {
				const result = parseIncremental("1) one\n2) two\n\n");
				expect(result.blocks).toHaveLength(1);
				// Parentheses are not currently supported
				expect(result.blocks[0].type).toBe("paragraph");
			});

			it("should handle non-sequential numbers", () => {
				const result = parseIncremental("1. first\n5. fifth\n10. tenth\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});

			it("should handle zero-indexed lists", () => {
				const result = parseIncremental("0. zero\n1. one\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});

			it("should handle version-like numbers in ordered lists", () => {
				const result = parseIncremental("1. Install v2.0\n2. Done\n\n");
				expect(result.blocks).toHaveLength(1);
				expect(result.blocks[0].type).toBe("list");
			});
		});

		describe("mixed lists", () => {
			it("should handle ordered list switching to unordered", () => {
				const result = parseIncremental("1. ordered\n- unordered\n\n");
				expect(result.blocks).toHaveLength(2);
				expect(result.blocks[0].type).toBe("list");
				expect(result.blocks[1].type).toBe("list");
			});
		});
	});

	describe("code block comprehensive", () => {
		it("should handle backtick fences", () => {
			const result = parseIncremental("```\ncode\n```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
		});

		it("should handle tilde fences", () => {
			const result = parseIncremental("~~~\ncode\n~~~\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
		});

		it("should handle code block with language", () => {
			const result = parseIncremental("```typescript\nconst x = 1;\n```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].language).toBe("typescript");
		});

		it("should handle code block with language and info", () => {
			const result = parseIncremental("```js filename=test.js\ncode\n```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].language).toBe("js");
		});

		it("should handle code block with more backticks in content", () => {
			const result = parseIncremental("````\n```\nnot a fence\n```\n````\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
		});

		it("should handle unclosed code block", () => {
			const result = parseIncremental("```js\ncode");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].complete).toBe(false);
		});

		it("should handle empty code block", () => {
			const result = parseIncremental("```\n```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
		});

		it("should handle code block immediately after paragraph", () => {
			const result = parseIncremental("text\n```\ncode\n```\n\n");
			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[1].type).toBe("code");
		});

		it("should handle code block with special characters", () => {
			const result = parseIncremental(
				"```\n<script>alert('xss')</script>\n```\n\n",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].raw).toContain("<script>");
		});
	});

	describe("blockquote comprehensive", () => {
		it("should handle single line blockquote", () => {
			const result = parseIncremental("> quote\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle multi-line blockquote", () => {
			const result = parseIncremental("> line 1\n> line 2\n> line 3\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle lazy blockquote continuation", () => {
			const result = parseIncremental("> line 1\nline 2\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle blockquote with nested elements", () => {
			const result = parseIncremental("> # Heading in quote\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle nested blockquotes", () => {
			const result = parseIncremental("> outer\n> > inner\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle blockquote with code block", () => {
			const result = parseIncremental("> ```\n> code\n> ```\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle blockquote with list", () => {
			const result = parseIncremental("> - item 1\n> - item 2\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle empty blockquote line", () => {
			const result = parseIncremental(">\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});

		it("should handle blockquote without space after >", () => {
			const result = parseIncremental(">no space\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");
		});
	});

	describe("table comprehensive", () => {
		it("should handle basic table", () => {
			const result = parseIncremental("| A | B |\n|---|---|\n| 1 | 2 |\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
		});

		it("should handle table without outer pipes", () => {
			const result = parseIncremental("A | B\n---|---\n1 | 2\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle table with alignment", () => {
			const result = parseIncremental("| A | B |\n|:--|--:|\n| 1 | 2 |\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
		});

		it("should handle table with extra whitespace", () => {
			const result = parseIncremental(
				"|  A  |  B  |\n| --- | --- |\n|  1  |  2  |\n\n",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
		});

		it("should handle single column table", () => {
			const result = parseIncremental("| A |\n|---|\n| 1 |\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
		});

		it("should handle table with empty cells", () => {
			const result = parseIncremental("| A | B |\n|---|---|\n| 1 | |\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
		});

		it("should handle incomplete table", () => {
			const result = parseIncremental("| A | B |\n| 1 | 2 |");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].complete).toBe(false);
		});

		it("should handle table followed by paragraph", () => {
			const result = parseIncremental("| A |\n|---|\n| 1 |\n\ntext\n\n");
			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[0].type).toBe("table");
			expect(result.blocks[1].type).toBe("paragraph");
		});
	});

	describe("horizontal rule comprehensive", () => {
		it("should handle dashes", () => {
			const result = parseIncremental("---\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
		});

		it("should handle stars", () => {
			const result = parseIncremental("***\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
		});

		it("should handle underscores", () => {
			const result = parseIncremental("___\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
		});

		it("should handle more than 3 characters", () => {
			const result = parseIncremental("-----\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
		});

		it("should handle spaces between characters", () => {
			const result = parseIncremental("- - -\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("hr");
		});

		it("should not confuse list with hr", () => {
			const result = parseIncremental("- item\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
		});

		it("should handle hr between paragraphs", () => {
			const result = parseIncremental("para1\n\n---\n\npara2\n\n");
			expect(result.blocks).toHaveLength(3);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[1].type).toBe("hr");
			expect(result.blocks[2].type).toBe("paragraph");
		});
	});

	describe("paragraph comprehensive", () => {
		it("should handle single line paragraph", () => {
			const result = parseIncremental("Hello world\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle multi-line paragraph", () => {
			const result = parseIncremental("Line 1\nLine 2\nLine 3\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle paragraph with inline formatting markers", () => {
			const result = parseIncremental("Text with **incomplete bold\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle paragraph with special characters", () => {
			const result = parseIncremental("Special: < > & \" '\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle paragraph starting with special chars", () => {
			const result = parseIncremental("[not a link\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle paragraph with backticks", () => {
			const result = parseIncremental("Text `code` more\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle very long paragraph", () => {
			const content = "word ".repeat(1000) + "\n\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});

	describe("complex mixed documents", () => {
		it("should handle full document structure", () => {
			const content = `# Document Title

Introduction paragraph with some text.

## Section 1

- List item 1
- List item 2
  - Nested item

> A blockquote with **bold** text.

\`\`\`javascript
const code = "example";
\`\`\`

| Col1 | Col2 |
|------|------|
| A    | B    |

---

Final paragraph.
`;
			const result = parseIncremental(content);
			expect(result.blocks.length).toBeGreaterThan(5);
			expect(result.blocks.some((b) => b.type === "heading")).toBe(true);
			expect(result.blocks.some((b) => b.type === "list")).toBe(true);
			expect(result.blocks.some((b) => b.type === "blockquote")).toBe(true);
			expect(result.blocks.some((b) => b.type === "code")).toBe(true);
			expect(result.blocks.some((b) => b.type === "table")).toBe(true);
			expect(result.blocks.some((b) => b.type === "hr")).toBe(true);
			expect(result.blocks.some((b) => b.type === "paragraph")).toBe(true);
		});

		it("should handle consecutive same-type blocks", () => {
			const result = parseIncremental("Para 1\n\nPara 2\n\nPara 3\n\n");
			expect(result.blocks).toHaveLength(3);
			for (const block of result.blocks) {
				expect(block.type).toBe("paragraph");
			}
		});

		it("should handle code block between lists", () => {
			const result = parseIncremental(
				"- item 1\n\n```\ncode\n```\n\n- item 2\n\n",
			);
			expect(result.blocks).toHaveLength(3);
			expect(result.blocks[0].type).toBe("list");
			expect(result.blocks[1].type).toBe("code");
			expect(result.blocks[2].type).toBe("list");
		});

		it("should handle multiple headings", () => {
			const result = parseIncremental("# H1\n\n## H2\n\n### H3\n\n");
			expect(result.blocks).toHaveLength(3);
			expect(result.blocks[0].level).toBe(1);
			expect(result.blocks[1].level).toBe(2);
			expect(result.blocks[2].level).toBe(3);
		});

		it("should handle document ending without blank line", () => {
			const result = parseIncremental("# Heading\n\nParagraph");
			expect(result.blocks).toHaveLength(2);
			expect(result.blocks[0].complete).toBe(true);
			expect(result.blocks[1].complete).toBe(false);
		});
	});

	describe("unicode and special characters", () => {
		it("should handle emoji", () => {
			const result = parseIncremental("Hello 👋 World 🌍\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toContain("👋");
		});

		it("should handle non-Latin scripts", () => {
			const result = parseIncremental("Hello 世界 Привет مرحبا\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle mathematical symbols", () => {
			const result = parseIncremental("Equation: ∑(x²) = ∞\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle zero-width characters", () => {
			const result = parseIncremental("Text\u200Bwith\u200Bjoiners\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle RTL text", () => {
			const result = parseIncremental("مرحبا بالعالم\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle combined characters", () => {
			const result = parseIncremental("Café résumé naïve\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});

	describe("whitespace handling", () => {
		it("should handle leading whitespace", () => {
			const result = parseIncremental("   Indented paragraph\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle trailing whitespace", () => {
			const result = parseIncremental("Text   \n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle multiple blank lines", () => {
			const result = parseIncremental("Para 1\n\n\n\nPara 2\n\n");
			expect(result.blocks).toHaveLength(2);
		});

		it("should handle tabs", () => {
			const result = parseIncremental("\tTabbed paragraph\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle mixed whitespace", () => {
			const result = parseIncremental("  \t  Mixed spaces and tabs\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle CRLF line endings", () => {
			const result = parseIncremental("Line 1\r\nLine 2\r\n\r\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});

	describe("streaming edge cases", () => {
		it("should handle chunk ending mid-heading", () => {
			const result = parseIncremental("# He");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("heading");
			expect(result.blocks[0].complete).toBe(false);
		});

		it("should handle chunk ending mid-code-fence", () => {
			const result = parseIncremental("``");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle chunk ending at list marker", () => {
			const result = parseIncremental("- ");
			expect(result.blocks).toHaveLength(0);
		});

		it("should handle incomplete table", () => {
			const result = parseIncremental("| Col");
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("| Col");
		});

		it("should buffer a table header row until a separator arrives", () => {
			const result = parseIncremental("| Col A | Col B |");
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("| Col A | Col B |");
		});

		it("should buffer a partial separator row for a pending table", () => {
			const result = parseIncremental("| Col A | Col B |\n|-");
			expect(result.blocks).toHaveLength(0);
			expect(result.buffered).toBe("| Col A | Col B |\n|-");
		});

		it("should start rendering a table once the separator row is valid", () => {
			const result = parseIncremental("| Col A | Col B |\n|---|---|");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
			expect(result.blocks[0].complete).toBe(false);
		});

		it("should handle chunk at block boundary", () => {
			const result = parseIncremental("# Heading\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].complete).toBe(true);
		});

		it("should handle very long line in stream", () => {
			const longLine = "a".repeat(10000);
			const result = parseIncremental(longLine);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});

	describe("edge cases and unusual input", () => {
		it("should handle only newlines", () => {
			const result = parseIncremental("\n\n\n");
			expect(result.blocks).toHaveLength(0);
		});

		it("should handle single character", () => {
			const result = parseIncremental("x");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle only special characters", () => {
			const result = parseIncremental("!@#$%^&*()");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle repeated block markers", () => {
			const result = parseIncremental("#####\n\n");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should handle mixed line endings", () => {
			const result = parseIncremental("Line 1\nLine 2\r\nLine 3\rLine 4\n\n");
			expect(result.blocks).toHaveLength(1);
		});

		it("should handle null bytes", () => {
			const result = parseIncremental("Hello\x00World\n\n");
			expect(result.blocks).toHaveLength(1);
		});

		it("should handle control characters", () => {
			const result = parseIncremental("Text\x01\x02\x03\n\n");
			expect(result.blocks).toHaveLength(1);
		});

		it("should handle extremely deeply nested structure", () => {
			let content = "- item\n";
			for (let i = 0; i < 20; i++) {
				content += "  ".repeat(i + 1) + "- nested\n";
			}
			content += "\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
		});
	});
});
