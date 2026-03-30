import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAutoScroll } from "../src/use-auto-scroll";

class ResizeObserverMock {
	private readonly callback?: ResizeObserverCallback;
	observe = vi.fn();
	disconnect = vi.fn();

	constructor(callback?: ResizeObserverCallback) {
		this.callback = callback;
	}

	trigger() {
		this.callback?.([], this as unknown as ResizeObserver);
	}
}

class MutationObserverMock {
	private readonly callback: MutationCallback;
	observe = vi.fn();
	disconnect = vi.fn();

	constructor(callback: MutationCallback) {
		this.callback = callback;
	}

	trigger(mutations: MutationRecord[] = []) {
		this.callback(mutations, this as unknown as MutationObserver);
	}
}

function attachScrollableMetrics(
	el: HTMLDivElement,
	{
		scrollHeight = 1000,
		clientHeight = 400,
		scrollTop = 600,
	}: {
		scrollHeight?: number;
		clientHeight?: number;
		scrollTop?: number;
	} = {},
) {
	Object.defineProperty(el, "scrollHeight", {
		configurable: true,
		get: () => scrollHeight,
		set: (value: number) => {
			scrollHeight = value;
		},
	});
	Object.defineProperty(el, "clientHeight", {
		configurable: true,
		get: () => clientHeight,
		set: (value: number) => {
			clientHeight = value;
		},
	});
	Object.defineProperty(el, "scrollTop", {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		},
	});

	const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
		if (typeof top === "number") {
			scrollTop = top;
		}
	});

	Object.defineProperty(el, "scrollTo", {
		configurable: true,
		value: scrollTo,
	});

	return { scrollTo };
}

function HookHarness({
	deps,
	behavior,
	onRender,
	children,
}: {
	deps: unknown[];
	behavior?: ScrollBehavior;
	onRender: ReturnType<typeof vi.fn>;
	children?: ReactNode;
}) {
	const value = useAutoScroll<HTMLDivElement>(deps, { behavior });
	onRender(value);

	return <div ref={value.ref}>{children}</div>;
}

function advanceFrame() {
	act(() => {
		vi.advanceTimersByTime(16);
	});
}

function setupObservers() {
	const mutationObservers: MutationObserverMock[] = [];
	const resizeObservers: ResizeObserverMock[] = [];

	vi.stubGlobal(
		"ResizeObserver",
		vi.fn((callback: ResizeObserverCallback) => {
			const instance = new ResizeObserverMock(callback);
			resizeObservers.push(instance);
			return instance;
		}),
	);
	vi.stubGlobal(
		"MutationObserver",
		vi.fn((callback: MutationCallback) => {
			const instance = new MutationObserverMock(callback);
			mutationObservers.push(instance);
			return instance;
		}),
	);

	return { mutationObservers, resizeObservers };
}

/**
 * Advance frames until scrollTop stops changing (lerp has converged)
 * but do NOT advance far enough to expire the cooldown timer.
 */
function advanceLerpToTarget(el: HTMLDivElement, target: number) {
	for (let i = 0; i < 60; i++) {
		advanceFrame();
		if (el.scrollTop >= target) return;
	}
}

/**
 * Advance well past the cooldown window so scroll events are processed.
 */
function advancePastCooldown() {
	act(() => {
		vi.advanceTimersByTime(200);
	});
}

