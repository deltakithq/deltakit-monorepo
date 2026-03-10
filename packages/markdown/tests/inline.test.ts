import { describe, expect, it } from "vitest";
import { findBufferPoint, parseInline } from "../src/core/inline.js";

describe("parseInline", () => {
	describe("plain text", () => {
		it("should parse plain text", () => {
			const tokens = parseInline("Hello world");
			expect(tokens).toHaveLength(1);
			expect(tokens[0].type).toBe("text");
			expect(tokens[0].value).toBe("Hello world");
		});

		it("should handle empty string", () => {
			const tokens = parseInline("");
			expect(tokens).toHaveLength(0);
		});
	});

	describe("bold", () => {
		it("should parse **bold** text", () => {
			const tokens = parseInline("Hello **world**");
			expect(tokens).toHaveLength(2);
			expect(tokens[0].type).toBe("text");
			expect(tokens[0].value).toBe("Hello ");
			expect(tokens[1].type).toBe("strong");
			expect(tokens[1].value).toBe("world");
		});

		it("should parse __bold__ text", () => {
			const tokens = parseInline("Hello __world__");
			expect(tokens).toHaveLength(2);
			expect(tokens[0].type).toBe("text");
			expect(tokens[1].type).toBe("strong");
			expect(tokens[1].value).toBe("world");
		});

		it("should parse bold at start of string", () => {
			const tokens = parseInline("**bold** text");
			expect(tokens[0].type).toBe("strong");
			expect(tokens[0].value).toBe("bold");
		});

		it("should parse bold at end of string", () => {
			const tokens = parseInline("text **bold**");
			const lastToken = tokens[tokens.length - 1];
			expect(lastToken.type).toBe("strong");
			expect(lastToken.value).toBe("bold");
		});
	});

	describe("italic", () => {
		it("should parse *italic* text", () => {
			const tokens = parseInline("Hello *world*");
			expect(tokens).toHaveLength(2);
			expect(tokens[0].type).toBe("text");
			expect(tokens[1].type).toBe("em");
			expect(tokens[1].value).toBe("world");
		});

		it("should parse _italic_ text", () => {
			const tokens = parseInline("Hello _world_");
			expect(tokens).toHaveLength(2);
			expect(tokens[1].type).toBe("em");
			expect(tokens[1].value).toBe("world");
		});
	});

	describe("inline code", () => {
		it("should parse `code` text", () => {
			const tokens = parseInline("Use `console.log()` here");
			expect(tokens).toHaveLength(3);
			expect(tokens[0].type).toBe("text");
			expect(tokens[0].value).toBe("Use ");
			expect(tokens[1].type).toBe("code");
			expect(tokens[1].value).toBe("console.log()");
			expect(tokens[2].type).toBe("text");
			expect(tokens[2].value).toBe(" here");
		});
	});

	describe("strikethrough", () => {
		it("should parse ~~strikethrough~~ text", () => {
			const tokens = parseInline("Hello ~~world~~");
			expect(tokens).toHaveLength(2);
			expect(tokens[1].type).toBe("del");
			expect(tokens[1].value).toBe("world");
		});
	});

	describe("links", () => {
		it("should parse [text](url) links", () => {
			const tokens = parseInline("Click [here](https://example.com)");
			expect(tokens).toHaveLength(2);
			expect(tokens[0].type).toBe("text");
			expect(tokens[1].type).toBe("link");
			expect(tokens[1].value).toBe("here");
			expect(tokens[1].href).toBe("https://example.com");
		});

		it("should parse link with inline formatting in text", () => {
			const tokens = parseInline("[**bold link**](https://example.com)");
			expect(tokens).toHaveLength(1);
			expect(tokens[0].type).toBe("link");
			expect(tokens[0].children).toBeDefined();
			expect(tokens[0].children?.[0].type).toBe("strong");
		});
	});

	describe("images", () => {
		it("should parse ![alt](src) images", () => {
			const tokens = parseInline("See ![logo](https://example.com/logo.png)");
			expect(tokens).toHaveLength(2);
			expect(tokens[1].type).toBe("image");
			expect(tokens[1].alt).toBe("logo");
			expect(tokens[1].href).toBe("https://example.com/logo.png");
		});
	});

	describe("autolinks", () => {
		it("should parse https:// autolinks", () => {
			const tokens = parseInline("Visit https://example.com for more");
			expect(tokens).toHaveLength(3);
			expect(tokens[0].type).toBe("text");
			expect(tokens[1].type).toBe("autolink");
			expect(tokens[1].href).toBe("https://example.com");
			expect(tokens[2].type).toBe("text");
		});

		it("should parse http:// autolinks", () => {
			const tokens = parseInline("Visit http://example.com for more");
			expect(tokens).toHaveLength(3);
			expect(tokens[1].type).toBe("autolink");
			expect(tokens[1].href).toBe("http://example.com");
		});
	});

	describe("mixed inline", () => {
		it("should parse mixed bold and italic", () => {
			const tokens = parseInline("Hello **bold** and *italic* text");
			const types = tokens.map((t) => t.type);
			expect(types).toContain("text");
			expect(types).toContain("strong");
			expect(types).toContain("em");
		});

		it("should parse code followed by link", () => {
			const tokens = parseInline("Use `code` and [link](url)");
			const types = tokens.map((t) => t.type);
			expect(types).toContain("code");
			expect(types).toContain("link");
		});
	});
});

describe("findBufferPoint", () => {
	it("should return -1 for complete text", () => {
		expect(findBufferPoint("Hello **world**")).toBe(-1);
	});

	it("should find unclosed bold marker", () => {
		const point = findBufferPoint("Hello **wor");
		expect(point).toBeGreaterThanOrEqual(0);
		expect("Hello **wor".slice(point)).toContain("**");
	});

	it("should find unclosed italic marker", () => {
		const point = findBufferPoint("Hello *wor");
		expect(point).toBeGreaterThanOrEqual(0);
	});

	it("should find unclosed backtick", () => {
		const point = findBufferPoint("Use `console");
		expect(point).toBeGreaterThanOrEqual(0);
	});

	it("should find unclosed link bracket", () => {
		const point = findBufferPoint("Click [here");
		expect(point).toBeGreaterThanOrEqual(0);
	});

	it("should find unclosed strikethrough", () => {
		const point = findBufferPoint("Hello ~~wor");
		expect(point).toBeGreaterThanOrEqual(0);
	});

	it("should return -1 when all markers are closed", () => {
		expect(findBufferPoint("Hello **bold** and *italic* and `code`")).toBe(-1);
	});
});
