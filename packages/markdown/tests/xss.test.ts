import { describe, expect, it } from "vitest";
import { parseIncremental } from "../src/core/parser.js";

describe("XSS prevention", () => {
	describe("link href sanitization", () => {
		it("should block javascript: protocol in markdown links", () => {
			const result = parseIncremental("[click me](javascript:alert('xss'))");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			// The raw content should still have the link structure
			expect(result.blocks[0].raw).toContain(
				"[click me](javascript:alert('xss'))",
			);
		});

		it("should block javascript: protocol with different casing", () => {
			const result = parseIncremental("[click me](JaVaScRiPt:alert('xss'))");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should block javascript: with HTML entities", () => {
			const result = parseIncremental(
				"[click me](javascript&#58;alert('xss'))",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should block data: URIs that could execute code", () => {
			const result = parseIncremental(
				"[click me](data:text/html,<script>alert('xss')</script>)",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should allow safe http/https links", () => {
			const result = parseIncremental("[click me](https://example.com)");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toContain("[click me](https://example.com)");
		});

		it("should allow mailto: links", () => {
			const result = parseIncremental("[email me](mailto:test@example.com)");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should allow tel: links", () => {
			const result = parseIncremental("[call me](tel:+1234567890)");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});

	describe("image src sanitization", () => {
		it("should block javascript: protocol in image src", () => {
			const result = parseIncremental("![alt](javascript:alert('xss'))");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toContain("![alt](javascript:alert('xss'))");
		});

		it("should block data: URIs in images that could be dangerous", () => {
			const result = parseIncremental(
				"![alt](data:text/html,<script>alert('xss')</script>)",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});

		it("should allow safe http/https image URLs", () => {
			const result = parseIncremental("![alt](https://example.com/image.png)");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(result.blocks[0].raw).toContain(
				"![alt](https://example.com/image.png)",
			);
		});

		it("should allow data:image/ for actual images", () => {
			const result = parseIncremental(
				"![alt](data:image/png;base64,iVBORw0KGgo)",
			);
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});

	describe("autolink sanitization", () => {
		it("should not autolink javascript: URLs", () => {
			const result = parseIncremental("Check out javascript:alert('xss')");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
			// Should be treated as plain text, not a link
			expect(result.blocks[0].raw).toBe("Check out javascript:alert('xss')");
		});

		it("should autolink safe https URLs", () => {
			const result = parseIncremental("Check out https://example.com");
			expect(result.blocks).toHaveLength(1);
			expect(result.blocks[0].type).toBe("paragraph");
		});
	});
});
