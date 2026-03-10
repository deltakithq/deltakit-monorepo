import { createFileRoute, Link } from "@tanstack/react-router";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import {
	ArrowRight,
	MessageSquare,
	Puzzle,
	Radio,
	ShieldCheck,
	Wrench,
	Zap,
} from "lucide-react";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
	component: HomePage,
});

const features = [
	{
		icon: Radio,
		title: "Real-time SSE Streaming",
		description:
			"Stream AI responses token-by-token over Server-Sent Events. Messages update in real-time with automatic state management.",
	},
	{
		icon: Wrench,
		title: "Tool Call Rendering",
		description:
			"Built-in support for rendering server-side tool calls. Handle function calling with loading states and results out of the box.",
	},
	{
		icon: Puzzle,
		title: "Custom Content Parts",
		description:
			"Extend beyond text with custom part types — images, citations, status indicators. Full TypeScript generics keep everything typed.",
	},
	{
		icon: ShieldCheck,
		title: "Type-Safe Event Handling",
		description:
			"Custom onEvent callback with full TypeScript support. EventHelpers API for appendText, appendPart, and direct state access.",
	},
	{
		icon: MessageSquare,
		title: "Message Management",
		description:
			"Clear, edit, resend, or programmatically insert messages. Full control over conversation state with setMessages.",
	},
	{
		icon: Zap,
		title: "Zero Config Defaults",
		description:
			"Works immediately with text streaming out of the box. Add authentication, custom headers, and initial messages as needed.",
	},
];

const codeExample = `import { useStreamChat } from "@deltakit/react";

function Chat() {
  const { messages, sendMessage, isLoading, stop } = useStreamChat({
    api: "/api/chat",
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.parts.map((part, i) =>
            part.type === "text" ? <p key={i}>{part.text}</p> : null
          )}
        </div>
      ))}
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter") sendMessage(e.currentTarget.value);
        }}
      />
      {isLoading && <button onClick={stop}>Stop</button>}
    </div>
  );
}`;

function HomePage() {
	return (
		<HomeLayout {...baseOptions()}>
			{/* Hero */}
			<section className="flex flex-col items-center px-4 pt-20 pb-16 text-center">
				<div className="flex flex-col items-center gap-6 max-w-3xl">
					<img src="/deltakit.png" alt="DeltaKit" width={56} height={56} />
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-fd-foreground">
						Build AI Chat Interfaces
						<br />
						<span className="text-fd-muted-foreground">with Streaming SSE</span>
					</h1>
					<p className="text-lg text-fd-muted-foreground max-w-xl">
						A lightweight React toolkit for real-time AI chat. Stream responses
						over Server-Sent Events from any backend framework.
					</p>
					<div className="flex gap-3 mt-2">
						<Link
							to="/docs/react"
							className="inline-flex items-center gap-2 rounded-md bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
						>
							Get Started
							<ArrowRight className="size-4" />
						</Link>
						<Link
							to="/docs/core/custom-events"
							className="inline-flex items-center gap-2 rounded-md border border-fd-border px-6 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
						>
							Core Library
						</Link>
					</div>
				</div>
			</section>

			{/* @deltakit/react highlight */}
			<section className="px-4 py-16 border-t border-fd-border">
				<div className="mx-auto max-w-4xl">
					<div className="flex flex-col items-center text-center gap-4 mb-12">
						<span className="inline-flex items-center rounded-full border border-fd-border bg-fd-secondary px-3 py-1 text-xs font-medium text-fd-secondary-foreground">
							@deltakit/react
						</span>
						<h2 className="text-3xl font-bold tracking-tight text-fd-foreground">
							One hook. Complete streaming chat.
						</h2>
						<p className="text-fd-muted-foreground max-w-xl">
							<code className="rounded bg-fd-secondary px-1.5 py-0.5 text-sm font-mono text-fd-secondary-foreground">
								useStreamChat
							</code>{" "}
							manages messages, network requests, SSE parsing, cancellation, and
							real-time state updates — so you can focus on your UI.
						</p>
					</div>

					{/* Code preview */}
					<DynamicCodeBlock
						lang="tsx"
						code={codeExample}
						codeblock={{ title: "chat.tsx" }}
					/>

					{/* Returns */}
					<div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
						{[
							{
								name: "messages",
								desc: "Live-updating conversation",
							},
							{
								name: "sendMessage",
								desc: "Send and stream",
							},
							{
								name: "isLoading",
								desc: "Stream status",
							},
							{
								name: "stop",
								desc: "Cancel in-flight",
							},
						].map((item) => (
							<div
								key={item.name}
								className="rounded-lg border border-fd-border p-3"
							>
								<code className="text-sm font-mono font-medium text-fd-foreground">
									{item.name}
								</code>
								<p className="text-xs text-fd-muted-foreground mt-1">
									{item.desc}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Features grid */}
			<section className="px-4 py-16 border-t border-fd-border">
				<div className="mx-auto max-w-4xl">
					<div className="flex flex-col items-center text-center gap-4 mb-12">
						<h2 className="text-3xl font-bold tracking-tight text-fd-foreground">
							Everything you need
						</h2>
						<p className="text-fd-muted-foreground max-w-lg">
							From basic text streaming to custom tool calls and typed event
							handling — all with a minimal API surface.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="group rounded-lg border border-fd-border p-5 transition-colors hover:bg-fd-accent/50"
							>
								<feature.icon className="size-5 text-fd-muted-foreground mb-3" />
								<h3 className="text-sm font-semibold text-fd-foreground mb-1.5">
									{feature.title}
								</h3>
								<p className="text-sm text-fd-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Install CTA */}
			<section className="px-4 py-16 border-t border-fd-border">
				<div className="mx-auto max-w-xl flex flex-col items-center text-center gap-6">
					<h2 className="text-2xl font-bold tracking-tight text-fd-foreground">
						Get started in seconds
					</h2>
					<DynamicCodeBlock
						lang="bash"
						code="npm install @deltakit/react"
						codeblock={{ title: "Terminal" }}
					/>
					<Link
						to="/docs/react/quick-start"
						className="inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline"
					>
						Follow the Quick Start guide
						<ArrowRight className="size-4" />
					</Link>
				</div>
			</section>
		</HomeLayout>
	);
}
