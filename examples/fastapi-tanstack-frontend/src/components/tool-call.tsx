import { Terminal } from "lucide-react";

interface ToolCallProps {
	argument: string;
	result?: string;
}

export function ToolCall({ argument, result }: ToolCallProps) {
	let label: string | undefined;
	let toolName: string | undefined;
	try {
		const parsed = JSON.parse(argument);
		label = parsed.label;
		toolName = parsed.name || parsed.tool;
	} catch {
		// ignore
	}

	// If no label but we have the raw argument, show a truncated version
	const displayLabel = label || toolName || "Tool Call";

	return (
		<div className="my-2">
			<div className="flex items-center gap-1.5 text-sm font-medium bg-gradient-to-b from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
				<Terminal className="h-3 w-3 text-indigo-500" />
				<span>{displayLabel}</span>
			</div>
			{result && (
				<div className="mt-1 rounded bg-neutral-800/50 p-2 text-xs text-neutral-400">
					<span className="text-neutral-500">Result:</span>
					<pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono">
						{result.length > 200 ? `${result.slice(0, 200)}...` : result}
					</pre>
				</div>
			)}
		</div>
	);
}
