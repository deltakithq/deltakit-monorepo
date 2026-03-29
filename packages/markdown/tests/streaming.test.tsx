import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";
import { parseIncremental } from "../src/core/parser.js";

const ASCII_DIAGRAM_BODY = [
	"+----------------------+      +----------------------+      +----------------------+",
	"| User                 |      | Forum                |      | Post                 |",
	"+----------------------+      +----------------------+      +----------------------+",
	"| id (PK)              |<-----| creatorId            |<-----| authorId             |",
	"| email                |      | id (PK)              |      | forumId              |",
	"| username             |      | name                 |      | id (PK)              |",
	"| passwordHash         |      | slug (UQ)            |      | title                |",
	"| bio                  |      | description          |      | content              |",
	"| avatarUrl            |      | createdAt            |      | createdAt            |",
	"+----------------------+      +----------------------+      +----------------------+",
	"",
	"         |",
	"         v",
	"                          +----------------------+",
	"                          | Comment              |",
	"                          +----------------------+",
	"                          | authorId             |<---------------------------+",
	"                          | postId               |                            |",
	"                          | parentId             |----> Self-referencing (nested replies)",
	"                          | id (PK)              |                            |",
	"                          | content              |                            |",
	"                          +----------------------+                            |",
	"",
	"+----------------------+      (Polymorphic - targets posts OR comments)",
	"| Vote                 |",
	"+----------------------+",
	"| id (PK)              |",
	"| userId               |",
	'| targetType           |      ("post" or "comment")',
	"| targetId             |",
	"| value                |      (1 = upvote, -1 = downvote)",
	"+----------------------+",
].join("\n");

const ASCII_DIAGRAM_FENCED = `\`\`\`text
${ASCII_DIAGRAM_BODY}
\`\`\``;

const ASCII_DIAGRAM_PARTIAL = `\`\`\`text
${ASCII_DIAGRAM_BODY.split("\n").slice(0, 18).join("\n")}`;

function installMockImage(
	resolve: (src: string) => "load" | "error",
): () => void {
	const OriginalImage = globalThis.Image;

	class MockImage {
		onload: ((ev: Event) => void) | null = null;
		onerror: ((ev: Event) => void) | null = null;
		private _src = "";

		set src(value: string) {
			this._src = value;
			setTimeout(() => {
				if (resolve(value) === "error") {
					this.onerror?.(new Event("error"));
				} else {
					this.onload?.(new Event("load"));
				}
			}, 0);
		}

		get src(): string {
			return this._src;
		}
	}

	globalThis.Image = MockImage as unknown as typeof Image;

	return () => {
		globalThis.Image = OriginalImage;
	};
}

