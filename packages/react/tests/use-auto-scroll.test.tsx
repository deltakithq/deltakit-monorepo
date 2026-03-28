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

function createContainer({
	scrollHeight = 1000,
	clientHeight = 400,
	scrollTop = 600,
}: {
	scrollHeight?: number;
	clientHeight?: number;
	scrollTop?: number;
} = {}) {
	const el = document.createElement("div");
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

	return { el, scrollTo };
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

describe("useAutoScroll", () => {
	it("keeps a pinned container at the bottom with instant frame updates", () => {
		vi.useFakeTimers();

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

		const container = createContainer();
		const onRender = vi.fn();
		const view = render(
			<HookHarness
				deps={[[{ id: 1 }]]}
				behavior="smooth"
				onRender={onRender}
			/>,
		);
		const el = view.container.firstElementChild as HTMLDivElement | null;
		if (!el) throw new Error("Expected rendered div");
		const { scrollTo } = attachScrollableMetrics(el, {
			scrollHeight: container.el.scrollHeight,
			clientHeight: container.el.clientHeight,
			scrollTop: container.el.scrollTop,
		});

		act(() => {
			el.scrollHeight = 1100;
			view.rerender(
				<HookHarness
					deps={[[{ id: 1 }, { id: 2 }]]}
					behavior="smooth"
					onRender={onRender}
				/>,
			);
			mutationObservers[0]?.trigger();
			el.scrollHeight = 1200;
			mutationObservers[0]?.trigger();
		});
		advanceFrame();
		expect(el.scrollTop).toBe(1200);

		act(() => {
			el.scrollHeight = 1300;
			resizeObservers[0]?.trigger();
		});
		advanceFrame();

		expect(el.scrollTop).toBe(1300);
		expect(scrollTo).toHaveBeenCalledWith({ top: 1300, behavior: "smooth" });
		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(true);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("does not auto-scroll when the user has detached from the bottom", () => {
		vi.useFakeTimers();

		const mutationObservers: MutationObserverMock[] = [];

		vi.stubGlobal(
			"ResizeObserver",
			vi.fn(() => new ResizeObserverMock()),
		);
		vi.stubGlobal(
			"MutationObserver",
			vi.fn((callback: MutationCallback) => {
				const instance = new MutationObserverMock(callback);
				mutationObservers.push(instance);
				return instance;
			}),
		);

		const container = createContainer({ scrollTop: 200 });
		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement | null;
		if (!el) throw new Error("Expected rendered div");
		const { scrollTo } = attachScrollableMetrics(el, {
			scrollHeight: container.el.scrollHeight,
			clientHeight: container.el.clientHeight,
			scrollTop: container.el.scrollTop,
		});

		act(() => {
			el.dispatchEvent(new Event("scroll"));
		});

		act(() => {
			el.scrollHeight = 1200;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
			mutationObservers[0]?.trigger();
		});
		advanceFrame();

		act(() => {
			el.scrollHeight = 1400;
		});
		advanceFrame();

		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(false);
		expect(el.scrollTop).toBe(200);
		expect(scrollTo).not.toHaveBeenCalled();

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("scrollToBottom re-pins and honors the configured behavior", () => {
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

		const container = createContainer({ scrollTop: 200 });
		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[]} behavior="smooth" onRender={onRender} />,
		);
		const api = onRender.mock.lastCall?.[0];
		const el = view.container.firstElementChild as HTMLDivElement | null;
		if (!api || !el) throw new Error("Hook result not captured");
		const { scrollTo } = attachScrollableMetrics(el, {
			scrollHeight: container.el.scrollHeight,
			clientHeight: container.el.clientHeight,
			scrollTop: container.el.scrollTop,
		});

		act(() => {
			el.dispatchEvent(new Event("scroll"));
		});

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

	it("stays pinned across consecutive frames when content keeps growing", () => {
		vi.useFakeTimers();

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

		const container = createContainer();
		const onRender = vi.fn();
		const view = render(
			<HookHarness deps={[[{ id: 1 }]]} onRender={onRender} />,
		);
		const el = view.container.firstElementChild as HTMLDivElement | null;
		if (!el) throw new Error("Expected rendered div");
		const { scrollTo } = attachScrollableMetrics(el, {
			scrollHeight: container.el.scrollHeight,
			clientHeight: container.el.clientHeight,
			scrollTop: container.el.scrollTop,
		});

		act(() => {
			el.scrollHeight = 1100;
			view.rerender(
				<HookHarness deps={[[{ id: 1 }, { id: 2 }]]} onRender={onRender} />,
			);
		});
		advanceFrame();
		expect(el.scrollTop).toBe(1100);

		act(() => {
			el.scrollHeight = 1400;
		});
		advanceFrame();

		expect(el.scrollTop).toBe(1400);
		expect(scrollTo).toHaveBeenCalledWith({ top: 1400, behavior: "smooth" });
		expect(onRender.mock.lastCall?.[0].isAtBottom).toBe(true);

		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
});
