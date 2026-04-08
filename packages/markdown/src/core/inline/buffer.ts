import { findClosingMarker } from "./shared.js";
import { parseLinkOrImage } from "./tokens.js";

export function findBufferPoint(input: string): number {
	let earliestUnclosed = -1;

	for (const { open, close } of [
		{ open: "**", close: "**" },
		{ open: "__", close: "__" },
		{ open: "~~", close: "~~" },
		{ open: "`", close: "`" },
	]) {
		const unclosedAt = findFirstUnclosed(input, open, close);
		if (unclosedAt !== -1) {
			if (earliestUnclosed === -1 || unclosedAt < earliestUnclosed) {
				earliestUnclosed = unclosedAt;
			}
		}
	}

	const unclosedImage = findFirstUnclosedImage(input);
	if (unclosedImage !== -1) {
		if (earliestUnclosed === -1 || unclosedImage < earliestUnclosed) {
			earliestUnclosed = unclosedImage;
		}
	}

	const unclosedLink = findFirstUnclosedLink(input);
	if (unclosedLink !== -1) {
		if (earliestUnclosed === -1 || unclosedLink < earliestUnclosed) {
			earliestUnclosed = unclosedLink;
		}
	}

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

function findFirstUnclosed(input: string, open: string, close: string): number {
	let pos = 0;

	while (pos < input.length) {
		const openIdx = input.indexOf(open, pos);
		if (openIdx === -1) return -1;

		const afterOpen = openIdx + open.length;
		const closeIdx = input.indexOf(close, afterOpen);

		if (closeIdx === -1) {
			return openIdx;
		}

		pos = closeIdx + close.length;
	}

	return -1;
}

function findFirstUnclosedSingle(input: string, marker: string): number {
	let pos = 0;

	while (pos < input.length) {
		const idx = input.indexOf(marker, pos);
		if (idx === -1) return -1;

		if (input[idx + 1] === marker) {
			const closeDouble = input.indexOf(marker + marker, idx + 2);
			if (closeDouble !== -1) {
				pos = closeDouble + 2;
			} else {
				pos = idx + 2;
			}
			continue;
		}

		if (idx > 0 && input[idx - 1] === marker) {
			pos = idx + 1;
			continue;
		}

		const closeIdx = findClosingMarker(input, idx + 1, marker);
		if (closeIdx === -1) {
			if (marker === "_" && idx > 0 && /\w/.test(input[idx - 1])) {
				pos = idx + 1;
				continue;
			}
			return idx;
		}

		if (
			marker === "_" &&
			idx > 0 &&
			/\w/.test(input[idx - 1]) &&
			closeIdx + 1 < input.length &&
			/\w/.test(input[closeIdx + 1])
		) {
			pos = closeIdx + 1;
			continue;
		}

		pos = closeIdx + 1;
	}

	return -1;
}

function findFirstUnclosedImage(input: string): number {
	let pos = 0;

	while (pos < input.length) {
		const openIdx = input.indexOf("![", pos);
		if (openIdx === -1) return -1;

		const result = parseLinkOrImage(input, openIdx + 1, true, () => []);
		if (!result) {
			return openIdx;
		}

		pos = result.end;
	}

	return -1;
}

function findFirstUnclosedLink(input: string): number {
	let pos = 0;

	while (pos < input.length) {
		const openIdx = input.indexOf("[", pos);
		if (openIdx === -1) return -1;

		if (openIdx > 0 && input[openIdx - 1] === "!") {
			pos = openIdx + 1;
			continue;
		}

		const result = parseLinkOrImage(input, openIdx, false, () => []);
		if (!result) {
			return openIdx;
		}

		pos = result.end;
	}

	return -1;
}
