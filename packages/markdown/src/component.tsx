import type { ReactNode } from "react";
import {
	createElement,
	memo,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { parseIncremental } from "./core/parser.js";
import type {
	Block,
	ComponentOverrides,
	StreamingMarkdownProps,
} from "./core/types.js";
import { renderBlock } from "./hook.js";
import { mergeComponents } from "./renderers/defaults.js";

/**
 * CSS styles for smooth opacity transition on streaming blocks.
 * GPU-accelerated with will-change hint.
 */
const STREAMING_STYLES = `
  .streaming-markdown-block {
    transition: opacity 150ms ease-out;
    will-change: opacity;
  }

  .streaming-markdown-image-skeleton {
    display: inline-block;
    width: min(18rem, 100%);
    max-width: 100%;
    min-width: 10rem;
    height: 10rem;
    border-radius: 0.5rem;
    background: linear-gradient(
      90deg,
      rgba(15, 23, 42, 0.08) 0%,
      rgba(15, 23, 42, 0.14) 50%,
      rgba(15, 23, 42, 0.08) 100%
    );
    background-size: 200% 100%;
    animation: streaming-markdown-image-pulse 1.2s ease-in-out infinite;
    vertical-align: middle;
  }

  .streaming-markdown-image-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: min(18rem, 100%);
    max-width: 100%;
    min-height: 6rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(15, 23, 42, 0.16);
    background: rgba(15, 23, 42, 0.04);
    color: rgba(15, 23, 42, 0.78);
    font-size: 0.75rem;
    line-height: 1.3;
    text-align: center;
    box-sizing: border-box;
    vertical-align: middle;
  }

  @keyframes streaming-markdown-image-pulse {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 100% 50%;
    }
  }
`;

/**
 * BlockRenderer — memoized block component.
 * When block.complete is true, this component never rerenders.
 * Incomplete blocks get wrapped in a transition container for smooth opacity updates.
 */
const BlockRenderer = memo(
	function BlockRenderer({
		block,
		components,
	}: {
		block: Block;
		components: Required<ComponentOverrides>;
	}): ReactNode {
		const rendered = renderBlock(block, components);

		// Apply opacity transition wrapper only to incomplete (streaming) blocks
		if (!block.complete) {
			return createElement(
				"div",
				{ className: "streaming-markdown-block" },
				rendered,
			);
		}

		return rendered;
	},
	(prev, next) => {
		// If the previous block was complete, skip rerender
		if (prev.block.complete) return true;
		// Otherwise, compare by raw content
		return (
			prev.block.raw === next.block.raw &&
			prev.block.complete === next.block.complete
		);
	},
);

/**
 * `<StreamingMarkdown />` — Main React component for rendering streaming markdown.
 *
 * Designed for AI chat UIs. Only the last (active) block rerenders on each token.
 * Completed blocks are frozen via React.memo.
 *
 * @example
 * ```tsx
 * <StreamingMarkdown
 *   content={streamingText}
 *   components={{ code: MyCodeHighlighter }}
 *   batchMs={16}
 * />
 * ```
 */
export function StreamingMarkdown({
	content,
	components,
	batchMs = 16,
	bufferIncomplete = true,
	className,
}: StreamingMarkdownProps): ReactNode {
	const merged = useMemo(() => mergeComponents(components), [components]);

	// Batching: debounce content updates
	const [renderContent, setRenderContent] = useState(content);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (batchMs === 0) {
			setRenderContent(content);
			return;
		}

		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
		}

		timerRef.current = setTimeout(() => {
			setRenderContent(content);
			timerRef.current = null;
		}, batchMs);

		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}
		};
	}, [content, batchMs]);

	const parsed = useMemo(
		() => parseIncremental(renderContent, { bufferIncomplete }),
		[renderContent, bufferIncomplete],
	);

	return createElement(
		"div",
		{ className },
		createElement("style", {
			dangerouslySetInnerHTML: { __html: STREAMING_STYLES },
		}),
		parsed.blocks.map((block) =>
			createElement(BlockRenderer, {
				key: block.id,
				block,
				components: merged,
			}),
		),
		// Buffered content is held back (invisible) during uncertainty.
		// It will be rendered once the syntax resolves.
	);
}
