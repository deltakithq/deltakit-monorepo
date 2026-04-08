import type { ReactNode } from "react";
import {
	extractBlockquoteContent,
	extractCodeContent,
	extractHeadingContent,
} from "../../core/blocks.js";
import { parseInline } from "../../core/inline.js";
import type { Block, ComponentOverrides } from "../../core/types.js";
import { renderInlineTokens } from "./inline.js";
import { renderList } from "./lists.js";
import { renderTable } from "./tables.js";

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
			return renderList(block, components, renderBlock);
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
