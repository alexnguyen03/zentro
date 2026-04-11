import React from 'react';
import { cn } from '../../lib/cn';

export type BaseTableAlign = 'left' | 'center' | 'right';

export interface BaseTableColumn<T> {
    key: string;
    header: React.ReactNode;
    width?: string;
    align?: BaseTableAlign;
    headerClassName?: string;
    cellClassName?: string;
    renderCell: (row: T, rowIndex: number) => React.ReactNode;
}

interface BaseTableProps<T> {
    rows: T[];
    columns: Array<BaseTableColumn<T>>;
    fixedHeader?: boolean;
    className?: string;
    containerClassName?: string;
    emptyMessage?: string;
    getRowKey?: (row: T, rowIndex: number) => string;
    onRowClick?: (row: T, rowIndex: number, event: React.MouseEvent<HTMLTableRowElement>) => void;
    getRowClassName?: (row: T, rowIndex: number) => string | undefined;
}

function alignClassName(align: BaseTableAlign | undefined): string {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
}

export function BaseTable<T>({
    rows,
    columns,
    fixedHeader = false,
    className,
    containerClassName,
    emptyMessage = 'No data found.',
    getRowKey,
    onRowClick,
    getRowClassName,
}: BaseTableProps<T>) {
    return (
        <div
            className={cn('w-full overflow-auto rounded-sm', containerClassName)}
            style={{
                background: 'var(--surface-panel)',
            }}
        >
            <table className={cn('w-full border-collapse table-fixed text-[12px]', className)}>
                <colgroup>
                    {columns.map((column) => (
                        <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className={cn(
                                    'px-1.5 py-1.5 text-(--content-secondary) font-bold whitespace-nowrap overflow-hidden text-ellipsis',
                                    fixedHeader && 'sticky top-0 z-(--layer-table-sticky)',
                                    alignClassName(column.align),
                                    column.headerClassName,
                                )}
                                style={{
                                    background: 'var(--surface-elevated)',
                                }}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                className="px-2 py-2.5 text-center text-(--content-secondary) border-b-0"
                                colSpan={columns.length}
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, rowIndex) => (
                            <tr
                                key={getRowKey ? getRowKey(row, rowIndex) : String(rowIndex)}
                                className={cn(
                                    'transition-colors hover:bg-[color-mix(in_srgb,var(--content-primary)_8%,transparent)]',
                                    onRowClick && 'cursor-pointer',
                                    getRowClassName?.(row, rowIndex),
                                )}
                                style={{
                                    background: rowIndex % 2 === 0
                                        ? 'color-mix(in srgb, var(--surface-panel) 82%, transparent)'
                                        : 'color-mix(in srgb, var(--surface-panel) 70%, transparent)',
                                }}
                                onClick={onRowClick ? (event) => onRowClick(row, rowIndex, event) : undefined}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={cn(
                                            'px-1.5 py-1.5 text-(--content-primary) whitespace-nowrap overflow-hidden text-ellipsis',
                                            alignClassName(column.align),
                                            column.cellClassName,
                                        )}
                                    >
                                        {column.renderCell(row, rowIndex)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
