import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { FetchMoreRows } from '../../../services/queryService';

interface UseResultTableVirtualizationArgs {
    tabId: string;
    isDone: boolean;
    hasMore: boolean;
    isFetchingMore: boolean;
    queryStartedAt?: number;
    tableRowsLength: number;
    columnsLength: number;
    loadedRowsLength: number;
    setOffset: (tabId: string, offset: number) => void;
}

export interface ResultTableVirtualization {
    parentRef: RefObject<HTMLDivElement>;
    virtualItems: Array<{ index: number; start: number; end: number }>;
    renderedColumnIndexes: number[];
    paddingTop: number;
    paddingBottom: number;
    columnPaddingLeft: number;
    columnPaddingRight: number;
}

export function useResultTableVirtualization({
    tabId,
    isDone,
    hasMore,
    isFetchingMore,
    queryStartedAt,
    tableRowsLength,
    columnsLength,
    loadedRowsLength,
    setOffset,
}: UseResultTableVirtualizationArgs): ResultTableVirtualization {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: tableRowsLength,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 22,
        overscan: 20,
    });
    const columnVirtualizer = useVirtualizer({
        count: Math.max(columnsLength, 0),
        horizontal: true,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 140,
        overscan: 8,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const virtualColumns = columnVirtualizer.getVirtualItems();
    const renderedColumnIndexes = useMemo(
        () => (virtualColumns.length > 0
            ? virtualColumns.map((virtualColumn) => virtualColumn.index)
            : Array.from({ length: columnsLength }, (_, index) => index)),
        [columnsLength, virtualColumns],
    );

    const fetchMoreRef = useRef(false);
    const loadMoreZoneArmedRef = useRef(true);

    useEffect(() => {
        if (!queryStartedAt) return;
        const scrollEl = parentRef.current;
        if (!scrollEl) return;
        scrollEl.scrollTop = 0;
        rowVirtualizer.scrollToIndex(0, { align: 'start' });
    }, [queryStartedAt, rowVirtualizer]);

    useEffect(() => {
        if (!isFetchingMore) {
            fetchMoreRef.current = false;
        }
    }, [isFetchingMore]);

    useEffect(() => {
        if (!virtualItems.length || !isDone || !hasMore) {
            loadMoreZoneArmedRef.current = true;
            return;
        }
        const lastItem = virtualItems[virtualItems.length - 1];
        const triggerIndex = Math.max(tableRowsLength - 15, 0);
        const inLoadMoreZone = lastItem.index >= triggerIndex;

        if (!inLoadMoreZone) {
            loadMoreZoneArmedRef.current = true;
            return;
        }

        if (!loadMoreZoneArmedRef.current || isFetchingMore || fetchMoreRef.current) return;

        loadMoreZoneArmedRef.current = false;
        fetchMoreRef.current = true;
        const newOffset = loadedRowsLength;
        setOffset(tabId, newOffset);
        FetchMoreRows(tabId, newOffset).catch(console.error);
    }, [
        hasMore,
        isDone,
        isFetchingMore,
        loadedRowsLength,
        setOffset,
        tabId,
        tableRowsLength,
        virtualItems,
    ]);

    const totalHeight = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
    const paddingBottom = virtualItems.length > 0
        ? totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0)
        : 0;

    const dataColumnTotalWidth = columnVirtualizer.getTotalSize();
    const columnPaddingLeft = virtualColumns.length > 0 ? (virtualColumns[0]?.start ?? 0) : 0;
    const columnPaddingRight = virtualColumns.length > 0
        ? dataColumnTotalWidth - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
        : 0;

    return {
        parentRef,
        virtualItems,
        renderedColumnIndexes,
        paddingTop,
        paddingBottom,
        columnPaddingLeft,
        columnPaddingRight,
    };
}
