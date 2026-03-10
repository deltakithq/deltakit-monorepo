import type { ReactNode } from "react";
import { createElement } from "react";
import type {
	CodeComponentProps,
	ComponentOverrides,
	DefaultComponentProps,
	ImageComponentProps,
	LinkComponentProps,
} from "../core/types.js";

function DefaultParagraph({ children }: DefaultComponentProps): ReactNode {
	return createElement("p", null, children);
}

function DefaultH1({ children }: DefaultComponentProps): ReactNode {
	return createElement("h1", null, children);
}

function DefaultH2({ children }: DefaultComponentProps): ReactNode {
	return createElement("h2", null, children);
}

function DefaultH3({ children }: DefaultComponentProps): ReactNode {
	return createElement("h3", null, children);
}

function DefaultH4({ children }: DefaultComponentProps): ReactNode {
	return createElement("h4", null, children);
}

function DefaultH5({ children }: DefaultComponentProps): ReactNode {
	return createElement("h5", null, children);
}

function DefaultH6({ children }: DefaultComponentProps): ReactNode {
	return createElement("h6", null, children);
}

function DefaultCode({
	language,
	children,
	inline,
}: CodeComponentProps): ReactNode {
	if (inline) {
		return createElement("code", null, children);
	}
	return createElement(
		"pre",
		null,
		createElement(
			"code",
			{ className: language ? `language-${language}` : undefined },
			children,
		),
	);
}

function DefaultPre({ children }: DefaultComponentProps): ReactNode {
	return createElement("pre", null, children);
}

function DefaultBlockquote({ children }: DefaultComponentProps): ReactNode {
	return createElement("blockquote", null, children);
}

function DefaultUl({ children }: DefaultComponentProps): ReactNode {
	return createElement("ul", null, children);
}

function DefaultOl({ children }: DefaultComponentProps): ReactNode {
	return createElement("ol", null, children);
}

function DefaultLi({ children }: DefaultComponentProps): ReactNode {
	return createElement("li", null, children);
}

function DefaultLink({ href, children }: LinkComponentProps): ReactNode {
	return createElement("a", { href }, children);
}

function DefaultStrong({ children }: DefaultComponentProps): ReactNode {
	return createElement("strong", null, children);
}

function DefaultEm({ children }: DefaultComponentProps): ReactNode {
	return createElement("em", null, children);
}

function DefaultDel({ children }: DefaultComponentProps): ReactNode {
	return createElement("del", null, children);
}

function DefaultHr(): ReactNode {
	return createElement("hr", null);
}

function DefaultImg({ src, alt }: ImageComponentProps): ReactNode {
	return createElement("img", { src, alt });
}

function DefaultTable({ children }: DefaultComponentProps): ReactNode {
	return createElement("table", null, children);
}

function DefaultThead({ children }: DefaultComponentProps): ReactNode {
	return createElement("thead", null, children);
}

function DefaultTbody({ children }: DefaultComponentProps): ReactNode {
	return createElement("tbody", null, children);
}

function DefaultTr({ children }: DefaultComponentProps): ReactNode {
	return createElement("tr", null, children);
}

function DefaultTh({ children }: DefaultComponentProps): ReactNode {
	return createElement("th", null, children);
}

function DefaultTd({ children }: DefaultComponentProps): ReactNode {
	return createElement("td", null, children);
}

/** Default component overrides — used when no custom renderers are provided */
export const defaultComponents: Required<ComponentOverrides> = {
	p: DefaultParagraph,
	h1: DefaultH1,
	h2: DefaultH2,
	h3: DefaultH3,
	h4: DefaultH4,
	h5: DefaultH5,
	h6: DefaultH6,
	code: DefaultCode,
	pre: DefaultPre,
	blockquote: DefaultBlockquote,
	ul: DefaultUl,
	ol: DefaultOl,
	li: DefaultLi,
	a: DefaultLink,
	strong: DefaultStrong,
	em: DefaultEm,
	del: DefaultDel,
	hr: DefaultHr,
	img: DefaultImg,
	table: DefaultTable,
	thead: DefaultThead,
	tbody: DefaultTbody,
	tr: DefaultTr,
	th: DefaultTh,
	td: DefaultTd,
};

/** Merge user-provided components with defaults */
export function mergeComponents(
	custom?: ComponentOverrides,
): Required<ComponentOverrides> {
	if (!custom) return defaultComponents;
	return { ...defaultComponents, ...custom };
}
