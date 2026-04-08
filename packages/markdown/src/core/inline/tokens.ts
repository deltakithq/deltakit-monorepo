import type { InlineToken } from "../types.js";

export function parseLinkOrImage(
	input: string,
	bracketStart: number,
	isImage: boolean,
	parseNested: (input: string) => InlineToken[],
): { token: InlineToken; end: number } | null {
	const closeBracket = input.indexOf("]", bracketStart + 1);
	if (closeBracket === -1) return null;

	if (input[closeBracket + 1] !== "(") return null;

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
			children: parseNested(text),
		},
		end: closeParen + 1,
	};
}
