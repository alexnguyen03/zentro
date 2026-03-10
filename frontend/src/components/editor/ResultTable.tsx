import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
    type Row,
    type Cell,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FetchMoreRows } from '../../../wailsjs/go/app/App';
import { useResultStore, type TabResult } from '../../stores/resultStore';
import { useToast } from '../layout/Toast';
import { ArrowUp, ArrowDown, Lock, Unlock } from 'lucide-react';

interface ResultTableProps {
    tabId: string;
    columns: string[];
    rows: string[][];
    isDone: boolean;
    editedCells: Map<string, string>;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    selectedCells: Set<string>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    deletedRows?: Set<number>;
    setDeletedRows?: React.Dispatch<React.SetStateAction<Set<number>>>;
}

interface TableMeta {
    selectedCells: Set<string>;
    editedCells: Map<string, string>;
    editingCell: string | null;
    editValue: string;
    handleCellMouseDown: (e: React.MouseEvent, rIdx: number, cIdx: number) => void;
    handleCellMouseEnter: (rIdx: number, cIdx: number) => void;
    handleCellDoubleClick: (rIdx: number, cIdx: number, val: string) => void;
    setEditValue: (val: string) => void;
    handleCommitEdit: () => void;
    setEditingCell: (cellId: string | null) => void;
    handleRevertRow: (rIdx: number) => void;
}

