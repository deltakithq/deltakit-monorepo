import type { RefObject } from "react";

export interface UseAutoScrollOptions {
	behavior?: ScrollBehavior;
	enabled?: boolean;
	threshold?: number;
}

export interface UseAutoScrollReturn<T extends HTMLElement = HTMLDivElement> {
	ref: RefObject<T | null>;
	scrollToBottom: () => void;
	isAtBottom: boolean;
}
