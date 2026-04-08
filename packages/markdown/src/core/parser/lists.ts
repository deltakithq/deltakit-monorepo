import type { detectBlockType } from "../blocks.js";
import type { Block } from "../types.js";
import {
	findNextNonEmptyLine,
	getOrderedListStart,
	isListItem,
	isPartialListMarker,
} from "./shared.js";

export function getRelaxedOrderedListDetection(
	lines: string[],
	lineIdx: number,
	blocks: Block[],
	relaxedOrderedListMarkers: boolean,
): ReturnType<typeof detectBlockType> {
	if (!relaxedOrderedListMarkers) {
		return null;
	}

	if (!shouldTreatAsBareOrderedListItem(lines, lineIdx, blocks, false)) {
		return null;
	}

	const listStart = getOrderedListStart(lines[lineIdx], {
		allowBareOrdered: true,
	});
	if (listStart === undefined) {
		return null;
	}

	return {
		type: "list",
		listStyle: "ordered",
		listStart,
	};
}

export function shouldTreatAsBareOrderedListItem(
	lines: string[],
	lineIdx: number,
	blocks: Block[],
	inOrderedList: boolean,
): boolean {
	const line = lines[lineIdx];
	if (!looksLikeBareOrderedListItem(line)) {
		return false;
	}

	if (inOrderedList) {
		return true;
	}

	const previousBlock = blocks[blocks.length - 1];
	if (previousBlock?.type === "list" && previousBlock.listStyle === "ordered") {
		return true;
	}

	const nextNonEmptyLine = findNextNonEmptyLine(lines, lineIdx + 1);
	return (
		nextNonEmptyLine !== null &&
		isListItem(nextNonEmptyLine, { allowBareOrdered: true })
	);
}

export function stripTrailingEmptyOrPartialListItem(
	raw: string,
): { safe: string; trailing: string } | null {
	const lines = raw.split("\n");
	const lastLine = lines[lines.length - 1];
	if (!lastLine) return null;

	const emptyMarkerMatch = lastLine.match(/^(\s*[-*+]\s+)$|^(\s*\d+\.\s+)$/);
	const partialMarker = isPartialListMarker(lastLine);

	if (!emptyMarkerMatch && !partialMarker) return null;

	const safeLines = lines.slice(0, -1);
	return {
		safe: safeLines.join("\n"),
		trailing: lastLine,
	};
}

function looksLikeBareOrderedListItem(line: string): boolean {
	if (getOrderedListStart(line) !== undefined) {
		return false;
	}

	const match = line.trimStart().match(/^(\d+)\s+(.+)$/);
	if (!match) {
		return false;
	}

	const content = match[2];
	return (
		content.startsWith("`") ||
		content.startsWith("[") ||
		content.startsWith("(") ||
		content.startsWith("http://") ||
		content.startsWith("https://") ||
		content.includes(" - ")
	);
}
