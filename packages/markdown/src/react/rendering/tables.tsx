import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { isTableSeparator, parseTableRow } from "../../core/blocks.js";
import { parseInline } from "../../core/inline.js";
import type { Block, ComponentOverrides } from "../../core/types.js";
import { renderInlineTokens } from "./inline.js";

export function renderTable(
	block: Block,
	components: Required<ComponentOverrides>,
): ReactNode {
	const lines = block.raw.split("\n").filter((l) => l.trim().length > 0);
	const separatorIndex = lines.findIndex((line) => isTableSeparator(line));

	if (separatorIndex === -1) {
		return components.p({ children: block.raw });
	}

	if (lines.length === 0) {
		return components.table({ children: null });
	}

	const rows: ReactNode[] = [];
	let headerDone = false;
	let rowIdx = 0;

	for (const line of lines) {
		if (isTableSeparator(line)) {
			headerDone = true;
			continue;
		}

		const cells = parseTableRow(line);
		const isHeader = !headerDone;

		const cellNodes = cells.map((cell, cellIdx) => {
			const inlineNodes = renderInlineTokens(parseInline(cell), components);
			const CellComponent = isHeader ? components.th : components.td;
			return createElement(
				Fragment,
				{ key: `cell-${cellIdx}` },
				CellComponent({ children: inlineNodes }),
			);
		});

		rows.push(
			createElement(
				Fragment,
				{ key: `row-${rowIdx}` },
				components.tr({ children: cellNodes }),
			),
		);

		if (isHeader) {
			rows.push(
				createElement(
					Fragment,
					{ key: "thead" },
					components.thead({ children: rows.splice(0) }),
				),
			);
		}

		rowIdx++;
	}

	const headerRows = rows.filter((_, i) => i === 0);
	const bodyRows = rows.filter((_, i) => i > 0);

	const tableChildren: ReactNode[] = [...headerRows];
	if (bodyRows.length > 0) {
		tableChildren.push(
			createElement(
				Fragment,
				{ key: "tbody" },
				components.tbody({ children: bodyRows }),
			),
		);
	}

	return components.table({ children: tableChildren });
}
