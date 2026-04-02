import { useEffect, useRef } from 'react';

interface ViewStats {
    visibleRows: number;
    totalRows: number;
}

export function useResultTableViewStats(
    visibleRows: number,
    totalRows: number,
    onViewStatsChange?: (stats: ViewStats) => void,
): void {
    const onViewStatsChangeRef = useRef(onViewStatsChange);
    const lastViewStatsRef = useRef<ViewStats | null>(null);

    useEffect(() => {
        onViewStatsChangeRef.current = onViewStatsChange;
    }, [onViewStatsChange]);

    useEffect(() => {
        const nextStats = { visibleRows, totalRows };
        const prev = lastViewStatsRef.current;
        if (prev && prev.visibleRows === nextStats.visibleRows && prev.totalRows === nextStats.totalRows) {
            return;
        }
        lastViewStatsRef.current = nextStats;
        onViewStatsChangeRef.current?.(nextStats);
    }, [totalRows, visibleRows]);
}
