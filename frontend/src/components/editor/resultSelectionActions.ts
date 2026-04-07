import type { DraftRow } from '../../lib/dataEditing';
import { makeCellId, parseCellId } from './resultPanelUtils';

interface DisplayRowLike {
    key: string;
    kind: 'persisted' | 'draft';
    values: string[];
    persistedIndex?: number | null;
    draft?: { id: string } | null;
}

interface SelectionBounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

function getSelectionBounds(selectedCells: Set<string>, rowOrder: Map<string, number>): SelectionBounds | null {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    selectedCells.forEach((cellId) => {
        const { rowKey, colIdx } = parseCellId(cellId);
        const rowIndex = rowOrder.get(rowKey);
        if (rowIndex === undefined || Number.isNaN(colIdx)) return;
        minRow = Math.min(minRow, rowIndex);
        maxRow = Math.max(maxRow, rowIndex);
        minCol = Math.min(minCol, colIdx);
        maxCol = Math.max(maxCol, colIdx);
    });

    if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) return null;
    return { minRow, maxRow, minCol, maxCol };
}

export function buildSelectionMatrix(params: {
    selectedCells: Set<string>;
    displayRows: DisplayRowLike[];
    rowOrder: Map<string, number>;
    editedCells: Map<string, string>;
}): string[][] {
    const { selectedCells, displayRows, rowOrder, editedCells } = params;
    const bounds = getSelectionBounds(selectedCells, rowOrder);
    if (!bounds) return [];

    const matrix: string[][] = [];
    for (let ri = bounds.minRow; ri <= bounds.maxRow; ri += 1) {
        const displayRow = displayRows[ri];
        if (!displayRow) continue;
        const row: string[] = [];
        for (let ci = bounds.minCol; ci <= bounds.maxCol; ci += 1) {
            const cellId = makeCellId(displayRow.key, ci);
            if (!selectedCells.has(cellId)) {
                row.push('');
                continue;
            }
            row.push(
                displayRow.kind === 'persisted'
                    ? (editedCells.get(`${displayRow.persistedIndex}:${ci}`) ?? displayRow.values[ci] ?? '')
                    : (displayRow.values[ci] ?? ''),
            );
        }
        matrix.push(row);
    }
    return matrix;
}

export function matrixToTsv(matrix: string[][]): string {
    return matrix.map((row) => row.join('\t')).join('\n');
}

function parseClipboardText(text: string): string[][] {
    if (!text) return [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines.map((line) => line.split('\t'));
}

export function applyClipboardPaste(params: {
    text: string;
    selectedCells: Set<string>;
    displayRows: DisplayRowLike[];
    rowOrder: Map<string, number>;
    editedCells: Map<string, string>;
    draftRows: DraftRow[];
    deletedRows: Set<number>;
    columnCount: number;
}): { nextEdited: Map<string, string>; nextDraftRows: DraftRow[]; pastedCells: Set<string> } | null {
    const {
        text,
        selectedCells,
        displayRows,
        rowOrder,
        editedCells,
        draftRows,
        deletedRows,
        columnCount,
    } = params;

    const bounds = getSelectionBounds(selectedCells, rowOrder);
    if (!bounds) return null;

    const matrix = parseClipboardText(text);
    if (matrix.length === 0 || matrix[0].length === 0) return null;

    const nextEdited = new Map(editedCells);
    const nextDraftRows = draftRows.map((draftRow) => ({ ...draftRow, values: [...draftRow.values] }));
    const nextDraftById = new Map(nextDraftRows.map((draftRow) => [draftRow.id, draftRow]));
    const pastedCells = new Set<string>();

    for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
        const displayRow = displayRows[bounds.minRow + rowOffset];
        if (!displayRow) break;
        if (displayRow.kind === 'persisted' && deletedRows.has(displayRow.persistedIndex as number)) continue;

        for (let colOffset = 0; colOffset < matrix[rowOffset].length; colOffset += 1) {
            const colIdx = bounds.minCol + colOffset;
            if (colIdx >= columnCount) break;
            const value = matrix[rowOffset][colOffset];
            const cellId = makeCellId(displayRow.key, colIdx);

            if (displayRow.kind === 'persisted') {
                nextEdited.set(`${displayRow.persistedIndex}:${colIdx}`, value);
            } else {
                const draftId = displayRow.draft?.id;
                const target = draftId ? nextDraftById.get(draftId) : null;
                if (target) {
                    target.values[colIdx] = value;
                }
            }
            pastedCells.add(cellId);
        }
    }

    return { nextEdited, nextDraftRows, pastedCells };
}

