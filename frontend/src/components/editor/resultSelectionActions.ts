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
    const { selectedCells, displayRows, editedCells, columns, pkColumns, tableName, driver } = params;
    if (selectedCells.size === 0) return '';

    const tbl = quoteIdent(tableName, driver);

    const persistedRowIndices = Array.from(new Set(
        Array.from(selectedCells)
            .map((cellId) => parseCellId(cellId).rowKey)
            .filter((rowKey) => rowKey.startsWith('p:'))
            .map((rowKey) => Number(rowKey.slice(2)))
            .filter((rowIndex) => Number.isFinite(rowIndex)),
    )).sort((a, b) => a - b);
    if (persistedRowIndices.length === 0) return '';

    const displayRowsByPersistedIndex = new Map<number, DisplayRowLike>();
    displayRows.forEach((row) => {
        if (row.kind === 'persisted' && typeof row.persistedIndex === 'number') {
            displayRowsByPersistedIndex.set(row.persistedIndex, row);
        }
    });

    return persistedRowIndices
        .map((rowIndex) => {
            const row = displayRowsByPersistedIndex.get(rowIndex);
            if (!row) return '';
            const setClauses = columns
                .map((col, colIdx) => {
                    const val = editedCells.get(`${rowIndex}:${colIdx}`) ?? row.values[colIdx] ?? '';
                    return `${quoteIdent(col, driver)} = ${quoteLiteral(val)}`;
                })
                .join(',\n    ');
            const whereClauses = pkColumns.length > 0
                ? pkColumns
                    .map((pkCol) => {
                        const colIdx = columns.indexOf(pkCol);
                        const val = colIdx >= 0 ? (editedCells.get(`${rowIndex}:${colIdx}`) ?? row.values[colIdx] ?? '') : '';
                        return `${quoteIdent(pkCol, driver)} = ${quoteLiteral(val)}`;
                    })
                    .join('\n    AND ')
                : '/* add WHERE condition */';
            return `UPDATE ${tbl}\nSET\n    ${setClauses}\nWHERE\n    ${whereClauses};`;
        })
        .filter(Boolean)
        .join('\n\n');
}

function getPersistedRowByIndex(displayRows: DisplayRowLike[], rowIndex: number): DisplayRowLike | undefined {
    return displayRows.find((row) => row.kind === 'persisted' && row.persistedIndex === rowIndex);
}

export function buildWhereClauseByPrimaryKeys(params: {
    persistedRowIndices: number[];
    displayRows: DisplayRowLike[];
    editedCells: Map<string, string>;
    columns: string[];
    pkColumns: string[];
    driver: string | undefined;
}): string {
    const { persistedRowIndices, displayRows, editedCells, columns, pkColumns, driver } = params;
    if (persistedRowIndices.length === 0 || pkColumns.length === 0) return '';

    const rowClauses = persistedRowIndices
        .map((rowIndex) => {
            const row = getPersistedRowByIndex(displayRows, rowIndex);
            if (!row) return '';
            const parts = pkColumns
                .map((pkCol) => {
                    const colIdx = columns.indexOf(pkCol);
                    if (colIdx < 0) return '';
                    const value = editedCells.get(`${rowIndex}:${colIdx}`) ?? row.values[colIdx] ?? '';
                    return `${quoteIdent(pkCol, driver)} = ${quoteLiteral(value)}`;
                })
                .filter(Boolean);
            if (parts.length === 0) return '';
            return parts.length > 1 ? `(${parts.join(' AND ')})` : parts[0];
        })
        .filter(Boolean);

    if (rowClauses.length === 0) return '';
    return rowClauses.join(' OR ');
}

export function buildWhereClauseBySelectionIn(params: {
    selectedCells: Set<string>;
    displayRowsByKey: Map<string, DisplayRowLike>;
    editedCells: Map<string, string>;
    columns: string[];
    driver: string | undefined;
}): string {
    const { selectedCells, displayRowsByKey, editedCells, columns, driver } = params;
    if (selectedCells.size === 0) return '';

    let selectedColIdx: number | null = null;
    const values: string[] = [];

    selectedCells.forEach((cellId) => {
        const { rowKey, colIdx } = parseCellId(cellId);
        const row = displayRowsByKey.get(rowKey);
        if (!row || colIdx < 0 || colIdx >= columns.length) return;
        if (selectedColIdx === null) selectedColIdx = colIdx;
        if (selectedColIdx !== colIdx) {
            selectedColIdx = -1;
            return;
        }
        const value =
            row.kind === 'persisted'
                ? (editedCells.get(`${row.persistedIndex}:${colIdx}`) ?? row.values[colIdx] ?? '')
                : (row.values[colIdx] ?? '');
        values.push(value);
    });

    if (selectedColIdx === null || selectedColIdx < 0) return '';
    const column = columns[selectedColIdx];
    if (!column) return '';

    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) return '';

    const nonNullValues = uniqueValues.filter((value) => value !== '');
    const hasNull = uniqueValues.length !== nonNullValues.length;
    const clauses: string[] = [];
    const quotedColumn = quoteIdent(column, driver);

    if (nonNullValues.length === 1) {
        clauses.push(`${quotedColumn} = ${quoteLiteral(nonNullValues[0])}`);
    } else if (nonNullValues.length > 1) {
        clauses.push(`${quotedColumn} IN (${nonNullValues.map(quoteLiteral).join(', ')})`);
    }

    if (hasNull) {
        clauses.push(`${quotedColumn} IS NULL`);
    }

    if (clauses.length === 0) return '';
    return clauses.length > 1 ? `(${clauses.join(' OR ')})` : clauses[0];
}

export function buildSelectByPrimaryKeyQuery(params: {
    persistedRowIndex: number;
    displayRows: DisplayRowLike[];
    editedCells: Map<string, string>;
    columns: string[];
    pkColumns: string[];
    tableName: string;
    driver: string | undefined;
}): string {
    const { persistedRowIndex, displayRows, editedCells, columns, pkColumns, tableName, driver } = params;
    if (!tableName || pkColumns.length === 0) return '';
    const whereClause = buildWhereClauseByPrimaryKeys({
        persistedRowIndices: [persistedRowIndex],
        displayRows,
        editedCells,
        columns,
        pkColumns,
        driver,
    });
    if (!whereClause) return '';
    return `SELECT * FROM ${quoteIdent(tableName, driver)} WHERE ${whereClause};`;
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
