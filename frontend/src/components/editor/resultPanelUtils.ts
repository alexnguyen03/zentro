export const LIMIT_OPTIONS = [100, 500, 1000, 5000, 10000, 50000];
const CELL_ID_SEPARATOR = '|';

export function makeCellId(rowKey: string, colIdx: number): string {
    return `${rowKey}${CELL_ID_SEPARATOR}${colIdx}`;
}

export function parseCellId(cellId: string): { rowKey: string; colIdx: number } {
    const separatorIndex = cellId.lastIndexOf(CELL_ID_SEPARATOR);
    return {
        rowKey: cellId.slice(0, separatorIndex),
        colIdx: Number(cellId.slice(separatorIndex + 1)),
    };
}

export function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
