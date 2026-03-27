import React from 'react';
import { useToast } from '../layout/Toast';
import { useStatusStore } from '../../stores/statusStore';
import type { ExportJobStatus } from '../../features/query/resultStrategy';
import { ExportCSV, ExportJSON, ExportSQLInsert } from '../../services/queryService';

interface UseResultExportOptions {
    result: { columns: string[]; rows: string[][]; tableName?: string } | undefined;
    tableNameForExport: string;
    setTableNameForExport: (v: string) => void;
    setShowExportMenu: (v: boolean) => void;
    setShowTableNameInput: (v: boolean) => void;
}

const CHUNK_SIZE = 2000;
const SMALL_EXPORT_THRESHOLD = 50000;

function nextTick() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

export function useResultExport({
    result,
    tableNameForExport,
    setTableNameForExport,
    setShowExportMenu,
    setShowTableNameInput,
}: UseResultExportOptions) {
    const { toast } = useToast();
    const [job, setJob] = React.useState<ExportJobStatus | null>(null);
    const queueRef = React.useRef<Array<{
        label: string;
        totalRows: number;
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
        totalRows: number,
        runner: () => Promise<string>,
    ) => {
        const startedAt = Date.now();
        const id = `job_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
        setJob({
            id,
            label,
            status: 'running',
            startedAt,
            processedRows: 0,
            totalRows,
            progressPct: 0,
            queuedCount: queueRef.current.length,
        });

        try {
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
                    progressPct: 100,
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
                progressPct: 100,
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
                processedRows: 0,
                totalRows,
                progressPct: 0,
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
        await runBackgroundExport(
            next.label,
            next.totalRows,
            next.runner,
        );

        if (queueRef.current.length > 0) {
            await drainQueue();
        }
    }, [runBackgroundExport]);

    const enqueueExport = React.useCallback((
        label: string,
        totalRows: number,
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

    const handleExportCSV = async () => {
        if (!result?.columns || !result.rows) return;
        setShowExportMenu(false);
        const label = result.rows.length > SMALL_EXPORT_THRESHOLD ? 'CSV (queued)' : 'CSV';
        enqueueExport(label, result.rows.length, () => ExportCSV(result.columns, result.rows));
    };

    const handleExportJSON = async () => {
        if (!result?.columns || !result.rows) return;
        setShowExportMenu(false);
        const label = result.rows.length > SMALL_EXPORT_THRESHOLD ? 'JSON (queued)' : 'JSON';
        enqueueExport(label, result.rows.length, () => ExportJSON(result.columns, result.rows));
    };

    const handleExportSQLConfirm = async () => {
        if (!result?.columns || !result.rows) return;
        const tableName = tableNameForExport.trim() || result.tableName || 'my_table';
        setShowTableNameInput(false);
        setTableNameForExport('');
        const label = result.rows.length > SMALL_EXPORT_THRESHOLD ? 'SQL INSERT (queued)' : 'SQL INSERT';
        enqueueExport(label, result.rows.length, () => ExportSQLInsert(result.columns, result.rows, tableName));
    };

    return { handleExportCSV, handleExportJSON, handleExportSQLConfirm, exportJob: job, cancelExport };
}
