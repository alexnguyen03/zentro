import React from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { DisplayRow } from '../../../lib/dataEditing';
import { parseCellId } from './cellUtils';
import { SortableHeaderCell } from './SortableHeaderCell';
import { DataColumnMeta } from './types';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Spinner } from '../../ui';

interface ResultTableGridProps {
    parentRef: React.RefObject<HTMLDivElement>;
    table: Table<DisplayRow>;
    columnsLength: number;
    isDone: boolean;
    isDeferredSorting: boolean;
    isDeferredFiltering: boolean;
    isFetchingMore: boolean;
    columnOrder: string[];
    virtualItems: Array<{ index: number; start: number; end: number }>;
    renderedColumnIndexes: number[];
    columnPaddingLeft: number;
    columnPaddingRight: number;
    paddingTop: number;
    paddingBottom: number;
    dataColumnById: Map<string, DataColumnMeta>;
    dataTypeByColumn: Map<string, string>;
    columnFilterApplied: Record<string, string>;
    columnFilterDrafts: Record<string, string>;
    activeFilterPopoverColumn: string | null;
    setColumnFilterDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setActiveFilterPopoverColumn: React.Dispatch<React.SetStateAction<string | null>>;
    applyHeaderFilter: (columnId: string) => void;
    clearHeaderFilter: (columnId: string) => void;
    handleAutoFitColumn: (columnId: string) => void;
    handleHeaderDragEnd: (event: DragEndEvent) => void;
    selectedCells: Set<string>;
    deletedRows?: Set<number>;
}

