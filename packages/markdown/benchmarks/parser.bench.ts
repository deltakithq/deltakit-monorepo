import { bench, describe } from "vitest";
import { parseInline } from "../src/core/inline.js";
import { parseIncremental } from "../src/core/parser.js";
import {
	generateStreamingSteps,
	HEAVY_INLINE,
	LONG_CONTENT,
	MIXED_CONTENT,
	SHORT_PARAGRAPH,
} from "./fixtures.js";

/**
 * Parser-only benchmarks for @deltakit/markdown internals.
 * These are NOT comparisons against react-markdown — they measure
 * our own parser performance for optimization and regression tracking.
 */

// ── parseIncremental benchmarks ──

describe("parseIncremental", () => {
	bench("short paragraph (~60 chars)", () => {
		parseIncremental(SHORT_PARAGRAPH);
	});

	bench("mixed content (~1.2kb, heading+para+code+list+blockquote)", () => {
		parseIncremental(MIXED_CONTENT);
	});

	bench("long content (~10kb single paragraph)", () => {
		parseIncremental(LONG_CONTENT);
	});

	bench("with buffering — unclosed bold", () => {
		parseIncremental("Hello **world is great and this is a test", {
			bufferIncomplete: true,
		});
	});

	bench("with buffering — unclosed link", () => {
		parseIncremental("Click [here to learn more about this", {
			bufferIncomplete: true,
		});
	});

	bench("without buffering — same content", () => {
		parseIncremental("Hello **world is great and this is a test", {
			bufferIncomplete: false,
		});
	});
});

// ── Streaming simulation benchmarks ──
// These measure the real cost of re-parsing on every token during streaming.

describe("streaming simulation", () => {
	const steps100 = generateStreamingSteps(MIXED_CONTENT, 12);
	const steps500 = generateStreamingSteps(MIXED_CONTENT, 3);

	bench(`~100-step stream (${steps100.length} parses)`, () => {
		for (const step of steps100) {
			parseIncremental(step, { bufferIncomplete: true });
		}
	});

	bench(`~500-step stream (${steps500.length} parses)`, () => {
		for (const step of steps500) {
			parseIncremental(step, { bufferIncomplete: true });
		}
	});

	bench("incremental cost — first token", () => {
		parseIncremental(MIXED_CONTENT.slice(0, 4));
	});

	bench("incremental cost — midpoint", () => {
		parseIncremental(MIXED_CONTENT.slice(0, MIXED_CONTENT.length / 2));
	});

	bench("incremental cost — full content", () => {
		parseIncremental(MIXED_CONTENT);
	});
});

// ── parseInline benchmarks ──

describe("parseInline", () => {
	bench("plain text (no special chars)", () => {
		parseInline("Hello world this is just plain text with nothing special");
	});

	bench("heavy formatting (bold+italic+code+link)", () => {
		parseInline(HEAVY_INLINE);
	});

	bench("single bold", () => {
		parseInline("Hello **world**");
	});

	bench("nested: bold inside link", () => {
		parseInline("[**bold link text**](https://example.com)");
	});

	bench("many inline elements (10x)", () => {
		const input = "**bold** *italic* `code` [link](url) ".repeat(10);
		parseInline(input);
	});
});
