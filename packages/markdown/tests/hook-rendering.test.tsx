import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";

// Helper to render markdown with batchMs=0 for synchronous output
function renderMarkdown(content: string, components?: Record<string, unknown>) {
	return render(
		createElement(StreamingMarkdown, {
			content,
			batchMs: 0,
			...(components ? { components } : {}),
		}),
	);
}

// ---------------------------------------------------------------------------
// sanitizeUrl (tested via rendered output)
// ---------------------------------------------------------------------------

describe("sanitizeUrl", () => {
	it("blocks javascript: protocol in links", () => {
		const { container } = renderMarkdown(
			"[click](javascript:alert('xss'))\n\n",
		);
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("");
	});

	it("blocks data: URIs that are not images", () => {
		const { container } = renderMarkdown(
			"[click](data:text/html,<script>alert(1)</script>)\n\n",
		);
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("");
	});

	it("blocks vbscript: protocol", () => {
		const { container } = renderMarkdown("[click](vbscript:MsgBox('xss'))\n\n");
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("");
	});

	it("allows http URLs", () => {
		const { container } = renderMarkdown("[click](http://example.com)\n\n");
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("http://example.com");
	});

	it("allows https URLs", () => {
		const { container } = renderMarkdown("[click](https://example.com)\n\n");
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("https://example.com");
	});

	it("allows mailto URLs", () => {
		const { container } = renderMarkdown(
			"[email](mailto:user@example.com)\n\n",
		);
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("mailto:user@example.com");
	});

	it("allows data:image/ URIs", () => {
		const { container } = renderMarkdown(
			"[img](data:image/png;base64,abc)\n\n",
		);
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("data:image/png;base64,abc");
	});
});

// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

