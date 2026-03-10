import { createFileRoute, Link } from "@tanstack/react-router";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import {
	ArrowRight,
	Brush,
	Cpu,
	Puzzle,
	Radio,
	ShieldCheck,
	Sparkles,
	Wrench,
	Zap,
} from "lucide-react";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
	component: HomePage,
});

// --- Packages ---

const packages = [
	{
		name: "@deltakit/react",
		headline: "Stream",
		description:
			"One hook to manage messages, SSE parsing, cancellation, and real-time state updates.",
		code: `const { messages, sendMessage, isLoading, stop } = useStreamChat({
  api: "/api/chat",
});`,
		docsUrl: "/docs/react" as const,
	},
	{
		name: "@deltakit/markdown",
		headline: "Render",
		description:
			"Incremental markdown renderer. Tokens are appended character-by-character — zero flicker, zero re-parsing.",
		code: `<StreamingMarkdown content={text} />`,
		docsUrl: "/docs/markdown" as const,
	},
];

// --- Features ---

const features = [
	{
		icon: Radio,
		title: "Real-time SSE Streaming",
		description:
			"Stream AI responses token-by-token over Server-Sent Events with automatic state management.",
		package: "react",
	},
	{
		icon: Sparkles,
		title: "Zero-Flicker Rendering",
		description:
			"Tokens are appended incrementally without reparsing. No layout jumps, no re-renders.",
		package: "markdown",
	},
	{
		icon: Wrench,
		title: "Tool Call Rendering",
		description:
			"Built-in support for server-side tool calls with loading states and results out of the box.",
		package: "react",
	},
	{
		icon: Cpu,
		title: "Incremental State Machine",
		description:
			"A character-level parser that only processes new input. No diffing, no virtual DOM overhead.",
		package: "markdown",
	},
	{
		icon: ShieldCheck,
		title: "Type-Safe Events",
		description:
			"Custom onEvent callback with full TypeScript support and EventHelpers API.",
		package: "react",
	},
	{
		icon: Brush,
		title: "Custom Components",
		description:
			"Replace any rendered element — headings, code blocks, links — with your own React components.",
		package: "markdown",
	},
	{
		icon: Puzzle,
		title: "Custom Content Parts",
		description:
			"Extend beyond text with custom part types — images, citations, status indicators.",
		package: "react",
	},
	{
		icon: Zap,
		title: "Zero Config Defaults",
		description:
			"Both packages work immediately out of the box. Add customization as needed.",
		package: "both",
	},
];

// --- Component ---

function HomePage() {
	return (
		<HomeLayout {...baseOptions()}>
			{/* Hero */}
			<section className="flex flex-col items-center px-4 pt-20 pb-16 text-center">
				<div className="flex flex-col items-center gap-6 max-w-3xl">
					<img src="/deltakit.png" alt="DeltaKit" width={56} height={56} />
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-fd-foreground">
						The React Toolkit
						<br />
						<span className="text-fd-muted-foreground">for AI Chat</span>
					</h1>
					<p className="text-lg text-fd-muted-foreground max-w-xl">
						Streaming hooks. Streaming markdown. Zero flicker. A lightweight
						toolkit to build real-time AI chat interfaces from any backend.
					</p>
					<div className="flex gap-3 mt-2">
						<Link
							to="/docs/react"
							className="inline-flex items-center gap-2 rounded-md bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
						>
							Get Started
							<ArrowRight className="size-4" />
						</Link>
						<a
							href="https://github.com/deltakithq/deltakit-monorepo"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 rounded-md border border-fd-border px-6 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
						>
							View on GitHub
						</a>
					</div>
				</div>
			</section>

			{/* Two packages — pipeline */}
			<section className="px-4 py-16 border-t border-fd-border">
				<div className="mx-auto max-w-3xl">
					<div className="flex flex-col items-center text-center gap-4 mb-14">
						<h2 className="text-3xl font-bold tracking-tight text-fd-foreground">
							Two packages. One pipeline.
						</h2>
						<p className="text-fd-muted-foreground max-w-lg">
							Stream data with{" "}
							<code className="rounded bg-fd-secondary px-1.5 py-0.5 text-xs font-mono text-fd-secondary-foreground">
								@deltakit/react
							</code>
							, render it with{" "}
							<code className="rounded bg-fd-secondary px-1.5 py-0.5 text-xs font-mono text-fd-secondary-foreground">
								@deltakit/markdown
							</code>
							.
						</p>
					</div>

					<div className="flex flex-col gap-0">
						{packages.map((pkg, i) => (
							<div key={pkg.name} className="relative flex flex-col">
								{/* Step connector */}
								{i > 0 && (
									<div className="flex items-center justify-center py-4">
										<div className="h-8 w-px bg-fd-border" />
									</div>
								)}

								{/* Step content */}
								<div className="group flex items-start gap-6">
									{/* Step number */}
									<div className="flex flex-col items-center shrink-0">
										<div className="flex items-center justify-center size-10 rounded-full border border-fd-border text-sm font-bold text-fd-foreground bg-fd-secondary">
											{i + 1}
										</div>
									</div>

									{/* Detail */}
									<div className="flex-1 pb-2">
										<div className="flex items-center gap-3 mb-1">
											<span className="text-lg font-bold text-fd-foreground">
												{pkg.headline}
											</span>
											<span className="text-xs font-medium text-fd-muted-foreground rounded-full border border-fd-border bg-fd-secondary px-2.5 py-0.5">
												{pkg.name}
											</span>
										</div>
										<p className="text-sm text-fd-muted-foreground leading-relaxed mb-3">
											{pkg.description}
										</p>
										<DynamicCodeBlock lang="tsx" code={pkg.code} />
										<Link
											to={pkg.docsUrl}
											className="inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary hover:underline mt-3"
										>
											Docs
											<ArrowRight className="size-3" />
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Features grid */}
			<section className="px-4 py-16 border-t border-fd-border">
				<div className="mx-auto max-w-5xl">
					<div className="flex flex-col items-center text-center gap-4 mb-12">
						<h2 className="text-3xl font-bold tracking-tight text-fd-foreground">
							Everything you need
						</h2>
						<p className="text-fd-muted-foreground max-w-lg">
							From basic text streaming to custom tool calls, typed event
							handling, and flicker-free markdown — all with a minimal API
							surface.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="group rounded-lg border border-fd-border p-5 transition-colors hover:bg-fd-accent/50"
							>
								<div className="flex items-center justify-between mb-3">
									<feature.icon className="size-5 text-fd-muted-foreground" />
									<span className="text-[10px] font-medium text-fd-muted-foreground rounded-full border border-fd-border px-2 py-0.5">
										{feature.package === "both"
											? "react + markdown"
											: feature.package}
									</span>
								</div>
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
					<div className="w-full">
						<DynamicCodeBlock
							lang="bash"
							code="npm install @deltakit/react @deltakit/markdown"
							codeblock={{ title: "Terminal" }}
						/>
					</div>
					<div className="flex flex-col sm:flex-row gap-4">
						<Link
							to="/docs/react/quick-start"
							className="inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline"
						>
							@deltakit/react Quick Start
							<ArrowRight className="size-3.5" />
						</Link>
						<Link
							to="/docs/markdown/quick-start"
							className="inline-flex items-center gap-2 text-sm font-medium text-fd-primary hover:underline"
						>
							@deltakit/markdown Quick Start
							<ArrowRight className="size-3.5" />
						</Link>
					</div>
				</div>
			</section>
		</HomeLayout>
	);
}
