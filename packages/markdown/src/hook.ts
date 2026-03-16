import type { ReactNode } from "react";
import {
	createElement,
	Fragment,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	extractBlockquoteContent,
	extractCodeContent,
	extractHeadingContent,
	isTableSeparator,
	parseTableRow,
} from "./core/blocks.js";
import { parseInline } from "./core/inline.js";
import { parseIncremental } from "./core/parser.js";
import type {
	Block,
	ComponentOverrides,
	InlineToken,
	StreamingMarkdownOptions,
	UseStreamingMarkdownReturn,
} from "./core/types.js";
import { mergeComponents } from "./renderers/defaults.js";

/**
 * Hook for headless streaming markdown usage.
 * Returns parsed React nodes and streaming status.
 */
export function useStreamingMarkdown(
	options: StreamingMarkdownOptions & { components?: ComponentOverrides },
): UseStreamingMarkdownReturn {
	const {
		content,
		batchMs = 16,
		bufferIncomplete = true,
		components,
	} = options;
	const [renderContent, setRenderContent] = useState(content);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prevContentRef = useRef(content);

	// Debounce content updates for batching
	useEffect(() => {
		if (batchMs === 0) {
			setRenderContent(content);
			return;
		}

		// If content changed, schedule a batched update
		if (content !== prevContentRef.current) {
			prevContentRef.current = content;

			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}

			timerRef.current = setTimeout(() => {
				setRenderContent(content);
				timerRef.current = null;
			}, batchMs);
		}

		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}
		};
	}, [content, batchMs]);

	const merged = useMemo(() => mergeComponents(components), [components]);

	const result = useMemo(() => {
		const parsed = parseIncremental(renderContent, { bufferIncomplete });
		return parsed;
	}, [renderContent, bufferIncomplete]);

	const nodes = useMemo(() => {
		return result.blocks.map((block) => renderBlock(block, merged));
	}, [result.blocks, merged]);

	// Consider streaming complete when content hasn't changed and no buffer
	const isComplete = result.buffered.length === 0 && content === renderContent;

	return { nodes, isComplete };
}

/** Render a single block into a React node */
export function renderBlock(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	switch (block.type) {
		case "heading":
			return renderHeading(block, components);
		case "paragraph":
			return renderParagraph(block, components);
		case "code":
			return renderCodeBlock(block, components);
		case "blockquote":
			return renderBlockquote(block, components);
		case "list":
			return renderList(block, components);
		case "table":
			return renderTable(block, components);
		case "hr":
			return createElement("div", { key: block.id }, components.hr());
		default:
			return renderParagraph(block, components);
	}
}

function renderHeading(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const content = extractHeadingContent(block.raw);
	const inlineNodes = renderInlineTokens(parseInline(content), components);
	const level = block.level ?? 1;
	const HeadingComponent = components[
		`h${level}` as keyof ComponentOverrides
	] as (props: { children: ReactNode }) => ReactNode;
	return createElement(
		"div",
		{ key: block.id },
		HeadingComponent({ children: inlineNodes }),
	);
}

function renderParagraph(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const inlineNodes = renderInlineTokens(parseInline(block.raw), components);
	return createElement(
		"div",
		{ key: block.id },
		components.p({ children: inlineNodes }),
	);
}

function renderCodeBlock(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	if (!block.complete) {
		// Pending code block — render empty skeleton
		return createElement(
			"div",
			{ key: block.id },
			components.code({
				language: block.language,
				children: "",
				inline: false,
			}),
		);
	}

	const content = extractCodeContent(block.raw);
	return createElement(
		"div",
		{ key: block.id },
		components.code({
			language: block.language,
			children: content,
			inline: false,
		}),
	);
}

function renderBlockquote(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const content = extractBlockquoteContent(block.raw);
	const inlineNodes = renderInlineTokens(parseInline(content), components);
	return createElement(
		"div",
		{ key: block.id },
		components.blockquote({ children: inlineNodes }),
	);
}

function renderList(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const lines = block.raw.split("\n").filter((l) => l.trim().length > 0);
	const items: ReactNode[] = [];

	for (const line of lines) {
		const content = line
			.replace(/^\s*[-*+]\s+/, "")
			.replace(/^\s*\d+\.\s+(?![\d.])/, "");
		// Skip empty list items during streaming to prevent choppy bullets
		if (content.trim().length === 0) continue;
		const inlineNodes = renderInlineTokens(parseInline(content), components);
		items.push(
			createElement(
				Fragment,
				{ key: `li-${items.length}` },
				components.li({ children: inlineNodes }),
			),
		);
	}

	const ListComponent =
		block.listStyle === "ordered" ? components.ol : components.ul;
	return createElement(
		"div",
		{ key: block.id },
		ListComponent({ children: items }),
	);
}