describe("block rendering", () => {
	describe("headings", () => {
		it("renders h1", () => {
			const { container } = renderMarkdown("# Title\n\n");
			expect(container.querySelector("h1")).toBeTruthy();
			expect(container.textContent).toContain("Title");
		});

		it("renders h2", () => {
			const { container } = renderMarkdown("## Subtitle\n\n");
			expect(container.querySelector("h2")).toBeTruthy();
		});

		it("renders h3", () => {
			const { container } = renderMarkdown("### Section\n\n");
			expect(container.querySelector("h3")).toBeTruthy();
		});

		it("renders h4", () => {
			const { container } = renderMarkdown("#### Subsection\n\n");
			expect(container.querySelector("h4")).toBeTruthy();
		});

		it("renders h5", () => {
			const { container } = renderMarkdown("##### Small\n\n");
			expect(container.querySelector("h5")).toBeTruthy();
		});

		it("renders h6", () => {
			const { container } = renderMarkdown("###### Tiny\n\n");
			expect(container.querySelector("h6")).toBeTruthy();
		});
	});

	describe("paragraph", () => {
		it("renders p with inline content", () => {
			const { container } = renderMarkdown("Hello world\n\n");
			expect(container.querySelector("p")).toBeTruthy();
			expect(container.textContent).toContain("Hello world");
		});
	});

	describe("code block", () => {
		it("renders pre/code with language class", () => {
			const { container } = renderMarkdown("```js\nconsole.log('hi')\n```\n\n");
			const pre = container.querySelector("pre");
			const code = container.querySelector("code");
			expect(pre).toBeTruthy();
			expect(code).toBeTruthy();
			expect(code?.className).toContain("language-js");
		});

		it("renders code block without language", () => {
			const { container } = renderMarkdown("```\nhello\n```\n\n");
			const code = container.querySelector("code");
			expect(code).toBeTruthy();
			expect(code?.className).toBe("");
		});
	});

	describe("blockquote", () => {
		it("renders blockquote element", () => {
			const { container } = renderMarkdown("> Some quote\n\n");
			expect(container.querySelector("blockquote")).toBeTruthy();
			expect(container.textContent).toContain("Some quote");
		});
	});

	describe("list", () => {
		it("renders ul with li items", () => {
			const { container } = renderMarkdown("- Item 1\n- Item 2\n- Item 3\n\n");
			expect(container.querySelector("ul")).toBeTruthy();
			const items = container.querySelectorAll("li");
			expect(items.length).toBeGreaterThanOrEqual(3);
		});

		it("renders ol with li items", () => {
			const { container } = renderMarkdown("1. First\n2. Second\n3. Third\n\n");
			expect(container.querySelector("ol")).toBeTruthy();
			const items = container.querySelectorAll("li");
			expect(items.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("ordered list with nested unordered items", () => {
		it("renders exactly 4 root li elements for 4 numbered items with nested bullets", () => {
			const content =
				"1. Item A\n   - detail\n2. Item B\n3. Item C\n   - detail\n4. Item D\n\n";
			const { container } = renderMarkdown(content);
			expect(container.querySelector("ol")).toBeTruthy();
			// Should have exactly 4 top-level <li> (direct children of <ol>)
			const ol = container.querySelector("ol")!;
			const topLevelItems = ol.querySelectorAll(":scope > li");
			expect(topLevelItems.length).toBe(4);
		});

		it("keeps a trailing paragraph outside a loose ordered list", () => {
			const content =
				"The user wants me to analyze the codebase and check if the README.md is correct. This requires:\n\n1. Understanding the codebase structure and what it does\n\n2. Reading the README.md to see what it claims\n\n3. Comparing the README claims against the actual codebase\n\nThis is an exploration task, so I should delegate to ExploreAgent to understand the codebase comprehensively. Let me do that.\n";
			const { container } = renderMarkdown(content);
			const ol = container.querySelector("ol");
			expect(ol).toBeTruthy();
			const topLevelItems = ol!.querySelectorAll(":scope > li");
			expect(topLevelItems.length).toBe(3);
			expect(topLevelItems[2]?.textContent).toContain(
				"Comparing the README claims against the actual codebase",
			);
			expect(topLevelItems[2]?.textContent).not.toContain(
				"This is an exploration task",
			);
			const paragraphs = Array.from(container.querySelectorAll("p")).map(
				(node) => node.textContent?.trim(),
			);
			expect(paragraphs).toContain(
				"This is an exploration task, so I should delegate to ExploreAgent to understand the codebase comprehensively. Let me do that.",
			);
		});
	});

	describe("table", () => {
		it("renders table/thead/tbody/tr/td structure", () => {
			const { container } = renderMarkdown(
				"| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |\n\n",
			);
			expect(container.querySelector("table")).toBeTruthy();
			expect(container.querySelector("thead")).toBeTruthy();
			expect(container.querySelector("tbody")).toBeTruthy();
			const thCells = container.querySelectorAll("th");
			expect(thCells.length).toBeGreaterThanOrEqual(2);
			const tdCells = container.querySelectorAll("td");
			expect(tdCells.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("hr", () => {
		it("renders hr element", () => {
			const { container } = renderMarkdown("---\n\n");
			expect(container.querySelector("hr")).toBeTruthy();
		});
	});
});

// ---------------------------------------------------------------------------
// Inline tokens
// ---------------------------------------------------------------------------

describe("inline tokens", () => {
	it("renders bold text", () => {
		const { container } = renderMarkdown("Hello **bold**\n\n");
		expect(container.querySelector("strong")).toBeTruthy();
		expect(container.textContent).toContain("bold");
	});

	it("renders italic text", () => {
		const { container } = renderMarkdown("Hello *italic*\n\n");
		expect(container.querySelector("em")).toBeTruthy();
	});

	it("renders inline code", () => {
		const { container } = renderMarkdown("Use `code` here\n\n");
		expect(container.querySelector("code")).toBeTruthy();
		expect(container.textContent).toContain("code");
	});

	it("renders link with sanitized href", () => {
		const { container } = renderMarkdown("[click](https://example.com)\n\n");
		const link = container.querySelector("a");
		expect(link).toBeTruthy();
		expect(link?.getAttribute("href")).toBe("https://example.com");
		expect(link?.textContent).toContain("click");
	});

	it("renders strikethrough", () => {
		const { container } = renderMarkdown("Hello ~~deleted~~\n\n");
		expect(container.querySelector("del")).toBeTruthy();
		expect(container.textContent).toContain("deleted");
	});

	it("renders autolink", () => {
		const { container } = renderMarkdown("<https://example.com>\n\n");
		const link = container.querySelector("a");
		expect(link).toBeTruthy();
		expect(link?.getAttribute("href")).toContain("https://example.com");
	});
});

// ---------------------------------------------------------------------------
// Custom component overrides
// ---------------------------------------------------------------------------

describe("custom component overrides", () => {
	it("overrides strong component", () => {
		const { container } = renderMarkdown("Hello **world**\n\n", {
			strong: ({ children }: { children: unknown }) =>
				createElement("b", { className: "my-bold" }, children as string),
		});
		expect(container.querySelector(".my-bold")).toBeTruthy();
		expect(container.querySelector("strong")).toBeFalsy();
	});

	it("overrides heading component", () => {
		const { container } = renderMarkdown("# Title\n\n", {
			h1: ({ children }: { children: unknown }) =>
				createElement("div", { className: "custom-h1" }, children as string),
		});
		expect(container.querySelector(".custom-h1")).toBeTruthy();
		expect(container.querySelector("h1")).toBeFalsy();
	});

	it("overrides code component", () => {
		const { container } = renderMarkdown("```js\nhello\n```\n\n", {
			code: ({
				children,
				language,
			}: {
				children: unknown;
				language?: string;
			}) =>
				createElement(
					"div",
					{ className: "custom-code", "data-lang": language },
					children as string,
				),
		});
		expect(container.querySelector(".custom-code")).toBeTruthy();
		expect(
			container.querySelector(".custom-code")?.getAttribute("data-lang"),
		).toBe("js");
	});

	it("overrides link component", () => {
		const { container } = renderMarkdown("[click](https://example.com)\n\n", {
			a: ({ href, children }: { href: string; children: unknown }) =>
				createElement(
					"span",
					{ className: "custom-link", "data-href": href },
					children as string,
				),
		});
		expect(container.querySelector(".custom-link")).toBeTruthy();
		expect(
			container.querySelector(".custom-link")?.getAttribute("data-href"),
		).toBe("https://example.com");
	});
});
