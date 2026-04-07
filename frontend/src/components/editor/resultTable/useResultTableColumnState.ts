import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { DragEndEvent } from '@dnd-kit/core';

import { DisplayRow } from '../../../lib/dataEditing';
import {
    buildHeaderColumnFilterExpr,
    computeAutoFitWidth,
    reorderDataColumnIds,
} from '../resultTableUtils';

import { DataColumnMeta } from './types';
import { getDragIds } from './cellUtils';

interface UseResultTableColumnStateArgs {
    dataColumnIds: string[];
    dataColumnById: Map<string, DataColumnMeta>;
    dataTypeByColumn: Map<string, string>;
    tableData: DisplayRow[];
    filterExpr: string;
    driver?: string;
    onHeaderFilterRun?: (filterExpr: string) => void;
}

export interface ResultTableColumnState {
    columnOrder: string[];
    tableColumnOrder: string[];
    setColumnOrder: Dispatch<SetStateAction<string[]>>;
    columnSizing: Record<string, number>;
    setColumnSizing: Dispatch<SetStateAction<Record<string, number>>>;
    columnVisibility: Record<string, boolean>;
    setColumnVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
    columnFilterDrafts: Record<string, string>;
    setColumnFilterDrafts: Dispatch<SetStateAction<Record<string, string>>>;
    columnFilterApplied: Record<string, string>;
    activeFilterPopoverColumn: string | null;
    setActiveFilterPopoverColumn: Dispatch<SetStateAction<string | null>>;
    applyHeaderFilter: (columnId: string) => void;
    clearHeaderFilter: (columnId: string) => void;
    handleHeaderDragEnd: (event: DragEndEvent) => void;
    handleAutoFitColumn: (columnId: string) => void;
}

export function useResultTableColumnState({
    dataColumnIds,
    dataColumnById,
    dataTypeByColumn,
    tableData,
    filterExpr,
    driver,
    onHeaderFilterRun,
}: UseResultTableColumnStateArgs): ResultTableColumnState {
    const [columnOrder, setColumnOrder] = useState<string[]>(dataColumnIds);
    const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
    const [columnFilterDrafts, setColumnFilterDrafts] = useState<Record<string, string>>({});
    const [columnFilterApplied, setColumnFilterApplied] = useState<Record<string, string>>({});
    const [activeFilterPopoverColumn, setActiveFilterPopoverColumn] = useState<string | null>(null);

    const tableColumnOrder = useMemo(() => ['__rownum__', ...columnOrder], [columnOrder]);

    useEffect(() => {
        setColumnOrder((prev) => {
            const alive = new Set(dataColumnIds);
            const kept = prev.filter((id) => alive.has(id));
            const missing = dataColumnIds.filter((id) => !kept.includes(id));
            return [...kept, ...missing];
        });

        setColumnSizing((prev) => Object.fromEntries(
            Object.entries(prev).filter(([key]) => key === '__rownum__' || dataColumnIds.includes(key)),
        ));
        setColumnFilterDrafts((prev) => Object.fromEntries(
            Object.entries(prev).filter(([key]) => dataColumnIds.includes(key)),
        ));
        setColumnFilterApplied((prev) => Object.fromEntries(
            Object.entries(prev).filter(([key]) => dataColumnIds.includes(key)),
        ));
    }, [dataColumnIds]);

    useEffect(() => {
        if (filterExpr.trim()) return;
        setColumnFilterApplied({});
        setColumnFilterDrafts({});
        setActiveFilterPopoverColumn(null);
    }, [filterExpr]);

    const applyHeaderFilter = useCallback((columnId: string) => {
        const nextApplied = { ...columnFilterApplied };
        const draft = (columnFilterDrafts[columnId] || '').trim();
        if (!draft) {
            delete nextApplied[columnId];
        } else {
            nextApplied[columnId] = draft;
        }
        setColumnFilterApplied(nextApplied);
        const nextAppliedByColumnName = Object.fromEntries(
            Object.entries(nextApplied).map(([nextColumnId, value]) => [
                dataColumnById.get(nextColumnId)?.name || nextColumnId,
                value,
            ]),
        );
        onHeaderFilterRun?.(buildHeaderColumnFilterExpr(nextAppliedByColumnName, driver));
        setActiveFilterPopoverColumn(null);
    }, [columnFilterApplied, columnFilterDrafts, dataColumnById, driver, onHeaderFilterRun]);

    const clearHeaderFilter = useCallback((columnId: string) => {
        const nextApplied = { ...columnFilterApplied };
        delete nextApplied[columnId];
        setColumnFilterApplied(nextApplied);
        setColumnFilterDrafts((prev) => ({ ...prev, [columnId]: '' }));
        const nextAppliedByColumnName = Object.fromEntries(
            Object.entries(nextApplied).map(([nextColumnId, value]) => [
                dataColumnById.get(nextColumnId)?.name || nextColumnId,
                value,
            ]),
        );
        onHeaderFilterRun?.(buildHeaderColumnFilterExpr(nextAppliedByColumnName, driver));
        setActiveFilterPopoverColumn(null);
    }, [columnFilterApplied, dataColumnById, driver, onHeaderFilterRun]);

    const handleHeaderDragEnd = useCallback((event: DragEndEvent) => {
        const { activeId, overId } = getDragIds(event);
        if (!overId || !activeId || activeId === overId) return;
        setColumnOrder((prev) => reorderDataColumnIds(prev, activeId, overId));
    }, []);

    const handleAutoFitColumn = useCallback((columnId: string) => {
        const columnMeta = dataColumnById.get(columnId);
        if (!columnMeta) return;
        const colIdx = columnMeta.index;
        const columnName = columnMeta.name;

        const sampledRows = tableData.slice(0, 5000);
        const texts = [
            columnName,
            dataTypeByColumn.get(columnName) || '',
            ...sampledRows.map((row) => row.values[colIdx] ?? ''),
        ];
        const width = computeAutoFitWidth(texts);
        setColumnSizing((prev) => ({ ...prev, [columnId]: width }));
    }, [dataColumnById, dataTypeByColumn, tableData]);

    return {
        columnOrder,
        tableColumnOrder,
        setColumnOrder,
        columnSizing,
        setColumnSizing,
        columnVisibility,
        setColumnVisibility,
        columnFilterDrafts,
        setColumnFilterDrafts,
        columnFilterApplied,
        activeFilterPopoverColumn,
        setActiveFilterPopoverColumn,
        applyHeaderFilter,
        clearHeaderFilter,
        handleHeaderDragEnd,
        handleAutoFitColumn,
    };
}
