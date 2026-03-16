import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function Navigation() {
	return (
		<nav className="border-b border-neutral-800 bg-neutral-900">
			<div className="mx-auto max-w-2xl px-4 py-3">
				<div className="flex items-center gap-4">
					<span className="text-sm font-semibold text-neutral-400">Chat:</span>
					<div className="flex gap-3">
						<Link
							to="/"
							activeProps={{ className: "text-white" }}
							inactiveProps={{
								className: "text-neutral-500 hover:text-neutral-300",
							}}
							className="text-sm font-medium transition-colors"
						>
							OpenAI Agents
						</Link>
						<Link
							to="/chat-agno"
							activeProps={{ className: "text-white" }}
							inactiveProps={{
								className: "text-neutral-500 hover:text-neutral-300",
							}}
							className="text-sm font-medium transition-colors"
						>
							Agno
						</Link>
					</div>
				</div>
			</div>
		</nav>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="bg-neutral-950 text-neutral-100 flex flex-col h-screen">
				<Navigation />
				<main className="flex-1 flex flex-col overflow-hidden">{children}</main>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