function renderTable(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const lines = block.raw.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length === 0) {
		return createElement(
			"div",
			{ key: block.id },
			components.table({ children: null }),
		);
	}

	const rows: ReactNode[] = [];
	let headerDone = false;
	let rowIdx = 0;

	for (const line of lines) {
		if (isTableSeparator(line)) {
			headerDone = true;
			continue;
		}

		const cells = parseTableRow(line);
		const isHeader = !headerDone;

		const cellNodes = cells.map((cell, cellIdx) => {
			const inlineNodes = renderInlineTokens(parseInline(cell), components);
			const CellComponent = isHeader ? components.th : components.td;
			return createElement(
				Fragment,
				{ key: `cell-${cellIdx}` },
				CellComponent({ children: inlineNodes }),
			);
		});

		rows.push(
			createElement(
				Fragment,
				{ key: `row-${rowIdx}` },
				components.tr({ children: cellNodes }),
			),
		);

		if (isHeader) {
			// Wrap header rows in thead
			const thead = createElement(
				Fragment,
				{ key: "thead" },
				components.thead({ children: rows.splice(0) }),
			);
			rows.push(thead);
		}

		rowIdx++;
	}

	// Remaining rows go in tbody
	const headerRows = rows.filter((_, i) => i === 0);
	const bodyRows = rows.filter((_, i) => i > 0);

	const tableChildren: ReactNode[] = [...headerRows];
	if (bodyRows.length > 0) {
		tableChildren.push(
			createElement(
				Fragment,
				{ key: "tbody" },
				components.tbody({ children: bodyRows }),
			),
		);
	}

	return createElement(
		"div",
		{ key: block.id },
		components.table({ children: tableChildren }),
	);
}

type ImageLoadState = "loading" | "ready" | "error";

const imageLoadCache = new Map<string, ImageLoadState>();
const imageLoadPromises = new Map<string, Promise<ImageLoadState>>();

function getInitialImageState(src: string): ImageLoadState {
	if (!src) return "error";
	return imageLoadCache.get(src) ?? "loading";
}

function preloadImage(src: string): Promise<ImageLoadState> {
	if (!src) return Promise.resolve("error");

	const cached = imageLoadCache.get(src);
	if (cached === "ready" || cached === "error") {
		return Promise.resolve(cached);
	}

	const inFlight = imageLoadPromises.get(src);
	if (inFlight) {
		return inFlight;
	}

	const promise = new Promise<ImageLoadState>((resolve) => {
		if (typeof Image === "undefined") {
			imageLoadCache.set(src, "ready");
			imageLoadPromises.delete(src);
			resolve("ready");
			return;
		}

		const img = new Image();
		img.onload = () => {
			imageLoadCache.set(src, "ready");
			imageLoadPromises.delete(src);
			resolve("ready");
		};
		img.onerror = () => {
			imageLoadCache.set(src, "error");
			imageLoadPromises.delete(src);
			resolve("error");
		};
		img.src = src;
	});

	imageLoadPromises.set(src, promise);
	return promise;
}

function BufferedImageToken({
	src,
	alt,
	components,
}: {
	src: string;
	alt: string;
	components: Required<ComponentOverrides>;
}): ReactNode {
	const [state, setState] = useState<ImageLoadState>(() =>
		getInitialImageState(src),
	);

	useEffect(() => {
		const initial = getInitialImageState(src);
		setState(initial);

		if (initial !== "loading") {
			return;
		}

		let cancelled = false;
		preloadImage(src).then((result) => {
			if (!cancelled) {
				setState(result);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [src]);

	if (state === "ready") {
		return components.img({ src, alt });
	}

	if (state === "error") {
		const fallbackText = alt
			? `Image unavailable: ${alt}`
			: "Image unavailable";
		return createElement(
			"span",
			{
				className: "streaming-markdown-image-fallback",
				role: "img",
				"aria-label": alt || "image unavailable",
			},
			fallbackText,
		);
	}

	return createElement("span", {
		className: "streaming-markdown-image-skeleton",
		"aria-hidden": "true",
	});
}

/** Convert inline tokens to React nodes */

function renderInlineTokens(
	tokens: InlineToken[],
	components: Required<ComponentOverrides>,
): ReactNode {
	if (tokens.length === 0) return null;
	if (tokens.length === 1 && tokens[0].type === "text") return tokens[0].value;

	return tokens.map((token, idx) => renderInlineToken(token, idx, components));
}

function renderInlineToken(
	token: InlineToken,
	key: number,
	components: Required<ComponentOverrides>,
): ReactNode {
	switch (token.type) {
		case "text":
			return createElement("span", { key }, token.value);
		case "strong": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement("span", { key }, components.strong({ children }));
		}
		case "em": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement("span", { key }, components.em({ children }));
		}
		case "code":
			return createElement(
				"span",
				{ key },
				components.code({ children: token.value, inline: true }),
			);
		case "del": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement("span", { key }, components.del({ children }));
		}
		case "link": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(
				"span",
				{ key },
				components.a({ href: token.href ?? "", children }),
			);
		}
		case "image":
			return createElement(
				"span",
				{ key },
				createElement(BufferedImageToken, {
					src: token.href ?? "",
					alt: token.alt ?? "",
					components,
				}),
			);
		case "autolink":
			return createElement(
				"span",
				{ key },
				components.a({ href: token.href ?? "", children: token.value }),
			);
		default:
			return createElement("span", { key }, token.value);
	}
}
