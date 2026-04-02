import React from 'react';
import { useToast } from '../layout/Toast';
import { useStatusStore } from '../../stores/statusStore';
import type { ExportJobStatus } from '../../features/query/resultStrategy';
import {
    ExportAllCSV,
    ExportAllJSON,
    ExportAllSQLInsert,
    ExportCSV,
    ExportJSON,
    ExportSQLInsert,
} from '../../services/queryService';

interface UseResultExportOptions {
    tabId: string;
    result: { columns: string[]; rows: string[][]; tableName?: string } | undefined;
}

export type ExportScope = 'view' | 'all';
export type ExportFormat = 'csv' | 'json' | 'sql';

export interface RunExportOptions {
    scope: ExportScope;
    format: ExportFormat;
    selectedColumns: string[];
    tableName?: string;
}

const CHUNK_SIZE = 2000;
const SMALL_EXPORT_THRESHOLD = 50000;

function nextTick() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

function filterRowsBySelectedColumns(
    allColumns: string[],
    rows: string[][],
    selectedColumns: string[],
): { columns: string[]; rows: string[][] } {
    const selectedSet = new Set(selectedColumns);
    const selectedIndexes = allColumns
        .map((col, index) => ({ col, index }))
        .filter((item) => selectedSet.has(item.col))
        .map((item) => item.index);
    const columns = selectedIndexes.map((index) => allColumns[index]);
    const filteredRows = rows.map((row) => selectedIndexes.map((index) => row[index] ?? ''));
    return { columns, rows: filteredRows };
}

