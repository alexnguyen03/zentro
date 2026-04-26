import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Lock, Unlock } from 'lucide-react';

import { DisplayRow } from '../../../lib/dataEditing';

import {
    fromDatetimeLocalValue,
    isDatetimeLike,
    makeCellId,
    toDatetimeLocalValue,
} from './cellUtils';
import { DataColumnMeta, TableMeta } from './types';
import { Input } from '../../ui';

interface UseResultTableColumnsArgs {
    dataColumns: DataColumnMeta[];
    isEditable: boolean;
    readOnlyMode: boolean;
    tableName?: string;
    onRemoveDraftRows: (draftIds: string[]) => void;
    commitEdit: (options?: { nextDirection?: 1 | -1 }) => Promise<void>;
    emitSaveShortcut: () => void;
}

export function useResultTableColumns({
    dataColumns,
    isEditable,
    readOnlyMode,
    tableName,
    onRemoveDraftRows,
    commitEdit,
    emitSaveShortcut,
}: UseResultTableColumnsArgs): ColumnDef<DisplayRow>[] {
    return useMemo<ColumnDef<DisplayRow>[]>(() => {
        const rowNumCol: ColumnDef<DisplayRow> = {
            id: '__rownum__',
            header: () => (
                <div
                    title={isEditable
                        ? `Editable (${tableName})`
                        : readOnlyMode
                            ? 'Read-only (View Mode)'
                            : 'Read-only (No Primary Key or missing PK in SELECT)'}
                    className="flex items-center w-full justify-center gap-1 cursor-help opacity-70"
                >
                    {isEditable
                        ? <Unlock size={10} className="text-success" />
                        : <Lock size={10} className="text-muted-foreground" />}
                </div>
            ),
            enableSorting: false,
            size: 52,
            minSize: 52,
            maxSize: 52,
            cell: ({ row, table }) => {
                const meta = table.options.meta as TableMeta | undefined;
                return (
                    <div
                        className="rt-cell-content rt-cell-content--compact row-num-col"
                        onDoubleClick={() => meta?.handleRevertRow?.(row.original.key)}
                        title={row.original.kind === 'draft' ? 'Double-click to remove this unsaved row' : 'Double-click to revert changes to this row'}
                    >
                        {row.original.kind === 'draft' ? row.index + 1 : (row.original.persistedIndex as number) + 1}
                    </div>
                );
            },
        };

        const dataCols: ColumnDef<DisplayRow>[] = dataColumns.map(({ id, index: colIdx, name }) => ({
            id,
            header: name,
            accessorFn: (row) => row.values[colIdx] ?? '',
            sortingFn: 'alphanumeric',
            size: 140,
            minSize: 72,
            maxSize: 720,
            cell: (info) => {
                const meta = info.table.options.meta as TableMeta | undefined;
                const rowKey = info.row.original.key;
                const cellId = makeCellId(rowKey, colIdx);
                const isSelected = meta?.selectedCells?.has(cellId) ?? false;
                const isEditing = meta?.editingCell === cellId;
                const displayRow = info.row.original;
                const isDirty = displayRow.kind === 'persisted'
                    ? meta?.editedCells?.has(`${displayRow.persistedIndex}:${colIdx}`) ?? false
                    : false;
                const baseValue = info.getValue() as string;
                const value = displayRow.kind === 'persisted'
                    ? (meta?.editedCells?.get(`${displayRow.persistedIndex}:${colIdx}`) ?? baseValue)
                    : (displayRow.values[colIdx] ?? '');

                if (isEditing) {
                    const dtLike = isDatetimeLike(baseValue || value);
                    return (
                        <Input
                            autoFocus
                            className="rt-cell-input"
                            type={dtLike ? 'datetime-local' : 'text'}
                            step={dtLike ? '0.001' : undefined}
                            value={meta?.editValue ?? ''}
                            onChange={(event) => meta?.setEditValue?.(event.target.value)}
                            onKeyDown={async (event) => {
                                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (dtLike) meta?.setEditValue?.(fromDatetimeLocalValue(event.currentTarget.value));
                                    await commitEdit();
                                    window.setTimeout(() => emitSaveShortcut(), 0);
                                    return;
                                }
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    if (dtLike) meta?.setEditValue?.(fromDatetimeLocalValue(event.currentTarget.value));
                                    await commitEdit();
                                } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    if (displayRow.kind === 'draft') {
                                        onRemoveDraftRows([displayRow.draft!.id]);
                                    } else {
                                        meta?.setEditingCell?.(null);
                                    }
                                } else if (event.key === 'Tab') {
                                    event.preventDefault();
                                    if (dtLike) meta?.setEditValue?.(fromDatetimeLocalValue(event.currentTarget.value));
                                    await commitEdit({ nextDirection: event.shiftKey ? -1 : 1 });
                                }
                            }}
                            onBlur={async (event) => {
                                if (dtLike) meta?.setEditValue?.(fromDatetimeLocalValue(event.currentTarget.value));
                                await commitEdit();
                            }}
                            onClick={(event) => event.stopPropagation()}
                        />
                    );
                }

                return (
                    <div
                        className={`rt-cell-content rt-cell-content--compact ${isSelected ? 'rt-cell-selected' : ''} ${isDirty ? 'rt-cell-dirty' : ''}`}
                        onMouseDown={(event) => meta?.handleCellMouseDown?.(event, rowKey, colIdx)}
                        onMouseEnter={() => meta?.handleCellMouseEnter?.(rowKey, colIdx)}
                        onDoubleClick={() => meta?.handleCellDoubleClick?.(rowKey, colIdx, String(value))}
                        onContextMenu={(event) => meta?.handleCellContextMenu?.(event, rowKey, colIdx)}
                        title={String(value)}
                    >
                        {String(value)}
                    </div>
                );
            },
        }));

        return [rowNumCol, ...dataCols];
    }, [commitEdit, dataColumns, emitSaveShortcut, isEditable, onRemoveDraftRows, readOnlyMode, tableName]);
}
