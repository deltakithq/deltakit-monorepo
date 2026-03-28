import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";
import { parseInline } from "../src/core/inline.js";
import { parseIncremental } from "../src/core/parser.js";
import { Markdown } from "../src/static.js";

// ── Fixtures ──

/** Build a single realistic AI chat response (~8-15KB) */
function buildLargeMarkdown(): string {
	const sections: string[] = [];

	sections.push("# Comprehensive Architecture Overview\n");
	sections.push(
		"This document provides a **detailed analysis** of the system architecture, including *performance considerations*, `configuration options`, and [relevant documentation](https://example.com/docs).\n",
	);

	// Paragraphs with inline formatting
	for (let i = 0; i < 5; i++) {
		sections.push(
			`\nThe **component ${i}** handles *request processing* through a series of middleware layers. Each layer applies ` +
				"`transformations`" +
				` to the incoming data, validates against the schema, and produces a **normalized output**. See the [API reference](https://example.com/api/${i}) for details.\n`,
		);
	}

	// Code block 1
	sections.push("\n## Implementation Details\n");
	sections.push("\n```typescript\n");
	sections.push("interface Config {\n");
	sections.push("  maxRetries: number;\n");
	sections.push("  timeout: number;\n");
	sections.push("  backoff: 'linear' | 'exponential';\n");
	sections.push("  onError?: (error: Error) => void;\n");
	sections.push("}\n\n");
	sections.push("async function processRequest(config: Config) {\n");
	sections.push("  for (let i = 0; i < config.maxRetries; i++) {\n");
	sections.push("    try {\n");
	sections.push("      const result = await fetch('/api/data');\n");
	sections.push("      return await result.json();\n");
	sections.push("    } catch (err) {\n");
	sections.push("      config.onError?.(err as Error);\n");
	sections.push("      await delay(getBackoff(i, config.backoff));\n");
	sections.push("    }\n");
	sections.push("  }\n");
	sections.push("  throw new Error('Max retries exceeded');\n");
	sections.push("}\n");
	sections.push("```\n");

	// Unordered list
	sections.push("\n### Key Features\n\n");
	sections.push("- **Automatic retry** with configurable backoff strategy\n");
	sections.push(
		"- *Graceful degradation* when upstream services are unavailable\n",
	);
	sections.push("- Built-in `circuit breaker` pattern for fault tolerance\n");
	sections.push(
		"- Support for [custom middleware](https://example.com/middleware)\n",
	);
	sections.push("- Comprehensive logging with structured output\n");
	sections.push("- Zero-dependency core with optional plugins\n");
	sections.push("- TypeScript-first API with full type inference\n");
	sections.push("- Tree-shakeable module structure\n");

	// Ordered list with nested content
	sections.push("\n### Setup Steps\n\n");
	sections.push("1. Install the package via npm or yarn\n");
	sections.push("2. Configure the connection settings\n");
	sections.push("3. Initialize the client with your credentials\n");
	sections.push("4. Register event handlers for lifecycle events\n");
	sections.push("5. Start the service and verify health checks\n");

	// Table
	sections.push("\n| Method | Endpoint | Description | Auth |\n");
	sections.push("|--------|----------|-------------|------|\n");
	sections.push("| GET | /api/users | List all users | Bearer |\n");
	sections.push("| POST | /api/users | Create user | Bearer |\n");
	sections.push("| GET | /api/users/:id | Get user by ID | Bearer |\n");
	sections.push("| PUT | /api/users/:id | Update user | Bearer |\n");
	sections.push("| DELETE | /api/users/:id | Delete user | Admin |\n");

	// Blockquote
	sections.push(
		"\n> **Note:** The API rate limit is 1000 requests per minute per API key. Exceeding this limit will result in *429 Too Many Requests* responses.\n",
	);

	// Code block 2
	sections.push("\n```python\n");
	sections.push("import asyncio\n");
	sections.push("from dataclasses import dataclass\n\n");
	sections.push("@dataclass\n");
	sections.push("class Pipeline:\n");
	sections.push("    stages: list[Stage]\n");
	sections.push("    max_concurrency: int = 10\n\n");
	sections.push("    async def execute(self, data: list[dict]):\n");
	sections.push(
		"        semaphore = asyncio.Semaphore(self.max_concurrency)\n",
	);
	sections.push(
		"        tasks = [self._process(item, semaphore) for item in data]\n",
	);
	sections.push("        return await asyncio.gather(*tasks)\n");
	sections.push("```\n");

	// More paragraphs
	sections.push("\n## Performance Considerations\n");
	sections.push(
		"\nThe system has been optimized for **high throughput** with *minimal latency*. Benchmarks show consistent sub-millisecond response times under normal load, with `p99 latency` staying below 5ms even at 10k RPS.\n",
	);
	sections.push(
		"\nFor production deployments, we recommend using the **connection pooling** feature with a pool size of at least `20` connections. This prevents the overhead of establishing new TCP connections for each request.\n",
	);

	// HR
	sections.push("\n---\n");

	// Another table
	sections.push("\n| Metric | Development | Staging | Production |\n");
	sections.push("|--------|------------|---------|------------|\n");
	sections.push("| p50 Latency | 2ms | 3ms | 1ms |\n");
	sections.push("| p99 Latency | 15ms | 10ms | 5ms |\n");
	sections.push("| Throughput | 1k RPS | 5k RPS | 10k RPS |\n");
	sections.push("| Error Rate | <1% | <0.5% | <0.1% |\n");

	// Code block 3
	sections.push("\n```bash\n");
	sections.push("# Deploy to production\n");
	sections.push("export NODE_ENV=production\n");
	sections.push("npm run build\n");
	sections.push("docker compose up -d\n");
	sections.push("curl -s http://localhost:3000/health | jq .\n");
	sections.push("```\n");

	// Final paragraphs
	sections.push(
		"\nFor additional information, consult the **troubleshooting guide** or reach out to the *platform team* via `#platform-support` on Slack.\n",
	);

	return sections.join("");
}

