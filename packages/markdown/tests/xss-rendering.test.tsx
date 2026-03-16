import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";

describe("XSS prevention in rendering", () => {
	describe("link href sanitization", () => {
		it("should sanitize javascript: protocol in markdown links", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "[click me](javascript:alert('xss'))\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			// Should not have javascript: protocol
			const href = link?.getAttribute("href");
			expect(href).not.toMatch(/^javascript:/i);
			// Should be sanitized to empty or have safe protocol
			expect(href).toBe("");
		});

		it("should sanitize javascript: with different casing", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "[click me](JaVaScRiPt:alert('xss'))\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			const href = link?.getAttribute("href");
			expect(href).not.toMatch(/^javascript:/i);
		});

		it("should allow safe http/https links", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "[click me](https://example.com)\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			expect(link?.getAttribute("href")).toBe("https://example.com");
		});

		it("should allow mailto: links", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "[email me](mailto:test@example.com)\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			expect(link?.getAttribute("href")).toBe("mailto:test@example.com");
		});

		it("should allow tel: links", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "[call me](tel:+1234567890)\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			expect(link?.getAttribute("href")).toBe("tel:+1234567890");
		});
	});

	describe("image src sanitization", () => {
		it("should sanitize javascript: protocol in image src", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "![alt](javascript:alert('xss'))\n\n",
					batchMs: 0,
				}),
			);
			// Image should not render with javascript: src
			// It should be removed entirely or replaced with placeholder
			expect(container.textContent).not.toContain("javascript:");
			// Should not render an actual image element
			const img = container.querySelector("img");
			expect(img).toBeFalsy();
		});

		it("should allow safe https image URLs", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "![alt](https://example.com/image.png)\n\n",
					batchMs: 0,
				}),
			);
			// Should show skeleton (attempting to load)
			const skeleton = container.querySelector(
				".streaming-markdown-image-skeleton",
			);
			expect(skeleton).toBeTruthy();
		});
	});

	describe("autolink sanitization", () => {
		it("should not render javascript: URLs as autolinks", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Check out javascript:alert('xss')\n\n",
					batchMs: 0,
				}),
			);
			// Should not create a link
			const link = container.querySelector("a");
			expect(link).toBeFalsy();
			// Should render as plain text
			expect(container.textContent).toContain("javascript:alert('xss')");
		});

		it("should render safe https URLs as autolinks", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Check out https://example.com\n\n",
					batchMs: 0,
				}),
			);
			const link = container.querySelector("a");
			expect(link).toBeTruthy();
			expect(link?.getAttribute("href")).toBe("https://example.com");
		});
	});
});
