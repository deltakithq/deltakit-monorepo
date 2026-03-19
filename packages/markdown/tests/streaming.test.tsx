import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";
import { parseIncremental } from "../src/core/parser.js";

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