/** Build a large list with many items */
function buildLargeList(count: number): string {
	const items: string[] = [];
	for (let i = 0; i < count; i++) {
		if (i % 20 === 0 && i > 0) {
			// Every 20th item has a nested code block
			items.push(
				`${i + 1}. Item with **nested code**:\n\n   \`\`\`js\n   console.log("item ${i + 1}");\n   \`\`\`\n`,
			);
		} else if (i % 10 === 0 && i > 0) {
			// Every 10th item has a nested sub-list
			items.push(
				`${i + 1}. Item with sub-list:\n   - Sub item A for ${i + 1}\n   - Sub item B for ${i + 1}\n`,
			);
		} else {
			items.push(
				`${i + 1}. This is item **${i + 1}** with \`inline code\` and *emphasis*\n`,
			);
		}
	}
	return items.join("");
}

/** Build a chat transcript with multiple messages */
function buildChatTranscript(messageCount: number): string[] {
	const singleMessage = buildLargeMarkdown();
	const messages: string[] = [];
	for (let i = 0; i < messageCount; i++) {
		messages.push(singleMessage);
	}
	return messages;
}

/** Build markdown heavy on inline formatting (worst case for inline parser) */
function buildInlineHeavyMarkdown(paragraphs: number): string {
	const parts: string[] = [];
	for (let i = 0; i < paragraphs; i++) {
		parts.push(
			`This is **bold text ${i}** and *italic text ${i}* with \`code_${i}\` ` +
				`and [link ${i}](https://example.com/${i}) and ~~deleted ${i}~~ ` +
				`and **more _nested **bold italic**_ formatting** end.\n\n`,
		);
	}
	return parts.join("");
}

/** Build deeply nested lists */
function buildNestedLists(depth: number, itemsPerLevel: number): string {
	const lines: string[] = [];
	function addLevel(currentDepth: number): void {
		const indent = "  ".repeat(currentDepth);
		for (let i = 0; i < itemsPerLevel; i++) {
			lines.push(
				`${indent}- Level ${currentDepth} item ${i + 1} with **bold** and \`code\`\n`,
			);
			if (currentDepth < depth - 1) {
				addLevel(currentDepth + 1);
			}
		}
	}
	addLevel(0);
	return lines.join("");
}

/** Build many tables */
function buildManyTables(count: number, rows: number): string {
	const parts: string[] = [];
	for (let t = 0; t < count; t++) {
		parts.push(`\n| Column A | Column B | Column C | Column D |\n`);
		parts.push(`|----------|----------|----------|----------|\n`);
		for (let r = 0; r < rows; r++) {
			parts.push(
				`| Cell ${t}-${r}-A | **Bold ${r}** | \`code ${r}\` | [Link](https://example.com) |\n`,
			);
		}
		parts.push("\n");
	}
	return parts.join("");
}

