import { micromark } from "micromark";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { bench, describe } from "vitest";
import { StreamingMarkdown } from "../src/component.js";
import { parseIncremental } from "../src/core/parser.js";
import {
	BUNDLE_SIZES,
	FEATURE_PARITY,
	generateStreamingSteps,
	MIXED_CONTENT,
	SHORT_PARAGRAPH,
} from "./fixtures.js";

/**
 * Comparison benchmarks: @deltakit/markdown vs react-markdown
 *
 * FAIRNESS NOTES:
 * - All benchmarks use renderToStaticMarkup for both libraries (same rendering path)
 * - react-markdown produces spec-compliant HTML; @deltakit/markdown wraps elements
 *   in extra <div>/<span> tags (less work, simpler output)
 * - react-markdown supports the full CommonMark spec + plugin ecosystem;
 *   @deltakit/markdown supports a subset optimized for AI streaming
 * - The "streaming simulation" here uses renderToStaticMarkup in a loop, which
 *   does NOT demonstrate @deltakit/markdown's React.memo advantage (that only
 *   benefits client-side re-renders with real DOM reconciliation)
 * - See FEATURE_PARITY in fixtures.ts for a full feature comparison
 */

// ── Static render comparison ──
// Both libraries render the same markdown to HTML via renderToStaticMarkup.
// NOTE: @deltakit/markdown produces simpler HTML (extra wrapper divs/spans,
// no nested paragraph in blockquotes, etc.), so this is NOT an equal-output
// comparison. We do less work, so being faster here is expected.

describe("static render — short paragraph", () => {
	const content = `${SHORT_PARAGRAPH}\n\n`;

	bench("@deltakit/markdown", () => {
		renderToStaticMarkup(
			createElement(StreamingMarkdown, { content, batchMs: 0 }),
		);
	});

	bench("react-markdown", () => {
		renderToStaticMarkup(createElement(ReactMarkdown, null, content));
	});
});

describe("static render — mixed content (~1.2kb)", () => {
	bench("@deltakit/markdown", () => {
		renderToStaticMarkup(
			createElement(StreamingMarkdown, {
				content: MIXED_CONTENT,
				batchMs: 0,
			}),
		);
	});

	bench("react-markdown", () => {
		renderToStaticMarkup(createElement(ReactMarkdown, null, MIXED_CONTENT));
	});
});

// ── Streaming simulation (renderToStaticMarkup loop) ──
// CAVEAT: This measures raw throughput of re-rendering from scratch each time.
// It does NOT capture @deltakit/markdown's React.memo optimization, which only
// benefits real client-side React reconciliation. In a real browser, completed
// blocks would be skipped entirely — that advantage is not measured here.

describe("streaming simulation — 100 re-renders (renderToStaticMarkup)", () => {
	const steps = generateStreamingSteps(MIXED_CONTENT, 12);

	bench(`@deltakit/markdown (${steps.length} renders)`, () => {
		for (const step of steps) {
			renderToStaticMarkup(
				createElement(StreamingMarkdown, { content: step, batchMs: 0 }),
			);
		}
	});

	bench(`react-markdown (${steps.length} renders)`, () => {
		for (const step of steps) {
			renderToStaticMarkup(createElement(ReactMarkdown, null, step));
		}
	});
});

// ── Parse-only comparison: parseIncremental vs micromark ──
// This is a fairer apples-to-apples comparison. micromark is the parser engine
// that react-markdown uses internally (via remark-parse → mdast-util-from-markdown
// → micromark). Both produce a parsed representation from the same input.
//
// NOTE: micromark produces spec-compliant HTML string output.
// parseIncremental produces a Block[] AST. Different output formats,
// but both represent "parsing markdown" without React rendering.

describe("parse-only — mixed content (~1.2kb)", () => {
	bench("@deltakit/markdown parseIncremental → Block[]", () => {
		parseIncremental(MIXED_CONTENT);
	});

	bench("micromark → HTML string (engine behind react-markdown)", () => {
		micromark(MIXED_CONTENT);
	});
});

