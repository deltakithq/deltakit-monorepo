import { createBlock } from "../blocks.js";
import { findBufferPoint } from "../inline.js";
import type { Block, ParseResult, ParserState } from "../types.js";
import { stripTrailingEmptyOrPartialListItem } from "./lists.js";
import { getBlockTypeForState } from "./shared.js";
import {
	hasCommittedTableBodyRow,
	stripTrailingUnterminatedTableLine,
} from "./tables.js";

export interface FinalizeRemainingContentOptions {
	blocks: Block[];
	bufferIncomplete: boolean;
	codeLanguage?: string;
	currentRaw: string;
	listStart?: number;
	listStyle?: "ordered" | "unordered";
	maxBufferSize: number;
	state: ParserState;
}

export function finalizeRemainingContent(
	options: FinalizeRemainingContentOptions,
): ParseResult {
	const {
		blocks,
		bufferIncomplete,
		codeLanguage,
		currentRaw: initialRaw,
		listStart,
		listStyle,
		maxBufferSize,
		state,
	} = options;

	let currentRaw = initialRaw;
	let buffered = "";

	if (!currentRaw) {
		return { blocks, buffered };
	}

	const isPending = state === "PENDING_CODE_BLOCK" || state === "IN_CODE_BLOCK";

	if (isPending) {
		blocks.push(
			createBlock("code", currentRaw, {
				complete: false,
				language: codeLanguage,
			}),
		);
		return { blocks, buffered };
	}

	if (bufferIncomplete) {
		if (state === "IN_HEADING") {
			const headingContent = currentRaw.replace(/^#{1,6}\s*/, "");
			if (headingContent.trim().length === 0) {
				return { blocks, buffered: currentRaw };
			}
		}

		if (state === "IN_LIST") {
			const strippedRaw = stripTrailingEmptyOrPartialListItem(currentRaw);
			if (strippedRaw !== null) {
				if (strippedRaw.safe.length > 0) {
					currentRaw = strippedRaw.safe;
				} else {
					return { blocks, buffered: currentRaw };
				}
			}

			blocks.push(
				createBlock("list", currentRaw, {
					complete: false,
					listStyle,
					listStart,
				}),
			);
			return { blocks, buffered };
		}

		if (state === "IN_TABLE") {
			const originalTableRaw = currentRaw;
			const strippedRaw = stripTrailingUnterminatedTableLine(currentRaw);
			if (strippedRaw !== null) {
				if (strippedRaw.safe.length > 0) {
					currentRaw = strippedRaw.safe;
					buffered = strippedRaw.trailing;
				} else {
					return { blocks, buffered: strippedRaw.trailing };
				}
			}

			if (!hasCommittedTableBodyRow(currentRaw)) {
				return { blocks, buffered: originalTableRaw };
			}

			blocks.push(
				createBlock("table", currentRaw, {
					complete: false,
				}),
			);
			return { blocks, buffered };
		}

		const rawForInlineCheck =
			state === "IN_HEADING"
				? currentRaw.replace(/^#{1,6}\s+/, "")
				: currentRaw;
		const bufferPoint = findBufferPoint(rawForInlineCheck);

		if (
			bufferPoint !== -1 &&
			rawForInlineCheck.length - bufferPoint <= maxBufferSize
		) {
			const safeContent = rawForInlineCheck.slice(0, bufferPoint);
			buffered = rawForInlineCheck.slice(bufferPoint);

			if (state === "IN_HEADING") {
				const headingMatch = currentRaw.match(/^(#{1,6})\s+/);
				const level = (headingMatch?.[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
				const prefix = headingMatch?.[0] ?? "# ";
				if (safeContent.length > 0) {
					blocks.push(
						createBlock("heading", prefix + safeContent, {
							complete: false,
							level,
						}),
					);
				}
			} else if (safeContent.length > 0) {
				blocks.push(
					createBlock(getBlockTypeForState(state), safeContent, {
						complete: false,
						listStyle,
					}),
				);
			}

			return { blocks, buffered };
		}

		blocks.push(
			createBlock(getBlockTypeForState(state), currentRaw, {
				complete: false,
				level:
					state === "IN_HEADING"
						? ((currentRaw.match(/^(#{1,6})/)?.[1]?.length ?? 1) as
								| 1
								| 2
								| 3
								| 4
								| 5
								| 6)
						: undefined,
				listStyle,
			}),
		);
		return { blocks, buffered };
	}

	blocks.push(
		createBlock(getBlockTypeForState(state), currentRaw, {
			complete: false,
			level:
				state === "IN_HEADING"
					? ((currentRaw.match(/^(#{1,6})/)?.[1]?.length ?? 1) as
							| 1
							| 2
							| 3
							| 4
							| 5
							| 6)
					: undefined,
			listStyle,
			listStart,
		}),
	);
	return { blocks, buffered };
}
