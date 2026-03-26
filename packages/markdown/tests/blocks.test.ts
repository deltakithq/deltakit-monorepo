import { beforeEach, describe, expect, it } from "vitest";
import {
	createBlock,
	detectBlockType,
	extractBlockquoteContent,
	extractCodeContent,
	extractCodeLanguage,
	extractHeadingContent,
	isPipeTableCandidate,
	isPipeTableRow,
	isPotentialTableSeparator,
	isTableSeparator,
	parseTableRow,
	resetBlockIds,
} from "../src/core/blocks.js";

beforeEach(() => {
	resetBlockIds();
});

// ---------------------------------------------------------------------------
// detectBlockType
// ---------------------------------------------------------------------------

describe("detectBlockType", () => {
	describe("hr", () => {
		it("detects *** as hr", () => {
			expect(detectBlockType("***")).toEqual({ type: "hr" });
		});

		it("detects --- as hr", () => {
			expect(detectBlockType("---")).toEqual({ type: "hr" });
		});

		it("detects ___ as hr", () => {
			expect(detectBlockType("___")).toEqual({ type: "hr" });
		});

		it("detects spaced * * * as hr", () => {
			expect(detectBlockType("* * *")).toEqual({ type: "hr" });
		});
	});

	describe("code fences", () => {
		it("detects backtick fence", () => {
			const result = detectBlockType("```");
			expect(result).toEqual({ type: "code", language: undefined });
		});

		it("detects tilde fence", () => {
			const result = detectBlockType("~~~");
			expect(result).toEqual({ type: "code", language: undefined });
		});

		it("detects fence with language", () => {
			const result = detectBlockType("```javascript");
			expect(result).toEqual({ type: "code", language: "javascript" });
		});

		it("detects tilde fence with language", () => {
			const result = detectBlockType("~~~python");
			expect(result).toEqual({ type: "code", language: "python" });
		});
	});

	describe("headings", () => {
		it("detects h1", () => {
			expect(detectBlockType("# Title")).toEqual({
				type: "heading",
				level: 1,
			});
		});

		it("detects h2", () => {
			expect(detectBlockType("## Subtitle")).toEqual({
				type: "heading",
				level: 2,
			});
		});

		it("detects h6", () => {
			expect(detectBlockType("###### Deep")).toEqual({
				type: "heading",
				level: 6,
			});
		});
	});

	describe("blockquote", () => {
		it("detects > with space", () => {
			expect(detectBlockType("> quote")).toEqual({ type: "blockquote" });
		});

		it("detects > without space", () => {
			expect(detectBlockType(">quote")).toEqual({ type: "blockquote" });
		});
	});

	describe("unordered list", () => {
		it("detects - item", () => {
			expect(detectBlockType("- item")).toEqual({
				type: "list",
				listStyle: "unordered",
			});
		});

		it("detects * item", () => {
			expect(detectBlockType("* item")).toEqual({
				type: "list",
				listStyle: "unordered",
			});
		});

		it("detects + item", () => {
			expect(detectBlockType("+ item")).toEqual({
				type: "list",
				listStyle: "unordered",
			});
		});
	});

	describe("ordered list", () => {
		it("detects 1. item", () => {
			expect(detectBlockType("1. item")).toEqual({
				type: "list",
				listStyle: "ordered",
			});
		});

		it("does not detect version-like 1.0", () => {
			expect(detectBlockType("1.0 version")).toEqual({ type: "paragraph" });
		});
	});

	describe("paragraph", () => {
		it("detects non-empty text as paragraph", () => {
			expect(detectBlockType("Hello world")).toEqual({ type: "paragraph" });
		});
	});

	describe("empty", () => {
		it("returns null for empty string", () => {
			expect(detectBlockType("")).toBeNull();
		});

		it("returns null for whitespace-only", () => {
			expect(detectBlockType("   ")).toBeNull();
		});
	});
});

// ---------------------------------------------------------------------------
// createBlock / resetBlockIds
// ---------------------------------------------------------------------------

describe("createBlock", () => {
	it("creates a block with default complete=false", () => {
		const block = createBlock("paragraph", "Hello");
		expect(block.id).toBe(0);
		expect(block.type).toBe("paragraph");
		expect(block.raw).toBe("Hello");
		expect(block.complete).toBe(false);
	});

	it("creates a block with options", () => {
		const block = createBlock("heading", "# Title", {
			complete: true,
			level: 1,
		});
		expect(block.complete).toBe(true);
		expect(block.level).toBe(1);
	});

	it("increments id", () => {
		const a = createBlock("paragraph", "a");
		const b = createBlock("paragraph", "b");
		expect(a.id).toBe(0);
		expect(b.id).toBe(1);
	});

	it("stores language and listStyle", () => {
		const block = createBlock("code", "```js", { language: "js" });
		expect(block.language).toBe("js");

		const list = createBlock("list", "- item", { listStyle: "unordered" });
		expect(list.listStyle).toBe("unordered");
	});
});

