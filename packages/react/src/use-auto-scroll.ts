import { useCallback, useEffect, useRef, useState } from "react";
import type { UseAutoScrollOptions, UseAutoScrollReturn } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// useAutoScroll
// ---------------------------------------------------------------------------

export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(
	dependencies: unknown[],
	options?: UseAutoScrollOptions,
): UseAutoScrollReturn<T> {
	const {
		behavior = "instant",
		enabled = true,
		threshold = DEFAULT_THRESHOLD,
	} = options ?? {};

	const ref = useRef<T | null>(null);
	const isAtBottomRef = useRef(true);
	const [isAtBottom, setIsAtBottom] = useState(true);

	// A single rAF id shared across all scroll sources — ensures we never
	// call scrollTo() more than once per frame, no matter how many
	// MutationObserver / ResizeObserver callbacks fire.
	const rafRef = useRef<number | null>(null);

	const scheduleScroll = useCallback(() => {
		if (rafRef.current != null) return;
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null;
			const el = ref.current;
			if (el && isAtBottomRef.current) {
				el.scrollTo({ top: el.scrollHeight, behavior });
			}
		});
	}, [behavior]);

	// -----------------------------------------------------------------------
	// Track whether the user is near the bottom via scroll events.
	// Only triggers a React re-render when the boolean actually changes.
	// -----------------------------------------------------------------------

	useEffect(() => {
		const el = ref.current;
		if (!el || !enabled) return;

		const handleScroll = () => {
			const atBottom =
				el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
			isAtBottomRef.current = atBottom;
			setIsAtBottom((prev) => (prev === atBottom ? prev : atBottom));
		};

		el.addEventListener("scroll", handleScroll, { passive: true });
		return () => el.removeEventListener("scroll", handleScroll);
	}, [enabled, threshold]);

	// -----------------------------------------------------------------------
	// Scroll to bottom when dependencies change (if pinned).
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (!enabled || !isAtBottomRef.current) return;
		scheduleScroll();
		// biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are passed dynamically by the consumer
	}, dependencies);

	// -----------------------------------------------------------------------
	// MutationObserver + ResizeObserver — catch content changes during
	// streaming that happen between React re-renders (e.g. DOM mutations
	// from markdown renderers). Scroll calls are batched via rAF so we
	// scroll at most once per frame.
	// -----------------------------------------------------------------------

	useEffect(() => {
		const el = ref.current;
		if (!el || !enabled) return;

		const resizeObserver = new ResizeObserver(scheduleScroll);

		// Observe existing children for size changes.
		for (const child of el.children) {
			resizeObserver.observe(child);
		}

		// Watch for new children added to the container.
		const mutationObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node instanceof Element) {
						resizeObserver.observe(node);
					}
				}
			}
			scheduleScroll();
		});

		mutationObserver.observe(el, { childList: true, subtree: true });

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, [enabled, scheduleScroll]);

	// -----------------------------------------------------------------------
	// Cancel any pending rAF on unmount.
	// -----------------------------------------------------------------------

	useEffect(() => {
		return () => {
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, []);

	// -----------------------------------------------------------------------
	// scrollToBottom — imperative function that scrolls to the bottom and
	// re-pins auto-scroll.
	// -----------------------------------------------------------------------

	const scrollToBottom = useCallback(() => {
		const el = ref.current;
		if (!el) return;

		isAtBottomRef.current = true;
		setIsAtBottom(true);
		el.scrollTo({ top: el.scrollHeight, behavior });
	}, [behavior]);

	return { ref, scrollToBottom, isAtBottom };
}