describe("parse-only — short paragraph", () => {
	bench("@deltakit/markdown parseIncremental", () => {
		parseIncremental(`${SHORT_PARAGRAPH}\n\n`);
	});

	bench("micromark", () => {
		micromark(`${SHORT_PARAGRAPH}\n\n`);
	});
});

// ── Parse-only streaming simulation ──
// How fast can each parser handle 100+ re-parses during streaming?

describe("parse-only streaming — ~100 steps", () => {
	const steps = generateStreamingSteps(MIXED_CONTENT, 12);

	bench(`@deltakit/markdown (${steps.length} parses)`, () => {
		for (const step of steps) {
			parseIncremental(step, { bufferIncomplete: true });
		}
	});

	bench(`micromark (${steps.length} parses)`, () => {
		for (const step of steps) {
			micromark(step);
		}
	});
});

// ── Bundle size report (not a benchmark, but logged for reference) ──
// These are pre-measured values. Run `benchmarks/measure-bundle.sh` to update.

describe("bundle size (reference, not a perf benchmark)", () => {
	bench("@deltakit/markdown — report sizes", () => {
		// This bench is just a carrier for the report — no meaningful perf data
		void BUNDLE_SIZES.deltakit.gzipped;
	});

	bench("react-markdown — report sizes", () => {
		void BUNDLE_SIZES.reactMarkdown.gzipped;
	});
});

// Log feature parity and bundle sizes after benchmarks
if (typeof globalThis !== "undefined") {
	console.log("\n─── Feature Parity Matrix ───\n");
	const features = Object.entries(FEATURE_PARITY);
	const maxLen = Math.max(...features.map(([k]) => k.length));
	console.log(
		`${"Feature".padEnd(maxLen)}  @deltakit/markdown    react-markdown`,
	);
	console.log(`${"─".repeat(maxLen)}  ${"─".repeat(20)}  ${"─".repeat(20)}`);
	for (const [feature, support] of features) {
		const dk =
			support.deltakit === true
				? "✓"
				: support.deltakit === false
					? "✗"
					: String(support.deltakit);
		const rm =
			support.reactMarkdown === true
				? "✓"
				: support.reactMarkdown === false
					? "✗"
					: String(support.reactMarkdown);
		console.log(`${feature.padEnd(maxLen)}  ${dk.padEnd(20)}  ${rm}`);
	}

	console.log("\n─── Bundle Size ───\n");
	console.log(
		`@deltakit/markdown:  ${(BUNDLE_SIZES.deltakit.minified / 1024).toFixed(1)}kb minified, ${(BUNDLE_SIZES.deltakit.gzipped / 1024).toFixed(1)}kb gzipped, ${BUNDLE_SIZES.deltakit.runtimeDeps} runtime deps`,
	);
	console.log(
		`react-markdown:      ${(BUNDLE_SIZES.reactMarkdown.minified / 1024).toFixed(1)}kb minified, ${(BUNDLE_SIZES.reactMarkdown.gzipped / 1024).toFixed(1)}kb gzipped, ${BUNDLE_SIZES.reactMarkdown.runtimeDeps} runtime deps`,
	);
	console.log(
		`\nSize ratio: react-markdown is ${(BUNDLE_SIZES.reactMarkdown.gzipped / BUNDLE_SIZES.deltakit.gzipped).toFixed(1)}x larger (gzipped)`,
	);

	console.log("\n─── Fairness Disclaimers ───\n");
	console.log(
		"1. @deltakit/markdown produces simpler HTML (extra wrapper <div>/<span> tags).",
	);
	console.log("   react-markdown produces spec-compliant CommonMark HTML.");
	console.log(
		"2. react-markdown supports the full CommonMark spec + plugin ecosystem.",
	);
	console.log(
		"   @deltakit/markdown supports a subset optimized for AI streaming.",
	);
	console.log(
		"3. The renderToStaticMarkup benchmarks do NOT show React.memo benefits.",
	);
	console.log(
		"   @deltakit/markdown's key advantage (stable block memoization) only",
	);
	console.log("   appears in real client-side React reconciliation.");
	console.log("4. Parse-only benchmarks compare different output formats:");
	console.log(
		"   parseIncremental → Block[] (AST) vs micromark → HTML string.",
	);
	console.log("");
}
