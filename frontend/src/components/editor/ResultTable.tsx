import React, { useEffect, useMemo, useState } from 'react';
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnDef,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, Lock, Unlock } from 'lucide-react';
import { FetchMoreRows } from '../../services/queryService';
import { models } from '../../../wailsjs/go/models';
import { DraftRow, DisplayRow, buildDisplayRows } from '../../lib/dataEditing';
import { useResultStore, type TabResult } from '../../stores/resultStore';
import { useToast } from '../layout/Toast';
import { resolveResultFetchStrategy } from '../../features/query/resultStrategy';

export interface FocusCellRequest {
    rowKey: string;
    colIdx: number;
    nonce: number;
}

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
    draftRows: DraftRow[];
    setDraftRows: React.Dispatch<React.SetStateAction<DraftRow[]>>;
    columnDefs: models.ColumnDef[];
    focusCellRequest: FocusCellRequest | null;
    onFocusCellRequestHandled: () => void;
    onRemoveDraftRows: (draftIds: string[]) => void;
    readOnlyMode?: boolean;
    quickFilter?: string;
    onViewStatsChange?: (stats: { visibleRows: number; totalRows: number }) => void;
}

interface TableMeta {
    selectedCells: Set<string>;
    editedCells: Map<string, string>;
    editingCell: string | null;
    editValue: string;
    handleCellMouseDown: (event: React.MouseEvent, rowKey: string, colIdx: number) => void;
    handleCellMouseEnter: (rowKey: string, colIdx: number) => void;
    handleCellDoubleClick: (rowKey: string, colIdx: number, val: string) => void;
    setEditValue: (value: string) => void;
    setEditingCell: (cellId: string | null) => void;
    handleRevertRow: (rowKey: string) => void;
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
const CELL_ID_SEPARATOR = '|';

const isDatetimeLike = (val: string): boolean => DATETIME_RE.test(val.trim());

const toDatetimeLocalValue = (val: string): string => {
    let s = val.trim().replace(' ', 'T');
    s = s.replace(/[+-]\d{2}:?\d{2}(\s+\S+)?$/, '').replace(/Z$/, '').trim();
    s = s.replace(/(\d{2}:\d{2}:\d{2}\.)(\d{3})\d*/, '$1$2');
    return s;
};

const fromDatetimeLocalValue = (val: string): string => val.replace('T', ' ');

function makeCellId(rowKey: string, colIdx: number): string {
    return `${rowKey}${CELL_ID_SEPARATOR}${colIdx}`;
}

function parseCellId(cellId: string): { rowKey: string; colIdx: number } {
    const separatorIndex = cellId.lastIndexOf(CELL_ID_SEPARATOR);
    return {
        rowKey: cellId.slice(0, separatorIndex),
        colIdx: Number(cellId.slice(separatorIndex + 1)),
    };
}

export const ResultTable: React.FC<ResultTableProps> = ({
    tabId,
    columns,
    rows,
    isDone,
    editedCells,
    setEditedCells,
    selectedCells,
    setSelectedCells,
    deletedRows,
    setDeletedRows,
    draftRows,
    setDraftRows,
    columnDefs,
    focusCellRequest,
    onFocusCellRequestHandled,
    onRemoveDraftRows,
    readOnlyMode = false,
    quickFilter = '',
    onViewStatsChange,
}) => {
    const { results, setOffset } = useResultStore();
    const { toast } = useToast();
    const resultState = results[tabId] as TabResult | undefined;
    const displayRows = useMemo(() => buildDisplayRows(rows, draftRows), [rows, draftRows]);
    const displayRowsByKey = useMemo(() => new Map(displayRows.map((row) => [row.key, row])), [displayRows]);
    const rowOrder = useMemo(() => new Map(displayRows.map((row, index) => [row.key, index])), [displayRows]);

    const isEditable = useMemo(() => {
        if (readOnlyMode) return false;
        if (!resultState?.tableName || !resultState?.primaryKeys?.length) return false;
        if (!columns.length) return false;
        return resultState.primaryKeys.every((primaryKey) => columns.includes(primaryKey));
    }, [columns, readOnlyMode, resultState?.primaryKeys, resultState?.tableName]);

    const viewportState = resolveResultFetchStrategy(displayRows.length, Boolean(resultState?.hasMore), isDone);
    const canSortClientSide = isDone && !resultState?.hasMore;
    const shouldUseDeferredSort = canSortClientSide && viewportState.strategy === 'incremental_client';
    const [sorting, setSorting] = useState<SortingState>([]);
    const [deferredSortedRows, setDeferredSortedRows] = useState<DisplayRow[]>(displayRows);
    const [isDeferredSorting, setIsDeferredSorting] = useState(false);
    const [deferredFilteredRows, setDeferredFilteredRows] = useState<DisplayRow[]>(displayRows);
    const [isDeferredFiltering, setIsDeferredFiltering] = useState(false);
    const parentRef = React.useRef<HTMLDivElement>(null);
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [lastSelected, setLastSelected] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ rowKey: string; colIdx: number; active: boolean; initialSelected: Set<string> } | null>(null);
    const pendingSelectionRef = React.useRef<{ cellId: string; rowKey: string; colIdx: number } | null>(null);
    const onViewStatsChangeRef = React.useRef(onViewStatsChange);
    const lastViewStatsRef = React.useRef<{ visibleRows: number; totalRows: number } | null>(null);