export function useResultExport({ tabId, result }: UseResultExportOptions) {
    const { toast } = useToast();
    const [job, setJob] = React.useState<ExportJobStatus | null>(null);
    const queueRef = React.useRef<Array<{
        label: string;
        totalRows?: number;
        runner: () => Promise<string>;
    }>>([]);
    const runningRef = React.useRef(false);
    const cancelledRef = React.useRef<Set<string>>(new Set());

    const notifyExport = (path: string | undefined) => {
        if (!path) return;
        toast.success(`Exported to: ${path}`);
        useStatusStore.getState().setMessage(`Exported to: ${path}`);
    };

    const notifyExportError = (error: unknown, label = 'Export') => {
        toast.error(`${label} failed: ${error}`);
        useStatusStore.getState().setMessage(`${label} failed: ${error}`);
    };

    const runBackgroundExport = React.useCallback(async (
        label: string,
        totalRows: number | undefined,
        runner: () => Promise<string>,
    ) => {
        const startedAt = Date.now();
        const id = `job_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
        setJob({
            id,
            label,
            status: 'running',
            startedAt,
            processedRows: typeof totalRows === 'number' ? 0 : undefined,
            totalRows,
            progressPct: typeof totalRows === 'number' ? 0 : undefined,
            queuedCount: queueRef.current.length,
        });

        try {
            if (typeof totalRows === 'number' && totalRows > 0) {
                for (let offset = 0; offset < totalRows; offset += CHUNK_SIZE) {
                    if (cancelledRef.current.has(id)) {
                        setJob({
                            id,
                            label,
                            status: 'cancelled',
                            startedAt,
                            finishedAt: Date.now(),
                            processedRows: offset,
                            totalRows,
                            progressPct: Math.min(100, Math.round((offset / Math.max(totalRows, 1)) * 100)),
                            queuedCount: queueRef.current.length,
                        });
                        toast.info(`${label} export cancelled.`);
                        return;
                    }

                    const processedRows = Math.min(totalRows, offset + CHUNK_SIZE);
                    setJob({
                        id,
                        label,
                        status: 'running',
                        startedAt,
                        processedRows,
                        totalRows,
                        progressPct: Math.min(100, Math.round((processedRows / Math.max(totalRows, 1)) * 100)),
                        queuedCount: queueRef.current.length,
                    });
                    await nextTick();
                }
            }

            const filePath = await runner();
            if (!filePath) {
                setJob({
                    id,
                    label,
                    status: 'cancelled',
                    startedAt,
                    finishedAt: Date.now(),
                    processedRows: totalRows,
                    totalRows,
                    progressPct: typeof totalRows === 'number' ? 100 : undefined,
                    queuedCount: queueRef.current.length,
                });
                return;
            }

            setJob({
                id,
                label,
                status: 'done',
                startedAt,
                finishedAt: Date.now(),
                processedRows: totalRows,
                totalRows,
                progressPct: typeof totalRows === 'number' ? 100 : undefined,
                queuedCount: queueRef.current.length,
            });
            notifyExport(filePath);
        } catch (error) {
            setJob({
                id,
                label,
                status: 'failed',
                startedAt,
                finishedAt: Date.now(),
                processedRows: typeof totalRows === 'number' ? 0 : undefined,
                totalRows,
                progressPct: typeof totalRows === 'number' ? 0 : undefined,
                queuedCount: queueRef.current.length,
                error: String(error),
            });
            notifyExportError(error, `${label} export`);
        } finally {
            cancelledRef.current.delete(id);
            runningRef.current = false;
        }
    }, [toast]);

    const drainQueue = React.useCallback(async () => {
        if (runningRef.current) return;
        const next = queueRef.current.shift();
        if (!next) return;

        runningRef.current = true;
        await runBackgroundExport(next.label, next.totalRows, next.runner);
        if (queueRef.current.length > 0) {
            await drainQueue();
        }
    }, [runBackgroundExport]);

    const enqueueExport = React.useCallback((
        label: string,
        totalRows: number | undefined,
        runner: () => Promise<string>,
    ) => {
        queueRef.current.push({ label, totalRows, runner });
        void drainQueue();
    }, [drainQueue]);

    const cancelExport = React.useCallback(() => {
        if (!job || job.status !== 'running') return;
        cancelledRef.current.add(job.id);
        queueRef.current = [];
    }, [job]);

    const runExport = React.useCallback((options: RunExportOptions) => {
        const selectedColumns = options.selectedColumns || [];
        if (selectedColumns.length === 0) {
            toast.error('Select at least one column to export.');
            return;
        }

        const formatLabel = options.format === 'sql' ? 'SQL INSERT' : options.format.toUpperCase();
        const scopeLabel = options.scope === 'all' ? 'All (no paging)' : 'In View';

        if (options.scope === 'view') {
            if (!result?.columns || !result.rows) {
                toast.error('No fetched rows available for in-view export.');
                return;
            }
            const filtered = filterRowsBySelectedColumns(result.columns, result.rows, selectedColumns);
            const label = filtered.rows.length > SMALL_EXPORT_THRESHOLD
                ? `${formatLabel} ${scopeLabel} (queued)`
                : `${formatLabel} ${scopeLabel}`;

            if (options.format === 'csv') {
                enqueueExport(label, filtered.rows.length, () => ExportCSV(filtered.columns, filtered.rows));
                return;
            }
            if (options.format === 'json') {
                enqueueExport(label, filtered.rows.length, () => ExportJSON(filtered.columns, filtered.rows));
                return;
            }
            const tableName = options.tableName?.trim() || result.tableName || 'my_table';
            enqueueExport(label, filtered.rows.length, () => ExportSQLInsert(filtered.columns, filtered.rows, tableName));
            return;
        }

        const label = `${formatLabel} ${scopeLabel}`;
        if (options.format === 'csv') {
            enqueueExport(label, undefined, () => ExportAllCSV(tabId, selectedColumns));
            return;
        }
        if (options.format === 'json') {
            enqueueExport(label, undefined, () => ExportAllJSON(tabId, selectedColumns));
            return;
        }
        const tableName = options.tableName?.trim() || result?.tableName || 'my_table';
        enqueueExport(label, undefined, () => ExportAllSQLInsert(tabId, tableName, selectedColumns));
    }, [enqueueExport, result, tabId, toast]);

    return {
        runExport,
        exportJob: job,
        cancelExport,
    };
}
