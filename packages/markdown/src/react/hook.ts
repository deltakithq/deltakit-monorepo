import {
	createElement,
	Fragment,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { parseIncremental } from "../core/parser.js";
import type {
	ComponentOverrides,
	StreamingMarkdownOptions,
	UseStreamingMarkdownReturn,
} from "../core/types.js";
import { mergeComponents } from "../renderers/defaults.js";
import { renderBlock } from "./rendering/index.js";

/**
 * Hook for headless streaming markdown usage.
 * Returns parsed React nodes and streaming status.
 */
export function useStreamingMarkdown(
	options: StreamingMarkdownOptions & { components?: ComponentOverrides },
): UseStreamingMarkdownReturn {
	const {
		content,
		batchMs = 16,
		bufferIncomplete = true,
		components,
	} = options;
	const [renderContent, setRenderContent] = useState(content);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prevContentRef = useRef(content);

	// Debounce content updates for batching
	useEffect(() => {
		if (batchMs === 0) {
			setRenderContent(content);
			return;
		}

		// If content changed, schedule a batched update
		if (content !== prevContentRef.current) {
			prevContentRef.current = content;

			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}

			timerRef.current = setTimeout(() => {
				setRenderContent(content);
				timerRef.current = null;
			}, batchMs);
		}

		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}
		};
	}, [content, batchMs]);

	const merged = useMemo(() => mergeComponents(components), [components]);

	const result = useMemo(() => {
		const parsed = parseIncremental(renderContent, {
			bufferIncomplete,
			relaxedOrderedListMarkers: true,
		});
		return parsed;
	}, [renderContent, bufferIncomplete]);

	const nodes = useMemo(() => {
		return result.blocks.map((block) =>
			createElement(Fragment, { key: block.id }, renderBlock(block, merged)),
		);
	}, [result.blocks, merged]);

	// Consider streaming complete when content hasn't changed and no buffer
	const isComplete = result.buffered.length === 0 && content === renderContent;

	return { nodes, isComplete };
}
export { renderBlock } from "./rendering/index.js";
