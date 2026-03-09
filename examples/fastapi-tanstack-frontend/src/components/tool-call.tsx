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

	return <p className="my-1 text-xs text-blue-400">{label}</p>;
}
