import {
	createBlock,
	detectBlockType,
	extractCodeLanguage,
	resetBlockIds,
} from "./blocks.js";
import { findBufferPoint } from "./inline.js";
import type { Block, ParseOptions, ParseResult, ParserState } from "./types.js";

const MAX_BUFFER_SIZE = 200;

/**
 * Parse markdown content incrementally, producing safe-to-render blocks.
 * Designed for streaming AI responses — only the last block is in flux.
 *
 * @param content - The full markdown string received so far
 * @param options - Parser options
 * @returns ParseResult with blocks and buffered content
 */
export function parseIncremental(
	content: string,
	options?: ParseOptions,
): ParseResult {
	const bufferIncomplete = options?.bufferIncomplete ?? true;

	resetBlockIds();

	if (content.length === 0) {
		return { blocks: [], buffered: "" };
	}

	const blocks: Block[] = [];
	const lines = splitLines(content);
	let state: ParserState = "IDLE";
	let currentRaw = "";
	let codeFenceMarker = "";
	let codeLanguage: string | undefined;
	let listStyle: "ordered" | "unordered" | undefined;

	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx];
		const isLastLine = lineIdx === lines.length - 1;
		const nextLine = lineIdx + 1 < lines.length ? lines[lineIdx + 1] : null;
		const isBlankLine = line.trim() === "";

		switch (state) {
			case "IDLE": {
				if (isBlankLine) continue;

				const detected = detectBlockType(line);
				if (!detected) continue;

				switch (detected.type) {
					case "hr": {
						blocks.push(createBlock("hr", line, { complete: true }));
						break;
					}
					case "code": {
						const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
						codeFenceMarker = fenceMatch?.[2]?.[0] ?? "`";
						codeLanguage = extractCodeLanguage(line);
						currentRaw = line;
						state = "PENDING_CODE_BLOCK";
						break;
					}
					case "heading": {
						currentRaw = line;
						if (!isLastLine) {
							// Heading is complete when newline is received
							blocks.push(
								createBlock("heading", currentRaw, {
									complete: true,
									level: detected.level,
								}),
							);
							currentRaw = "";
							state = "IDLE";
						} else {
							state = "IN_HEADING";
						}
						break;
					}
					case "blockquote": {
						currentRaw = line;
						state = "IN_BLOCKQUOTE";
						break;
					}
					case "list": {
						currentRaw = line;
						listStyle = detected.listStyle;
						state = "IN_LIST";
						break;
					}
					case "table": {
						currentRaw = line;
						state = "IN_TABLE";
						break;
					}
					case "paragraph": {
						currentRaw = line;
						state = "IN_PARAGRAPH";
						break;
					}
				}
				break;
			}

			case "IN_HEADING": {
				// Heading completes on any newline (we got a new line, so previous heading is done)
				const headingMatch = currentRaw.match(/^(#{1,6})\s+/);
				const level = (headingMatch?.[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
				blocks.push(
					createBlock("heading", currentRaw, {
						complete: true,
						level,
					}),
				);
				currentRaw = "";
				state = "IDLE";
				// Re-process current line in IDLE state
				lineIdx--;
				break;
			}

			case "IN_PARAGRAPH": {
				if (isBlankLine) {
					// Blank line terminates paragraph
					blocks.push(createBlock("paragraph", currentRaw, { complete: true }));
					currentRaw = "";
					state = "IDLE";
				} else {
					// Check if new line starts a different block type
					const detected = detectBlockType(line);
					if (detected && detected.type !== "paragraph") {
						// End current paragraph, re-process this line
						blocks.push(
							createBlock("paragraph", currentRaw, { complete: true }),
						);
						currentRaw = "";
						state = "IDLE";
						lineIdx--;
					} else {
						// Continue paragraph
						currentRaw += `\n${line}`;
					}
				}
				break;
			}

			case "PENDING_CODE_BLOCK":
			case "IN_CODE_BLOCK": {
				// Check if this line is a closing fence
				const trimmed = line.trim();
				const isClosingFence =
					trimmed.length >= 3 &&
					new RegExp(`^${codeFenceMarker}{3,}\\s*$`).test(trimmed);

				if (
					(isClosingFence && state !== "PENDING_CODE_BLOCK") ||
					(isClosingFence &&
						state === "PENDING_CODE_BLOCK" &&
						currentRaw.includes("\n"))
				) {
					currentRaw += `\n${line}`;
					blocks.push(
						createBlock("code", currentRaw, {
							complete: true,
							language: codeLanguage,
						}),
					);
					currentRaw = "";
					codeFenceMarker = "";
					codeLanguage = undefined;
					state = "IDLE";
				} else {
					if (currentRaw) {
						currentRaw += `\n${line}`;
					} else {
						currentRaw = line;
					}
					state = "IN_CODE_BLOCK";
				}
				break;
			}

			case "IN_BLOCKQUOTE": {
				if (isBlankLine) {
					blocks.push(
						createBlock("blockquote", currentRaw, { complete: true }),
					);
					currentRaw = "";
					state = "IDLE";
				} else if (line.trimStart().startsWith(">")) {
					currentRaw += `\n${line}`;
				} else {
					// Non-blockquote line ends the blockquote
					blocks.push(
						createBlock("blockquote", currentRaw, { complete: true }),
					);
					currentRaw = "";
					state = "IDLE";
					lineIdx--;
				}
				break;
			}

			case "IN_LIST": {
				if (isBlankLine) {
					// Check if the next line continues the list
					if (nextLine && isListItem(nextLine)) {
						currentRaw += `\n${line}`;
					} else {
						blocks.push(
							createBlock("list", currentRaw, {
								complete: true,
								listStyle,
							}),
						);
						currentRaw = "";
						listStyle = undefined;
						state = "IDLE";
					}
				} else if (isListItem(line) || isContinuation(line)) {
					currentRaw += `\n${line}`;
				} else {
					// Non-list line ends the list
					blocks.push(
						createBlock("list", currentRaw, {
							complete: true,
							listStyle,
						}),
					);
					currentRaw = "";
					listStyle = undefined;
					state = "IDLE";
					lineIdx--;
				}
				break;
			}

			case "IN_TABLE": {
				if (isBlankLine) {
					blocks.push(createBlock("table", currentRaw, { complete: true }));
					currentRaw = "";
					state = "IDLE";
				} else if (line.trim().includes("|")) {
					currentRaw += `\n${line}`;
				} else {
					// Non-table line ends the table
					blocks.push(createBlock("table", currentRaw, { complete: true }));
					currentRaw = "";
					state = "IDLE";
					lineIdx--;
				}
				break;
			}
		}
	}

	// Handle remaining content
	let buffered = "";

	if (currentRaw) {
		const isPending =
			state === "PENDING_CODE_BLOCK" || state === "IN_CODE_BLOCK";

		if (isPending) {
			// Code block not yet closed — render as pending skeleton
			blocks.push(
				createBlock("code", currentRaw, {
					complete: false,
					language: codeLanguage,
				}),
			);
		} else if (bufferIncomplete && !isPending) {
			// Check for unclosed inline markers
			const rawForInlineCheck =
				state === "IN_HEADING"
					? currentRaw.replace(/^#{1,6}\s+/, "")
					: currentRaw;
			const bufferPoint = findBufferPoint(rawForInlineCheck);

			if (
				bufferPoint !== -1 &&
				rawForInlineCheck.length - bufferPoint <= MAX_BUFFER_SIZE
			) {
				// Split: safe prefix goes to block, rest is buffered
				const safeContent = rawForInlineCheck.slice(0, bufferPoint);
				buffered = rawForInlineCheck.slice(bufferPoint);

				if (state === "IN_HEADING") {
					const headingMatch = currentRaw.match(/^(#{1,6})\s+/);
					const level = (headingMatch?.[1]?.length ?? 1) as
						| 1
						| 2
						| 3
						| 4
						| 5
						| 6;
					const prefix = headingMatch?.[0] ?? "# ";
					if (safeContent.length > 0) {
						blocks.push(
							createBlock("heading", prefix + safeContent, {
								complete: false,
								level,
							}),
						);
					}
				} else {
					if (safeContent.length > 0) {
						blocks.push(
							createBlock(getBlockTypeForState(state), safeContent, {
								complete: false,
								listStyle,
							}),
						);
					}
				}
			} else {
				// Buffer too large or no buffer point — just render as incomplete
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
			}
		} else {
			// No buffering — render as-is, incomplete
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
		}
	}

	return { blocks, buffered };
}

/** Split content into lines, preserving trailing empty line awareness */
function splitLines(content: string): string[] {
	return content.split("\n");
}

/** Check if a line is a list item */
function isListItem(line: string): boolean {
	const trimmed = line.trimStart();
	return /^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
}

/** Check if a line is a continuation of a list item (indented) */
function isContinuation(line: string): boolean {
	return /^\s{2,}/.test(line) && line.trim().length > 0;
}

/** Map parser state to block type */
function getBlockTypeForState(
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