describe("useAutoScroll", () => {
	it("lerps toward the bottom smoothly over multiple frames", () => {
		vi.useFakeTimers();
		const { mutationObservers } = setupObservers();

		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		attachScrollableMetrics(el);

		// Grow content — target scrollTop = 1400 - 400 = 1000.
		act(() => {
			el.scrollHeight = 1400;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
			mutationObservers[0]?.trigger();
		});

		// After ONE frame we should have moved partway, not jumped all the way.
		advanceFrame();
		const afterOneFrame = el.scrollTop;
		expect(afterOneFrame).toBeGreaterThan(600);
		expect(afterOneFrame).toBeLessThan(1000);

		// After enough frames we should converge to the target.
		advanceLerpToTarget(el, 1000);
		expect(el.scrollTop).toBe(1000);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("does not disengage when scroll events fire shortly after lerp ends", () => {
		vi.useFakeTimers();
		const { mutationObservers } = setupObservers();

		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		attachScrollableMetrics(el);

		// Large content growth — the lerp takes multiple frames.
		act(() => {
			el.scrollHeight = 2000;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
			mutationObservers[0]?.trigger();
		});

		// Let the lerp converge (but stay within cooldown window).
		advanceLerpToTarget(el, 1600);
		expect(el.scrollTop).toBe(1600);

		// Simulate more content arriving RIGHT AFTER the lerp finished
		// (within the cooldown window). This is the race that used to
		// disengage auto-scroll.
		act(() => {
			el.scrollHeight = 2200;
			el.dispatchEvent(new Event("scroll"));
		});

		// isAtBottom should still be true — cooldown protects us.
		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(true);

		// Observer fires, scheduleScroll picks up the new height.
		act(() => {
			mutationObservers[0]?.trigger();
		});
		advanceLerpToTarget(el, 1800);
		expect(el.scrollTop).toBe(1800);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("disengages when user scrolls away after cooldown expires", () => {
		vi.useFakeTimers();
		const { mutationObservers } = setupObservers();

		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		attachScrollableMetrics(el);

		// Trigger a scroll so the lerp runs and finishes.
		act(() => {
			el.scrollHeight = 1100;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
			mutationObservers[0]?.trigger();
		});
		advanceLerpToTarget(el, 700);
		expect(el.scrollTop).toBe(700);

		// Advance past the cooldown window.
		advancePastCooldown();

		// User scrolls up far from the bottom.
		act(() => {
			el.scrollTop = 100;
			el.dispatchEvent(new Event("scroll"));
		});

		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(false);

		// New content arrives — should NOT auto-scroll since user detached.
		act(() => {
			el.scrollHeight = 1500;
			mutationObservers[0]?.trigger();
		});
		advanceLerpToTarget(el, 1100);

		expect(el.scrollTop).toBe(100);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("disengages immediately when the user wheels upward during active auto-scroll", () => {
		vi.useFakeTimers();
		const { mutationObservers } = setupObservers();

		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		attachScrollableMetrics(el);

		act(() => {
			el.scrollHeight = 1800;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
			mutationObservers[0]?.trigger();
		});

		advanceFrame();
		const scrollTopBeforeWheel = el.scrollTop;
		expect(scrollTopBeforeWheel).toBeGreaterThan(600);

		act(() => {
			el.dispatchEvent(
				new WheelEvent("wheel", {
					deltaY: -120,
				}),
			);
		});

		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(false);

		act(() => {
			el.scrollHeight = 2200;
			mutationObservers[0]?.trigger();
		});
		advanceLerpToTarget(el, 1800);

		expect(el.scrollTop).toBe(scrollTopBeforeWheel);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("scrollToBottom re-pins and honors the configured behavior", () => {
		// No fake timers — we only need to verify the imperative call.
		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(
				(callback: ResizeObserverCallback) => new ResizeObserverMock(callback),
			),
		);
		vi.stubGlobal(
			"MutationObserver",
			vi.fn((callback: MutationCallback) => new MutationObserverMock(callback)),
		);

		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[]} behavior="smooth" onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		const { scrollTo } = attachScrollableMetrics(el, { scrollTop: 200 });

		// Dispatch a scroll event so the handler detects we're NOT at bottom.
		act(() => {
			el.dispatchEvent(new Event("scroll"));
		});
		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(false);

		// Call scrollToBottom — should re-pin.
		const api = onRender.mock.lastCall?.[0];
		act(() => {
			api.scrollToBottom();
		});

		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(true);
		expect(scrollTo).toHaveBeenCalledWith({
			top: 1000,
			behavior: "smooth",
		});

		vi.unstubAllGlobals();
	});

	it("stays pinned when content keeps growing across frames", () => {
		vi.useFakeTimers();
		const { mutationObservers } = setupObservers();

		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		attachScrollableMetrics(el);

		act(() => {
			el.scrollHeight = 1100;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
			mutationObservers[0]?.trigger();
		});
		advanceLerpToTarget(el, 700);
		expect(el.scrollTop).toBe(700);

		act(() => {
			el.scrollHeight = 1400;
			mutationObservers[0]?.trigger();
		});
		advanceLerpToTarget(el, 1000);

		expect(el.scrollTop).toBe(1000);
		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(true);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("never calls scrollTo during streaming (no smooth-scroll flicker)", () => {
		vi.useFakeTimers();
		const { mutationObservers } = setupObservers();

		const onRender = vi.fn();
		const view = render(
			<HookHarness
				deps={[[{ id: 1 }]]}
				behavior="smooth"
				onRender={onRender}
			/>,
		);
		const el = view.container.firstElementChild as HTMLDivElement;
		const { scrollTo } = attachScrollableMetrics(el);

		for (let height = 1100; height <= 1500; height += 100) {
			act(() => {
				el.scrollHeight = height;
				mutationObservers[0]?.trigger();
			});
			advanceLerpToTarget(el, height - 400);
		}

		// scheduleScroll uses scrollTop directly — scrollTo is reserved
		// for the explicit scrollToBottom() call only.
		expect(scrollTo).not.toHaveBeenCalled();

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
});
