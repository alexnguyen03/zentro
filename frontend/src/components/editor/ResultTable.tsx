import React, { useMemo, useState, useEffect } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FetchMoreRows } from '../../../wailsjs/go/app/App';
import { useResultStore } from '../../stores/resultStore';
import { useToast } from '../layout/Toast';
import { Loader, ArrowUp, ArrowDown, Database, Lock, Unlock } from 'lucide-react';

interface ResultTableProps {
    tabId: string;
    columns: string[];
    rows: string[][];
    isDone: boolean;
    editedCells: Map<string, string>;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
}

export const ResultTable: React.FC<ResultTableProps> = ({ tabId, columns, rows, isDone, editedCells, setEditedCells }) => {
    const { results, setOffset } = useResultStore();
    const { toast } = useToast();
    const resultState = results[tabId];

    const isEditable = useMemo(() => {
        if (!resultState?.tableName || !resultState?.primaryKeys?.length) return false;
        return resultState.primaryKeys.every(pk => columns.includes(pk));
    }, [resultState?.tableName, resultState?.primaryKeys, columns]);

    // Disable sorting locally if we haven't loaded everything yet (true infinite scroll limitation)
    const canSortClientSide = isDone && !resultState?.hasMore;
    const [sorting, setSorting] = useState<SortingState>([]);
    const parentRef = React.useRef<HTMLDivElement>(null);

    // Batch Edit States
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [lastSelected, setLastSelected] = useState<string | null>(null);

    // Stable ref so closures inside useMemo can always read fresh editValue
    const editValueRef = React.useRef(editValue);
    useEffect(() => { editValueRef.current = editValue; }, [editValue]);

    const selectedCellsRef = React.useRef(selectedCells);
    useEffect(() => { selectedCellsRef.current = selectedCells; }, [selectedCells]);

    const editingCellRef = React.useRef(editingCell);
    useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);

    useEffect(() => {
        if (!isDone) {
            setSelectedCells(new Set());
            setEditingCell(null);
            setLastSelected(null);
        }
    }, [isDone, rows]); // Reset on new query

    const handleCellClick = React.useCallback((e: React.MouseEvent, rIdx: number, cIdx: number) => {
        if (!isDone) return;
        const id = `${rIdx}:${cIdx}`;

        if (e.shiftKey && lastSelected) {
            const [lastR, lastC] = lastSelected.split(':').map(Number);
            if (lastC === cIdx) {
                setSelectedCells(prev => {
                    const newSel = new Set(prev);
                    const min = Math.min(lastR, rIdx);
                    const max = Math.max(lastR, rIdx);
                    for (let i = min; i <= max; i++) newSel.add(`${i}:${cIdx}`);
                    return newSel;
                });
                return;
            }
        }

        if (e.ctrlKey || e.metaKey) {
            setSelectedCells(prev => {
                const newSel = new Set(prev);
                if (newSel.has(id)) newSel.delete(id); else newSel.add(id);
                return newSel;
            });
        } else {
            setSelectedCells(new Set([id]));
        }
        setLastSelected(id);
    }, [isDone, lastSelected]);

    const handleCellDoubleClick = React.useCallback((rIdx: number, cIdx: number, val: string) => {
        if (!isDone) return;
        if (!isEditable) {
            toast.error("Result is read-only. Make sure the query includes the primary key(s).");
            return;
        }
        const id = `${rIdx}:${cIdx}`;
        setEditingCell(id);
        setEditValue(val);
        setSelectedCells(prev => {
            if (prev.has(id)) return prev;
            setLastSelected(id);
            return new Set([id]);
        });
    }, [isDone, isEditable, toast]);

    const handleCommitEdit = React.useCallback(() => {
        const currentEditingCell = editingCellRef.current;
        if (!currentEditingCell) return;
        const [, cIdx] = currentEditingCell.split(':').map(Number);
        const currentEditValue = editValueRef.current;
        const currentSelectedCells = selectedCellsRef.current;

        setEditedCells((prev: Map<string, string>) => {
            const newMap = new Map<string, string>(prev);
            currentSelectedCells.forEach(selId => {
                const [, selC] = selId.split(':').map(Number);
                if (selC === cIdx) newMap.set(selId, currentEditValue);
            });
            return newMap;
        });
        setEditingCell(null);
    }, [setEditedCells]);

    // Build TanStack column definitions - stable
    const colDefs = useMemo<ColumnDef<string[]>[]>(() => {
        const rowNumCol: ColumnDef<string[]> = {
            id: '__rownum__',
            header: () => (
                <div
                    title={isEditable
                        ? `Editable (${resultState?.tableName})`
                        : "Read-only (No Primary Key or missing PK in SELECT)"}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'help' }}
                >
                    #
                    {isEditable
                        ? <Unlock size={10} style={{ color: 'var(--color-success)' }} />
                        : <Lock size={10} style={{ color: 'var(--color-warning)' }} />
                    }
                </div>
            ),
            enableSorting: false,
            size: 52,
            cell: ({ row }) => (
                <div className="rt-cell-content row-num-col">
                    {row.index + 1}
                </div>
            ),
        };

        const dataCols: ColumnDef<string[]>[] = columns.map((col, colIdx) => ({
            id: col || `col_${colIdx}`,
            header: col,
            accessorFn: (row: string[]) => row[colIdx] ?? '',
            sortingFn: 'alphanumeric',
            size: 140,
            cell: (info) => {
                const meta = info.table.options.meta as any;
                const cellId = `${info.row.index}:${colIdx}`;
                const isSelected = meta.selectedCells.has(cellId);
                const isDirty = meta.editedCells.has(cellId);
                const isEditing = meta.editingCell === cellId;
                const origVal = info.getValue() as string;
                const value = isDirty ? meta.editedCells.get(cellId)! : origVal;

                if (isEditing) {
                    return (
                        <input
                            autoFocus
                            className="rt-cell-input"
                            value={meta.editValue}
                            onChange={(e) => meta.setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') meta.handleCommitEdit();
                                else if (e.key === 'Escape') meta.setEditingCell(null);
                            }}
                            onBlur={meta.handleCommitEdit}
                            onClick={e => e.stopPropagation()}
                        />
                    );
                }

                return (
                    <div
                        className={`rt-cell-content ${isSelected ? 'rt-cell-selected' : ''} ${isDirty ? 'rt-cell-dirty' : ''}`}
                        onClick={(e) => meta.handleCellClick(e, info.row.index, colIdx)}
                        onDoubleClick={() => meta.handleCellDoubleClick(info.row.index, colIdx, String(value))}
                        title={String(value)}
                    >
                        {String(value)}
                    </div>
                );
            }
        }));

        return [rowNumCol, ...dataCols];
    }, [columns, isEditable, resultState?.tableName]);

    const table = useReactTable({
        data: rows,
        columns: colDefs,
        state: { sorting },
        meta: {
            selectedCells,
            editedCells,
            editingCell,
            editValue,
            handleCellClick,
            handleCellDoubleClick,
            setEditValue,
            handleCommitEdit,
            setEditingCell
        },
        onSortingChange: canSortClientSide ? setSorting : undefined,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        enableSorting: canSortClientSide,
    });

    const { rows: tableRows } = table.getRowModel();

    const virtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 30,
        overscan: 20,
    });

    const virtualItems = virtualizer.getVirtualItems();

    // Infinite Scroll trigger
    useEffect(() => {
        if (!virtualItems.length || !isDone || !resultState?.hasMore || resultState?.isFetchingMore) return;
        const lastItem = virtualItems[virtualItems.length - 1];
        if (lastItem.index >= tableRows.length - 15) {
            // Trigger fetch
            // The new offset should be exactly the number of rows currently in memory
            const newOffset = rows.length;
            setOffset(tabId, newOffset);
            FetchMoreRows(tabId, newOffset).catch(console.error);
        }
    }, [
        virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0,
        isDone,
        resultState?.hasMore,
        resultState?.isFetchingMore,
        rows.length
    ]);

    const totalHeight = virtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
    const paddingBottom =
        virtualItems.length > 0
            ? totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0)
            : 0;

    return (
        <div ref={parentRef} className="result-virtual-scroll">
            <table className="result-table-tanstack">
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                const sorted = header.column.getIsSorted();
                                const canSort = header.column.getCanSort();
                                return (
                                    <th
                                        key={header.id}
                                        style={{ width: header.getSize() }}
                                        className={`rt-th ${canSort ? 'rt-th-sortable' : ''} ${sorted ? 'rt-th-sorted' : ''}`}
                                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                                        title={canSort && !isDone ? 'Sort available after query completes' : undefined}
                                    >
                                        <span className="rt-th-label">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {sorted === 'asc' && <ArrowUp size={11} className="rt-sort-icon" />}
                                            {sorted === 'desc' && <ArrowDown size={11} className="rt-sort-icon" />}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {paddingTop > 0 && (
                        <tr><td style={{ height: paddingTop }} /></tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                        const row = tableRows[virtualRow.index];
                        return (
                            <tr key={row.id} className={virtualRow.index % 2 === 0 ? '' : 'rt-row-alt'}>
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} style={{ width: cell.column.getSize() }}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                    {paddingBottom > 0 && (
                        <tr><td style={{ height: paddingBottom }} /></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
