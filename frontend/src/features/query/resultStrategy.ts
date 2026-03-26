export type ResultFetchStrategy = 'client_full' | 'incremental_client' | 'server_aware';

export interface ResultViewportState {
    strategy: ResultFetchStrategy;
    isLargeDataset: boolean;
    rowCount: number;
    hasMore: boolean;
}

export interface ExportJobStatus {
    id: string;
    status: 'idle' | 'running' | 'done' | 'failed' | 'cancelled';
    startedAt: number;
    finishedAt?: number;
    error?: string;
}

const INCREMENTAL_THRESHOLD = 15000;

export function resolveResultFetchStrategy(rowCount: number, hasMore: boolean, isDone: boolean): ResultViewportState {
    if (!isDone) {
        return {
            strategy: 'server_aware',
            isLargeDataset: false,
            rowCount,
            hasMore,
        };
    }
    if (hasMore) {
        return {
            strategy: 'server_aware',
            isLargeDataset: true,
            rowCount,
            hasMore,
        };
    }
    if (rowCount >= INCREMENTAL_THRESHOLD) {
        return {
            strategy: 'incremental_client',
            isLargeDataset: true,
            rowCount,
            hasMore,
        };
    }
    return {
        strategy: 'client_full',
        isLargeDataset: false,
        rowCount,
        hasMore,
    };
}

