import type { ReactNode } from "react";

// ── Block Types ──

export type BlockType =
	| "heading"
	| "paragraph"
	| "code"
	| "blockquote"
	| "list"
	| "table"
	| "hr";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Block {
	/** Stable ID for React reconciliation */
	id: number;
	/** The type of block */
	type: BlockType;
	/** Raw markdown source for this block */
	raw: string;
	/** Whether this block is complete (frozen — never rerenders) */
	complete: boolean;
	/** Heading level (1-6), only relevant for heading blocks */
	level?: HeadingLevel;
	/** Code block language identifier */
	language?: string;
	/** List style: ordered or unordered */
	listStyle?: "ordered" | "unordered";
}

// ── Parser State Machine ──

export type ParserState =
	| "IDLE"
	| "IN_HEADING"
	| "IN_PARAGRAPH"
	| "IN_CODE_BLOCK"
	| "PENDING_CODE_BLOCK"
	| "IN_BLOCKQUOTE"
	| "IN_LIST"
	| "IN_TABLE";

// ── Inline Tokens ──

export type InlineTokenType =
	| "text"
	| "strong"
	| "em"
	| "code"
	| "del"
	| "link"
	| "image"
	| "autolink";

export interface InlineToken {
	type: InlineTokenType;
	value: string;
	href?: string;
	alt?: string;
	/** Nested inline tokens (e.g., bold inside a link) */
	children?: InlineToken[];
}

// ── Parse Result ──

export interface ParseResult {
	/** Parsed, safe-to-render blocks */
	blocks: Block[];
	/** Held-back partial content (pending resolution) */
	buffered: string;
}

// ── Parser Options ──

export interface ParseOptions {
	/** Hold back tokens with uncertain syntax (default: true) */
	bufferIncomplete?: boolean;
}

// ── Component Props ──

export interface CodeComponentProps {
	language?: string;
	children: ReactNode;
	inline?: boolean;
}

export interface LinkComponentProps {
	href: string;
	children: ReactNode;
}

export interface ImageComponentProps {
	src: string;
	alt: string;
}

export interface HeadingComponentProps {
	level: HeadingLevel;
	children: ReactNode;
}

export interface TableCellComponentProps {
	children: ReactNode;
	isHeader?: boolean;
}

export interface DefaultComponentProps {
	children: ReactNode;
}

/** Map of overridable element renderers */
export interface ComponentOverrides {
	p?: (props: DefaultComponentProps) => ReactNode;
	h1?: (props: DefaultComponentProps) => ReactNode;
	h2?: (props: DefaultComponentProps) => ReactNode;
	h3?: (props: DefaultComponentProps) => ReactNode;
	h4?: (props: DefaultComponentProps) => ReactNode;
	h5?: (props: DefaultComponentProps) => ReactNode;
	h6?: (props: DefaultComponentProps) => ReactNode;
	code?: (props: CodeComponentProps) => ReactNode;
	pre?: (props: DefaultComponentProps) => ReactNode;
	blockquote?: (props: DefaultComponentProps) => ReactNode;
	ul?: (props: DefaultComponentProps) => ReactNode;
	ol?: (props: DefaultComponentProps) => ReactNode;
	li?: (props: DefaultComponentProps) => ReactNode;
	a?: (props: LinkComponentProps) => ReactNode;
	strong?: (props: DefaultComponentProps) => ReactNode;
	em?: (props: DefaultComponentProps) => ReactNode;
	del?: (props: DefaultComponentProps) => ReactNode;
	hr?: () => ReactNode;
	img?: (props: ImageComponentProps) => ReactNode;
	table?: (props: DefaultComponentProps) => ReactNode;
	thead?: (props: DefaultComponentProps) => ReactNode;
	tbody?: (props: DefaultComponentProps) => ReactNode;
	tr?: (props: DefaultComponentProps) => ReactNode;
	th?: (props: DefaultComponentProps) => ReactNode;
	td?: (props: DefaultComponentProps) => ReactNode;
}

// ── Hook & Component Options ──

export interface StreamingMarkdownOptions {
	/** The live streaming markdown content */
	content: string;
	/** Debounce renders in ms (default: 16ms = 60fps) */
	batchMs?: number;
	/** Hold back uncertain partial syntax (default: true) */
	bufferIncomplete?: boolean;
}

export interface StreamingMarkdownProps extends StreamingMarkdownOptions {
	/** Override renderers per element type */
	components?: ComponentOverrides;
	/** className on wrapper div */
	className?: string;
}

export interface UseStreamingMarkdownReturn {
	/** Rendered React nodes */
	nodes: ReactNode[];
	/** True when streaming has ended (content is stable) */
	isComplete: boolean;
}
