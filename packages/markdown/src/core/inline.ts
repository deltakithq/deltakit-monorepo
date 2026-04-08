import {
	appendText,
	findClosingMarker,
	findUrlEnd,
	flushText,
	parseLinkOrImage,
} from "./inline/index.js";
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
			const result = parseLinkOrImage(input, pos + 1, true, parseInline);
			if (result) {
				flushText(tokens, input, pos);
				tokens.push(result.token);
				pos = result.end;
				matched = true;
			}
		}

		if (!matched && input[pos] === "[") {
			// 3. Link: [text](url)
			const result = parseLinkOrImage(input, pos, false, parseInline);
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
				// For __: skip intraword emphasis (CommonMark rule)
				const isIntraword =
					marker === "__" &&
					pos > 0 &&
					/\w/.test(input[pos - 1]) &&
					end + 2 < input.length &&
					/\w/.test(input[end + 2]);

				if (!isIntraword) {
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
		}

		if (!matched && (input[pos] === "*" || input[pos] === "_")) {
			// 6. Italic: *text* or _text_
			const marker = input[pos];
			const end = findClosingMarker(input, pos + 1, marker);
			if (end !== -1) {
				// For _: skip intraword emphasis (CommonMark rule)
				const isIntraword =
					marker === "_" &&
					pos > 0 &&
					/\w/.test(input[pos - 1]) &&
					end + 1 < input.length &&
					/\w/.test(input[end + 1]);

				if (!isIntraword) {
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

export { findBufferPoint } from "./inline/index.js";
