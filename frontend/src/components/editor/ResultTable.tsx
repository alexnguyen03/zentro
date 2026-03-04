import React, { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface ResultTableProps {
    columns: string[];
    rows: string[][];
    isDone: boolean;
}

export const ResultTable: React.FC<ResultTableProps> = ({ columns, rows, isDone }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const parentRef = React.useRef<HTMLDivElement>(null);

    // Build TanStack column definitions
    const colDefs = useMemo<ColumnDef<string[]>[]>(() => {
        const rowNumCol: ColumnDef<string[]> = {
            id: '__rownum__',
            header: '#',
            enableSorting: false,
            size: 52,
            cell: ({ row }) => row.index + 1,
        };

        const dataCols: ColumnDef<string[]>[] = columns.map((col, colIdx) => ({
            id: col || `col_${colIdx}`,
            header: col,
            accessorFn: (row: string[]) => row[colIdx] ?? '',
            sortingFn: 'alphanumeric',
            size: 140,
        }));

        return [rowNumCol, ...dataCols];
    }, [columns]);

    const table = useReactTable({
        data: rows,
        columns: colDefs,
        state: { sorting },
        onSortingChange: isDone ? setSorting : undefined,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        enableSorting: isDone,
    });

    const { rows: tableRows } = table.getRowModel();

    const virtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 30,
        overscan: 20,
    });

    const virtualItems = virtualizer.getVirtualItems();
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
                                    <td key={cell.id} style={{ width: cell.column.getSize() }} title={String(cell.getValue() ?? '')}>
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