describe("streaming simulation", () => {
	describe("token-by-token parsing", () => {
		it("should produce stable blocks as content streams in", () => {
			// Simulate streaming: "# Hello\n\nThis is a paragraph being streamed tok"
			const stream1 = parseIncremental("# Hello\n\nThis is ");
			expect(stream1.blocks[0].type).toBe("heading");
			expect(stream1.blocks[0].complete).toBe(true);
			expect(stream1.blocks[1].type).toBe("paragraph");
			expect(stream1.blocks[1].complete).toBe(false);

			const stream2 = parseIncremental("# Hello\n\nThis is a paragraph ");
			expect(stream2.blocks[0].type).toBe("heading");
			expect(stream2.blocks[0].complete).toBe(true);
			expect(stream2.blocks[0].raw).toBe("# Hello"); // Stable!

			const stream3 = parseIncremental(
				"# Hello\n\nThis is a paragraph being streamed",
			);
			expect(stream3.blocks[0].raw).toBe("# Hello"); // Still stable!
			expect(stream3.blocks[1].raw).toContain("streamed");
		});

		it("should handle code block appearing mid-stream", () => {
			const s1 = parseIncremental("Some text\n\n```");
			expect(s1.blocks[0].type).toBe("paragraph");
			expect(s1.blocks[0].complete).toBe(true);
			expect(s1.blocks[1].type).toBe("code");
			expect(s1.blocks[1].complete).toBe(false);

			const s2 = parseIncremental("Some text\n\n```js\nconsole.log");
			expect(s2.blocks[0].type).toBe("paragraph");
			expect(s2.blocks[1].type).toBe("code");
			expect(s2.blocks[1].complete).toBe(false);

			const s3 = parseIncremental("Some text\n\n```js\nconsole.log('hi')\n```");
			expect(s3.blocks[0].type).toBe("paragraph");
			expect(s3.blocks[1].type).toBe("code");
			expect(s3.blocks[1].complete).toBe(true);
		});

		it("completed blocks should never change as new content arrives", () => {
			const snapshots: string[] = [];

			// Simulate 5 streaming states
			const states = [
				"# Title\n\nFirst para",
				"# Title\n\nFirst paragraph\n\n",
				"# Title\n\nFirst paragraph\n\nSecond",
				"# Title\n\nFirst paragraph\n\nSecond paragraph\n\n",
				"# Title\n\nFirst paragraph\n\nSecond paragraph\n\nThird",
			];

			for (const state of states) {
				const result = parseIncremental(state);
				const firstBlock = result.blocks[0];
				if (firstBlock) {
					snapshots.push(firstBlock.raw);
				}
			}

			// First block (heading) should be identical across all snapshots
			for (const snapshot of snapshots) {
				expect(snapshot).toBe("# Title");
			}
		});

		it("should keep a fenced ASCII diagram on the code path while streaming", () => {
			const openingFence = parseIncremental("```text\n");
			expect(openingFence.blocks).toHaveLength(1);
			expect(openingFence.blocks[0].type).toBe("code");
			expect(openingFence.blocks[0].complete).toBe(false);

			const partial = parseIncremental(ASCII_DIAGRAM_PARTIAL);
			expect(partial.blocks).toHaveLength(1);
			expect(partial.blocks[0].type).toBe("code");
			expect(partial.blocks[0].complete).toBe(false);
			expect(partial.blocks[0].type).not.toBe("paragraph");
			expect(partial.blocks[0].type).not.toBe("table");
			expect(partial.blocks[0].type).not.toBe("list");
			expect(partial.blocks[0].type).not.toBe("blockquote");

			const complete = parseIncremental(ASCII_DIAGRAM_FENCED);
			expect(complete.blocks).toHaveLength(1);
			expect(complete.blocks[0].type).toBe("code");
			expect(complete.blocks[0].complete).toBe(true);
			expect(complete.blocks[0].language).toBe("text");
			expect(complete.blocks[0].type).not.toBe("paragraph");
			expect(complete.blocks[0].type).not.toBe("table");
			expect(complete.blocks[0].type).not.toBe("list");
			expect(complete.blocks[0].type).not.toBe("blockquote");
		});
	});

	describe("component rendering", () => {
		it("should render heading content", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "# Hello World\n\n",
					batchMs: 0,
				}),
			);
			expect(container.querySelector("h1")).toBeTruthy();
			expect(container.textContent).toContain("Hello World");
		});

		it("should render paragraph content", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Hello world\n\n",
					batchMs: 0,
				}),
			);
			expect(container.querySelector("p")).toBeTruthy();
			expect(container.textContent).toContain("Hello world");
		});

		it("should render code blocks", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "```js\nconsole.log('hi')\n```\n\n",
					batchMs: 0,
				}),
			);
			expect(container.querySelector("pre")).toBeTruthy();
			expect(container.querySelector("code")).toBeTruthy();
		});

		it("should render incomplete code block content while streaming", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "```js\nconsole.log('streaming')",
					batchMs: 0,
				}),
			);
			const code = container.querySelector("code");
			expect(container.querySelector("pre")).toBeTruthy();
			expect(code).toBeTruthy();
			expect(code?.textContent).toContain("console.log('streaming')");
			expect(code?.className).toContain("language-js");
		});

		it("should preserve ASCII diagram whitespace inside fenced code blocks", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: ASCII_DIAGRAM_FENCED,
					batchMs: 0,
				}),
			);

			const pre = container.querySelector("pre");
			const code = container.querySelector("code");

			expect(pre).toBeTruthy();
			expect(code).toBeTruthy();
			expect(code?.textContent).toBe(ASCII_DIAGRAM_BODY);
			expect(code?.textContent).toContain(
				"| parentId             |----> Self-referencing (nested replies)",
			);
			expect(code?.textContent).toContain(
				"+----------------------+      (Polymorphic - targets posts OR comments)",
			);
			expect(code?.textContent).toContain(
				'| targetType           |      ("post" or "comment")',
			);
			expect(code?.textContent).toContain(
				"| value                |      (1 = upvote, -1 = downvote)",
			);
		});

		it("should render a partial fenced ASCII diagram as code instead of other block types", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: ASCII_DIAGRAM_PARTIAL,
					batchMs: 0,
				}),
			);

			const pre = container.querySelector("pre");
			const code = container.querySelector("code");

			expect(pre).toBeTruthy();
			expect(code).toBeTruthy();
			expect(container.querySelector("table")).toBeFalsy();
			expect(container.querySelector("blockquote")).toBeFalsy();
			expect(container.querySelector("ul")).toBeFalsy();
			expect(container.querySelector("ol")).toBeFalsy();
			expect(code?.textContent).toBe(
				ASCII_DIAGRAM_BODY.split("\n").slice(0, 18).join("\n"),
			);
		});

		it("should render fenced code blocks nested inside list items", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content:
						'1. .env.example - Now includes:\n\n   ```env\n   OPENAI_API_KEY="sk-your-openai-api-key-here"\n   OPENAI_BASE_URL="https://api.openai.com/v1"\n   ```\n\n',
					batchMs: 0,
				}),
			);

			const list = container.querySelector("ol");
			const items = container.querySelectorAll("li");
			const pre = container.querySelector("pre");

			expect(list).toBeTruthy();
			expect(items).toHaveLength(1);
			expect(pre).toBeTruthy();
			expect(pre?.textContent).toContain(
				'OPENAI_API_KEY="sk-your-openai-api-key-here"',
			);
			expect(pre?.textContent).toContain(
				'OPENAI_BASE_URL="https://api.openai.com/v1"',
			);
		});

		it("should render bold text", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Hello **world**\n\n",
					batchMs: 0,
				}),
			);
			expect(container.querySelector("strong")).toBeTruthy();
			expect(container.textContent).toContain("world");
		});

		it("should render italic text", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Hello *world*\n\n",
					batchMs: 0,
				}),
			);
			expect(container.querySelector("em")).toBeTruthy();
		});

		it("should render links", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "[click](https://example.com)\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			expect(link?.getAttribute("href")).toBe("https://example.com");
		});

		it("should hold back an incomplete trailing table row until newline", async () => {
			const partial = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Age |\n|------|-----|\n| Alice",
					batchMs: 0,
				}),
			);
			const initialTable = partial.container.querySelector("table");
			expect(initialTable).toBeFalsy();
			expect(partial.container.textContent).not.toContain("Name");
			expect(partial.container.textContent).not.toContain("Alice");

			const completed = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Age |\n|------|-----|\n| Alice | 30 |\n",
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				const completedTable = completed.container.querySelector("table");
				expect(completedTable?.textContent).toContain("Alice");
				expect(completedTable?.textContent).toContain("30");
			});
		});

		it("should hold back a trailing table row even if the row text looks complete until newline arrives", async () => {
			const partial = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Age |\n|------|-----|\n| Alice | 30 |",
					batchMs: 0,
				}),
			);

			const initialTable = partial.container.querySelector("table");
			expect(initialTable).toBeFalsy();
			expect(partial.container.textContent).not.toContain("Name");
			expect(partial.container.textContent).not.toContain("Alice");
			expect(partial.container.textContent).not.toContain("30");

			const completed = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Age |\n|------|-----|\n| Alice | 30 |\n",
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				const completedTable = completed.container.querySelector("table");
				expect(completedTable?.textContent).toContain("Alice");
				expect(completedTable?.textContent).toContain("30");
			});
		});

		it("should hold back a table until the first body row is newline-terminated", async () => {
			const partial = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Age |\n|------|-----|\n",
					batchMs: 0,
				}),
			);

			expect(partial.container.querySelector("table")).toBeFalsy();
			expect(partial.container.textContent).not.toContain("Name");

			const completed = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Age |\n|------|-----|\n| Alice | 30 |\n",
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				const completedTable = completed.container.querySelector("table");
				expect(completedTable).toBeTruthy();
				expect(completedTable?.textContent).toContain("Name");
				expect(completedTable?.textContent).toContain("Age");
				expect(completedTable?.textContent).toContain("Alice");
			});
		});

		it("should hold back a newline-terminated table header until the separator arrives", () => {
			const partial = render(
				createElement(StreamingMarkdown, {
					content: "| Name | Type | Description |\n",
					batchMs: 0,
				}),
			);

			expect(partial.container.querySelector("table")).toBeFalsy();
			expect(partial.container.textContent).not.toContain("Name");
			expect(partial.container.querySelector("p")).toBeFalsy();
		});

		it("should not flash the next table header as raw paragraph text between streamed tables", async () => {
			const partialContent =
				"| A | B |\n|---|---|\n| 1 | 2 |\n\n| Name | Type | Description |";
			const completedContent =
				"| A | B |\n|---|---|\n| 1 | 2 |\n\n| Name | Type | Description |\n|------|------|-------------|\n| id | string | markdown body |\n";

			const view = render(
				createElement(StreamingMarkdown, {
					content: partialContent,
					batchMs: 0,
				}),
			);

			expect(view.container.textContent).toContain("A");
			expect(view.container.textContent).toContain("1");
			expect(view.container.textContent).not.toContain("Name");
			expect(view.container.querySelectorAll("table")).toHaveLength(1);

			view.rerender(
				createElement(StreamingMarkdown, {
					content: completedContent,
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				expect(view.container.textContent).toContain("Name");
				expect(view.container.textContent).toContain("markdown body");
				expect(view.container.querySelectorAll("table")).toHaveLength(2);
			});
		});

		it("should render all list items immediately during streaming", async () => {
			// Streaming: second item is still being typed — renders immediately
			const partial = render(
				createElement(StreamingMarkdown, {
					content: "- Item 1\n- Item 2 partial",
					batchMs: 0,
				}),
			);
			const partialList = partial.container.querySelector("ul");
			expect(partialList).toBeTruthy();
			expect(partialList?.textContent).toContain("Item 1");
			expect(partialList?.textContent).toContain("Item 2 partial");

			// Once complete, all items render
			const completed = render(
				createElement(StreamingMarkdown, {
					content: "- Item 1\n- Item 2 complete\n",
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				const completedList = completed.container.querySelector("ul");
				expect(completedList?.textContent).toContain("Item 1");
				expect(completedList?.textContent).toContain("Item 2 complete");
			});
		});

		it("should update a previously completed list block when later chunks extend it", async () => {
			const partialContent = `## Nested Ordered List

1. Planning Phase
   1. Gather requirements
   2. Define scope
   3. Create timeline
`;

			const fullContent = `## Nested Ordered List

1. Planning Phase
   1. Gather requirements
   2. Define scope
   3. Create timeline
2. Development Phase
   1. Set up project structure
   2. Implement core features
`;

			const view = render(
				createElement(StreamingMarkdown, {
					content: partialContent,
					batchMs: 0,
				}),
			);

			expect(view.container.textContent).toContain("Planning Phase");
			expect(view.container.textContent).not.toContain("Development Phase");

			view.rerender(
				createElement(StreamingMarkdown, {
					content: fullContent,
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				expect(view.container.textContent).toContain("Development Phase");
				expect(view.container.textContent).toContain(
					"Set up project structure",
				);
				expect(view.container.querySelectorAll("ol").length).toBeGreaterThan(1);
			});
		});

		it("should update a previously completed table block when later chunks add rows", async () => {
			const partialContent = `## Simple Table

| Name | Type | Description |
|------|------|-------------|
`;

			const fullContent = `## Simple Table

| Name | Type | Description |
|------|------|-------------|
| id | string | Unique identifier |
| role | enum | user or assistant |
`;

			const view = render(
				createElement(StreamingMarkdown, {
					content: partialContent,
					batchMs: 0,
				}),
			);

			expect(view.container.textContent).not.toContain("Name");
			expect(view.container.textContent).not.toContain("Unique identifier");

			view.rerender(
				createElement(StreamingMarkdown, {
					content: fullContent,
					batchMs: 0,
				}),
			);

			await waitFor(() => {
				expect(view.container.textContent).toContain("Unique identifier");
				expect(view.container.textContent).toContain("user or assistant");
				expect(view.container.querySelectorAll("tbody tr")).toHaveLength(2);
			});
		});

		it("should render image skeleton first, then reveal image once loaded", async () => {
			const restore = installMockImage(() => "load");
			try {
				const { container } = render(
					createElement(StreamingMarkdown, {
						content: "Look ![logo](https://example.com/logo.png)\n\n",
						batchMs: 0,
					}),
				);

				expect(
					container.querySelector(".streaming-markdown-image-skeleton"),
				).toBeTruthy();
				expect(container.querySelector("img")).toBeFalsy();

				await waitFor(() => {
					expect(container.querySelector("img")).toBeTruthy();
				});

				expect(
					container.querySelector(".streaming-markdown-image-skeleton"),
				).toBeFalsy();
			} finally {
				restore();
			}
		});

		it("should render fallback with alt text when image load fails", async () => {
			const restore = installMockImage(() => "error");
			try {
				const { container } = render(
					createElement(StreamingMarkdown, {
						content: "Look ![profile photo](https://example.com/fail.png)\n\n",
						batchMs: 0,
					}),
				);

				expect(
					container.querySelector(".streaming-markdown-image-skeleton"),
				).toBeTruthy();

				await waitFor(() => {
					expect(
						container.querySelector(".streaming-markdown-image-fallback"),
					).toBeTruthy();
				});

				expect(container.textContent).toContain("profile photo");
				expect(container.querySelector("img")).toBeFalsy();
			} finally {
				restore();
			}
		});

		it("should reuse cached image readiness and avoid skeleton flicker", async () => {
			const restore = installMockImage(() => "load");
			try {
				const first = render(
					createElement(StreamingMarkdown, {
						content: "![logo](https://example.com/cached-logo.png)",
						batchMs: 0,
					}),
				);

				await waitFor(() => {
					expect(first.container.querySelector("img")).toBeTruthy();
				});
				first.unmount();

				const second = render(
					createElement(StreamingMarkdown, {
						content: "![logo](https://example.com/cached-logo.png)",
						batchMs: 0,
					}),
				);

				expect(second.container.querySelector("img")).toBeTruthy();
				expect(
					second.container.querySelector(".streaming-markdown-image-skeleton"),
				).toBeFalsy();
			} finally {
				restore();
			}
		});

		it("should render empty content without errors", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "",
					batchMs: 0,
				}),
			);
			expect(container.querySelector("div")).toBeTruthy();
		});

		it("should apply className to wrapper", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Hello\n\n",
					className: "prose",
					batchMs: 0,
				}),
			);
			expect(container.querySelector(".prose")).toBeTruthy();
		});

		it("should use custom components", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Hello **world**\n\n",
					batchMs: 0,
					components: {
						strong: ({ children }) =>
							createElement("b", { className: "custom-bold" }, children),
					},
				}),
			);
			expect(container.querySelector(".custom-bold")).toBeTruthy();
		});
	});

	describe("compatibility", () => {
		it("should handle GFM tables", () => {
			const content =
				"| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |\n\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("table");
		});

		it("should handle nested lists (2 levels deep)", () => {
			const content = "- Item 1\n  - Sub 1\n  - Sub 2\n- Item 2\n\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("list");
		});

		it("should handle blockquote with inline formatting", () => {
			const content = "> Hello **bold** and *italic*\n\n";
			const result = parseIncremental(content);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("blockquote");

			const { container } = render(
				createElement(StreamingMarkdown, {
					content,
					batchMs: 0,
				}),
			);
			expect(container.querySelector("blockquote")).toBeTruthy();
			expect(container.querySelector("strong")).toBeTruthy();
		});

		it("should handle content with only whitespace", () => {
			const result = parseIncremental("   \n  \n   ");
			expect(result.blocks).toHaveLength(0);
		});

		it("should handle very long single paragraph", () => {
			const longText = "word ".repeat(2000);
			const result = parseIncremental(longText);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});
});