/** Build many code blocks */
function buildManyCodeBlocks(count: number, linesPerBlock: number): string {
	const parts: string[] = [];
	const languages = [
		"typescript",
		"python",
		"rust",
		"go",
		"bash",
		"sql",
		"json",
	];
	for (let i = 0; i < count; i++) {
		const lang = languages[i % languages.length];
		parts.push(`\n\`\`\`${lang}\n`);
		for (let line = 0; line < linesPerBlock; line++) {
			parts.push(
				`  // Line ${line}: some code content with various characters {} [] () => += -= *= /=\n`,
			);
		}
		parts.push("```\n");
	}
	return parts.join("");
}

/** Build a very large single markdown document (~50KB+) */
function buildVeryLargeMarkdown(): string {
	const parts: string[] = [];

	// Multiple sections with all block types
	for (let section = 0; section < 40; section++) {
		parts.push(`\n# Section ${section + 1}: Architecture Component\n\n`);
		parts.push(
			`The **${section + 1}th component** is responsible for *processing* and \`transforming\` ` +
				`data through a pipeline. See [docs](https://example.com/section/${section}).\n\n`,
		);

		// Paragraphs
		for (let p = 0; p < 3; p++) {
			parts.push(
				`Paragraph ${p + 1} of section ${section + 1}: This contains **bold**, *italic*, ` +
					`\`inline code\`, and [links](https://example.com). The system processes ` +
					`approximately ~~10,000~~ **50,000** requests per second under normal load conditions.\n\n`,
			);
		}

		// Code block
		parts.push(
			`\`\`\`typescript\nfunction handler${section}(req: Request): Response {\n`,
		);
		parts.push(
			`  const data = parse(req.body);\n  return new Response(JSON.stringify(data));\n}\n\`\`\`\n\n`,
		);

		// List
		parts.push(`- Feature A of section ${section + 1}\n`);
		parts.push(`- Feature B with **bold** text\n`);
		parts.push(`- Feature C with \`code\` and *emphasis*\n\n`);

		// Table
		parts.push(`| Metric | Value | Status |\n|--------|-------|--------|\n`);
		parts.push(`| Latency | ${section}ms | OK |\n`);
		parts.push(`| Throughput | ${(section + 1) * 1000} RPS | OK |\n\n`);

		// Blockquote
		parts.push(
			`> **Note:** Section ${section + 1} requires special configuration.\n\n`,
		);

		// HR
		if (section < 39) parts.push("---\n\n");
	}

	return parts.join("");
}

/** Simulate realistic token-by-token streaming (varying chunk sizes) */
function simulateRealisticStreaming(content: string): number[] {
	const chunkSizes = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]; // Fibonacci-ish
	const times: number[] = [];
	let pos = 0;
	let chunkIdx = 0;

	while (pos < content.length) {
		const chunkSize = chunkSizes[chunkIdx % chunkSizes.length];
		pos = Math.min(pos + chunkSize, content.length);
		chunkIdx++;

		const slice = content.slice(0, pos);
		const start = performance.now();
		parseIncremental(slice);
		times.push(performance.now() - start);
	}

	return times;
}

// ── Tests ──