describe("resetBlockIds", () => {
	it("resets counter to 0", () => {
		createBlock("paragraph", "a");
		createBlock("paragraph", "b");
		resetBlockIds();
		const block = createBlock("paragraph", "c");
		expect(block.id).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// extractHeadingContent
// ---------------------------------------------------------------------------

describe("extractHeadingContent", () => {
	it("strips # prefix for h1", () => {
		expect(extractHeadingContent("# Hello")).toBe("Hello");
	});

	it("strips ## prefix for h2", () => {
		expect(extractHeadingContent("## World")).toBe("World");
	});

	it("strips ### prefix for h3", () => {
		expect(extractHeadingContent("### Deep")).toBe("Deep");
	});
});

// ---------------------------------------------------------------------------
// extractBlockquoteContent
// ---------------------------------------------------------------------------

describe("extractBlockquoteContent", () => {
	it("strips > prefix", () => {
		expect(extractBlockquoteContent("> hello")).toBe("hello");
	});

	it("strips > from multi-line", () => {
		expect(extractBlockquoteContent("> line1\n> line2")).toBe("line1\nline2");
	});

	it("handles > without space", () => {
		expect(extractBlockquoteContent(">hello")).toBe("hello");
	});
});

// ---------------------------------------------------------------------------
// extractCodeContent
// ---------------------------------------------------------------------------

describe("extractCodeContent", () => {
	it("strips backtick fences", () => {
		expect(extractCodeContent("```\nhello\n```")).toBe("hello");
	});

	it("handles missing closing fence", () => {
		expect(extractCodeContent("```\nhello world")).toBe("hello world");
	});

	it("strips tilde fences", () => {
		expect(extractCodeContent("~~~\ncode\n~~~")).toBe("code");
	});

	it("strips fence with language", () => {
		expect(extractCodeContent("```js\nconsole.log('hi')\n```")).toBe(
			"console.log('hi')",
		);
	});
});

// ---------------------------------------------------------------------------
// extractCodeLanguage
// ---------------------------------------------------------------------------

describe("extractCodeLanguage", () => {
	it("extracts language from backtick fence", () => {
		expect(extractCodeLanguage("```javascript")).toBe("javascript");
	});

	it("extracts language from tilde fence", () => {
		expect(extractCodeLanguage("~~~python")).toBe("python");
	});

	it("returns undefined for fence without language", () => {
		expect(extractCodeLanguage("```")).toBeUndefined();
	});

	it("returns undefined for empty language", () => {
		expect(extractCodeLanguage("```   ")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// isTableSeparator
// ---------------------------------------------------------------------------

describe("isTableSeparator", () => {
	it("detects |---|---|", () => {
		expect(isTableSeparator("|---|---|")).toBe(true);
	});

	it("detects :---: alignment", () => {
		expect(isTableSeparator("|:---:|:---:|")).toBe(true);
	});

	it("detects without leading pipe", () => {
		expect(isTableSeparator("---|---")).toBe(true);
	});

	it("rejects non-separator", () => {
		expect(isTableSeparator("| hello | world |")).toBe(false);
	});

	it("rejects plain text", () => {
		expect(isTableSeparator("not a separator")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isPipeTableRow / isPipeTableCandidate / isPotentialTableSeparator
// ---------------------------------------------------------------------------

describe("isPipeTableRow", () => {
	it("returns true for | a | b |", () => {
		expect(isPipeTableRow("| a | b |")).toBe(true);
	});

	it("returns false for no trailing pipe", () => {
		expect(isPipeTableRow("| a | b")).toBe(false);
	});
});

describe("isPipeTableCandidate", () => {
	it("returns true for lines starting with |", () => {
		expect(isPipeTableCandidate("| something")).toBe(true);
	});

	it("returns false for non-pipe lines", () => {
		expect(isPipeTableCandidate("hello")).toBe(false);
	});
});

describe("isPotentialTableSeparator", () => {
	it("returns true for incomplete separator |-", () => {
		expect(isPotentialTableSeparator("|-")).toBe(true);
	});

	it("returns true for | :-", () => {
		expect(isPotentialTableSeparator("| :-")).toBe(true);
	});

	it("returns false for non-pipe start", () => {
		expect(isPotentialTableSeparator("hello")).toBe(false);
	});

	it("returns false for complete separator", () => {
		expect(isPotentialTableSeparator("|---|---|")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// parseTableRow
// ---------------------------------------------------------------------------

describe("parseTableRow", () => {
	it("parses basic row", () => {
		expect(parseTableRow("| a | b | c |")).toEqual(["a", "b", "c"]);
	});

	it("strips leading and trailing pipes", () => {
		expect(parseTableRow("| hello | world |")).toEqual(["hello", "world"]);
	});

	it("handles no leading/trailing pipes", () => {
		expect(parseTableRow("a | b")).toEqual(["a", "b"]);
	});
});
