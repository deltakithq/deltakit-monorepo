import type { Block, BlockType, HeadingLevel } from "./types.js";

let nextBlockId = 0;

/** Reset the block ID counter (useful for testing) */
export function resetBlockIds(): void {
	nextBlockId = 0;
}

/** Detect what type of block a line starts */
export function detectBlockType(line: string): {
	type: BlockType;
	level?: HeadingLevel;
	language?: string;
	listStyle?: "ordered" | "unordered";
} | null {
	const trimmed = line.trimStart();

	// HR: --- or *** or ___ (3+ chars, optionally with spaces)
	if (
		/^(\*\s*){3,}$/.test(trimmed) ||
		/^(-\s*){3,}$/.test(trimmed) ||
		/^(_\s*){3,}$/.test(trimmed)
	) {
		return { type: "hr" };
	}

	// Code block fence: ``` or ~~~
	if (/^(`{3,}|~{3,})/.test(trimmed)) {
		const match = trimmed.match(/^(`{3,}|~{3,})\s*(.*)/);
		const language = match?.[2]?.trim() || undefined;
		return { type: "code", language };
	}

	// Heading: # through ######
	const headingMatch = trimmed.match(/^(#{1,6})\s+/);
	if (headingMatch) {
		const level = headingMatch[1].length as HeadingLevel;
		return { type: "heading", level };
	}

	// Blockquote: > or >
	if (/^>\s?/.test(trimmed)) {
		return { type: "blockquote" };
	}

	// Unordered list: - , * , +  (followed by space)
	if (/^[-*+]\s+/.test(trimmed)) {
		return { type: "list", listStyle: "unordered" };
	}

	// Ordered list: 1. 2. etc. (but not version numbers like 1.0 or 2.5.1)
	if (/^\d+\.\s+(?![\d.])/.test(trimmed)) {
		return { type: "list", listStyle: "ordered" };
	}

	// Table: starts with |
	if (/^\|/.test(trimmed)) {
		return { type: "table" };
	}

	// Default: paragraph (any non-empty text)
	if (trimmed.length > 0) {
		return { type: "paragraph" };
	}

	return null;
}

/** Create a new block */
export function createBlock(
	type: BlockType,
	raw: string,
	options?: {
		complete?: boolean;
		level?: HeadingLevel;
		language?: string;
		listStyle?: "ordered" | "unordered";
	},
): Block {
	return {
		id: nextBlockId++,
		type,
		raw,
		complete: options?.complete ?? false,
		level: options?.level,
		language: options?.language,
		listStyle: options?.listStyle,
	};
}

/** Extract the content from a heading line (strip the # prefix) */
export function extractHeadingContent(raw: string): string {
	return raw.replace(/^#{1,6}\s+/, "");
}

/** Extract the content from a blockquote (strip > prefix per line) */
export function extractBlockquoteContent(raw: string): string {
	return raw
		.split("\n")
		.map((line) => line.replace(/^>\s?/, ""))
		.join("\n");
}

/** Extract the content from a code block (strip fences and language) */
export function extractCodeContent(raw: string): string {
	const lines = raw.split("\n");
	// Remove opening fence
	const startIdx = lines[0].match(/^(`{3,}|~{3,})/) ? 1 : 0;
	// Remove closing fence if present
	const lastLine = lines[lines.length - 1];
	const endIdx = lastLine.match(/^(`{3,}|~{3,})\s*$/)
		? lines.length - 1
		: lines.length;
	return lines.slice(startIdx, endIdx).join("\n");
}

/** Extract language from a code fence opening (first word only) */
export function extractCodeLanguage(fenceLine: string): string | undefined {
	const trimmed = fenceLine.trimStart();
	// Use RegExp constructor to avoid potential bundling issues with backticks
	const pattern = /^(`{3,}|~{3,})\s*(\S*)/;
	const match = trimmed.match(pattern);
	const lang = match?.[2]?.trim();
	return lang || undefined;
}

/** Check if a line is a table separator row (e.g., |---|---|) */
export function isTableSeparator(line: string): boolean {
	const trimmed = line.trim();
	return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(trimmed);
}

/** Parse a table row into cells */
export function parseTableRow(line: string): string[] {
	const trimmed = line.trim();
	// Remove leading and trailing |
	const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
	return inner.split("|").map((cell) => cell.trim());
}
