import { Terminal } from "lucide-react";

interface ToolCallProps {
	argument: string;
}

export function ToolCall({ argument }: ToolCallProps) {
	let label: string | undefined;
	try {
		const parsed = JSON.parse(argument);
		label = parsed.label;
	} catch {
		// ignore
	}

	if (!label) return null;

	return (
		<div className="my-2 flex items-center gap-1.5 text-sm font-medium bg-gradient-to-b from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
			<Terminal className="h-3 w-3 text-indigo-500" />
			<span>{label}</span>
		</div>
	);
}
