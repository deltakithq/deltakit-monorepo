import type { ContentPart, SSEEvent } from "@deltakit/core";
import type { EventHelpers } from "../../types";

export function defaultOnEvent(
	event: SSEEvent,
	helpers: EventHelpers<ContentPart>,
): void {
	if (event.type === "text_delta") {
		helpers.appendText(event.delta);
	}
}
