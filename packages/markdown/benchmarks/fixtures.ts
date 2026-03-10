/**
 * Shared markdown test fixtures for benchmarks.
 *
 * IMPORTANT: Fixtures only use markdown features that BOTH @deltakit/markdown
 * and react-markdown support, to ensure fair comparison.
 */

/** Simple short paragraph — baseline */
export const SHORT_PARAGRAPH =
	"Hello world, this is a simple test paragraph with some text.";

/**
 * Realistic AI response with mixed content.
 * Uses only features both renderers support:
 * headings, paragraphs, bold, italic, inline code, code blocks,
 * unordered lists, ordered lists, blockquotes, links, HR.
 */
export const MIXED_CONTENT = `# Understanding React Hooks

React Hooks are functions that let you **hook into** React state and lifecycle features from function components.

## Why Hooks?

Hooks solve a wide variety of seemingly unconnected problems in React that we've encountered over five years of writing and maintaining tens of thousands of components:

- **Reuse stateful logic** between components without changing your component hierarchy
- **Split one component** into smaller functions based on what pieces are related
- **Use more of React's features** without classes

## Example: useState

\`\`\`tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
\`\`\`

## Example: useEffect

The \`useEffect\` hook lets you perform side effects in function components. It serves the same purpose as \`componentDidMount\`, \`componentDidUpdate\`, and \`componentWillUnmount\` in React classes.

> **Note:** If you're familiar with React class lifecycle methods, you can think of \`useEffect\` Hook as \`componentDidMount\`, \`componentDidUpdate\`, and \`componentWillUnmount\` combined.

### Rules of Hooks

1. Only call Hooks **at the top level** — don't call Hooks inside loops, conditions, or nested functions
2. Only call Hooks **from React function components** — don't call Hooks from regular JavaScript functions
3. You can also call Hooks from **custom Hooks**

For more information, visit [React documentation](https://react.dev/reference/react) or check out the [Hooks API reference](https://react.dev/reference/react/hooks).

---

*Built with **functional components** and Hooks.*
`;

/** Long content — stress test */
export const LONG_CONTENT =
	"This is a very long paragraph that simulates a large block of text content. ".repeat(
		130,
	);

/** Heavy inline formatting */
export const HEAVY_INLINE =
	"Hello **bold text** and *italic text* and `inline code` and [a link](https://example.com) and more **bold** and *italic* and `code` here.";

/**
 * Generate an array of incrementally growing strings that simulate
 * token-by-token streaming of content.
 *
 * @param content - Full markdown content
 * @param tokenSize - Characters per "token" (default 4, typical LLM token is 3-5 chars)
 */
export function generateStreamingSteps(
	content: string,
	tokenSize = 4,
): string[] {
	const steps: string[] = [];
	for (let i = tokenSize; i <= content.length; i += tokenSize) {
		steps.push(content.slice(0, i));
	}
	if (steps[steps.length - 1] !== content) {
		steps.push(content);
	}
	return steps;
}

/**
 * Feature parity matrix.
 * Honest documentation of what each library supports.
 *
 * true  = fully supported
 * false = not supported
 * "partial" = basic support, not spec-complete
 */
export const FEATURE_PARITY = {
	"Headings (h1-h6)": { deltakit: true, reactMarkdown: true },
	Paragraphs: { deltakit: true, reactMarkdown: true },
	"Bold (**text**)": { deltakit: true, reactMarkdown: true },
	"Italic (*text*)": { deltakit: true, reactMarkdown: true },
	"Inline code (`code`)": { deltakit: true, reactMarkdown: true },
	"Code blocks (```)": { deltakit: true, reactMarkdown: true },
	"Links [text](url)": { deltakit: true, reactMarkdown: true },
	"Images ![alt](src)": { deltakit: true, reactMarkdown: true },
	"Unordered lists": { deltakit: true, reactMarkdown: true },
	"Ordered lists": { deltakit: true, reactMarkdown: true },
	Blockquotes: { deltakit: true, reactMarkdown: true },
	"Horizontal rules": { deltakit: true, reactMarkdown: true },
	"Strikethrough (~~text~~)": {
		deltakit: true,
		reactMarkdown: "via remark-gfm",
	},
	"Tables (GFM)": { deltakit: "partial", reactMarkdown: "via remark-gfm" },
	"CommonMark full compliance": { deltakit: false, reactMarkdown: true },
	"Nested blockquotes": { deltakit: false, reactMarkdown: true },
	"Reference links [text][id]": { deltakit: false, reactMarkdown: true },
	"HTML entities": { deltakit: false, reactMarkdown: true },
	"Escape sequences (\\*)": { deltakit: false, reactMarkdown: true },
	"Plugin system (remark/rehype)": { deltakit: false, reactMarkdown: true },
	"Streaming-optimized rendering": { deltakit: true, reactMarkdown: false },
	"Incremental block parsing": { deltakit: true, reactMarkdown: false },
	"Incomplete syntax buffering": { deltakit: true, reactMarkdown: false },
	"React.memo stable blocks": { deltakit: true, reactMarkdown: false },
	"Zero runtime dependencies": { deltakit: true, reactMarkdown: false },
} as const;

/**
 * Bundle size data (measured via esbuild --minify + gzip).
 * Update these values when bundles change.
 */
export const BUNDLE_SIZES = {
	deltakit: {
		minified: 12_237,
		gzipped: 3_901,
		runtimeDeps: 0,
	},
	reactMarkdown: {
		minified: 117_529,
		gzipped: 36_165,
		runtimeDeps: 11,
	},
} as const;
