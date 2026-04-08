import { isTableSeparator } from "../blocks.js";

export function stripTrailingUnterminatedTableLine(
	raw: string,
): { safe: string; trailing: string } | null {
	const lines = raw.split("\n");
	if (lines.length === 0) return null;

	const trailing = lines[lines.length - 1];
	if (trailing.length === 0) return null;

	const safeLines = lines.slice(0, -1);
	if (safeLines.length === 0) {
		return {
			safe: "",
			trailing,
		};
	}

	const safe = safeLines.join("\n");
	const stillLooksLikeTable =
		safeLines.length >= 2 && safeLines.some((line) => isTableSeparator(line));

	if (!stillLooksLikeTable) {
		return {
			safe: "",
			trailing: raw,
		};
	}

	return {
		safe,
		trailing,
	};
}

export function hasCommittedTableBodyRow(raw: string): boolean {
	const lines = raw.split("\n").filter((line) => line.trim().length > 0);
	const separatorIndex = lines.findIndex((line) => isTableSeparator(line));
	if (separatorIndex === -1) return false;
	return lines.slice(separatorIndex + 1).some((line) => line.trim().length > 0);
}
