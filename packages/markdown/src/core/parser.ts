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
import {
	finalizeRemainingContent,
	findNextNonEmptyLine,
	findNextNonEmptyLineIndex,
	getListStyle,
	getRelaxedOrderedListDetection,
	hasCommittedTableBodyRow,
	isContinuation,
	isIndentedContinuation,
	isIndentedLine,
	isLazyContinuation,
	isListItem,
	isPartialBlockMarker,
	isPartialListMarker,
	shouldTreatAsBareOrderedListItem,
	splitLines,
} from "./parser/index.js";
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
	const relaxedOrderedListMarkers = options?.relaxedOrderedListMarkers ?? false;

	if (options?.resetIds !== false) {
		resetBlockIds();
	}

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
	let listStart: number | undefined;

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
							nextLine !== null &&
							nextLine.trim() === "" &&
							lineIdx + 1 === lines.length - 1
						) {
							return { blocks, buffered: `${line}\n` };
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

				const detected =
					getRelaxedOrderedListDetection(
						lines,
						lineIdx,
						blocks,
						relaxedOrderedListMarkers,
					) ?? detectBlockType(line);
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
						listStart = detected.listStart;
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
					if (isPipeTableCandidate(line)) {
						// A pipe-table header can begin while we're still in paragraph
						// state due to streaming chunk boundaries. End the paragraph and
						// re-process this line in IDLE so table buffering/detection runs.
						blocks.push(
							createBlock("paragraph", currentRaw, { complete: true }),
						);
						currentRaw = "";
						state = "IDLE";
						lineIdx--;
						break;
					}

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
				const allowBareOrdered = shouldTreatAsBareOrderedListItem(
					lines,
					lineIdx,
					blocks,
					listStyle === "ordered" && relaxedOrderedListMarkers,
				);

				if (isBlankLine) {
					const nextNonEmptyLine = findNextNonEmptyLine(lines, lineIdx + 1);

					// Check if the next line continues the list
					if (
						nextNonEmptyLine &&
						isListItem(nextNonEmptyLine, {
							allowBareOrdered:
								relaxedOrderedListMarkers &&
								shouldTreatAsBareOrderedListItem(
									lines,
									findNextNonEmptyLineIndex(lines, lineIdx + 1) ?? lineIdx + 1,
									blocks,
									listStyle === "ordered",
								),
						})
					) {
						currentRaw += `\n${line}`;
					} else if (nextNonEmptyLine && isContinuation(nextNonEmptyLine)) {
						// Blank line inside a list item before an indented continuation,
						// including fenced code blocks nested under the item.
						currentRaw += `\n${line}`;
					} else if (
						nextNonEmptyLine &&
						isIndentedContinuation(nextNonEmptyLine)
					) {
						// Multi-paragraph list item: indented content after blank line
						currentRaw += `\n${line}`;
					} else {
						blocks.push(
							createBlock("list", currentRaw, {
								complete: true,
								listStyle,
								listStart,
							}),
						);
						currentRaw = "";
						listStyle = undefined;
						listStart = undefined;
						state = "IDLE";
					}
				} else if (
					isListItem(line, {
						allowBareOrdered: relaxedOrderedListMarkers && allowBareOrdered,
					})
				) {
					if (isIndentedLine(line)) {
						// Nested list item — keep in current block
						currentRaw += `\n${line}`;
					} else {
						// Root-level: check if list type changed
						const newListStyle = getListStyle(line, {
							allowBareOrdered: relaxedOrderedListMarkers && allowBareOrdered,
						});
						if (newListStyle && newListStyle !== listStyle) {
							// Style changed without a blank line (e.g. "1. Topic\n- detail").
							// Indent the line so it becomes a nested sub-item of
							// the previous item rather than splitting into two blocks.
							currentRaw += `\n  ${line}`;
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
							listStart,
						}),
					);
					currentRaw = "";
					listStyle = undefined;
					listStart = undefined;
					state = "IDLE";
					lineIdx--;
				}
				break;
			}

			case "IN_TABLE": {
				if (isBlankLine) {
					if (isLastLine && !hasCommittedTableBodyRow(currentRaw)) {
						// Preserve a trailing newline after the separator/header-only
						// state so end-of-input buffering can keep the whole table hidden
						// until the first body row is complete.
						currentRaw += "\n";
					} else {
						blocks.push(createBlock("table", currentRaw, { complete: true }));
						currentRaw = "";
						state = "IDLE";
					}
				} else if (isPipeTableRow(line)) {
					currentRaw += `\n${line}`;
				} else if (isLastLine && isPipeTableCandidate(line)) {
					// Keep a partial trailing table line attached to the table so the
					// end-of-input buffering logic can decide when it is safe to render.
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

	return finalizeRemainingContent({
		blocks,
		bufferIncomplete,
		codeLanguage,
		currentRaw,
		listStart,
		listStyle,
		maxBufferSize: MAX_BUFFER_SIZE,
		state,
	});
}
