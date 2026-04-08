import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { parseInline } from "../../core/inline.js";
import { parseIncremental } from "../../core/parser.js";
import type { Block, ComponentOverrides } from "../../core/types.js";
import { renderInlineTokens } from "./inline.js";

type RenderBlock = (
	block: Block,
	components: Required<ComponentOverrides>,
) => ReactNode;

function needsBlockParse(content: string): boolean {
	if (!content.includes("\n")) return false;
	const lines = content.split("\n");
	return lines.some((line) => {
		const t = line.trimStart();
		return /^```|^~~~|^[-*+]\s|^\d+\.\s|^>\s?|^\|/.test(t);
	});
}

export function renderList(
	block: Block,
	components: Required<ComponentOverrides>,
	renderBlock: RenderBlock,
): ReactNode {
	const parsedItems = parseListItems(block.raw);

	const items = parsedItems.map((item, index) => {
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
			components.li({
				children,
				value: block.listStyle === "ordered" ? item.value : undefined,
			}),
		);
	});

	const ListComponent =
		block.listStyle === "ordered" ? components.ol : components.ul;
	return ListComponent({
		children: items,
		start: block.listStyle === "ordered" ? block.listStart : undefined,
	});
}

function parseListItems(
	raw: string,
): Array<{ content: string; value?: number }> {
	const lines = raw.split("\n");
	const items: Array<{ lines: string[]; value?: number }> = [];
	let currentItem: { lines: string[]; value?: number } | null = null;

	for (const line of lines) {
		const orderedMatch = line.match(/^(\d+)(?:\.(?!\d))?\s+/);
		if (/^[-*+]\s+/.test(line) || orderedMatch) {
			if (currentItem) {
				items.push(currentItem);
			}
			currentItem = {
				lines: [
					line.replace(/^[-*+]\s+/, "").replace(/^\d+(?:\.(?!\d))?\s+/, ""),
				],
				value: orderedMatch ? Number(orderedMatch[1]) : undefined,
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
		.map((item) => ({
			content: normalizeListItemContent(item.lines),
			value: item.value,
		}))
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
