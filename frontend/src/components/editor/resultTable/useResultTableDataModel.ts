import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { SortingState } from '@tanstack/react-table';

import { DraftRow, DisplayRow, buildDisplayRows } from '../../../lib/dataEditing';
import { resolveResultFetchStrategy } from '../../../features/query/resultStrategy';

import { DataColumnMeta } from './types';
import { makeDataColumnId } from './cellUtils';

interface UseResultTableDataModelArgs {
    columns: string[];
    rows: string[][];
    draftRows: DraftRow[];
    quickFilter: string;
    isDone: boolean;
    hasMore: boolean;
    disableClientSort?: boolean;
}

export interface ResultTableDataModel {
    displayRows: DisplayRow[];
    displayRowsByKey: Map<string, DisplayRow>;
    rowOrder: Map<string, number>;
    dataColumns: DataColumnMeta[];
    dataColumnById: Map<string, DataColumnMeta>;
    dataColumnIds: string[];
    sorting: SortingState;
    setSorting: Dispatch<SetStateAction<SortingState>>;
    canSortClientSide: boolean;
    shouldUseDeferredSort: boolean;
    tableData: DisplayRow[];
    isDeferredSorting: boolean;
    isDeferredFiltering: boolean;
    viewportStrategy: string;
}

export function useResultTableDataModel({
    columns,
    rows,
    draftRows,
    quickFilter,
    isDone,
    hasMore,
    disableClientSort = false,
}: UseResultTableDataModelArgs): ResultTableDataModel {
    const displayRows = useMemo(() => buildDisplayRows(rows, draftRows), [rows, draftRows]);
    const displayRowsByKey = useMemo(() => new Map(displayRows.map((row) => [row.key, row])), [displayRows]);
    const rowOrder = useMemo(() => new Map(displayRows.map((row, index) => [row.key, index])), [displayRows]);

    const viewportState = resolveResultFetchStrategy(displayRows.length, hasMore, isDone);
    const canSortClientSide = !disableClientSort && isDone && !hasMore;
    const shouldUseDeferredSort = canSortClientSide && viewportState.strategy === 'incremental_client';

    const [sorting, setSorting] = useState<SortingState>([]);
    const [deferredSortedRows, setDeferredSortedRows] = useState<DisplayRow[]>(displayRows);
    const [isDeferredSorting, setIsDeferredSorting] = useState(false);
    const [deferredFilteredRows, setDeferredFilteredRows] = useState<DisplayRow[]>(displayRows);
    const [isDeferredFiltering, setIsDeferredFiltering] = useState(false);

    useEffect(() => {
        if (!disableClientSort) return;
        setSorting([]);
    }, [disableClientSort]);

    const dataColumns = useMemo<DataColumnMeta[]>(
        () => columns.map((columnName, index) => ({
            id: makeDataColumnId(columnName, index),
            index,
            name: columnName || `col_${index}`,
        })),
        [columns],
    );
    const dataColumnById = useMemo(
        () => new Map(dataColumns.map((column) => [column.id, column])),
        [dataColumns],
    );
    const dataColumnIds = useMemo(
        () => dataColumns.map((column) => column.id),
        [dataColumns],
    );

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
            const columnIndex = dataColumnById.get(String(sortRule.id))?.index ?? -1;
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
    }, [dataColumnById, deferredFilteredRows, shouldUseDeferredSort, sorting]);

    const filteredRows = quickFilter.trim() ? deferredFilteredRows : displayRows;
    const tableData = shouldUseDeferredSort ? deferredSortedRows : filteredRows;

    return {
        displayRows,
        displayRowsByKey,
        rowOrder,
        dataColumns,
        dataColumnById,
        dataColumnIds,
        sorting,
        setSorting,
        canSortClientSide,
        shouldUseDeferredSort,
        tableData,
        isDeferredSorting,
        isDeferredFiltering,
        viewportStrategy: viewportState.strategy,
    };
}