export const ResultTableGrid: React.FC<ResultTableGridProps> = ({
    parentRef,
    table,
    columnsLength,
    isDone,
    isDeferredSorting,
    isDeferredFiltering,
    isFetchingMore,
    columnOrder,
    virtualItems,
    renderedColumnIndexes,
    columnPaddingLeft,
    columnPaddingRight,
    paddingTop,
    paddingBottom,
    dataColumnById,
    dataTypeByColumn,
    columnFilterApplied,
    columnFilterDrafts,
    activeFilterPopoverColumn,
    setColumnFilterDrafts,
    setActiveFilterPopoverColumn,
    applyHeaderFilter,
    clearHeaderFilter,
    handleAutoFitColumn,
    handleHeaderDragEnd,
    selectedCells,
    deletedRows,
}) => {
    const dndSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
    );
    const tableRows = table.getRowModel().rows;
    return (
        <div ref={parentRef} className="result-virtual-scroll">
            {(isDeferredSorting || isDeferredFiltering) && (
                <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border bg-card/50">
                    {isDeferredFiltering
                        ? 'Applying incremental filter for loaded rows...'
                        : 'Applying incremental sort for large result set...'}
                </div>
            )}
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleHeaderDragEnd}>
                <table className="result-table-tanstack">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => {
                            const fixedHeader = headerGroup.headers[0];
                            const dynamicHeaders = headerGroup.headers.slice(1);
                            return (
                                <tr key={headerGroup.id}>
                                    {fixedHeader && (() => {
                                        const sorted = fixedHeader.column.getIsSorted();
                                        const canSort = fixedHeader.column.getCanSort();
                                        return (
                                            <th
                                                key={fixedHeader.id}
                                                style={{ width: fixedHeader.getSize(), minWidth: fixedHeader.getSize(), maxWidth: fixedHeader.getSize() }}
                                                className={`rt-th rt-index-sticky ${canSort ? 'rt-th-sortable' : ''} ${sorted ? 'rt-th-sorted' : ''}`}
                                                onClick={canSort ? fixedHeader.column.getToggleSortingHandler() : undefined}
                                                title={canSort && !isDone ? 'Sort available after query completes' : undefined}
                                            >
                                                <span className="rt-th-label justify-center">
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
                                            style={{ width: columnPaddingLeft, minWidth: columnPaddingLeft, maxWidth: columnPaddingLeft }}
                                        />
                                    )}
                                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                                        {renderedColumnIndexes.map((columnIndex) => {
                                            const header = dynamicHeaders[columnIndex];
                                            if (!header) return null;
                                            const sorted = header.column.getIsSorted();
                                            const canSort = header.column.getCanSort();
                                            const columnId = String(header.column.id);
                                            const columnMeta = dataColumnById.get(columnId);
                                            const columnName = columnMeta?.name || columnId;
                                            const isFilterOpen = activeFilterPopoverColumn === columnId;
                                            const isFilterActive = Boolean((columnFilterApplied[columnId] || '').trim());
                                            const dataTypeLabel = dataTypeByColumn.get(columnName) || 'unknown';
                                            return (
                                                <SortableHeaderCell
                                                    key={header.id}
                                                    header={header}
                                                    className={`rt-th ${canSort ? 'rt-th-sortable' : ''} ${sorted ? 'rt-th-sorted' : ''}`}
                                                    onSortToggle={canSort ? header.column.getToggleSortingHandler() : undefined}
                                                    onAutoFit={() => handleAutoFitColumn(columnId)}
                                                    title={canSort && !isDone ? 'Sort available after query completes' : undefined}
                                                >
                                                    <div className="rt-th-content">
                                                        <span className="rt-th-label">
                                                            <span className="rt-th-name">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                                                            <span className="rt-th-type">{dataTypeLabel}</span>
                                                            {sorted === 'asc' && <ArrowUp size={11} className="rt-sort-icon" />}
                                                            {sorted === 'desc' && <ArrowDown size={11} className="rt-sort-icon" />}
                                                        </span>
                                                        <Popover
                                                            open={isFilterOpen}
                                                            onOpenChange={(open) => setActiveFilterPopoverColumn(open ? columnId : null)}
                                                        >
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={`rt-th-filter-btn ${isFilterActive ? 'is-active' : ''}`}
                                                                    title="Filter this column"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setColumnFilterDrafts((prev) => ({
                                                                            ...prev,
                                                                            [columnId]: prev[columnId] ?? columnFilterApplied[columnId] ?? '',
                                                                        }));
                                                                    }}
                                                                >
                                                                    <Search size={10} />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent
                                                                align="end"
                                                                sideOffset={4}
                                                                className="rt-th-filter-popover p-2"
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                <div className="rt-th-filter-input-row">
                                                                    <Input
                                                                        autoFocus
                                                                        className="rt-th-filter-input h-6"
                                                                        value={columnFilterDrafts[columnId] ?? columnFilterApplied[columnId] ?? ''}
                                                                        onChange={(event) => setColumnFilterDrafts((prev) => ({ ...prev, [columnId]: event.target.value }))}
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                applyHeaderFilter(columnId);
                                                                            } else if (event.key === 'Escape') {
                                                                                event.preventDefault();
                                                                                clearHeaderFilter(columnId);
                                                                            }
                                                                        }}
                                                                        placeholder={`Contains in ${columnName}`}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="rt-th-filter-input-clear h-6 w-6 p-0"
                                                                        title="Clear filter"
                                                                        onClick={() => clearHeaderFilter(columnId)}
                                                                    >
                                                                        <X size={10} />
                                                                    </Button>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </SortableHeaderCell>
                                            );
                                        })}
                                    </SortableContext>
                                    {columnPaddingRight > 0 && (
                                        <th
                                            aria-hidden
                                            className="rt-th"
                                            style={{ width: columnPaddingRight, minWidth: columnPaddingRight, maxWidth: columnPaddingRight }}
                                        />
                                    )}
                                </tr>
                            );
                        })}
                    </thead>
                    <tbody>
                        {paddingTop > 0 && (
                            <tr><td colSpan={columnsLength + 1} style={{ height: paddingTop }} /></tr>
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
                                        <td
                                            key={fixedCell.id}
                                            style={{ width: fixedCell.column.getSize(), minWidth: fixedCell.column.getSize(), maxWidth: fixedCell.column.getSize() }}
                                            className="rt-index-sticky"
                                        >
                                            {flexRender(fixedCell.column.columnDef.cell, fixedCell.getContext())}
                                        </td>
                                    )}
                                    {columnPaddingLeft > 0 && (
                                        <td
                                            aria-hidden
                                            style={{ width: columnPaddingLeft, minWidth: columnPaddingLeft, maxWidth: columnPaddingLeft }}
                                        />
                                    )}
                                    {renderedColumnIndexes.map((columnIndex) => {
                                        const cell = dynamicCells[columnIndex];
                                        if (!cell) return null;
                                        return (
                                            <td key={cell.id} style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        );
                                    })}
                                    {columnPaddingRight > 0 && (
                                        <td
                                            aria-hidden
                                            style={{ width: columnPaddingRight, minWidth: columnPaddingRight, maxWidth: columnPaddingRight }}
                                        />
                                    )}
                                </tr>
                            );
                        })}
                        {paddingBottom > 0 && (
                            <tr><td colSpan={columnsLength + 1} style={{ height: paddingBottom }} /></tr>
                        )}
                        {isFetchingMore && (
                            <tr>
                                <td colSpan={columnsLength + 1} className="bg-background px-2 py-2 text-center">
                                    <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground">
                                        <Spinner size={12} tone="primary" />
                                        <span className="ml-2">Loading more rows...</span>
                                    </span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </DndContext>
        </div>
    );
};
