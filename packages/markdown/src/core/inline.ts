import type { InlineToken } from "./types.js";

/**
 * Parse inline markdown into tokens.
 * Handles: bold, italic, inline code, strikethrough, links, images, autolinks.
 * Priority order matches the spec (section 5.2).
 */
export function parseInline(input: string): InlineToken[] {
	const tokens: InlineToken[] = [];
	let pos = 0;

	while (pos < input.length) {
		let matched = false;

		// 1. Inline code: `code`
		if (input[pos] === "`") {
			const end = input.indexOf("`", pos + 1);
			if (end !== -1) {
				flushText(tokens, input, pos);
				tokens.push({ type: "code", value: input.slice(pos + 1, end) });
				pos = end + 1;
				matched = true;
			}
		}

		if (!matched && input[pos] === "!" && input[pos + 1] === "[") {
			// 2. Image: ![alt](src)
			const result = parseLinkOrImage(input, pos + 1, true);
			if (result) {
				flushText(tokens, input, pos);
				tokens.push(result.token);
				pos = result.end;
				matched = true;
			}
		}

		if (!matched && input[pos] === "[") {
			// 3. Link: [text](url)
			const result = parseLinkOrImage(input, pos, false);
			if (result) {
				flushText(tokens, input, pos);
				tokens.push(result.token);
				pos = result.end;
				matched = true;
			}
		}

		if (!matched && input[pos] === "~" && input[pos + 1] === "~") {
			// 4. Strikethrough: ~~text~~
			const end = input.indexOf("~~", pos + 2);
			if (end !== -1) {
				flushText(tokens, input, pos);
				const inner = input.slice(pos + 2, end);
				tokens.push({
					type: "del",
					value: inner,
					children: parseInline(inner),
				});
				pos = end + 2;
				matched = true;
			}
		}

		if (
			!matched &&
			((input[pos] === "*" && input[pos + 1] === "*") ||
				(input[pos] === "_" && input[pos + 1] === "_"))
		) {
			// 5. Bold: **text** or __text__
			const marker = input.slice(pos, pos + 2);
			const end = input.indexOf(marker, pos + 2);
			if (end !== -1) {
				flushText(tokens, input, pos);
				const inner = input.slice(pos + 2, end);
				tokens.push({
					type: "strong",
					value: inner,
					children: parseInline(inner),
				});
				pos = end + 2;
				matched = true;
			}
		}

		if (!matched && (input[pos] === "*" || input[pos] === "_")) {
			// 6. Italic: *text* or _text_
			const marker = input[pos];
			const end = findClosingMarker(input, pos + 1, marker);
			if (end !== -1) {
				flushText(tokens, input, pos);
				const inner = input.slice(pos + 1, end);
				tokens.push({
					type: "em",
					value: inner,
					children: parseInline(inner),
				});
				pos = end + 1;
				matched = true;
			}
		}

		if (
			!matched &&
			(input.slice(pos, pos + 8) === "https://" ||
				input.slice(pos, pos + 7) === "http://")
		) {
			// 7. Autolinks: https://... or http://...
			flushText(tokens, input, pos);
			const end = findUrlEnd(input, pos);
			const url = input.slice(pos, end);
			tokens.push({ type: "autolink", value: url, href: url });
			pos = end;
			matched = true;
		}

		if (!matched) {
			// Not a special token — accumulate as text
			appendText(tokens, input[pos]);
			pos++;
		}
	}

	return tokens;
}

/** Append a character to the last text token, or create a new one */
function appendText(tokens: InlineToken[], char: string): void {
	const last = tokens[tokens.length - 1];
	if (last && last.type === "text") {
		last.value += char;
	} else {
		tokens.push({ type: "text", value: char });
	}
}

/** Flush accumulated text - this is a no-op helper for clarity (text is already pushed char by char) */
function flushText(_tokens: InlineToken[], _input: string, _pos: number): void {
	// Text is accumulated char-by-char in the main loop via appendText,
	// so there's nothing to flush here. This function exists as a semantic marker.
}

/** Parse a [text](url) or ![alt](src) construct */
function parseLinkOrImage(
	input: string,
	bracketStart: number,
	isImage: boolean,
): { token: InlineToken; end: number } | null {
	// Find closing ]
	const closeBracket = input.indexOf("]", bracketStart + 1);
	if (closeBracket === -1) return null;

	// Must be followed by (
	if (input[closeBracket + 1] !== "(") return null;

	// Find closing )
	const closeParen = input.indexOf(")", closeBracket + 2);
	if (closeParen === -1) return null;

	const text = input.slice(bracketStart + 1, closeBracket);
	const url = input.slice(closeBracket + 2, closeParen);

	if (isImage) {
		return {
			token: {
				type: "image",
				value: text,
				alt: text,
				href: url,
			},
			end: closeParen + 1,
		};
	}

	return {
		token: {
			type: "link",
			value: text,
			href: url,
			children: parseInline(text),
		},
		end: closeParen + 1,
	};
}

