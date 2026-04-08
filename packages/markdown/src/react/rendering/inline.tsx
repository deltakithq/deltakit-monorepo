import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import type { ComponentOverrides, InlineToken } from "../../core/types.js";
import { BufferedImageToken } from "./images.js";
import { sanitizeUrl } from "./url.js";

export function renderInlineTokens(
	tokens: InlineToken[],
	components: Required<ComponentOverrides>,
): ReactNode {
	if (tokens.length === 0) return null;
	if (tokens.length === 1 && tokens[0].type === "text") return tokens[0].value;

	return tokens.map((token, idx) => renderInlineToken(token, idx, components));
}

function renderInlineToken(
	token: InlineToken,
	key: number,
	components: Required<ComponentOverrides>,
): ReactNode {
	switch (token.type) {
		case "text":
			return createElement(Fragment, { key }, token.value);
		case "strong": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(Fragment, { key }, components.strong({ children }));
		}
		case "em": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(Fragment, { key }, components.em({ children }));
		}
		case "code":
			return createElement(
				Fragment,
				{ key },
				components.code({ children: token.value, inline: true }),
			);
		case "del": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(Fragment, { key }, components.del({ children }));
		}
		case "link": {
			const children = token.children
				? renderInlineTokens(token.children, components)
				: token.value;
			return createElement(
				Fragment,
				{ key },
				components.a({ href: sanitizeUrl(token.href ?? ""), children }),
			);
		}
		case "image": {
			const sanitizedSrc = sanitizeUrl(token.href ?? "");
			if (!sanitizedSrc) {
				return createElement(Fragment, { key }, "[Image]");
			}
			return createElement(
				Fragment,
				{ key },
				createElement(BufferedImageToken, {
					src: sanitizedSrc,
					alt: token.alt ?? "",
					components,
				}),
			);
		}
		case "autolink": {
			const sanitizedHref = sanitizeUrl(token.href ?? "");
			if (!sanitizedHref) {
				return createElement(Fragment, { key }, token.value);
			}
			return createElement(
				Fragment,
				{ key },
				components.a({ href: sanitizedHref, children: token.value }),
			);
		}
		default:
			return createElement(Fragment, { key }, token.value);
	}
}
