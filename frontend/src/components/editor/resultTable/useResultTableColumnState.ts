import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { DragEndEvent } from '@dnd-kit/core';

import { DisplayRow } from '../../../lib/dataEditing';
import {
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
}

export interface ResultTableColumnState {
    columnOrder: string[];
    tableColumnOrder: string[];
    setColumnOrder: Dispatch<SetStateAction<string[]>>;
    columnSizing: Record<string, number>;
    setColumnSizing: Dispatch<SetStateAction<Record<string, number>>>;
    columnVisibility: Record<string, boolean>;
    setColumnVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
    handleHeaderDragEnd: (event: DragEndEvent) => void;
    handleAutoFitColumn: (columnId: string) => void;
}

export function useResultTableColumnState({
    dataColumnIds,
    dataColumnById,
    dataTypeByColumn,
    tableData,
}: UseResultTableColumnStateArgs): ResultTableColumnState {
    const [columnOrder, setColumnOrder] = useState<string[]>(dataColumnIds);
    const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

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
    }, [dataColumnIds]);

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
        handleHeaderDragEnd,
        handleAutoFitColumn,
    };
}
