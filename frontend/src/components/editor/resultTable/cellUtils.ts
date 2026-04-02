import { DragEndEvent } from '@dnd-kit/core';

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
const CELL_ID_SEPARATOR = '|';

export const isDatetimeLike = (val: string): boolean => DATETIME_RE.test(val.trim());

export const toDatetimeLocalValue = (val: string): string => {
    let s = val.trim().replace(' ', 'T');
    s = s.replace(/[+-]\d{2}:?\d{2}(\s+\S+)?$/, '').replace(/Z$/, '').trim();
    s = s.replace(/(\d{2}:\d{2}:\d{2}\.)(\d{3})\d*/, '$1$2');
    return s;
};

export const fromDatetimeLocalValue = (val: string): string => val.replace('T', ' ');

export function makeCellId(rowKey: string, colIdx: number): string {
    return `${rowKey}${CELL_ID_SEPARATOR}${colIdx}`;
}

export function makeDataColumnId(columnName: string, index: number): string {
    const safeName = (columnName || `col_${index}`).trim() || `col_${index}`;
    return `${index}_${safeName}`;
}

export function parseCellId(cellId: string): { rowKey: string; colIdx: number } {
    const separatorIndex = cellId.lastIndexOf(CELL_ID_SEPARATOR);
    return {
        rowKey: cellId.slice(0, separatorIndex),
        colIdx: Number(cellId.slice(separatorIndex + 1)),
    };
}

export function getDragIds(event: DragEndEvent): { activeId: string; overId: string } {
    return {
        activeId: String(event.active.id || ''),
        overId: String(event.over?.id || ''),
    };
}