function quoteIdent(name: string, driver: string | undefined): string {
    if (driver === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
    if (driver === 'sqlserver') return `[${name.replace(/]/g, ']]')}]`;
    return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
    if (value === '') return 'NULL';
    return `'${value.replace(/'/g, "''")}'`;
}

export function buildRowsAsInsertStatements(params: {
    selectedCells: Set<string>;
    displayRows: DisplayRowLike[];
    rowOrder: Map<string, number>;
    editedCells: Map<string, string>;
    columns: string[];
    tableName: string;
    driver: string | undefined;
}): string {
    const { columns, tableName, driver } = params;
    const matrix = buildSelectionMatrix(params);
    if (matrix.length === 0) return '';

    const tbl = quoteIdent(tableName, driver);
    const cols = columns.map((c) => quoteIdent(c, driver)).join(', ');
    return matrix
        .map((row) => {
            const vals = row.map(quoteLiteral).join(', ');
            return `INSERT INTO ${tbl} (${cols}) VALUES (${vals});`;
        })
        .join('\n');
}

export function buildRowAsUpdateStatement(params: {
    selectedCells: Set<string>;
    displayRows: DisplayRowLike[];
    rowOrder: Map<string, number>;
    editedCells: Map<string, string>;
    columns: string[];
    pkColumns: string[];
    tableName: string;
    driver: string | undefined;
}): string {
    const { columns, pkColumns, tableName, driver } = params;
    const matrix = buildSelectionMatrix(params);
    if (matrix.length === 0) return '';

    const tbl = quoteIdent(tableName, driver);
    return matrix
        .map((row) => {
            const setClauses = columns
                .map((col, i) => `${quoteIdent(col, driver)} = ${quoteLiteral(row[i] ?? '')}`)
                .join(',\n    ');
            const whereClauses = pkColumns.length > 0
                ? pkColumns
                    .map((pkCol) => {
                        const i = columns.indexOf(pkCol);
                        return `${quoteIdent(pkCol, driver)} = ${quoteLiteral(i >= 0 ? (row[i] ?? '') : '')}`;
                    })
                    .join('\n    AND ')
                : '/* add WHERE condition */';
            return `UPDATE ${tbl}\nSET\n    ${setClauses}\nWHERE\n    ${whereClauses};`;
        })
        .join('\n\n');
}

export function applySetNullToSelection(params: {
    selectedCells: Set<string>;
    displayRowsByKey: Map<string, DisplayRowLike>;
    editedCells: Map<string, string>;
    draftRows: DraftRow[];
    nullableByColumnIndex: boolean[];
}): {
    nextEdited: Map<string, string>;
    nextDraftRows: DraftRow[];
    updatedCells: Set<string>;
    updatedCount: number;
    skippedCount: number;
} {
    const { selectedCells, displayRowsByKey, editedCells, draftRows, nullableByColumnIndex } = params;
    const nextEdited = new Map(editedCells);
    const nextDraftRows = draftRows.map((draftRow) => ({ ...draftRow, values: [...draftRow.values] }));
    const nextDraftById = new Map(nextDraftRows.map((draftRow) => [draftRow.id, draftRow]));
    const updatedCells = new Set<string>();
    let updatedCount = 0;
    let skippedCount = 0;

    selectedCells.forEach((cellId) => {
        const { rowKey, colIdx } = parseCellId(cellId);
        if (colIdx < 0 || colIdx >= nullableByColumnIndex.length) return;

        if (!nullableByColumnIndex[colIdx]) {
            skippedCount += 1;
            return;
        }

        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;

        if (displayRow.kind === 'persisted') {
            nextEdited.set(`${displayRow.persistedIndex}:${colIdx}`, '');
        } else {
            const draftId = displayRow.draft?.id;
            const target = draftId ? nextDraftById.get(draftId) : null;
            if (!target) return;
            target.values[colIdx] = '';
        }

        updatedCells.add(cellId);
        updatedCount += 1;
    });

    return {
        nextEdited,
        nextDraftRows,
        updatedCells,
        updatedCount,
        skippedCount,
    };
}
