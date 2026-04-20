import React, { useMemo } from 'react';
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';

import { DisplayRow } from '../../lib/dataEditing';
import { useResultStore, type TabResult } from '../../stores/resultStore';
import { normalizeDataTypeLabel } from './resultTableUtils';
import { useToast } from '../layout/Toast';

import { ResultTableGrid } from './resultTable/ResultTableGrid';
import { useResultTableColumns } from './resultTable/useResultTableColumns';
import { useResultTableColumnState } from './resultTable/useResultTableColumnState';
import { useResultTableDataModel } from './resultTable/useResultTableDataModel';
import { useResultTableInteractions } from './resultTable/useResultTableInteractions';
import { useResultTableViewStats } from './resultTable/useResultTableViewStats';
import { useResultTableVirtualization } from './resultTable/useResultTableVirtualization';
import type { ResultTableProps } from './resultTable/types';

export type { FocusCellRequest, ResultCellContextMenuPayload } from './resultTable/types';

export const ResultTable: React.FC<ResultTableProps> = ({
    tabId,
    columns,
    rows,
    isDone,
    editedCells,
    setEditedCells,
    selectedCells,
    setSelectedCells,
    selectedRowKeys,
    setSelectedRowKeys,
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
    onCellContextMenu,
    onRowHeaderContextMenu,
    columnVisibility: externalColumnVisibility,
    onColumnVisibilityChange: externalSetColumnVisibility,
}) => {
    const { results, setOffset } = useResultStore();
    const { toast } = useToast();
    const resultState = results[tabId] as TabResult | undefined;
    const hasMore = Boolean(resultState?.hasMore);
    const hasServerOrder = Boolean((resultState?.orderByExpr || '').trim());

    const dataModel = useResultTableDataModel({
        columns,
        rows,
        draftRows,
        quickFilter,
        isDone,
        hasMore,
        disableClientSort: hasServerOrder,
    });

    const isEditable = useMemo(() => {
        if (readOnlyMode) return false;
        if (!resultState?.tableName || !resultState?.primaryKeys?.length) return false;
        if (!columns.length) return false;
        return resultState.primaryKeys.every((primaryKey) => columns.includes(primaryKey));
    }, [columns, readOnlyMode, resultState?.primaryKeys, resultState?.tableName]);

    const dataTypeByColumn = useMemo(() => {
        const map = new Map<string, string>();
        columnDefs.forEach((columnDef) => {
            map.set(columnDef.Name, normalizeDataTypeLabel(columnDef.DataType));
        });
        return map;
    }, [columnDefs]);

    const columnState = useResultTableColumnState({
        dataColumnIds: dataModel.dataColumnIds,
        dataColumnById: dataModel.dataColumnById,
        dataTypeByColumn,
        tableData: dataModel.tableData,
    });

    const interactions = useResultTableInteractions({
        tabId,
        isDone,
        columns,
        rows,
        selectedCells,
        setSelectedCells,
        selectedRowKeys,
        setSelectedRowKeys,
        editedCells,
        setEditedCells,
        deletedRows,
        setDeletedRows,
        setDraftRows,
        displayRows: dataModel.displayRows,
        displayRowsByKey: dataModel.displayRowsByKey,
        rowOrder: dataModel.rowOrder,
        isEditable,
        focusCellRequest,
        onFocusCellRequestHandled,
        onRemoveDraftRows,
        onCellContextMenu,
        onRowHeaderContextMenu,
        onReadOnlyEditAttempt: () => {
            toast.error('Result is read-only. Make sure the query includes the primary key(s).');
        },
    });

    const tableColumns = useResultTableColumns({
        dataColumns: dataModel.dataColumns,
        isEditable,
        readOnlyMode,
        tableName: resultState?.tableName,
        onRemoveDraftRows,
        commitEdit: interactions.commitEdit,
        emitSaveShortcut: interactions.emitSaveShortcut,
    });

    const activeColumnVisibility = externalColumnVisibility ?? columnState.columnVisibility;
    const activeSetColumnVisibility = externalSetColumnVisibility ?? columnState.setColumnVisibility;

    const table = useReactTable<DisplayRow>({
        data: dataModel.tableData,
        columns: tableColumns,
        state: {
            sorting: dataModel.sorting,
            columnOrder: columnState.tableColumnOrder,
            columnSizing: columnState.columnSizing,
            columnVisibility: activeColumnVisibility,
        },
        meta: interactions.tableMeta,
        onSortingChange: dataModel.canSortClientSide ? dataModel.setSorting : undefined,
        onColumnSizingChange: columnState.setColumnSizing,
        onColumnVisibilityChange: activeSetColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: dataModel.shouldUseDeferredSort ? undefined : getSortedRowModel(),
        enableSorting: dataModel.canSortClientSide,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
    });

    const virtualization = useResultTableVirtualization({
        tabId,
        isDone,
        hasMore,
        isFetchingMore: Boolean(resultState?.isFetchingMore),
        queryStartedAt: resultState?.progress?.startedAt,
        tableRowsLength: table.getRowModel().rows.length,
        columnsLength: columns.length,
        loadedRowsLength: rows.length,
        setOffset,
    });

    useResultTableViewStats(
        dataModel.tableData.length,
        dataModel.displayRows.length,
        onViewStatsChange,
    );

    return (
        <ResultTableGrid
            parentRef={virtualization.parentRef}
            table={table}
            columnsLength={columns.length}
            isDone={isDone}
            isDeferredSorting={dataModel.isDeferredSorting}
            isDeferredFiltering={dataModel.isDeferredFiltering}
            isFetchingMore={Boolean(resultState?.isFetchingMore)}
            columnOrder={columnState.columnOrder}
            virtualItems={virtualization.virtualItems}
            renderedColumnIndexes={virtualization.renderedColumnIndexes}
            columnPaddingLeft={virtualization.columnPaddingLeft}
            columnPaddingRight={virtualization.columnPaddingRight}
            paddingTop={virtualization.paddingTop}
            paddingBottom={virtualization.paddingBottom}
            dataColumnById={dataModel.dataColumnById}
            dataTypeByColumn={dataTypeByColumn}
            handleAutoFitColumn={columnState.handleAutoFitColumn}
            handleHeaderDragEnd={columnState.handleHeaderDragEnd}
            selectedCells={selectedCells}
            selectedRowKeys={selectedRowKeys}
            deletedRows={deletedRows}
        />
    );
};
