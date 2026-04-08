import type { ContentPart, SSEEvent } from "@deltakit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	createChatTransportContext,
	createMessage,
} from "../internal/chat-controller";
import { resolveTransport } from "../internal/transports";
import type {
	ChatTransportRun,
	EventHelpers,
	StreamStatus,
	StreamStatusContext,
	UseStreamChatOptions,
	UseStreamChatReturn,
} from "../types";
import {
	appendPartToMessages,
	appendTextToMessages,
	defaultOnEvent,
	getCandidateRunId,
} from "./use-stream-chat/index";

// ---------------------------------------------------------------------------
// useStreamChat
// ---------------------------------------------------------------------------

export function useStreamChat<
	TPart extends { type: string } = ContentPart,
	TEvent extends { type: string } = SSEEvent,
>(options: UseStreamChatOptions<TPart, TEvent>): UseStreamChatReturn<TPart> {
	const {
		initialMessages,
		onEvent,
		onMessage,
		onError,
		onFinish,
		onStatusChange,
	} = options;

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

	const runIdRef = useRef(runId);
	runIdRef.current = runId;

	// Keep transport options in a ref so that callbacks always read the
	// latest values without causing memoisation instability.
	const transportOptionsRef = useRef(options.transportOptions);
	transportOptionsRef.current = options.transportOptions;

	const appendText = useCallback((delta: string) => {
		setMessages((prev) => appendTextToMessages(prev, delta));
	}, []);

	const appendPart = useCallback((part: TPart) => {
		setMessages((prev) => appendPartToMessages(prev, part));
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

	const onStatusChangeRef = useRef(onStatusChange);
	onStatusChangeRef.current = onStatusChange;

	const setRunIdWithSideEffects = useCallback((next: string | null) => {
		runIdRef.current = next;
		setRunId(next);
		transportOptionsRef.current?.backgroundSSE?.onRunIdChange?.(next);
		transportOptionsRef.current?.websocket?.onRunIdChange?.(next);
	}, []);

	const emitStatus = useCallback(
		(
			status: StreamStatus,
			overrides?: Partial<StreamStatusContext<TPart>>,
		): void => {
			onStatusChangeRef.current?.(status, {
				messages: overrides?.messages ?? messagesRef.current,
				runId: overrides?.runId ?? runIdRef.current,
				...(overrides?.error ? { error: overrides.error } : {}),
				...(overrides?.reason ? { reason: overrides.reason } : {}),
			});
		},
		[],
	);

	const transportContext = useMemo(
		() =>
			createChatTransportContext({
				appendPart,
				appendText,
				eventHandler: (event: TEvent, helpers: EventHelpers<TPart>) =>
					eventHandlerRef.current(event, helpers),
				getMessages: () => messagesRef.current,
				getRunId: () => runIdRef.current,
				onError: (...args) => onErrorRef.current?.(...args),
				onFinish: (...args) => onFinishRef.current?.(...args),
				onMessage: (...args) => onMessageRef.current?.(...args),
				onStatusChange: (...args) => onStatusChangeRef.current?.(...args),
				setError,
				setIsLoading,
				setMessages,
				setRunId: setRunIdWithSideEffects,
			}),
		[appendPart, appendText, setRunIdWithSideEffects],
	);

	const stop = useCallback(() => {
		const activeRun = runRef.current;
		if (!activeRun?.stop) {
			return;
		}

		const activeRunId = activeRun.runId ?? runIdRef.current;
		manuallyStoppedRef.current = true;
		void activeRun.stop();
		runRef.current = null;
		setIsLoading(false);
		setRunIdWithSideEffects(null);
		emitStatus("stopped", {
			reason: "user",
			runId: activeRunId,
		});
	}, [emitStatus, setRunIdWithSideEffects]);

	const sendMessage = useCallback(
		(text: string) => {
			if (runRef.current || isLoading) {
				return;
			}

			const userMessage = createMessage<TPart>("user", [
				{ type: "text", text } as unknown as TPart,
			]);
			const assistantMessage = createMessage<TPart>("assistant", []);
			const nextMessages = [
				...messagesRef.current,
				userMessage,
				assistantMessage,
			];

			messagesRef.current = nextMessages;
			setMessages(nextMessages);

			onMessageRef.current?.(userMessage);
			setError(null);
			setIsLoading(true);
			emitStatus("starting", {
				messages: nextMessages,
				runId: null,
			});

			// Reset the resume guard so a future resume for a new run is allowed.
			resumedRunIdRef.current = null;
			manuallyStoppedRef.current = false;

			const run = transport.start({ context: transportContext, message: text });
			runRef.current = run ?? null;
			if (run?.runId) {
				setRunIdWithSideEffects(run.runId);
			}
		},
		[
			emitStatus,
			isLoading,
			setRunIdWithSideEffects,
			transport,
			transportContext,
		],
	);

	// -----------------------------------------------------------------------
	// Auto-resume effect: attempt to reconnect to an in-flight run on mount.
	//
	// The candidate run id is read from transport options (which may change
	// when the app updates state). We guard against duplicate resumes for the
	// same run id using `resumedRunIdRef`.
	// -----------------------------------------------------------------------

	const candidateRunId = getCandidateRunId(options);

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
		emitStatus("resuming", { runId: candidateRunId });
		const run = transport.resume({
			context: transportContext,
			runId: candidateRunId,
		});
		runRef.current = run ?? null;
		setRunIdWithSideEffects(candidateRunId);
	}, [
		candidateRunId,
		emitStatus,
		setRunIdWithSideEffects,
		transport,
		transportContext,
	]);

	useEffect(() => {
		return () => {
			if (runRef.current) {
				emitStatus("stopped", {
					reason: "unmount",
					runId: runIdRef.current,
				});
			}
			void runRef.current?.close?.();
			runRef.current = null;
		};
	}, [emitStatus]);

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
