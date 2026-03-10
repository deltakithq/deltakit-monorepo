// Main React exports
export { StreamingMarkdown } from "./component.js";
export { parseInline } from "./core/inline.js";

// Re-export core parser for direct usage
export { parseIncremental } from "./core/parser.js";
// Re-export types
export type {
	Block,
	BlockType,
	CodeComponentProps,
	ComponentOverrides,
	DefaultComponentProps,
	HeadingComponentProps,
	HeadingLevel,
	ImageComponentProps,
	InlineToken,
	InlineTokenType,
	LinkComponentProps,
	ParseOptions,
	ParseResult,
	StreamingMarkdownOptions,
	StreamingMarkdownProps,
	TableCellComponentProps,
	UseStreamingMarkdownReturn,
} from "./core/types.js";
export { useStreamingMarkdown } from "./hook.js";
