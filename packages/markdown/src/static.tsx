import type { ReactNode } from "react";
import { createElement, Fragment, useMemo } from "react";
import { parseIncremental } from "./core/parser.js";
import type { MarkdownProps } from "./core/types.js";
import { renderBlock } from "./hook.js";
import { mergeComponents } from "./renderers/defaults.js";

/**
 * `<Markdown />` — Lightweight React component for rendering complete markdown.
 *
 * Designed for historical/complete messages where streaming features
 * (batching, debouncing, opacity transitions) are unnecessary overhead.
 *
 * @example
 * ```tsx
 * <Markdown
 *   content={completedMessage}
 *   components={{ code: MyCodeHighlighter }}
 * />
 * ```
 */
export function Markdown({
	content,
	components,
	className,
}: MarkdownProps): ReactNode {
	const merged = useMemo(() => mergeComponents(components), [components]);

	const parsed = useMemo(
		() => parseIncremental(content, { bufferIncomplete: false }),
		[content],
	);

	return createElement(
		"div",
		{ className },
		parsed.blocks.map((block) =>
			createElement(Fragment, { key: block.id }, renderBlock(block, merged)),
		),
	);
}
