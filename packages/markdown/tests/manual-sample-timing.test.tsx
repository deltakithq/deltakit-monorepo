import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import Prism from "prismjs";
import { createElement, Fragment, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import "prismjs/components/prism-bash.js";
import { extractCodeContent } from "../src/core/blocks.js";
import { parseIncremental } from "../src/core/parser.js";
import { renderBlock } from "../src/react/hook.js";
import { Markdown } from "../src/react/static.js";
import { mergeComponents } from "../src/renderers/defaults.js";

const SAMPLE_PATH =
	"/Users/indrazm/Downloads/create-debian-service-user-with-home-directory-no-password.md";

function getHighlightKey(language: string | undefined, source: string): string {
	return `${language ?? ""}\u0000${source}`;
}

function highlightCode(source: string, language?: string): string {
	const grammar = language ? Prism.languages[language] : undefined;
	return grammar
		? Prism.highlight(source, grammar, language)
		: Prism.util.encode(source);
}

function createPrismCodeBlock(highlightedByKey?: Map<string, string>) {
	return function PrismCodeBlock({
		language,
		children,
		inline,
	}: {
		language?: string;
		children: ReactNode;
		inline?: boolean;
	}) {
		if (inline) {
			return createElement("code", null, children);
		}

		const source =
			typeof children === "string" ? children : String(children ?? "");
		const highlighted =
			highlightedByKey?.get(getHighlightKey(language, source)) ??
			highlightCode(source, language);

		return createElement(
			"pre",
			null,
			createElement("code", {
				className: language ? `language-${language}` : undefined,
				dangerouslySetInnerHTML: { __html: highlighted },
			}),
		);
	};
}

describe("manual sample timing", () => {
	it("renders the exported markdown sample with split timings", () => {
		const content = readFileSync(SAMPLE_PATH, "utf8");
		const prismCodeBlock = createPrismCodeBlock();

		console.time("parseIncremental only");
		const parsed = parseIncremental(content, { bufferIncomplete: false });
		console.timeEnd("parseIncremental only");

		const codeBlocks = parsed.blocks.filter((block) => block.type === "code");
		const highlightedByKey = new Map<string, string>();

		console.time("Prism highlight only");
		for (const block of codeBlocks) {
			const source = extractCodeContent(block.raw);
			highlightedByKey.set(
				getHighlightKey(block.language, source),
				highlightCode(source, block.language),
			);
		}
		console.timeEnd("Prism highlight only");

		const preParsedComponents = mergeComponents({
			code: createPrismCodeBlock(highlightedByKey),
		});

		console.time("React render from pre-parsed blocks");
		const preParsedResult = render(
			createElement(
				"div",
				null,
				parsed.blocks.map((block) =>
					createElement(
						Fragment,
						{ key: block.id },
						renderBlock(block, preParsedComponents),
					),
				),
			),
		);
		console.timeEnd("React render from pre-parsed blocks");
		preParsedResult.unmount();

		console.time("Markdown render with Prism");
		const result = render(
			createElement(Markdown, {
				content,
				components: {
					code: prismCodeBlock,
				},
			}),
		);
		console.timeEnd("Markdown render with Prism");

		expect(result.container.textContent).toContain(
			"Create Debian Service User with Home Directory, No Password",
		);
		expect(result.container.querySelector("h1")).toBeTruthy();
		expect(result.container.querySelector("pre")).toBeTruthy();
		expect(
			result.container.querySelector("code.language-bash .token"),
		).toBeTruthy();
		expect(result.container.querySelector("table")).toBeTruthy();
	});
});