describe("performance", () => {
	describe("parser performance with large documents", () => {
		it("should parse a large markdown document in < 50ms", () => {
			const content = buildLargeMarkdown();
			expect(content.length).toBeGreaterThan(3000);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.length).toBeGreaterThan(10);
			expect(elapsed).toBeLessThan(50);
		});

		it("should average < 20ms over 100 iterations", () => {
			const content = buildLargeMarkdown();

			// Warmup
			parseIncremental(content);

			const start = performance.now();
			for (let i = 0; i < 100; i++) {
				parseIncremental(content);
			}
			const totalElapsed = performance.now() - start;
			const average = totalElapsed / 100;

			expect(average).toBeLessThan(20);
		});
	});

	describe("parser performance with many list items", () => {
		it("should parse a 200-item list in < 30ms", () => {
			const content = buildLargeList(200);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.length).toBeGreaterThan(0);
			expect(elapsed).toBeLessThan(30);
		});

		it("should produce unique block IDs", () => {
			const content = buildLargeList(100);
			const result = parseIncremental(content);

			const ids = result.blocks.map((b) => b.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});
	});

	describe("repeated parsing performance", () => {
		it("should parse the same content 100 times efficiently", () => {
			const content = buildLargeMarkdown();

			const start = performance.now();
			for (let i = 0; i < 100; i++) {
				parseIncremental(content);
			}
			const totalElapsed = performance.now() - start;

			// 100 parses should complete in under 2 seconds
			expect(totalElapsed).toBeLessThan(2000);
		});
	});

	describe("streaming simulation performance", () => {
		it("should handle incremental parsing efficiently", () => {
			const content = buildLargeMarkdown();
			const step = 100;
			let maxStepTime = 0;

			for (let i = step; i <= content.length; i += step) {
				const slice = content.slice(0, i);
				const start = performance.now();
				parseIncremental(slice);
				const elapsed = performance.now() - start;
				if (elapsed > maxStepTime) maxStepTime = elapsed;
			}

			// Each incremental step should be under 10ms
			expect(maxStepTime).toBeLessThan(10);
		});

		it("should complete full streaming simulation in reasonable time", () => {
			const content = buildLargeMarkdown();
			const step = 100;

			const start = performance.now();
			for (let i = step; i <= content.length; i += step) {
				parseIncremental(content.slice(0, i));
			}
			const totalElapsed = performance.now() - start;

			// Full simulation should complete in under 2 seconds
			expect(totalElapsed).toBeLessThan(2000);
		});
	});

	describe("component render performance", () => {
		it("should render a large document with lean DOM", () => {
			const content = buildLargeMarkdown();

			const { container } = render(
				createElement(StreamingMarkdown, {
					content,
					batchMs: 0,
				}),
			);

			// Count total DOM nodes
			const nodeCount = container.querySelectorAll("*").length;

			// Verify the content rendered
			expect(container.textContent).toContain("Architecture Overview");
			expect(container.querySelector("table")).toBeTruthy();
			expect(container.querySelector("pre")).toBeTruthy();
			expect(container.querySelector("blockquote")).toBeTruthy();

			// After wrapper removal, DOM should be lean.
			// With wrapper divs+spans: each block has an extra div, each inline token has an extra span.
			// Without: much fewer nodes. Assert a reasonable upper bound.
			// A typical large doc like ours should produce fewer than 300 DOM nodes.
			expect(nodeCount).toBeLessThan(300);
		});

		it("should not have unnecessary wrapper divs around blocks", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "# Heading\n\nParagraph text\n\n",
					batchMs: 0,
				}),
			);

			// The outer wrapper div should exist
			const outerDiv = container.firstElementChild;
			expect(outerDiv?.tagName).toBe("DIV");

			// But h1 and p should be direct children, not wrapped in extra divs
			const children = outerDiv?.children;
			if (children) {
				for (let i = 0; i < children.length; i++) {
					const child = children[i];
					// Children should be semantic elements (h1, p), not wrapper divs
					expect(child.tagName).not.toBe("DIV");
				}
			}
		});

		it("should not have unnecessary span wrappers around inline text", () => {
			const { container } = render(
				createElement(StreamingMarkdown, {
					content: "Hello **world** and *italic*\n\n",
					batchMs: 0,
				}),
			);

			// There should be no span elements at all after our optimization
			const spans = container.querySelectorAll("span");
			expect(spans.length).toBe(0);
		});
	});

	describe("style injection", () => {
		it("should inject only one style tag for multiple instances", () => {
			// Clean up any existing style tags from previous tests
			document
				.querySelectorAll("style[data-deltakit-markdown]")
				.forEach((el) => {
					el.remove();
				});

			const instances = Array.from({ length: 100 }, (_, i) =>
				render(
					createElement(StreamingMarkdown, {
						content: `Message ${i}\n\n`,
						batchMs: 0,
					}),
				),
			);

			const styleTags = document.querySelectorAll(
				"style[data-deltakit-markdown]",
			);
			expect(styleTags.length).toBe(1);

			// Cleanup
			for (const instance of instances) {
				instance.unmount();
			}
		});

		it("should remove style tag when all instances unmount", () => {
			// Clean up any existing style tags
			document
				.querySelectorAll("style[data-deltakit-markdown]")
				.forEach((el) => {
					el.remove();
				});

			const instance1 = render(
				createElement(StreamingMarkdown, {
					content: "Hello\n\n",
					batchMs: 0,
				}),
			);
			const instance2 = render(
				createElement(StreamingMarkdown, {
					content: "World\n\n",
					batchMs: 0,
				}),
			);

			expect(
				document.querySelectorAll("style[data-deltakit-markdown]").length,
			).toBe(1);

			instance1.unmount();
			// Still one instance, style should remain
			expect(
				document.querySelectorAll("style[data-deltakit-markdown]").length,
			).toBe(1);

			instance2.unmount();
			// All unmounted, style should be removed
			expect(
				document.querySelectorAll("style[data-deltakit-markdown]").length,
			).toBe(0);
		});
	});

	describe("static Markdown component", () => {
		it("should produce identical text content as StreamingMarkdown", () => {
			const content = buildLargeMarkdown();

			const streaming = render(
				createElement(StreamingMarkdown, {
					content,
					batchMs: 0,
					bufferIncomplete: false,
				}),
			);

			const staticRender = render(createElement(Markdown, { content }));

			expect(staticRender.container.textContent).toBe(
				streaming.container.textContent,
			);

			streaming.unmount();
			staticRender.unmount();
		});

		it("should render without injecting style tags", () => {
			// Clean up any existing style tags
			document
				.querySelectorAll("style[data-deltakit-markdown]")
				.forEach((el) => {
					el.remove();
				});

			const instance = render(
				createElement(Markdown, { content: "Hello **world**\n\n" }),
			);

			const styleTags = document.querySelectorAll(
				"style[data-deltakit-markdown]",
			);
			expect(styleTags.length).toBe(0);

			instance.unmount();
		});

		it("should render headings, code, lists, tables correctly", () => {
			const content = buildLargeMarkdown();

			const { container } = render(createElement(Markdown, { content }));

			expect(container.querySelector("h1")).toBeTruthy();
			expect(container.querySelector("h2")).toBeTruthy();
			expect(container.querySelector("h3")).toBeTruthy();
			expect(container.querySelector("pre")).toBeTruthy();
			expect(container.querySelector("code")).toBeTruthy();
			expect(container.querySelector("table")).toBeTruthy();
			expect(container.querySelector("blockquote")).toBeTruthy();
			expect(container.querySelector("ol")).toBeTruthy();
			expect(container.querySelector("ul")).toBeTruthy();
			expect(container.querySelector("strong")).toBeTruthy();
			expect(container.querySelector("em")).toBeTruthy();
			expect(container.querySelector("hr")).toBeTruthy();
		});

		it("should accept className", () => {
			const { container } = render(
				createElement(Markdown, {
					content: "Hello\n\n",
					className: "prose",
				}),
			);
			expect(container.querySelector(".prose")).toBeTruthy();
		});

		it("should accept custom components", () => {
			const { container } = render(
				createElement(Markdown, {
					content: "Hello **world**\n\n",
					components: {
						strong: ({ children }) =>
							createElement("b", { className: "custom-bold" }, children),
					},
				}),
			);
			expect(container.querySelector(".custom-bold")).toBeTruthy();
		});
	});

	describe("chat transcript scale", () => {
		it("should parse 50 messages worth of markdown quickly", () => {
			const messages = buildChatTranscript(50);

			const start = performance.now();
			for (const msg of messages) {
				parseIncremental(msg);
			}
			const totalElapsed = performance.now() - start;

			// 50 large messages should parse in under 2 seconds
			expect(totalElapsed).toBeLessThan(2000);
		});

		it("should render 20 messages with reasonable DOM size", () => {
			const messages = buildChatTranscript(20);

			const containers: Element[] = [];
			let totalNodes = 0;

			for (const msg of messages) {
				const { container } = render(createElement(Markdown, { content: msg }));
				const nodes = container.querySelectorAll("*").length;
				totalNodes += nodes;
				containers.push(container);
			}

			// 20 messages, each ~200 nodes = ~4000 total. Be generous.
			expect(totalNodes).toBeLessThan(8000);

			// Average nodes per message should be reasonable
			const avgNodesPerMessage = totalNodes / 20;
			expect(avgNodesPerMessage).toBeLessThan(400);
		});
	});

	// ── Additional Performance Tests ──

	describe("inline parser performance", () => {
		it("should parse heavily formatted text efficiently", () => {
			const content = buildInlineHeavyMarkdown(100);
			const lines = content.split("\n").filter((l) => l.trim().length > 0);

			const start = performance.now();
			for (const line of lines) {
				parseInline(line);
			}
			const elapsed = performance.now() - start;

			// 100 paragraphs of dense inline formatting should parse in < 50ms
			expect(elapsed).toBeLessThan(50);
		});

		it("should handle long lines with many inline tokens", () => {
			// Build a single very long line with lots of inline elements
			const parts: string[] = [];
			for (let i = 0; i < 200; i++) {
				parts.push(
					`**bold${i}** *italic${i}* \`code${i}\` [link${i}](https://example.com/${i})`,
				);
			}
			const longLine = parts.join(" ");

			expect(longLine.length).toBeGreaterThan(10000);

			const start = performance.now();
			const tokens = parseInline(longLine);
			const elapsed = performance.now() - start;

			expect(tokens.length).toBeGreaterThan(100);
			expect(elapsed).toBeLessThan(50);
		});

		it("should handle pathological unclosed markers without hanging", () => {
			// Many unclosed bold markers — could cause backtracking
			const content = "** ".repeat(500);

			const start = performance.now();
			parseInline(content);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(100);
		});

		it("should handle deeply nested formatting efficiently", () => {
			// Nested bold inside italic inside links
			const parts: string[] = [];
			for (let i = 0; i < 100; i++) {
				parts.push(
					`[*text with **bold ${i}** inside*](https://example.com/${i})`,
				);
			}
			const content = parts.join(" ");

			const start = performance.now();
			parseInline(content);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(50);
		});
	});

	describe("nested list performance", () => {
		it("should parse 3-level nested lists with 5 items per level", () => {
			const content = buildNestedLists(3, 5);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.length).toBeGreaterThan(0);
			expect(elapsed).toBeLessThan(20);
		});

		it("should render nested lists without excessive DOM nodes", () => {
			const content = buildNestedLists(3, 5);

			const { container } = render(createElement(Markdown, { content }));

			const nodeCount = container.querySelectorAll("*").length;
			const listItems = container.querySelectorAll("li");

			expect(listItems.length).toBeGreaterThan(0);
			// Nodes per list item should be reasonable (not bloated by wrapper divs)
			const nodesPerItem = nodeCount / listItems.length;
			expect(nodesPerItem).toBeLessThan(10);
		});
	});

	describe("table performance", () => {
		it("should parse many tables quickly", () => {
			const content = buildManyTables(10, 20);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.filter((b) => b.type === "table").length).toBe(10);
			expect(elapsed).toBeLessThan(30);
		});

		it("should render large tables with reasonable DOM size", () => {
			const content = buildManyTables(5, 50);

			const { container } = render(createElement(Markdown, { content }));

			const tables = container.querySelectorAll("table");
			const totalCells = container.querySelectorAll("td, th").length;

			expect(tables.length).toBe(5);
			// 5 tables × (1 header row + 50 data rows) × 4 columns = 1020 cells
			expect(totalCells).toBeGreaterThan(500);

			// Total DOM nodes should still be manageable
			const nodeCount = container.querySelectorAll("*").length;
			expect(nodeCount).toBeLessThan(3000);
		});
	});

	describe("code block performance", () => {
		it("should parse many code blocks efficiently", () => {
			const content = buildManyCodeBlocks(20, 50);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.filter((b) => b.type === "code").length).toBe(20);
			expect(elapsed).toBeLessThan(30);
		});

		it("should handle very large code blocks", () => {
			// Single code block with 1000 lines
			const lines: string[] = ["```typescript\n"];
			for (let i = 0; i < 1000; i++) {
				lines.push(`const variable${i} = "value ${i}"; // comment ${i}\n`);
			}
			lines.push("```\n");
			const content = lines.join("");

			expect(content.length).toBeGreaterThan(40000);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.length).toBe(1);
			expect(result.blocks[0].type).toBe("code");
			expect(result.blocks[0].complete).toBe(true);
			expect(elapsed).toBeLessThan(30);
		});
	});

	describe("very large document performance", () => {
		it("should parse a large (~50KB) document in < 100ms", () => {
			const content = buildVeryLargeMarkdown();
			expect(content.length).toBeGreaterThan(40000);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.length).toBeGreaterThan(50);
			expect(elapsed).toBeLessThan(100);
		});

		it("should average < 30ms over 50 iterations for large doc", () => {
			const content = buildVeryLargeMarkdown();

			// Warmup
			parseIncremental(content);

			const start = performance.now();
			for (let i = 0; i < 50; i++) {
				parseIncremental(content);
			}
			const average = (performance.now() - start) / 50;

			expect(average).toBeLessThan(30);
		});

		it("should render a large document with bounded DOM nodes", () => {
			const content = buildVeryLargeMarkdown();

			const { container } = render(createElement(Markdown, { content }));

			const nodeCount = container.querySelectorAll("*").length;

			// Verify all block types rendered
			expect(container.querySelector("h1")).toBeTruthy();
			expect(container.querySelector("pre")).toBeTruthy();
			expect(container.querySelector("ul")).toBeTruthy();
			expect(container.querySelector("table")).toBeTruthy();
			expect(container.querySelector("blockquote")).toBeTruthy();
			expect(container.querySelector("hr")).toBeTruthy();

			// Even a large doc (40 sections) should have bounded DOM
			// ~50 nodes per section is reasonable
			expect(nodeCount).toBeLessThan(2500);
		});
	});

	describe("realistic streaming simulation", () => {
		it("should handle token-by-token streaming with variable chunk sizes", () => {
			// Use a moderate document for realistic streaming test
			const content = buildLargeMarkdown();
			const times = simulateRealisticStreaming(content);

			// No individual parse should exceed 15ms
			const maxTime = Math.max(...times);
			expect(maxTime).toBeLessThan(15);

			// Average should be well under 5ms
			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
			expect(avgTime).toBeLessThan(5);
		});

		it("should maintain consistent performance as content grows", () => {
			const content = buildLargeMarkdown();
			const step = 200;

			const earlyTimes: number[] = [];
			const lateTimes: number[] = [];

			for (let i = step; i <= content.length; i += step) {
				const slice = content.slice(0, i);
				const start = performance.now();
				parseIncremental(slice);
				const elapsed = performance.now() - start;

				if (i < content.length * 0.3) {
					earlyTimes.push(elapsed);
				} else if (i > content.length * 0.7) {
					lateTimes.push(elapsed);
				}
			}

			const earlyAvg =
				earlyTimes.reduce((a, b) => a + b, 0) / earlyTimes.length;
			const lateAvg = lateTimes.reduce((a, b) => a + b, 0) / lateTimes.length;

			// Late parsing should not be more than 10x slower than early parsing
			// (some degradation is expected since we re-parse from the beginning)
			expect(lateAvg).toBeLessThan(earlyAvg * 10);
		});
	});

	describe("mixed content stress test", () => {
		it("should handle alternating block types efficiently", () => {
			// Build content that rapidly alternates between all block types
			const parts: string[] = [];
			for (let i = 0; i < 50; i++) {
				parts.push(`# Heading ${i}\n\n`);
				parts.push(
					`Paragraph with **bold** and *italic* and \`code\` text.\n\n`,
				);
				parts.push(`\`\`\`js\nconsole.log(${i});\n\`\`\`\n\n`);
				parts.push(`- List item ${i}a\n- List item ${i}b\n\n`);
				parts.push(`> Blockquote ${i}\n\n`);
				parts.push(`| H1 | H2 |\n|-----|-----|\n| A${i} | B${i} |\n\n`);
				parts.push(`---\n\n`);
			}
			const content = parts.join("");

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			// 50 iterations × 7 block types = 350 blocks
			expect(result.blocks.length).toBeGreaterThan(300);
			expect(elapsed).toBeLessThan(50);
		});

		it("should render mixed content without DOM bloat", () => {
			const parts: string[] = [];
			for (let i = 0; i < 20; i++) {
				parts.push(`## Section ${i}\n\n`);
				parts.push(`Text with **bold** and [link](https://example.com).\n\n`);
				parts.push(`\`\`\`\ncode block ${i}\n\`\`\`\n\n`);
				parts.push(`- Item ${i}\n\n`);
			}
			const content = parts.join("");

			const { container } = render(createElement(Markdown, { content }));

			const nodeCount = container.querySelectorAll("*").length;
			const blocks = parseIncremental(content, {
				bufferIncomplete: false,
			}).blocks;

			// Nodes per block should be low (no wrapper bloat)
			const nodesPerBlock = nodeCount / blocks.length;
			expect(nodesPerBlock).toBeLessThan(8);
		});
	});

	describe("edge case performance", () => {
		it("should handle empty lines between blocks efficiently", () => {
			// Lots of empty lines between blocks
			const parts: string[] = [];
			for (let i = 0; i < 100; i++) {
				parts.push(`Paragraph ${i}\n\n\n\n\n`);
			}
			const content = parts.join("");

			const start = performance.now();
			parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(20);
		});

		it("should handle content with many autolinks", () => {
			const parts: string[] = [];
			for (let i = 0; i < 100; i++) {
				parts.push(
					`Check https://example.com/page/${i} and https://other.com/resource/${i} for details.\n\n`,
				);
			}
			const content = parts.join("");

			const start = performance.now();
			parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(30);
		});

		it("should handle horizontal rules interspersed with content", () => {
			const parts: string[] = [];
			for (let i = 0; i < 200; i++) {
				parts.push(`Text block ${i}\n\n---\n\n`);
			}
			const content = parts.join("");

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.filter((b) => b.type === "hr").length).toBe(200);
			expect(elapsed).toBeLessThan(30);
		});

		it("should handle a single extremely long paragraph", () => {
			// 50,000 characters in a single paragraph
			const sentence = "The quick **brown** fox *jumps* over the `lazy` dog. ";
			const content = `${sentence.repeat(1000)}\n\n`;

			expect(content.length).toBeGreaterThan(50000);

			const start = performance.now();
			const result = parseIncremental(content);
			const elapsed = performance.now() - start;

			expect(result.blocks.length).toBe(1);
			expect(result.blocks[0].type).toBe("paragraph");
			expect(elapsed).toBeLessThan(50);
		});
	});

	describe("parser correctness at scale", () => {
		it("should produce correct block types for a large mixed document", () => {
			const content = buildVeryLargeMarkdown();
			const result = parseIncremental(content, { bufferIncomplete: false });

			const typeCounts = new Map<string, number>();
			for (const block of result.blocks) {
				typeCounts.set(block.type, (typeCounts.get(block.type) ?? 0) + 1);
			}

			// Should have all major block types present
			expect(typeCounts.get("heading")).toBeGreaterThanOrEqual(10);
			expect(typeCounts.get("paragraph")).toBeGreaterThanOrEqual(10);
			expect(typeCounts.get("code")).toBeGreaterThanOrEqual(5);
			expect(typeCounts.get("list")).toBeGreaterThanOrEqual(5);
			expect(typeCounts.get("table")).toBeGreaterThanOrEqual(5);
			expect(typeCounts.get("blockquote")).toBeGreaterThanOrEqual(5);
			expect(typeCounts.get("hr")).toBeGreaterThanOrEqual(5);
		});

		it("should mark all blocks as complete in a terminated document", () => {
			const content = buildVeryLargeMarkdown();
			const result = parseIncremental(content, { bufferIncomplete: false });

			for (const block of result.blocks) {
				expect(block.complete).toBe(true);
			}
		});

		it("should have zero buffered content for a complete document", () => {
			const content = buildLargeMarkdown();
			const result = parseIncremental(content, { bufferIncomplete: false });

			expect(result.buffered).toBe("");
		});
	});

	describe("Markdown vs StreamingMarkdown performance comparison", () => {
		it("should render identical DOM structure", () => {
			const content = buildLargeMarkdown();

			const streaming = render(
				createElement(StreamingMarkdown, {
					content,
					batchMs: 0,
					bufferIncomplete: false,
				}),
			);

			const staticResult = render(createElement(Markdown, { content }));

			// Same DOM structure
			expect(staticResult.container.innerHTML).toBe(
				streaming.container.innerHTML,
			);

			streaming.unmount();
			staticResult.unmount();
		});

		it("Markdown should have fewer DOM nodes than StreamingMarkdown for streaming content", () => {
			// StreamingMarkdown wraps incomplete blocks in .streaming-markdown-block divs
			const content = "# Title\n\nParagraph text being streamed";

			const streaming = render(
				createElement(StreamingMarkdown, {
					content,
					batchMs: 0,
				}),
			);

			const staticResult = render(createElement(Markdown, { content }));

			const streamingNodes = streaming.container.querySelectorAll("*").length;
			const staticNodes = staticResult.container.querySelectorAll("*").length;

			// Static should have equal or fewer nodes (no streaming wrapper divs)
			expect(staticNodes).toBeLessThanOrEqual(streamingNodes);

			streaming.unmount();
			staticResult.unmount();
		});
	});
});
