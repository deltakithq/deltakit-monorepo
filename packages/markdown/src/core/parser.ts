import {
	createBlock,
	detectBlockType,
	extractCodeLanguage,
	isPipeTableCandidate,
	isPipeTableRow,
	isPotentialTableSeparator,
	isTableSeparator,
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

				if (isPipeTableCandidate(line)) {
					if (nextLine && isTableSeparator(nextLine)) {
						currentRaw = `${line}\n${nextLine}`;
						state = "IN_TABLE";
						lineIdx++;
						break;
					}

					if (bufferIncomplete) {
						if (isLastLine) {
							return { blocks, buffered: line };
						}

						if (
							nextLine &&
							isPotentialTableSeparator(nextLine) &&
							lineIdx + 1 === lines.length - 1
						) {
							return { blocks, buffered: `${line}\n${nextLine}` };
						}
					}
				}

				// When bufferIncomplete is on and this is the last line,
				// check if the line is a partial block marker that hasn't
				// fully formed yet (e.g. "#", "-", "1.", "1").
				// Buffer it to prevent flashing raw characters.
				if (bufferIncomplete && isLastLine && isPartialBlockMarker(line)) {
					return { blocks, buffered: line };
				}

				const detected = detectBlockType(line);
				if (!detected) continue;

				switch (detected.type) {
					case "hr": {
						blocks.push(createBlock("hr", line, { complete: true }));
						break;
					}
					case "code": {
						const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
						codeFenceMarker = fenceMatch?.[2] ?? "```";
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
				// Closing fence must use same character (` or ~) and at least as many as opening
				const trimmed = line.trim();
				const fenceChar = codeFenceMarker[0];
				const fenceLen = codeFenceMarker.length;
				const closingPattern = new RegExp(`^${fenceChar}{${fenceLen},}\\s*$`);
				const isClosingFence = closingPattern.test(trimmed);

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
				} else if (isLazyContinuation(line)) {
					// Lazy continuation: non-indented line continues blockquote paragraph
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
					} else if (nextLine && isContinuation(nextLine)) {
						// Blank line inside a list item before an indented continuation,
						// including fenced code blocks nested under the item.
						currentRaw += `\n${line}`;
					} else if (nextLine && isIndentedContinuation(nextLine)) {
						// Multi-paragraph list item: indented content after blank line
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
				} else if (isListItem(line)) {
					if (isIndentedLine(line)) {
						// Nested list item — keep in current block
						currentRaw += `\n${line}`;
					} else {
						// Root-level: check if list type changed
						const newListStyle = getListStyle(line);
						if (newListStyle && newListStyle !== listStyle) {
							// List type changed - close current list and start new one
							blocks.push(
								createBlock("list", currentRaw, {
									complete: true,
									listStyle,
								}),
							);
							currentRaw = line;
							listStyle = newListStyle;
						} else {
							currentRaw += `\n${line}`;
						}
					}
				} else if (isContinuation(line) || isIndentedContinuation(line)) {
					currentRaw += `\n${line}`;
				} else if (isLastLine && isPartialListMarker(line)) {
					// Partial list marker on last line (e.g. "-", "1.", "1")
					// Keep it attached to the list — it will likely become a full item
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
				} else if (isPipeTableRow(line)) {
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
			// --- Buffer block-level markers that have no content yet ---
			// This prevents empty headings/list bullets from flashing during streaming.

			if (state === "IN_HEADING") {
				const headingContent = currentRaw.replace(/^#{1,6}\s*/, "");
				if (headingContent.trim().length === 0) {
					// Heading marker with no text yet (e.g. "# " or "## ") — buffer entirely
					buffered = currentRaw;
					return { blocks, buffered };
				}
			}

			if (state === "IN_LIST") {
				// Strip trailing partial/empty list markers from the raw content.
				// e.g. "- item 1\n- " → render "- item 1", buffer "- "
				// e.g. "- item 1\n-" → render "- item 1", buffer "-"
				const strippedRaw = stripTrailingEmptyOrPartialListItem(currentRaw);
				if (strippedRaw !== null) {
					if (strippedRaw.safe.length > 0) {
						// Render the list without the trailing empty/partial item
						currentRaw = strippedRaw.safe;
					} else {
						// Only a marker (e.g. just "- " or "-") — buffer entirely
						buffered = currentRaw;
						return { blocks, buffered };
					}
				}
			}

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

/** Check if a line is indented (nested content) */
function isIndentedLine(line: string): boolean {
	return /^\s{2,}/.test(line) || /^\t/.test(line);
}

/** Check if a line is a list item */
function isListItem(line: string): boolean {
	const trimmed = line.trimStart();
	return /^[-*+]\s+/.test(trimmed) || /^\d+\.(?!\d)\s+/.test(trimmed);
}

/** Check if a line is a continuation of a list item (indented) */
function isContinuation(line: string): boolean {
	return /^\s{2,}/.test(line) && line.trim().length > 0;
}

/**
 * Check if a line is an indented continuation (for multi-paragraph list items).
 * These are lines that are indented but don't start a new block.
 */
function isIndentedContinuation(line: string): boolean {
	// Must be indented (at least 2 spaces)
	if (!/^\s{2,}/.test(line)) return false;
	const trimmed = line.trimStart();
	// Doesn't start a new block
	if (/^#{1,6}\s/.test(trimmed)) return false; // heading
	if (/^[-*+]\s+/.test(trimmed)) return false; // unordered list
	if (/^\d+\.(?!\d)\s+/.test(trimmed)) return false; // ordered list
	if (/^```|~~~/.test(trimmed)) return false; // code fence
	if (/^\|/.test(trimmed)) return false; // table
	// Non-empty line
	return trimmed.length > 0;
}

/**
 * Get the list style (ordered or unordered) of a list item line.
 */
function getListStyle(line: string): "ordered" | "unordered" | null {
	const trimmed = line.trimStart();
	if (/^[-*+]\s+/.test(trimmed)) return "unordered";
	if (/^\d+\.(?!\d)\s+/.test(trimmed)) return "ordered";
	return null;
}

/**
 * Check if a line is a lazy continuation of a blockquote.
 * In lazy continuation, a line without > can continue a blockquote paragraph
 * if it's not indented and doesn't start a new block.
 */
function isLazyContinuation(line: string): boolean {
	const trimmed = line.trimStart();
	// Not indented (no leading whitespace)
	if (/^\s/.test(line)) return false;
	// Doesn't start a new block
	if (/^#{1,6}\s/.test(trimmed)) return false; // heading
	if (/^[-*+]\s+/.test(trimmed)) return false; // unordered list
	if (/^\d+\.(?!\d)\s+/.test(trimmed)) return false; // ordered list
	if (/^```|~~~/.test(trimmed)) return false; // code fence
	if (/^\|/.test(trimmed)) return false; // table
	if (/^>\s?/.test(trimmed)) return false; // nested blockquote
	// Not a horizontal rule
	if (/^(\*\s*){3,}$/.test(trimmed)) return false;
	if (/^(-\s*){3,}$/.test(trimmed)) return false;
	if (/^(_\s*){3,}$/.test(trimmed)) return false;
	// Non-empty line that continues the paragraph
	return trimmed.length > 0;
}

/**
 * Check if a line could be a partial block-level marker that hasn't
 * fully formed yet. These would flash as raw text if rendered.
 *
 * Matches:
 *   "#", "##", "###" etc. (heading without space/content)
 *   "-", "*", "+" (list marker without space)
 *   "1", "1.", "12", "12." etc. (ordered list partial)
 *   "> " (blockquote marker-only, no content)
 */
function isPartialBlockMarker(line: string): boolean {
	const trimmed = line.trim();
	// Partial heading: just hashes, no space+content yet
	if (/^#{1,6}$/.test(trimmed)) return true;
	// Partial unordered list: just the marker char, no space
	if (/^[-*+]$/.test(trimmed)) return true;
	// Partial ordered list: digits, or digits+dot, no space
	if (/^\d+\.?$/.test(trimmed)) return true;
	return false;
}

/**
 * Check if a line could be a partial list marker (not yet a full item).
 * Used inside IN_LIST state to keep partial markers attached to the list
 * instead of breaking them out as paragraphs.
 *
 * Matches: "-", "*", "+", "1", "1.", "12." etc.
 */
function isPartialListMarker(line: string): boolean {
	const trimmed = line.trimStart();
	if (/^[-*+]$/.test(trimmed)) return true;
	if (/^\d+\.?$/.test(trimmed)) return true;
	return false;
}

/**
 * Check if the last line of a list block is an empty or partial list item marker.
 * Empty: "- " or "1. " (marker with space but no content)
 * Partial: "-" or "1." or "1" (marker not yet fully formed)
 *
 * If so, return the safe prefix (without the trailing marker) and the trailing part.
 * Returns null if the last item has content.
 */
function stripTrailingEmptyOrPartialListItem(
	raw: string,
): { safe: string; trailing: string } | null {
	const lines = raw.split("\n");
	const lastLine = lines[lines.length - 1];
	if (!lastLine) return null;

	// Check if last line is a list marker with no content after it (e.g. "- " or "1. ")
	const emptyMarkerMatch = lastLine.match(/^(\s*[-*+]\s+)$|^(\s*\d+\.\s+)$/);
	// Check if last line is a partial marker (e.g. "-", "1.", "1")
	const partialMarker = isPartialListMarker(lastLine);

	if (!emptyMarkerMatch && !partialMarker) return null;

	// Last line is marker-only or partial — strip it
	const safeLines = lines.slice(0, -1);
	return {
		safe: safeLines.join("\n"),
		trailing: lastLine,
	};
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