export const ResultTable: React.FC<ResultTableProps> = ({ tabId, columns, rows, isDone, editedCells, setEditedCells, selectedCells, setSelectedCells, deletedRows, setDeletedRows }) => {
    const { results, setOffset } = useResultStore();
    const { toast } = useToast();
    const resultState = results[tabId] as TabResult | undefined;

    const isEditable = useMemo(() => {
        if (!resultState?.tableName || !resultState?.primaryKeys?.length) return false;
        if (!columns.length) return false;
        return resultState.primaryKeys.every(pk => columns.includes(pk));
    }, [resultState?.tableName, resultState?.primaryKeys, columns]);

    // Disable sorting locally if we haven't loaded everything yet (true infinite scroll limitation)
    const canSortClientSide = isDone && !resultState?.hasMore;
    const [sorting, setSorting] = useState<SortingState>([]);
    const parentRef = React.useRef<HTMLDivElement>(null);

    // Batch Edit States
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [lastSelected, setLastSelected] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ r: number, c: number, active: boolean, append: boolean, initialSelected: Set<string> } | null>(null);

    // Stable ref so closures inside useMemo can always read fresh editValue
    const editValueRef = React.useRef(editValue);
    useEffect(() => { editValueRef.current = editValue; }, [editValue]);

    const selectedCellsRef = React.useRef(selectedCells);
    useEffect(() => { selectedCellsRef.current = selectedCells; }, [selectedCells]);

    const editingCellRef = React.useRef(editingCell);
    useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);

    useEffect(() => {
        if (!isDone) {
            setEditingCell(null);
            setLastSelected(null);
            setDragStart(null);
        }
    }, [isDone, rows]); // Reset on new query

    // Global mouse up
    useEffect(() => {
        const handleMouseUp = () => setDragStart(null);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const handleCellMouseDown = React.useCallback((e: React.MouseEvent, rIdx: number, cIdx: number) => {
        if (!isDone) return;
        if (e.button !== 0) return; // Only default left click
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
            const isAppend = e.ctrlKey || e.metaKey;
            setLastSelected(id);
            setSelectedCells(prev => {
                const newSel = isAppend ? new Set(prev) : new Set<string>();
                if (isAppend && newSel.has(id)) {
                    newSel.delete(id);
                } else {
                    newSel.add(id);
                }
                setDragStart({ r: rIdx, c: cIdx, active: true, append: isAppend, initialSelected: new Set(newSel) });
                return newSel;
            });
        }
    }, [isDone, lastSelected, setSelectedCells]);

    const handleCellMouseEnter = React.useCallback((rIdx: number, cIdx: number) => {
        if (!dragStart?.active) return;

        setSelectedCells(() => {
            const newSel = new Set(dragStart.initialSelected);
            const minR = Math.min(dragStart.r, rIdx);
            const maxR = Math.max(dragStart.r, rIdx);
            const minC = Math.min(dragStart.c, cIdx);
            const maxC = Math.max(dragStart.c, cIdx);

            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    newSel.add(`${r}:${c}`);
                }
            }
            return newSel;
        });
        setLastSelected(`${rIdx}:${cIdx}`);
    }, [dragStart, setSelectedCells]);

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
    }, [isDone, isEditable, toast, setSelectedCells]);

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
    const colDefs = useMemo<ColumnDef<any>[]>(() => {
        const rowNumCol: ColumnDef<any> = {
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
            cell: ({ row, table }) => {
                const meta = table.options.meta as TableMeta | undefined;
                return (
                    <div
                        className="rt-cell-content row-num-col"
                        onDoubleClick={() => meta?.handleRevertRow?.(row.index)}
                        title="Double-click to revert changes to this row"
                    >
                        {row.index + 1}
                    </div>
                );
            },
        };

        const dataCols: ColumnDef<any>[] = columns.map((col, colIdx) => ({
            id: col || `col_${colIdx}`,
            header: col,
            accessorFn: (row: any[]) => row[colIdx] ?? '',
            sortingFn: 'alphanumeric',
            size: 140,
            cell: (info) => {
                const meta = info.table.options.meta as TableMeta | undefined;
                const cellId = `${info.row.index}:${colIdx}`;
                const isSelected = meta?.selectedCells?.has(cellId) ?? false;
                const isDirty = meta?.editedCells?.has(cellId) ?? false;
                const isEditing = meta?.editingCell === cellId;
                const origVal = info.getValue() as string;
                const editedValue = meta?.editedCells?.get(cellId);
                const value = isDirty && editedValue !== undefined ? editedValue : origVal;

                if (isEditing) {
                    return (
                        <input
                            autoFocus
                            className="rt-cell-input"
                            value={meta?.editValue ?? ''}
                            onChange={(e) => meta?.setEditValue?.(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') meta?.handleCommitEdit?.();
                                else if (e.key === 'Escape') meta?.setEditingCell?.(null);
                            }}
                            onBlur={() => meta?.handleCommitEdit?.()}
                            onClick={e => e.stopPropagation()}
                        />
                    );
                }

                return (
                    <div
                        className={`rt-cell-content ${isSelected ? 'rt-cell-selected' : ''} ${isDirty ? 'rt-cell-dirty' : ''}`}
                        onMouseDown={(e) => meta?.handleCellMouseDown?.(e, info.row.index, colIdx)}
                        onMouseEnter={() => meta?.handleCellMouseEnter?.(info.row.index, colIdx)}
                        onDoubleClick={() => meta?.handleCellDoubleClick?.(info.row.index, colIdx, String(value))}
                        title={String(value)}
                    >
                        {String(value)}
                    </div>
                );
            }
        }));

        return [rowNumCol, ...dataCols];
    }, [columns, isEditable, resultState?.tableName, resultState?.hasMore, canSortClientSide]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = useReactTable<any>({
        data: rows,
        columns: colDefs,
        state: { sorting },
        meta: {
            selectedCells,
            editedCells,
            editingCell,
            editValue,
            handleCellMouseDown,
            handleCellMouseEnter,
            handleCellDoubleClick,
            setEditValue,
            handleCommitEdit,
            setEditingCell,
            handleRevertRow: (rIdx: number) => {
                setEditedCells(prev => {
                    const next = new Map(prev);
                    for (const key of Array.from(next.keys())) {
                        if (key.startsWith(`${rIdx}:`)) {
                            next.delete(key);
                        }
                    }
                    return next;
                });

                if (setDeletedRows && deletedRows?.has(rIdx)) {
                    setDeletedRows(prev => {
                        const next = new Set(prev);
                        next.delete(rIdx);
                        return next;
                    });
                }
            }
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

    // Debounce ref to prevent multiple rapid fetch requests
    const fetchMoreRef = React.useRef(false);

    // Infinite Scroll trigger with debounce
    useEffect(() => {
        if (!virtualItems.length || !isDone || !resultState?.hasMore || resultState?.isFetchingMore || fetchMoreRef.current) return;

        const lastItem = virtualItems[virtualItems.length - 1];
        if (lastItem.index >= tableRows.length - 15) {
            fetchMoreRef.current = true;
            const newOffset = rows.length;
            setOffset(tabId, newOffset);
            FetchMoreRows(tabId, newOffset)
                .catch(console.error)
                .finally(() => {
                    setTimeout(() => { fetchMoreRef.current = false; }, 300);
                });
        }
    }, [
        virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0,
        isDone,
        resultState?.hasMore,
        resultState?.isFetchingMore,
        rows.length,
        tabId,
        setOffset,
        tableRows.length
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
                        const isDeleted = deletedRows?.has(virtualRow.index);
                        const altClass = virtualRow.index % 2 === 0 ? '' : 'rt-row-alt';
                        return (
                            <tr key={row.id} className={`${altClass} ${isDeleted ? 'rt-row-deleted' : ''}`}>
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
                    {resultState?.isFetchingMore && (
                        <tr>
                            <td colSpan={columns.length + 1} style={{
                                textAlign: 'center',
                                padding: '8px',
                                background: 'var(--bg-primary)'
                            }}>
                                <div className="loading-spinner" style={{
                                    display: 'inline-block',
                                    width: 16,
                                    height: 16,
                                    border: '2px solid var(--border-color)',
                                    borderTopColor: 'var(--color-primary)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>
                                    Loading more rows...
                                </span>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
