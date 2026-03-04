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
import { Loader, ArrowUp, ArrowDown } from 'lucide-react';

interface ResultTableProps {
    tabId: string;
    columns: string[];
    rows: string[][];
    isDone: boolean;
}

export const ResultTable: React.FC<ResultTableProps> = ({ tabId, columns, rows, isDone }) => {
    const { results, setOffset } = useResultStore();
    const resultState = results[tabId];

    // Disable sorting locally if we haven't loaded everything yet (true infinite scroll limitation)
    const canSortClientSide = isDone && !resultState?.hasMore;
    const [sorting, setSorting] = useState<SortingState>([]);
    const parentRef = React.useRef<HTMLDivElement>(null);

    // Batch Edit States
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [editedCells, setEditedCells] = useState<Map<string, string>>(new Map());
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [lastSelected, setLastSelected] = useState<string | null>(null);

    useEffect(() => {
        if (!isDone) {
            setSelectedCells(new Set());
            setEditedCells(new Map());
            setEditingCell(null);
            setLastSelected(null);
        }
    }, [isDone, rows]); // Reset on new query

    const handleCellClick = (e: React.MouseEvent, rIdx: number, cIdx: number) => {
        if (!isDone) return;
        const id = `${rIdx}:${cIdx}`;

        if (e.shiftKey && lastSelected) {
            const [lastR, lastC] = lastSelected.split(':').map(Number);
            if (lastC === cIdx) { // range select works on same col only
                const newSel = new Set(selectedCells);
                const min = Math.min(lastR, rIdx);
                const max = Math.max(lastR, rIdx);
                for (let i = min; i <= max; i++) {
                    newSel.add(`${i}:${cIdx}`);
                }
                setSelectedCells(newSel);
                return;
            }
        }

        if (e.ctrlKey || e.metaKey) {
            const newSel = new Set(selectedCells);
            if (newSel.has(id)) newSel.delete(id); else newSel.add(id);
            setSelectedCells(newSel);
        } else {
            setSelectedCells(new Set([id]));
        }
        setLastSelected(id);
    };

    const handleCellDoubleClick = (rIdx: number, cIdx: number, val: string) => {
        if (!isDone) return;
        const id = `${rIdx}:${cIdx}`;
        setEditingCell(id);
        setEditValue(val);
        if (!selectedCells.has(id)) {
            setSelectedCells(new Set([id]));
            setLastSelected(id);
        }
    };

    const handleCommitEdit = () => {
        if (!editingCell) return;
        const [rIdx, cIdx] = editingCell.split(':').map(Number);

        const newMap = new Map(editedCells);
        // Propagate to all selected cells in the SAME col
        selectedCells.forEach(selId => {
            const [selR, selC] = selId.split(':').map(Number);
            if (selC === cIdx) {
                newMap.set(selId, editValue);
            }
        });

        setEditedCells(newMap);
        setEditingCell(null);
    };

    // Build TanStack column definitions
    const colDefs = useMemo<ColumnDef<string[]>[]>(() => {
        const rowNumCol: ColumnDef<string[]> = {
            id: '__rownum__',
            header: '#',
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
            cell: ({ row, getValue }) => {
                const cellId = `${row.index}:${colIdx}`;
                const isSelected = selectedCells.has(cellId);
                const isDirty = editedCells.has(cellId);
                const isEditing = editingCell === cellId;
                const origVal = getValue() as string;
                const value = isDirty ? editedCells.get(cellId)! : origVal;

                if (isEditing) {
                    return (
                        <input
                            autoFocus
                            className="rt-cell-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitEdit();
                                else if (e.key === 'Escape') setEditingCell(null);
                            }}
                            onBlur={handleCommitEdit}
                            onClick={e => e.stopPropagation()}
                        />
                    );
                }

                return (
                    <div
                        className={`rt-cell-content ${isSelected ? 'rt-cell-selected' : ''} ${isDirty ? 'rt-cell-dirty' : ''}`}
                        onClick={(e) => handleCellClick(e, row.index, colIdx)}
                        onDoubleClick={() => handleCellDoubleClick(row.index, colIdx, String(value))}
                        title={String(value)}
                    >
                        {String(value)}
                    </div>
                );
            }
        }));

        return [rowNumCol, ...dataCols];
    }, [columns, selectedCells, editedCells, editingCell, editValue, isDone]);

    const table = useReactTable({
        data: rows,
        columns: colDefs,
        state: { sorting },
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
        if (!virtualItems.length || !isDone || !resultState?.hasMore) return;
        const lastItem = virtualItems[virtualItems.length - 1];
        if (lastItem.index >= tableRows.length - 15) {
            // Trigger fetch
            const currentOffset = resultState.offset || 0;
            const newOffset = currentOffset + rows.length;
            setOffset(tabId, newOffset);
            FetchMoreRows(tabId, newOffset).catch(console.error);
        }
    }, [
        virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0,
        isDone,
        resultState?.hasMore
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

            {!isDone && results[tabId]?.offset > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0', color: 'var(--text-secondary)', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <Loader size={14} className="result-spinner" /> Loading more rows...
                </div>
            )}
        </div>
    );
};
