import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "../src/component.js";
import { parseIncremental } from "../src/core/parser.js";

function renderMarkdown(content: string) {
	return render(createElement(StreamingMarkdown, { content, batchMs: 0 }));
}

describe("nested ordered list rendering", () => {
	it("checks parser output for nested blockquotes and lists", () => {
		const content = `> **Nested blockquotes** are also possible:
>
> > This is a nested blockquote inside another blockquote.
> > It goes one level deeper.
>
> > > And this goes even deeper — three levels of nesting.

> Blockquotes can contain other elements:
>
> - A list item inside a blockquote
> - Another list item
>
> And even \`inline code\` or **bold text** within the quote.

## Ordered Lists

1. First step: Install dependencies
2. Second step: Configure the environment

Nested ordered lists:

1. Planning Phase
   1. Gather requirements
   2. Define scope
   3. Create timeline
2. Development Phase
   1. Set up project structure

Mixed nested lists:

1. Project Setup
   - Install Node.js
   - Clone the repository
2. Configuration
   - Create \`.env\` file

## Tables

| Name | Type |
|------|------|
| id | string |
| role | enum |

`;
		const result = parseIncremental(content, { bufferIncomplete: false });
		for (const b of result.blocks) {
			console.log(
				`[${b.id}] ${b.type} (${b.complete ? "complete" : "incomplete"}) listStyle=${b.listStyle}`,
			);
			console.log(`  raw: ${JSON.stringify(b.raw).slice(0, 120)}`);
		}
		console.log("buffered:", JSON.stringify(result.buffered));

		const { container } = renderMarkdown(content);

		// Check nested ordered lists
		const allOl = container.querySelectorAll("ol");
		const allUl = container.querySelectorAll("ul");
		const allLi = container.querySelectorAll("li");
		const allTable = container.querySelectorAll("table");

		console.log("\n=== DOM counts ===");
		console.log("ol:", allOl.length);
		console.log("ul:", allUl.length);
		console.log("li:", allLi.length);
		console.log("table:", allTable.length);

		// Print all li text content
		console.log("\n=== All LI items ===");
		allLi.forEach((li, i) => {
			console.log(`  li[${i}]:`, li.textContent?.slice(0, 60));
		});

		// Check table structure
		console.log("\n=== Table HTML ===");
		allTable.forEach((t, i) => {
			console.log(`  table[${i}]:`, t.innerHTML.slice(0, 200));
		});

		// Assertions
		expect(container.innerHTML).toContain("Planning Phase");
		expect(container.innerHTML).toContain("Gather requirements");
		expect(container.innerHTML).toContain("Development Phase");
		expect(container.innerHTML).toContain("Project Setup");
		expect(container.innerHTML).toContain("Install Node.js");
		expect(container.innerHTML).toContain("Configuration");
		expect(allTable.length).toBeGreaterThan(0);
	});
});
