import type { ReactNode } from "react";
import { createElement, useEffect, useState } from "react";
import type { ComponentOverrides } from "../../core/types.js";

type ImageLoadState = "loading" | "ready" | "error";

const imageLoadCache = new Map<string, ImageLoadState>();
const imageLoadPromises = new Map<string, Promise<ImageLoadState>>();

function getInitialImageState(src: string): ImageLoadState {
	if (!src) return "error";
	return imageLoadCache.get(src) ?? "loading";
}

function preloadImage(src: string): Promise<ImageLoadState> {
	if (!src) return Promise.resolve("error");

	const cached = imageLoadCache.get(src);
	if (cached === "ready" || cached === "error") {
		return Promise.resolve(cached);
	}

	const inFlight = imageLoadPromises.get(src);
	if (inFlight) {
		return inFlight;
	}

	const promise = new Promise<ImageLoadState>((resolve) => {
		if (typeof Image === "undefined") {
			imageLoadCache.set(src, "ready");
			imageLoadPromises.delete(src);
			resolve("ready");
			return;
		}

		const img = new Image();
		img.onload = () => {
			imageLoadCache.set(src, "ready");
			imageLoadPromises.delete(src);
			resolve("ready");
		};
		img.onerror = () => {
			imageLoadCache.set(src, "error");
			imageLoadPromises.delete(src);
			resolve("error");
		};
		img.src = src;
	});

	imageLoadPromises.set(src, promise);
	return promise;
}

export function BufferedImageToken({
	src,
	alt,
	components,
}: {
	src: string;
	alt: string;
	components: Required<ComponentOverrides>;
}): ReactNode {
	const [state, setState] = useState<ImageLoadState>(() =>
		getInitialImageState(src),
	);

	useEffect(() => {
		const initial = getInitialImageState(src);
		setState(initial);

		if (initial !== "loading") {
			return;
		}

		let cancelled = false;
		preloadImage(src).then((result) => {
			if (!cancelled) {
				setState(result);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [src]);

	if (state === "ready") {
		return components.img({ src, alt });
	}

	if (state === "error") {
		const fallbackText = alt
			? `Image unavailable: ${alt}`
			: "Image unavailable";
		return createElement(
			"span",
			{
				className: "streaming-markdown-image-fallback",
				role: "img",
				"aria-label": alt || "image unavailable",
			},
			fallbackText,
		);
	}

	return createElement("span", {
		className: "streaming-markdown-image-skeleton",
		"aria-hidden": "true",
	});
}
