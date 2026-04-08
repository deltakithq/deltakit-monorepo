import type { InlineToken } from "../types.js";

export function appendText(tokens: InlineToken[], char: string): void {
	const last = tokens[tokens.length - 1];
	if (last && last.type === "text") {
		last.value += char;
	} else {
		tokens.push({ type: "text", value: char });
	}
}

export function flushText(
	_tokens: InlineToken[],
	_input: string,
	_pos: number,
): void {
	// Text is accumulated char-by-char in the main loop via appendText,
	// so there's nothing to flush here. This function exists as a semantic marker.
}

export function findClosingMarker(
	input: string,
	start: number,
	marker: string,
): number {
	for (let i = start; i < input.length; i++) {
		if (input[i] === marker) {
			if (input[i + 1] === marker) {
				i++;
				continue;
			}
			return i;
		}
	}
	return -1;
}

export function findUrlEnd(input: string, start: number): number {
	let i = start;
	while (i < input.length) {
		const ch = input[i];
		if (ch === " " || ch === "\n" || ch === "\t" || ch === ")" || ch === "]") {
			break;
		}
		i++;
	}

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
