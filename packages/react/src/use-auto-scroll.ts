import { useCallback, useEffect, useRef, useState } from "react";
import type { UseAutoScrollOptions, UseAutoScrollReturn } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 50;

/**
 * Fraction of remaining distance covered each frame.
 * 0.5 at 60 fps closes ~97 % of a gap within ≈ 100 ms — responsive enough
 * to keep up with fast-growing lists/code blocks, while still looking smooth.
 */
const LERP_FACTOR = 0.5;

/**
 * After the lerp finishes, keep the scroll-event guard active for this
 * many milliseconds.  This prevents a race where content grows between the
 * lerp ending and the next observer callback, causing the scroll handler
 * to falsely disengage auto-scroll.
 */
const SCROLL_COOLDOWN_MS = 150;

// ---------------------------------------------------------------------------
// useAutoScroll
// ---------------------------------------------------------------------------

export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(
	dependencies: unknown[],
	options?: UseAutoScrollOptions,
): UseAutoScrollReturn<T> {
	const {
		behavior = "smooth",
		enabled = true,
		threshold = DEFAULT_THRESHOLD,
	} = options ?? {};

	const ref = useRef<T | null>(null);
	const isAtBottomRef = useRef(true);
	const [isAtBottom, setIsAtBottom] = useState(true);

	const rafRef = useRef<number | null>(null);

	// Guard: while true the scroll-event handler ignores position checks
	// so that programmatic scrolling doesn't falsely disengage auto-scroll.
	// Stays true during the lerp AND for a short cooldown after it ends.
	const isAutoScrollingRef = useRef(false);
	const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// -------------------------------------------------------------------
	// scheduleScroll — lerp-based auto-scroll
	//
	// Each rAF frame we move `LERP_FACTOR` of the remaining distance
	// toward the bottom.  This avoids both the jarring jump of a raw
	// `scrollTop` assignment AND the flicker of overlapping
	// `scrollTo({ behavior: "smooth" })` calls.
	// -------------------------------------------------------------------

	const scheduleScroll = useCallback(() => {
		// If a tick loop is already running it will pick up the new
		// scrollHeight automatically — no need to start another.
		if (rafRef.current != null) return;

		// Cancel any pending cooldown — we're about to start scrolling again.
		if (cooldownRef.current != null) {
			clearTimeout(cooldownRef.current);
			cooldownRef.current = null;
		}

		const tick = () => {
			const el = ref.current;
			if (!el || !isAtBottomRef.current) {
				rafRef.current = null;
				isAutoScrollingRef.current = false;
				return;
			}

			const target = el.scrollHeight - el.clientHeight;
			const distance = target - el.scrollTop;

			if (distance <= 0.5) {
				// Close enough — snap and stop.
				if (distance > 0) el.scrollTop = target;
				rafRef.current = null;

				// Keep the guard active for a short cooldown so scroll
				// events that fire after the lerp don't disengage us.
				cooldownRef.current = setTimeout(() => {
					isAutoScrollingRef.current = false;
					cooldownRef.current = null;
				}, SCROLL_COOLDOWN_MS);
				return;
			}

			isAutoScrollingRef.current = true;

			// Math.ceil guarantees at least 1 px per frame so we always
			// converge and never stall.
			el.scrollTop = el.scrollTop + Math.ceil(distance * LERP_FACTOR);
			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);
	}, []);

	// -------------------------------------------------------------------
	// Track whether the user is near the bottom via scroll events.
	// Only triggers a React re-render when the boolean actually changes.
	// -------------------------------------------------------------------

	useEffect(() => {
		const el = ref.current;
		if (!el || !enabled) return;

		const handleScroll = () => {
			// Ignore scroll events fired by (or shortly after) our own
			// programmatic scrolling — without this guard, fast-growing
			// content can push the measured distance past the threshold
			// and falsely disengage auto-scroll.
			if (isAutoScrollingRef.current) return;

			const atBottom =
				el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
			isAtBottomRef.current = atBottom;
			setIsAtBottom((prev) => (prev === atBottom ? prev : atBottom));
		};

		el.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();
		return () => el.removeEventListener("scroll", handleScroll);
	}, [enabled, threshold]);

	// -------------------------------------------------------------------
	// Scroll to bottom when dependencies change (if pinned).
	// -------------------------------------------------------------------

	useEffect(() => {
		if (!enabled || !isAtBottomRef.current) return;
		scheduleScroll();
		// biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are passed dynamically by the consumer
	}, dependencies);

	// -------------------------------------------------------------------
	// MutationObserver + ResizeObserver — catch content changes during
	// streaming that happen between React re-renders (e.g. DOM mutations
	// from markdown renderers). Scroll calls are batched via rAF so we
	// scroll at most once per frame.
	// -------------------------------------------------------------------

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

	// -------------------------------------------------------------------
	// Cancel any pending rAF / cooldown on unmount.
	// -------------------------------------------------------------------

	useEffect(() => {
		return () => {
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			if (cooldownRef.current != null) {
				clearTimeout(cooldownRef.current);
				cooldownRef.current = null;
			}
			isAutoScrollingRef.current = false;
		};
	}, []);

	// -------------------------------------------------------------------
	// scrollToBottom — imperative function that scrolls to the bottom and
	// re-pins auto-scroll.
	// -------------------------------------------------------------------

	const scrollToBottom = useCallback(() => {
		const el = ref.current;
		if (!el) return;

		isAtBottomRef.current = true;
		isAutoScrollingRef.current = false;
		if (cooldownRef.current != null) {
			clearTimeout(cooldownRef.current);
			cooldownRef.current = null;
		}
		setIsAtBottom(true);
		el.scrollTo({ top: el.scrollHeight, behavior });
	}, [behavior]);

	return { ref, scrollToBottom, isAtBottom };
}