/** Find the closing single marker (* or _), avoiding double markers */
function findClosingMarker(
	input: string,
	start: number,
	marker: string,
): number {
	for (let i = start; i < input.length; i++) {
		if (input[i] === marker) {
			// Make sure it's not a double marker (would be bold, not italic)
			if (input[i + 1] === marker) {
				i++; // Skip the double
				continue;
			}
			return i;
		}
	}
	return -1;
}

/** Find where a URL ends (space, newline, or end of string) */
function findUrlEnd(input: string, start: number): number {
	let i = start;
	while (i < input.length) {
		const ch = input[i];
		if (ch === " " || ch === "\n" || ch === "\t" || ch === ")" || ch === "]") {
			break;
		}
		i++;
	}
	// Strip trailing punctuation that's likely not part of the URL
	while (i > start) {
		const ch = input[i - 1];
		if (ch === "." || ch === "," || ch === ";" || ch === ":" || ch === "!") {
			i--;
		} else {
			break;
		}
	}
	return i;
}

/**
 * Check if a string has unclosed inline markers.
 * Used for buffering incomplete syntax during streaming.
 * Returns the index from which content should be buffered, or -1 if all is safe.
 */
export function findBufferPoint(input: string): number {
	// Try to find the earliest unclosed marker by scanning forward
	// and tracking open/close pairs.

	const markerDefs = [
		{ open: "**", close: "**" },
		{ open: "__", close: "__" },
		{ open: "~~", close: "~~" },
		{ open: "`", close: "`" },
		{ open: "![", close: ")" },
		{ open: "[", close: ")" },
	];

	let earliestUnclosed = -1;

	for (const { open, close } of markerDefs) {
		const unclosedAt = findFirstUnclosed(input, open, close);
		if (unclosedAt !== -1) {
			if (earliestUnclosed === -1 || unclosedAt < earliestUnclosed) {
				earliestUnclosed = unclosedAt;
			}
		}
	}

	// Also check single * and _ (italic), but skip positions that are part of ** or __
	const unclosedStar = findFirstUnclosedSingle(input, "*");
	if (unclosedStar !== -1) {
		if (earliestUnclosed === -1 || unclosedStar < earliestUnclosed) {
			earliestUnclosed = unclosedStar;
		}
	}

	const unclosedUnderscore = findFirstUnclosedSingle(input, "_");
	if (unclosedUnderscore !== -1) {
		if (earliestUnclosed === -1 || unclosedUnderscore < earliestUnclosed) {
			earliestUnclosed = unclosedUnderscore;
		}
	}

	return earliestUnclosed;
}

/** Find the first unclosed opening marker by scanning forward */
function findFirstUnclosed(input: string, open: string, close: string): number {
	let pos = 0;

	while (pos < input.length) {
		const openIdx = input.indexOf(open, pos);
		if (openIdx === -1) return -1;

		// For ** and __, make sure we're not in a position that's already handled
		// Skip if this is a link/image bracket that starts a valid construct
		if (open === "[" && openIdx > 0 && input[openIdx - 1] === "!") {
			pos = openIdx + 1;
			continue;
		}

		// Find matching close after the open
		const afterOpen = openIdx + open.length;
		const closeIdx = input.indexOf(close, afterOpen);

		if (closeIdx === -1) {
			// No close found — this is unclosed
			return openIdx;
		}

		// Found a close — skip past it and continue
		pos = closeIdx + close.length;
	}

	return -1;
}

/** Find the first unclosed single marker (* or _), skipping double markers */
function findFirstUnclosedSingle(input: string, marker: string): number {
	let pos = 0;

	while (pos < input.length) {
		const idx = input.indexOf(marker, pos);
		if (idx === -1) return -1;

		// Skip if it's part of a double marker
		if (input[idx + 1] === marker) {
			// Skip the double marker pair
			const closeDouble = input.indexOf(marker + marker, idx + 2);
			if (closeDouble !== -1) {
				pos = closeDouble + 2;
			} else {
				// Unclosed double marker — but that's handled by findFirstUnclosed
				pos = idx + 2;
			}
			continue;
		}

		// Check if previous char is also the marker (we're at the second char of a double)
		if (idx > 0 && input[idx - 1] === marker) {
			pos = idx + 1;
			continue;
		}

		// This is a single marker — find its close
		const closeIdx = findClosingMarker(input, idx + 1, marker);
		if (closeIdx === -1) {
			return idx;
		}

		pos = closeIdx + 1;
	}

	return -1;
}
