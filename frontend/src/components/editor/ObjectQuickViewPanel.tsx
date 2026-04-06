import React from 'react';
import type { models } from '../../../wailsjs/go/models';
import { Button } from '../ui';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';

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
    const hasColumns = columns.length > 0;
    const showCount = !loading && !message && hasColumns;

    // Compute empty-state message: shown when loading, backend message, or no columns
    const emptyStateMessage = loading
        ? 'Loading object info...'
        : message || 'No columns found.';

    const showEmptyState = loading || !!message || !hasColumns;

    return (
        <div
            className="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-elevation-md"
            style={{
                width: 'min(560px, calc(100vw - 40px))',
                maxWidth: 'min(560px, calc(100vw - 40px))',
                height: 'min(340px, calc(100vh - 120px))',
            }}
        >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background/35 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="m-0 h-auto max-w-full justify-start p-0 text-left text-[13px] font-semibold text-foreground enabled:hover:text-primary enabled:hover:underline enabled:hover:underline-offset-2 disabled:cursor-default disabled:text-foreground"
                        title={onOpenDefinition ? 'Go to table info' : title}
                        onClick={() => onOpenDefinition?.()}
                        disabled={!onOpenDefinition}
                    >
                        <span className="truncate">{title}</span>
                    </Button>
                </div>
                <div className="ml-2 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                    {showCount ? `${columns.length} columns` : ''}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-3 py-2.5 [scrollbar-gutter:stable_both-edges]">
                {showEmptyState && (
                    <div className="rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-[12px] text-muted-foreground">
                        {emptyStateMessage}
                    </div>
                )}

                {!loading && !message && hasColumns && (
                    <div className="overflow-hidden rounded-md border border-border bg-background/30">
                        <Table className="table-fixed text-[12px]">
                            <colgroup>
                                <col style={{ width: '42px' }} />
                                <col style={{ width: '44%' }} />
                                <col style={{ width: '34%' }} />
                                <col style={{ width: '64px' }} />
                            </colgroup>
                            <TableHeader className="sticky top-0 z-sticky bg-muted/70">
                                <TableRow>
                                    <TableHead className="h-auto px-2 py-1.5 text-[11px] font-semibold">#</TableHead>
                                    <TableHead className="h-auto px-2 py-1.5 text-[11px] font-semibold">Name</TableHead>
                                    <TableHead className="h-auto px-2 py-1.5 text-[11px] font-semibold">Data Type</TableHead>
                                    <TableHead className="h-auto px-2 py-1.5 text-[11px] font-semibold">PK</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {columns.map((column, index) => (
                                    <TableRow key={`${column.Name ?? ''}:${index}`} className="border-border/60 hover:bg-muted/35">
                                        <TableCell className="px-2 py-1.5 text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="truncate px-2 py-1.5 text-foreground" title={column.Name ?? ''}>{column.Name ?? ''}</TableCell>
                                        <TableCell className="truncate px-2 py-1.5 text-foreground" title={column.DataType ?? ''}>{column.DataType ?? ''}</TableCell>
                                        <TableCell className="px-2 py-1.5">
                                            {column.IsPrimaryKey ? (
                                                <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">PK</span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
};
