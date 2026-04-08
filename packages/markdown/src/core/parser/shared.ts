import { matchOrderedListMarker } from "../blocks.js";
import type { ParserState } from "../types.js";

export function splitLines(content: string): string[] {
	return content.split("\n");
}

export function isIndentedLine(line: string): boolean {
	return /^\s{2,}/.test(line) || /^\t/.test(line);
}

export function isListItem(
	line: string,
	options?: { allowBareOrdered?: boolean },
): boolean {
	const trimmed = line.trimStart();
	return (
		/^[-*+]\s+/.test(trimmed) ||
		matchOrderedListMarker(trimmed, {
			allowBare: options?.allowBareOrdered,
		}) !== null
	);
}

export function isContinuation(line: string): boolean {
	return /^\s{2,}/.test(line) && line.trim().length > 0;
}

export function isIndentedContinuation(line: string): boolean {
	if (!/^\s{2,}/.test(line)) return false;
	const trimmed = line.trimStart();
	if (/^#{1,6}\s/.test(trimmed)) return false;
	if (/^[-*+]\s+/.test(trimmed)) return false;
	if (matchOrderedListMarker(trimmed) !== null) return false;
	if (/^```|~~~/.test(trimmed)) return false;
	if (/^\|/.test(trimmed)) return false;
	return trimmed.length > 0;
}

export function getListStyle(
	line: string,
	options?: { allowBareOrdered?: boolean },
): "ordered" | "unordered" | null {
	const trimmed = line.trimStart();
	if (/^[-*+]\s+/.test(trimmed)) return "unordered";
	if (
		matchOrderedListMarker(trimmed, {
			allowBare: options?.allowBareOrdered,
		}) !== null
	) {
		return "ordered";
	}
	return null;
}

export function getOrderedListStart(
	line: string,
	options?: { allowBareOrdered?: boolean },
): number | undefined {
	return (
		matchOrderedListMarker(line, {
			allowBare: options?.allowBareOrdered,
		})?.start ?? undefined
	);
}

export function findNextNonEmptyLine(
	lines: string[],
	startIndex: number,
): string | null {
	const index = findNextNonEmptyLineIndex(lines, startIndex);
	return index === null ? null : lines[index];
}

export function findNextNonEmptyLineIndex(
	lines: string[],
	startIndex: number,
): number | null {
	for (let idx = startIndex; idx < lines.length; idx++) {
		if (lines[idx].trim().length > 0) {
			return idx;
		}
	}

	return null;
}

export function isLazyContinuation(line: string): boolean {
	const trimmed = line.trimStart();
	if (/^\s/.test(line)) return false;
	if (/^#{1,6}\s/.test(trimmed)) return false;
	if (/^[-*+]\s+/.test(trimmed)) return false;
	if (matchOrderedListMarker(trimmed) !== null) return false;
	if (/^```|~~~/.test(trimmed)) return false;
	if (/^\|/.test(trimmed)) return false;
	if (/^>\s?/.test(trimmed)) return false;
	if (/^(\*\s*){3,}$/.test(trimmed)) return false;
	if (/^(-\s*){3,}$/.test(trimmed)) return false;
	if (/^(_\s*){3,}$/.test(trimmed)) return false;
	return trimmed.length > 0;
}

export function isPartialBlockMarker(line: string): boolean {
	const trimmed = line.trim();
	if (/^#{1,6}$/.test(trimmed)) return true;
	if (/^[-*+]$/.test(trimmed)) return true;
	if (/^\d$/.test(trimmed) || /^\d+\.$/.test(trimmed)) return true;
	return false;
}

export function isPartialListMarker(line: string): boolean {
	const trimmed = line.trimStart();
	if (/^[-*+]$/.test(trimmed)) return true;
	if (/^\d$/.test(trimmed) || /^\d+\.$/.test(trimmed)) return true;
	return false;
}

export function getBlockTypeForState(
	state: ParserState,
): "heading" | "paragraph" | "code" | "blockquote" | "list" | "table" | "hr" {
	switch (state) {
		case "IN_HEADING":
			return "heading";
		case "IN_CODE_BLOCK":
		case "PENDING_CODE_BLOCK":
			return "code";
		case "IN_BLOCKQUOTE":
			return "blockquote";
		case "IN_LIST":
			return "list";
		case "IN_TABLE":
			return "table";
		default:
			return "paragraph";
	}
}