    const editValueRef = React.useRef(editValue);
    useEffect(() => { editValueRef.current = editValue; }, [editValue]);

    const editingCellRef = React.useRef(editingCell);
    useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);

    const displayRowsRef = React.useRef(displayRows);
    useEffect(() => { displayRowsRef.current = displayRows; }, [displayRows]);
    useEffect(() => { onViewStatsChangeRef.current = onViewStatsChange; }, [onViewStatsChange]);

    useEffect(() => {
        if (!isDone) {
            setEditingCell(null);
            setLastSelected(null);
            setDragStart(null);
        }
    }, [isDone, rows]);

    useEffect(() => {
        const query = quickFilter.trim().toLowerCase();
        if (!query) {
            setDeferredFilteredRows(displayRows);
            setIsDeferredFiltering(false);
            return;
        }

        const useIncrementalFilter = viewportState.strategy !== 'client_full' || displayRows.length >= 15000;
        if (!useIncrementalFilter) {
            setDeferredFilteredRows(
                displayRows.filter((row) => row.values.some((cell) => (cell || '').toLowerCase().includes(query))),
            );
            setIsDeferredFiltering(false);
            return;
        }

        let cancelled = false;
        setIsDeferredFiltering(true);
        const next: DisplayRow[] = [];

        const pump = (startIndex: number) => {
            if (cancelled) return;
            const chunkEnd = Math.min(startIndex + 1500, displayRows.length);
            for (let i = startIndex; i < chunkEnd; i += 1) {
                const row = displayRows[i];
                if (row.values.some((cell) => (cell || '').toLowerCase().includes(query))) {
                    next.push(row);
                }
            }

            if (chunkEnd < displayRows.length) {
                window.setTimeout(() => pump(chunkEnd), 0);
                return;
            }

            if (!cancelled) {
                setDeferredFilteredRows(next);
                setIsDeferredFiltering(false);
            }
        };

        pump(0);
        return () => {
            cancelled = true;
        };
    }, [displayRows, quickFilter, viewportState.strategy]);

    useEffect(() => {
        if (!shouldUseDeferredSort || sorting.length === 0) {
            setDeferredSortedRows(deferredFilteredRows);
            setIsDeferredSorting(false);
            return;
        }

        setIsDeferredSorting(true);
        const id = window.setTimeout(() => {
            const [sortRule] = sorting;
            if (!sortRule) {
                setDeferredSortedRows(deferredFilteredRows);
                setIsDeferredSorting(false);
                return;
            }

            const direction = sortRule.desc ? -1 : 1;
            const columnIndex = columns.findIndex((col) => col === String(sortRule.id));
            if (columnIndex < 0) {
                setDeferredSortedRows(deferredFilteredRows);
                setIsDeferredSorting(false);
                return;
            }

            const next = [...deferredFilteredRows].sort((a, b) => {
                const left = (a.values[columnIndex] || '').toLowerCase();
                const right = (b.values[columnIndex] || '').toLowerCase();
                if (left < right) return -1 * direction;
                if (left > right) return 1 * direction;
                return 0;
            });
            setDeferredSortedRows(next);
            setIsDeferredSorting(false);
        }, 0);

        return () => window.clearTimeout(id);
    }, [columns, deferredFilteredRows, shouldUseDeferredSort, sorting]);

    useEffect(() => {
        const handleMouseUp = () => setDragStart(null);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const applyDraftValueUpdates = React.useCallback((changes: Array<{ rowKey: string; colIdx: number; value: string }>) => {
        if (changes.length === 0) return;
        setDraftRows((prev) => prev.map((draftRow) => {
            const rowKey = `d:${draftRow.id}`;
            const rowChanges = changes.filter((change) => change.rowKey === rowKey);
            if (rowChanges.length === 0) return draftRow;

            const nextValues = [...draftRow.values];
            rowChanges.forEach((change) => {
                nextValues[change.colIdx] = change.value;
            });

            return { ...draftRow, values: nextValues };
        }));
    }, [setDraftRows]);

    const focusCell = React.useCallback((rowKey: string, colIdx: number) => {
        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;

        const rawValue = displayRow.values[colIdx] ?? '';
        pendingSelectionRef.current = null;
        setSelectedCells(new Set([makeCellId(rowKey, colIdx)]));
        setLastSelected(makeCellId(rowKey, colIdx));
        setEditingCell(makeCellId(rowKey, colIdx));
        setEditValue(isDatetimeLike(rawValue) ? toDatetimeLocalValue(rawValue) : rawValue);
    }, [displayRowsByKey, setSelectedCells]);

    useEffect(() => {
        if (!focusCellRequest) return;
        focusCell(focusCellRequest.rowKey, focusCellRequest.colIdx);
        onFocusCellRequestHandled();
    }, [focusCell, focusCellRequest, onFocusCellRequestHandled]);

    const handleCellMouseDown = React.useCallback((event: React.MouseEvent, rowKey: string, colIdx: number) => {
        if (!isDone || event.button !== 0) return;
        const cellId = makeCellId(rowKey, colIdx);

        if (editingCellRef.current && editingCellRef.current !== cellId) {
            pendingSelectionRef.current = { cellId, rowKey, colIdx };
        } else {
            pendingSelectionRef.current = null;
        }

        if (event.shiftKey && lastSelected) {
            const { rowKey: lastRowKey, colIdx: lastColIdx } = parseCellId(lastSelected);
            const currentRowOrder = rowOrder.get(rowKey);
            const lastRowOrder = rowOrder.get(lastRowKey);
            if (currentRowOrder !== undefined && lastRowOrder !== undefined && lastColIdx === colIdx) {
                setSelectedCells((prev) => {
                    const next = new Set(prev);
                    const min = Math.min(currentRowOrder, lastRowOrder);
                    const max = Math.max(currentRowOrder, lastRowOrder);
                    for (let rowIndex = min; rowIndex <= max; rowIndex++) {
                        next.add(makeCellId(displayRows[rowIndex].key, colIdx));
                    }
                    return next;
                });
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedCells((prev) => {
                const next = new Set(prev);
                if (next.has(cellId)) next.delete(cellId); else next.add(cellId);
                return next;
            });
        } else {
            setSelectedCells(new Set([cellId]));
            setDragStart({ rowKey, colIdx, active: true, initialSelected: new Set([cellId]) });
        }

        setLastSelected(cellId);
    }, [displayRows, isDone, lastSelected, rowOrder, setSelectedCells]);

    const handleCellMouseEnter = React.useCallback((rowKey: string, colIdx: number) => {
        if (!dragStart?.active) return;

        const startRowOrder = rowOrder.get(dragStart.rowKey);
        const currentRowOrder = rowOrder.get(rowKey);
        if (startRowOrder === undefined || currentRowOrder === undefined) return;

        setSelectedCells(() => {
            const next = new Set(dragStart.initialSelected);
            const minRow = Math.min(startRowOrder, currentRowOrder);
            const maxRow = Math.max(startRowOrder, currentRowOrder);
            const minCol = Math.min(dragStart.colIdx, colIdx);
            const maxCol = Math.max(dragStart.colIdx, colIdx);

            for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
                for (let nextCol = minCol; nextCol <= maxCol; nextCol++) {
                    next.add(makeCellId(displayRows[rowIndex].key, nextCol));
                }
            }
            return next;
        });
        setLastSelected(makeCellId(rowKey, colIdx));
    }, [displayRows, dragStart, rowOrder, setSelectedCells]);

    const handleCellDoubleClick = React.useCallback((rowKey: string, colIdx: number, val: string) => {
        if (!isDone) return;
        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;
        if (displayRow.kind === 'persisted' && !isEditable) {
            toast.error('Result is read-only. Make sure the query includes the primary key(s).');
            return;
        }

        const cellId = makeCellId(rowKey, colIdx);
        pendingSelectionRef.current = null;
        setEditingCell(cellId);
        setEditValue(isDatetimeLike(val) ? toDatetimeLocalValue(val) : val);
        setSelectedCells(new Set([cellId]));
        setLastSelected(cellId);
    }, [displayRowsByKey, isDone, isEditable, setSelectedCells, toast]);

    const commitEdit = React.useCallback(async (options?: { nextDirection?: 1 | -1 }) => {
        const currentEditingCell = editingCellRef.current;
        if (!currentEditingCell) return;

        const { rowKey, colIdx } = parseCellId(currentEditingCell);
        const displayRow = displayRowsRef.current.find((row) => row.key === rowKey);
        if (!displayRow) return;

        const nextValue = editValueRef.current;
        if (displayRow.kind === 'persisted') {
            setEditedCells((prev) => {
                const next = new Map(prev);
                next.set(`${displayRow.persistedIndex}:${colIdx}`, nextValue);
                return next;
            });
        } else {
            applyDraftValueUpdates([{ rowKey: displayRow.key, colIdx, value: nextValue }]);
        }

        const currentRowOrder = rowOrder.get(rowKey);
        if (options?.nextDirection && currentRowOrder !== undefined) {
            const nextColIdx = colIdx + options.nextDirection;
            if (nextColIdx >= 0 && nextColIdx < columns.length) {
                pendingSelectionRef.current = null;
                const nextCellId = makeCellId(rowKey, nextColIdx);
                const nextCellValue = displayRow.kind === 'persisted'
                    ? (editedCells.get(`${displayRow.persistedIndex}:${nextColIdx}`) ?? displayRow.values[nextColIdx] ?? '')
                    : (displayRow.values[nextColIdx] ?? '');
                setEditingCell(nextCellId);
                setEditValue(isDatetimeLike(nextCellValue) ? toDatetimeLocalValue(nextCellValue) : nextCellValue);
                setSelectedCells(new Set([nextCellId]));
                setLastSelected(nextCellId);
                return;
            }
        }

        setEditingCell(null);
        if (pendingSelectionRef.current) {
            const { cellId } = pendingSelectionRef.current;
            pendingSelectionRef.current = null;
            setSelectedCells(new Set([cellId]));
            setLastSelected(cellId);
            return;
        }

        setSelectedCells(new Set([makeCellId(rowKey, colIdx)]));
    }, [applyDraftValueUpdates, columns, editedCells, rowOrder, setEditedCells, setSelectedCells]);

    const handleRevertRow = React.useCallback((rowKey: string) => {
        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;

        if (displayRow.kind === 'draft') {
            onRemoveDraftRows([displayRow.draft!.id]);
            return;
        }

        const rowIndex = displayRow.persistedIndex as number;
        setEditedCells((prev) => {
            const next = new Map(prev);
            Array.from(next.keys()).forEach((key) => {
                if (key.startsWith(`${rowIndex}:`)) {
                    next.delete(key);
                }
            });
            return next;
        });

        if (setDeletedRows && deletedRows?.has(rowIndex)) {
            setDeletedRows((prev) => {
                const next = new Set(prev);
                next.delete(rowIndex);
                return next;
            });
        }
    }, [deletedRows, displayRowsByKey, onRemoveDraftRows, setDeletedRows, setEditedCells]);

    const colDefs = useMemo<ColumnDef<DisplayRow>[]>(() => {
        const rowNumCol: ColumnDef<DisplayRow> = {
            id: '__rownum__',
            header: () => (
                <div
                    title={isEditable
                        ? `Editable (${resultState?.tableName})`
                        : readOnlyMode
                            ? 'Read-only (View Mode)'
                            : 'Read-only (No Primary Key or missing PK in SELECT)'}
                    className="flex items-center justify-center gap-1 cursor-help opacity-70"
                >
                    <span className="font-mono text-[10px]">#</span>
                    {isEditable
                        ? <Unlock size={10} className="text-success" />
                        : <Lock size={10} className="text-text-muted" />}
                </div>
            ),
            enableSorting: false,
            size: 52,
            cell: ({ row, table }) => {
                const meta = table.options.meta as TableMeta | undefined;
                return (
                    <div
                        className="rt-cell-content row-num-col"
                        onDoubleClick={() => meta?.handleRevertRow?.(row.original.key)}
                        title={row.original.kind === 'draft' ? 'Double-click to remove this unsaved row' : 'Double-click to revert changes to this row'}
                    >
                        {row.original.kind === 'draft' ? '+' : (row.original.persistedIndex as number) + 1}
                    </div>
                );
            },
        };

        const dataCols: ColumnDef<DisplayRow>[] = columns.map((col, colIdx) => ({
            id: col || `col_${colIdx}`,
            header: col,
            accessorFn: (row) => row.values[colIdx] ?? '',
            sortingFn: 'alphanumeric',
            size: 140,
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
                        <input
                            autoFocus
                            className="rt-cell-input"
                            type={dtLike ? 'datetime-local' : 'text'}
                            step={dtLike ? '0.001' : undefined}
                            value={meta?.editValue ?? ''}
                            onChange={(event) => meta?.setEditValue?.(event.target.value)}
                            onKeyDown={async (event) => {
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
                        className={`rt-cell-content ${isSelected ? 'rt-cell-selected' : ''} ${isDirty ? 'rt-cell-dirty' : ''}`}
                        onMouseDown={(event) => meta?.handleCellMouseDown?.(event, rowKey, colIdx)}
                        onMouseEnter={() => meta?.handleCellMouseEnter?.(rowKey, colIdx)}
                        onDoubleClick={() => meta?.handleCellDoubleClick?.(rowKey, colIdx, String(value))}
                        title={String(value)}
                    >
                        {String(value)}
                    </div>
                );
            },
        }));

        return [rowNumCol, ...dataCols];
    }, [columns, commitEdit, isEditable, onRemoveDraftRows, resultState?.tableName]);

    const filteredRows = quickFilter.trim() ? deferredFilteredRows : displayRows;
    const tableData = shouldUseDeferredSort ? deferredSortedRows : filteredRows;

    useEffect(() => {
        const nextStats = {
            visibleRows: tableData.length,
            totalRows: displayRows.length,
        };
        const prev = lastViewStatsRef.current;
        if (prev && prev.visibleRows === nextStats.visibleRows && prev.totalRows === nextStats.totalRows) {
            return;
        }
        lastViewStatsRef.current = nextStats;
        onViewStatsChangeRef.current?.(nextStats);
    }, [displayRows.length, tableData.length]);
    const table = useReactTable<DisplayRow>({
        data: tableData,
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
            setEditingCell,
            handleRevertRow,
        },
        onSortingChange: canSortClientSide ? setSorting : undefined,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: shouldUseDeferredSort ? undefined : getSortedRowModel(),
        enableSorting: canSortClientSide,
    });

    const { rows: tableRows } = table.getRowModel();

    const virtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 20,
    });
    const columnVirtualizer = useVirtualizer({
        count: Math.max(columns.length, 0),
        horizontal: true,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 140,
        overscan: 8,
    });

    const virtualItems = virtualizer.getVirtualItems();
    const virtualColumns = columnVirtualizer.getVirtualItems();
    const fetchMoreRef = React.useRef(false);

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
        isDone,
        resultState?.hasMore,
        resultState?.isFetchingMore,
        rows.length,
        setOffset,
        tabId,
        tableRows.length,
        virtualItems,
    ]);

    const totalHeight = virtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
    const paddingBottom = virtualItems.length > 0
        ? totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0)
        : 0;
    const dataColumnTotalWidth = columnVirtualizer.getTotalSize();
    const columnPaddingLeft = virtualColumns.length > 0 ? (virtualColumns[0]?.start ?? 0) : 0;
    const columnPaddingRight = virtualColumns.length > 0
        ? dataColumnTotalWidth - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
        : 0;

    return (
        <div ref={parentRef} className="result-virtual-scroll">
            {(isDeferredSorting || isDeferredFiltering) && (
                <div className="px-3 py-1 text-[11px] text-text-secondary border-b border-border bg-bg-secondary/50">
                    {isDeferredFiltering
                        ? 'Applying incremental filter for loaded rows...'
                        : 'Applying incremental sort for large result set...'}
                </div>
            )}
            <table className="result-table-tanstack">
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {(() => {
                                const fixedHeader = headerGroup.headers[0];
                                const dynamicHeaders = headerGroup.headers.slice(1);
                                return (
                                    <>
                                        {fixedHeader && (() => {
                                            const sorted = fixedHeader.column.getIsSorted();
                                            const canSort = fixedHeader.column.getCanSort();
                                            return (
                                                <th
                                                    key={fixedHeader.id}
                                                    style={{ width: fixedHeader.getSize() }}
                                                    className={`rt-th ${canSort ? 'rt-th-sortable' : ''} ${sorted ? 'rt-th-sorted' : ''}`}
                                                    onClick={canSort ? fixedHeader.column.getToggleSortingHandler() : undefined}
                                                    title={canSort && !isDone ? 'Sort available after query completes' : undefined}
                                                >
                                                    <span className="rt-th-label">
                                                        {flexRender(fixedHeader.column.columnDef.header, fixedHeader.getContext())}
                                                        {sorted === 'asc' && <ArrowUp size={11} className="rt-sort-icon" />}
                                                        {sorted === 'desc' && <ArrowDown size={11} className="rt-sort-icon" />}
                                                    </span>
                                                </th>
                                            );
                                        })()}
                                        {columnPaddingLeft > 0 && (
                                            <th
                                                aria-hidden
                                                className="rt-th"
                                                style={{ width: columnPaddingLeft, minWidth: columnPaddingLeft }}
                                            />
                                        )}
                                        {virtualColumns.map((virtualColumn) => {
                                            const header = dynamicHeaders[virtualColumn.index];
                                            if (!header) return null;
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
                                        {columnPaddingRight > 0 && (
                                            <th
                                                aria-hidden
                                                className="rt-th"
                                                style={{ width: columnPaddingRight, minWidth: columnPaddingRight }}
                                            />
                                        )}
                                    </>
                                );
                            })()}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {paddingTop > 0 && (
                        <tr><td colSpan={columns.length + 1} style={{ height: paddingTop }} /></tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                        const row = tableRows[virtualRow.index];
                        const visibleCells = row.getVisibleCells();
                        const fixedCell = visibleCells[0];
                        const dynamicCells = visibleCells.slice(1);
                        const displayRow = row.original;
                        const isDeleted = displayRow.kind === 'persisted' && deletedRows?.has(displayRow.persistedIndex as number);
                        const altClass = virtualRow.index % 2 === 0 ? '' : 'rt-row-alt';
                        const hasRowSel = Array.from(selectedCells).some((cellId) => parseCellId(cellId).rowKey === displayRow.key);
                        const draftClass = displayRow.kind === 'draft' ? 'rt-row-draft' : '';
                        return (
                            <tr key={displayRow.key} className={`${altClass} ${draftClass} ${isDeleted ? 'rt-row-deleted' : ''} ${hasRowSel ? 'rt-row-selected' : ''}`}>
                                {fixedCell && (
                                    <td key={fixedCell.id} style={{ width: fixedCell.column.getSize() }}>
                                        {flexRender(fixedCell.column.columnDef.cell, fixedCell.getContext())}
                                    </td>
                                )}
                                {columnPaddingLeft > 0 && (
                                    <td
                                        aria-hidden
                                        style={{ width: columnPaddingLeft, minWidth: columnPaddingLeft }}
                                    />
                                )}
                                {virtualColumns.map((virtualColumn) => {
                                    const cell = dynamicCells[virtualColumn.index];
                                    if (!cell) return null;
                                    return (
                                        <td key={cell.id} style={{ width: cell.column.getSize() }}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    );
                                })}
                                {columnPaddingRight > 0 && (
                                    <td
                                        aria-hidden
                                        style={{ width: columnPaddingRight, minWidth: columnPaddingRight }}
                                    />
                                )}
                            </tr>
                        );
                    })}
                    {paddingBottom > 0 && (
                        <tr><td colSpan={columns.length + 1} style={{ height: paddingBottom }} /></tr>
                    )}
                    {resultState?.isFetchingMore && (
                        <tr>
                            <td
                                colSpan={columns.length + 1}
                                style={{
                                    textAlign: 'center',
                                    padding: '8px',
                                    background: 'var(--surface-app)',
                                }}
                            >
                                <div
                                    className="loading-spinner"
                                    style={{
                                        display: 'inline-block',
                                        width: 12,
                                        height: 12,
                                        border: '1.5px solid var(--border-default)',
                                        borderTopColor: 'var(--interactive-primary)',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite',
                                    }}
                                />
                                <span style={{ marginLeft: 8, color: 'var(--content-secondary)', fontSize: '11px', fontWeight: 500 }}>
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

