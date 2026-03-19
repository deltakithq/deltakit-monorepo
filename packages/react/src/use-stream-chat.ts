import type { ContentPart, SSEEvent } from "@deltakit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createChatTransportContext, createMessage } from "./chat-controller";
import { resolveTransport } from "./transports";
import type {
	ChatTransportRun,
	EventHelpers,
	UseStreamChatOptions,
	UseStreamChatReturn,
} from "./types";

// ---------------------------------------------------------------------------
// Default event handler — accumulates `text_delta` into the last
// assistant message's parts.
// ---------------------------------------------------------------------------

function defaultOnEvent(
	event: SSEEvent,
	helpers: EventHelpers<ContentPart>,
): void {
	if (event.type === "text_delta") {
		helpers.appendText(event.delta);
	}
	// Other event types (e.g. tool_call) are silently ignored by default.
	// Users can provide their own `onEvent` to handle them.
}

// ---------------------------------------------------------------------------
// useStreamChat
// ---------------------------------------------------------------------------

export function useStreamChat<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(options: UseStreamChatOptions<TPart, TEvent>): UseStreamChatReturn<TPart> {
	const { initialMessages, onEvent, onMessage, onError, onFinish } = options;

	const [messages, setMessages] = useState(initialMessages ?? []);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [runId, setRunId] = useState<string | null>(null);

	const runRef = useRef<ChatTransportRun | null>(null);

	// Track which run id has already been resumed to prevent re-triggering.
	const resumedRunIdRef = useRef<string | null>(null);

	// When the user manually stops a run, suppress auto-resume until the
	// next explicit `sendMessage` call.
	const manuallyStoppedRef = useRef(false);

	// We use a ref for the latest messages so callbacks created inside
	// transport handlers always see the current value without re-creating
	// closures.
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	// Keep transport options in a ref so that callbacks always read the
	// latest values without causing memoisation instability.
	const transportOptionsRef = useRef(options.transportOptions);
	transportOptionsRef.current = options.transportOptions;

	const appendText = useCallback((delta: string) => {
		setMessages((prev) => {
			const last = prev[prev.length - 1];
			if (!last || last.role !== "assistant") return prev;

			const parts = [...last.parts];
			const lastPart = parts[parts.length - 1];

			if (lastPart && lastPart.type === "text" && "text" in lastPart) {
				const textPart = lastPart as { type: "text"; text: string };
				parts[parts.length - 1] = {
					...lastPart,
					text: textPart.text + delta,
				} as unknown as TPart;
			} else {
				parts.push({ type: "text", text: delta } as unknown as TPart);
			}

			return [...prev.slice(0, -1), { ...last, parts }];
		});
	}, []);

	const appendPart = useCallback((part: TPart) => {
		setMessages((prev) => {
			const last = prev[prev.length - 1];
			if (!last || last.role !== "assistant") return prev;

			return [
				...prev.slice(0, -1),
				{
					...last,
					parts: [...last.parts, part],
				},
			];
		});
	}, []);

	// Stabilise transport creation: resolve once and store in a ref so that
	// changing values like `runId` in transportOptions won't cause a new
	// transport instance (and therefore a new WebSocket) to be created.
	const transportRef = useRef<ReturnType<
		typeof resolveTransport<TPart, TEvent>
	> | null>(null);
	if (!transportRef.current) {
		transportRef.current = resolveTransport(options);
	}
	const transport = transportRef.current;

	const eventHandler =
		onEvent ??
		(defaultOnEvent as unknown as (
			event: TEvent,
			helpers: EventHelpers<TPart>,
		) => void);

	// Stabilise the transport context: use refs for values that change
	// frequently (transportOptions callbacks) so the context object itself
	// stays referentially stable.
	const eventHandlerRef = useRef(eventHandler);
	eventHandlerRef.current = eventHandler;

	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	const onFinishRef = useRef(onFinish);
	onFinishRef.current = onFinish;

	const onMessageRef = useRef(onMessage);
	onMessageRef.current = onMessage;

	const transportContext = useMemo(
		() =>
			createChatTransportContext({
				appendPart,
				appendText,
				eventHandler: (event: TEvent, helpers: EventHelpers<TPart>) =>
					eventHandlerRef.current(event, helpers),
				getMessages: () => messagesRef.current,
				onError: (...args) => onErrorRef.current?.(...args),
				onFinish: (...args) => onFinishRef.current?.(...args),
				onMessage: (...args) => onMessageRef.current?.(...args),
				setError,
				setIsLoading,
				setMessages,
				setRunId: (next) => {
					setRunId(next);
					transportOptionsRef.current?.backgroundSSE?.onRunIdChange?.(next);
					transportOptionsRef.current?.websocket?.onRunIdChange?.(next);
				},
			}),
		[appendPart, appendText],
	);

	const stop = useCallback(() => {
		const activeRun = runRef.current;
		if (!activeRun?.stop) {
			return;
		}

		manuallyStoppedRef.current = true;
		void activeRun.stop();
		runRef.current = null;
		setIsLoading(false);
	}, []);

	const sendMessage = useCallback(
		(text: string) => {
			if (runRef.current || isLoading) {
				return;
			}

			const userMessage = createMessage<TPart>("user", [
				{ type: "text", text } as unknown as TPart,
			]);
			const assistantMessage = createMessage<TPart>("assistant", []);

			setMessages((prev) => {
				const next = [...prev, userMessage, assistantMessage];
				messagesRef.current = next;
				return next;
			});

			onMessage?.(userMessage);
			setError(null);
			setIsLoading(true);

			// Reset the resume guard so a future resume for a new run is allowed.
			resumedRunIdRef.current = null;
			manuallyStoppedRef.current = false;

			const run = transport.start({ context: transportContext, message: text });
			runRef.current = run ?? null;
			if (run?.runId) {
				setRunId(run.runId);
			}
		},
		[isLoading, onMessage, transport, transportContext],
	);

	// -----------------------------------------------------------------------
	// Auto-resume effect: attempt to reconnect to an in-flight run on mount.
	//
	// The candidate run id is read from transport options (which may change
	// when the app updates state). We guard against duplicate resumes for the
	// same run id using `resumedRunIdRef`.
	// -----------------------------------------------------------------------

	const candidateRunId =
		options.transportOptions?.backgroundSSE?.runId ??
		options.transportOptions?.backgroundSSE?.getResumeKey?.() ??
		options.transportOptions?.websocket?.runId ??
		options.transportOptions?.websocket?.getResumeKey?.() ??
		null;

	useEffect(() => {
		// Already have an active run — don't start another.
		if (runRef.current) {
			return;
		}

		if (!candidateRunId) {
			return;
		}

		// User explicitly stopped — don't auto-resume until next sendMessage.
		if (manuallyStoppedRef.current) {
			return;
		}

		// Already resumed this exact run id — don't retry.
		if (resumedRunIdRef.current === candidateRunId) {
			return;
		}

		if (!transport.resume) {
			return;
		}

		resumedRunIdRef.current = candidateRunId;

		setError(null);
		setIsLoading(true);
		const run = transport.resume({
			context: transportContext,
			runId: candidateRunId,
		});
		runRef.current = run ?? null;
		setRunId(candidateRunId);
	}, [candidateRunId, transport, transportContext]);

	useEffect(() => {
		return () => {
			void runRef.current?.close?.();
			runRef.current = null;
		};
	}, []);

	const prevIsLoadingRef = useRef(isLoading);
	useEffect(() => {
		// Only clear the run ref on a true → false transition, not on mount
		// where isLoading starts as false. Clearing on mount would race with
		// the auto-resume effect and null out the run it just created.
		if (prevIsLoadingRef.current && !isLoading) {
			runRef.current = null;
		}
		prevIsLoadingRef.current = isLoading;
	}, [isLoading]);

	return {
		error,
		isLoading,
		messages,
		runId,
		sendMessage,
		setMessages,
		stop,
	};
}
