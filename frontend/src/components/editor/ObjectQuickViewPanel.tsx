import React from 'react';
import type { models } from '../../../wailsjs/go/models';
import { BaseTable, type BaseTableColumn } from '../ui';

interface ObjectQuickViewPanelProps {
    title: string;
    columns?: models.ColumnDef[];
    message?: string | null;
    loading?: boolean;
    onOpenDefinition?: (() => void) | null;
}

export const ObjectQuickViewPanel: React.FC<ObjectQuickViewPanelProps> = ({
    title,
    columns = [],
    message,
    loading = false,
    onOpenDefinition,
}) => {
    const tableRows = columns.map((column, index) => ({
        index: index + 1,
        name: column.Name || '',
        dataType: column.DataType || '',
        isPrimaryKey: Boolean(column.IsPrimaryKey),
    }));

    const tableColumns: Array<BaseTableColumn<(typeof tableRows)[number]>> = [
        {
            key: 'index',
            header: '#',
            width: '36px',
            renderCell: (row) => row.index,
        },
        {
            key: 'name',
            header: 'Name',
            width: '44%',
            renderCell: (row) => row.name,
        },
        {
            key: 'dataType',
            header: 'Data Type',
            width: '34%',
            renderCell: (row) => row.dataType,
        },
        {
            key: 'pk',
            header: 'PK',
            width: '54px',
            renderCell: (row) => (row.isPrimaryKey ? 'PK' : ''),
        },
    ];

    return (
        <div
            className="pointer-events-auto flex flex-col overflow-hidden rounded-md shadow"
            style={{
                width: 'min(560px, calc(100vw - 40px))',
                maxWidth: 'min(560px, calc(100vw - 40px))',
                height: 'min(340px, calc(100vh - 120px))',
                background: 'color-mix(in srgb, var(--surface-panel) 96%, black 4%)',
                borderColor: 'color-mix(in srgb, var(--border-primary) 85%, transparent)',
            }}
        >
        <div
            className="flex items-center justify-between gap-2.5 px-2.5 py-2"
            style={{
                borderBottom: '1px solid color-mix(in srgb, var(--border-primary) 80%, transparent)',
                background: 'color-mix(in srgb, var(--surface-elevated) 88%, transparent)',
            }}
        >
            <div className="min-w-0 flex-1">
                <button
                    type="button"
                    className="m-0 border-0 bg-transparent p-0 text-left text-[13px] font-bold text-[var(--content-primary)] whitespace-nowrap overflow-hidden text-ellipsis enabled:cursor-pointer enabled:hover:text-[var(--interactive-primary)] enabled:hover:underline enabled:hover:underline-offset-2 disabled:cursor-default"
                    title={onOpenDefinition ? 'Go to table info' : title}
                    onClick={() => onOpenDefinition?.()}
                    disabled={!onOpenDefinition}
                >
                    {title}
                </button>
            </div>
            <div className="ml-2.5 whitespace-nowrap text-[11px] text-[var(--content-secondary)]">
                {!loading && !message && columns.length > 0 ? `${columns.length} columns` : ''}
            </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2.5 pt-2 pb-2.5 [scrollbar-gutter:stable_both-edges]">
            {loading && <div className="px-0.5 py-2 text-[12px] text-[var(--content-secondary)]">Loading object info...</div>}
            {!loading && message && <div className="px-0.5 py-2 text-[12px] text-[var(--content-secondary)]">{message}</div>}
            {!loading && !message && columns.length === 0 && <div className="px-0.5 py-2 text-[12px] text-[var(--content-secondary)]">No columns found.</div>}
            {!loading && !message && columns.length > 0 && (
                <div className="h-full min-h-0">
                    <BaseTable
                        rows={tableRows}
                        columns={tableColumns}
                        fixedHeader
                        containerClassName="h-full"
                        getRowKey={(row) => `${row.name}:${row.index}`}
                    />
                </div>
            )}
        </div>
    </div>
    );
};
