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
 * Sanitize a URL to prevent XSS attacks.
 * Blocks javascript: and data: (non-image) protocols.
 * Allows: http:, https:, mailto:, tel:, and data:image/*
 */
function sanitizeUrl(url: string): string {
	if (!url) return "";

	const trimmed = url.trim().toLowerCase();

	// Block javascript: protocol (case-insensitive)
	if (trimmed.startsWith("javascript:")) {
		return "";
	}

	// Block data: URIs that aren't images
	if (trimmed.startsWith("data:") && !trimmed.startsWith("data:image/")) {
		return "";
	}

	// Block vbscript: protocol
	if (trimmed.startsWith("vbscript:")) {
		return "";
	}

	// Allow all other URLs (including relative URLs, http, https, mailto, tel, etc.)
	return url;
}

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
		return result.blocks.map((block) =>
			createElement(Fragment, { key: block.id }, renderBlock(block, merged)),
		);
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
			return components.hr();
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
	return HeadingComponent({ children: inlineNodes });
}

function renderParagraph(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const inlineNodes = renderInlineTokens(parseInline(block.raw), components);
	return components.p({ children: inlineNodes });
}

function renderCodeBlock(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const content = extractCodeContent(block.raw);
	return components.code({
		language: block.language,
		children: content,
		inline: false,
	});
}

function renderBlockquote(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const content = extractBlockquoteContent(block.raw);
	const inlineNodes = renderInlineTokens(parseInline(content), components);
	return components.blockquote({ children: inlineNodes });
}

/** Check if list item content needs full block-level parsing */
function needsBlockParse(content: string): boolean {
	if (!content.includes("\n")) return false;
	const lines = content.split("\n");
	return lines.some((line) => {
		const t = line.trimStart();
		return /^```|^~~~|^[-*+]\s|^\d+\.\s|^>\s?|^\|/.test(t);
	});
}

function renderList(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const items = parseListItems(block.raw).map((item, index) => {
		if (item.content.trim().length === 0) {
			return null;
		}

		const nestedBlocks = needsBlockParse(item.content)
			? parseIncremental(item.content, {
					bufferIncomplete: false,
					resetIds: false,
				}).blocks
			: [];

		const children =
			nestedBlocks.length > 0
				? nestedBlocks.map((nestedBlock) =>
						createElement(
							Fragment,
							{ key: `li-${index}-block-${nestedBlock.id}` },
							renderBlock(nestedBlock, components),
						),
					)
				: renderInlineTokens(parseInline(item.content), components);

		return createElement(
			Fragment,
			{ key: `li-${index}` },
			components.li({ children }),
		);
	});

	const ListComponent =
		block.listStyle === "ordered" ? components.ol : components.ul;
	return ListComponent({ children: items });
}

function parseListItems(raw: string): Array<{ content: string }> {
	const lines = raw.split("\n");
	const items: Array<{ lines: string[] }> = [];
	let currentItem: { lines: string[] } | null = null;

	for (const line of lines) {
		if (/^(?:[-*+]\s+|\d+\.(?!\d)\s+)/.test(line)) {
			if (currentItem) {
				items.push(currentItem);
			}

			currentItem = {
				lines: [line.replace(/^[-*+]\s+/, "").replace(/^\d+\.(?!\d)\s+/, "")],
			};
			continue;
		}

		if (currentItem) {
			currentItem.lines.push(line);
		}
	}

	if (currentItem) {
		items.push(currentItem);
	}

	return items
		.map((item) => ({ content: normalizeListItemContent(item.lines) }))
		.filter((item) => item.content.trim().length > 0);
}

function normalizeListItemContent(lines: string[]): string {
	if (lines.length <= 1) {
		return lines[0] ?? "";
	}

	const [firstLine, ...continuationLines] = lines;
	const nonEmptyContinuation = continuationLines.filter(
		(line) => line.trim().length > 0,
	);
	const minIndent =
		nonEmptyContinuation.length > 0
			? Math.min(
					...nonEmptyContinuation.map((line) => {
						const match = line.match(/^[ \t]*/);
						return match?.[0].length ?? 0;
					}),
				)
			: 0;

	const normalizedContinuation = continuationLines.map((line) => {
		if (line.trim().length === 0 || minIndent === 0) {
			return line;
		}

		return line.slice(Math.min(minIndent, line.length));
	});

	return [firstLine, ...normalizedContinuation].join("\n");
}

function renderTable(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const allLines = block.raw.split("\n").filter((l) => l.trim().length > 0);
	const lines =
		!block.complete && !block.raw.endsWith("\n") && allLines.length > 2
			? allLines.slice(0, -1)
			: allLines;
	const separatorIndex = lines.findIndex((line) => isTableSeparator(line));

	if (separatorIndex === -1) {
		return components.p({ children: block.raw });
	}

	if (lines.length === 0) {
		return components.table({ children: null });
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

	return components.table({ children: tableChildren });
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
			return createElement(Fragment, { key }, token.value);
		case "strong": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(Fragment, { key }, components.strong({ children }));
		}
		case "em": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(Fragment, { key }, components.em({ children }));
		}
		case "code":
			return createElement(
				Fragment,
				{ key },
				components.code({ children: token.value, inline: true }),
			);
		case "del": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(Fragment, { key }, components.del({ children }));
		}
		case "link": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(
				Fragment,
				{ key },
				components.a({ href: sanitizeUrl(token.href ?? ""), children }),
			);
		}
		case "image": {
			const sanitizedSrc = sanitizeUrl(token.href ?? "");
			// If URL is unsafe, don't render the image at all
			if (!sanitizedSrc) {
				return createElement(Fragment, { key }, "[Image]");
			}
			return createElement(
				Fragment,
				{ key },
				createElement(BufferedImageToken, {
					src: sanitizedSrc,
					alt: token.alt ?? "",
					components,
				}),
			);
		}
		case "autolink": {
			const sanitizedHref = sanitizeUrl(token.href ?? "");
			// If URL is unsafe (e.g., javascript:), render as plain text
			if (!sanitizedHref) {
				return createElement(Fragment, { key }, token.value);
			}
			return createElement(
				Fragment,
				{ key },
				components.a({ href: sanitizedHref, children: token.value }),
			);
		}
		default:
			return createElement(Fragment, { key }, token.value);
	}
}
