import { useCallback, useEffect, useRef, useState } from "react";
import type { UseAutoScrollOptions, UseAutoScrollReturn } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 50;

/**
 * Fraction of remaining distance covered each frame.
 * We scale this up for larger gaps so debounced/batched content flushes do
 * not leave the viewport visibly chasing the bottom for too long.
 */
const MIN_LERP_FACTOR = 0.5;
const MAX_LERP_FACTOR = 0.82;

/**
 * After the lerp finishes, keep the scroll-event guard active for this
 * many milliseconds.  This prevents a race where content grows between the
 * lerp ending and the next observer callback, causing the scroll handler
 * to falsely disengage auto-scroll.
 */
const SCROLL_COOLDOWN_MS = 150;

function getLerpFactor(distance: number, clientHeight: number): number {
	const safeClientHeight = Math.max(clientHeight, 1);
	const normalizedDistance = Math.min(distance / safeClientHeight, 1);

	return (
		MIN_LERP_FACTOR + (MAX_LERP_FACTOR - MIN_LERP_FACTOR) * normalizedDistance
	);
}

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
	const lastScrollTopRef = useRef(0);
	const userDetachedRef = useRef(false);

	const rafRef = useRef<number | null>(null);

	// Guard: while true the scroll-event handler ignores position checks
	// so that programmatic scrolling doesn't falsely disengage auto-scroll.
	// Stays true during the lerp AND for a short cooldown after it ends.
	const isAutoScrollingRef = useRef(false);
	const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const disengageAutoScroll = useCallback(() => {
		userDetachedRef.current = true;
		isAtBottomRef.current = false;
		setIsAtBottom(false);

		if (rafRef.current != null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}

		if (cooldownRef.current != null) {
			clearTimeout(cooldownRef.current);
			cooldownRef.current = null;
		}

		isAutoScrollingRef.current = false;
	}, []);

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
				if (distance > 0) {
					el.scrollTop = target;
					lastScrollTopRef.current = target;
				}
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
			const lerpFactor = getLerpFactor(distance, el.clientHeight);

			// Math.ceil guarantees at least 1 px per frame so we always
			// converge and never stall.
			el.scrollTop = el.scrollTop + Math.ceil(distance * lerpFactor);
			lastScrollTopRef.current = el.scrollTop;
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
			const nextScrollTop = el.scrollTop;
			const wasMovingUp = nextScrollTop < lastScrollTopRef.current;
			const wasMovingDown = nextScrollTop > lastScrollTopRef.current;
			lastScrollTopRef.current = nextScrollTop;

			// A manual upward scroll can arrive as a plain `scroll` event
			// (for example via scrollbar drag or touch interactions) while our
			// programmatic pinning is active. Detect that direction change and
			// detach immediately instead of waiting for the cooldown to expire.
			if (isAutoScrollingRef.current && wasMovingUp) {
				disengageAutoScroll();
				return;
			}

			// Ignore scroll events fired by (or shortly after) our own
			// programmatic scrolling — without this guard, fast-growing
			// content can push the measured distance past the threshold
			// and falsely disengage auto-scroll.
			if (isAutoScrollingRef.current) return;

			const atBottom =
				el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;

			// Preserve deliberate upward detachment even if the user is still
			// near the bottom threshold. Re-pin only after they move back down.
			if (userDetachedRef.current) {
				if (!atBottom || !wasMovingDown) {
					isAtBottomRef.current = false;
					setIsAtBottom((prev) => (prev === false ? prev : false));
					return;
				}

				userDetachedRef.current = false;
			}

			isAtBottomRef.current = atBottom;
			setIsAtBottom((prev) => (prev === atBottom ? prev : atBottom));
		};

		const handleWheel = (event: WheelEvent) => {
			if (event.deltaY < 0) {
				disengageAutoScroll();
			}
		};

		el.addEventListener("scroll", handleScroll, { passive: true });
		el.addEventListener("wheel", handleWheel, { passive: true });
		handleScroll();
		return () => {
			el.removeEventListener("scroll", handleScroll);
			el.removeEventListener("wheel", handleWheel);
		};
	}, [disengageAutoScroll, enabled, threshold]);

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

		const target = el.scrollHeight - el.clientHeight;
		isAtBottomRef.current = true;
		userDetachedRef.current = false;
		lastScrollTopRef.current = target;
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
