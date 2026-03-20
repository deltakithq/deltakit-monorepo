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
	const lastAutoScrollHeightRef = useRef<number | null>(null);
	const pendingVerificationFramesRef = useRef(0);

	const scheduleScroll = useCallback(() => {
		pendingVerificationFramesRef.current = Math.max(
			pendingVerificationFramesRef.current,
			1,
		);
		if (rafRef.current != null) return;

		const tick = () => {
			rafRef.current = null;
			const el = ref.current;
			if (!el || !isAtBottomRef.current) {
				pendingVerificationFramesRef.current = 0;
				return;
			}

			const nextHeight = el.scrollHeight;
			const heightChanged = lastAutoScrollHeightRef.current !== nextHeight;
			const distanceFromBottom = nextHeight - el.scrollTop - el.clientHeight;

			if (heightChanged || distanceFromBottom > 0) {
				lastAutoScrollHeightRef.current = nextHeight;
				pendingVerificationFramesRef.current = 1;

				// Keep the viewport pinned during streaming without restarting a
				// smooth scroll animation on every DOM mutation.
				el.scrollTop = nextHeight;
			} else {
				pendingVerificationFramesRef.current = Math.max(
					pendingVerificationFramesRef.current - 1,
					0,
				);
			}

			if (pendingVerificationFramesRef.current > 0) {
				rafRef.current = requestAnimationFrame(tick);
			}
		};

		rafRef.current = requestAnimationFrame(tick);
	}, []);

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
			if (!atBottom) {
				lastAutoScrollHeightRef.current = null;
				pendingVerificationFramesRef.current = 0;
			}
			setIsAtBottom((prev) => (prev === atBottom ? prev : atBottom));
		};

		el.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();
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
			pendingVerificationFramesRef.current = 0;
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
		lastAutoScrollHeightRef.current = el.scrollHeight;
		pendingVerificationFramesRef.current = 0;
		setIsAtBottom(true);
		el.scrollTo({ top: el.scrollHeight, behavior });
	}, [behavior]);

	return { ref, scrollToBottom, isAtBottom };
}
