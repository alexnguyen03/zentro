import React from 'react';
import { useToast } from '../layout/Toast';
import { useStatusStore } from '../../stores/statusStore';
import type { ExportJobStatus } from '../../features/query/resultStrategy';

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

function downloadBlob(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
    const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r');
    if (!needsQuotes) return value;
    return `"${value.replace(/"/g, '""')}"`;
}

function rowsToCsv(columns: string[], rows: string[][]): string {
    const header = columns.map(escapeCsvCell).join(',');
    const body = rows.map((row) => row.map((cell) => escapeCsvCell(cell ?? '')).join(',')).join('\n');
    return `${header}\n${body}`;
}

function rowsToJson(columns: string[], rows: string[][]): string {
    const objects = rows.map((row) => {
        const entry: Record<string, string> = {};
        columns.forEach((column, index) => {
            entry[column] = row[index] ?? '';
        });
        return entry;
    });
    return JSON.stringify(objects, null, 2);
}

function rowsToSql(columns: string[], rows: string[][], tableName: string): string {
    const quotedColumns = columns.map((column) => `"${column.replace(/"/g, '""')}"`).join(', ');
    const values = rows
        .map((row) => {
            const mapped = columns.map((_, index) => {
                const value = row[index] ?? '';
                if (value === '' || value.toLowerCase() === 'null') return 'NULL';
                return `'${value.replace(/'/g, "''")}'`;
            });
            return `(${mapped.join(', ')})`;
        })
        .join(',\n');
    return `INSERT INTO "${tableName.replace(/"/g, '""')}" (${quotedColumns})\nVALUES\n${values};\n`;
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
        extension: string;
        mime: string;
        builder: (rows: string[][]) => string;
        rows: string[][];
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
        extension: string,
        mime: string,
        builder: (rows: string[][]) => string,
        rows: string[][],
    ) => {
        const startedAt = Date.now();
        const id = `job_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;
        setJob({
            id,
            label,
            status: 'running',
            startedAt,
            processedRows: 0,
            totalRows: rows.length,
            progressPct: 0,
            queuedCount: queueRef.current.length,
        });

        try {
            for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
                if (cancelledRef.current.has(id)) {
                    setJob({
                        id,
                        label,
                        status: 'cancelled',
                        startedAt,
                        finishedAt: Date.now(),
                        processedRows: offset,
                        totalRows: rows.length,
                        progressPct: Math.min(100, Math.round((offset / Math.max(rows.length, 1)) * 100)),
                        queuedCount: queueRef.current.length,
                    });
                    toast.info(`${label} export cancelled.`);
                    return;
                }
                const processedRows = Math.min(rows.length, offset + CHUNK_SIZE);
                setJob({
                    id,
                    label,
                    status: 'running',
                    startedAt,
                    processedRows,
                    totalRows: rows.length,
                    progressPct: Math.min(100, Math.round((processedRows / Math.max(rows.length, 1)) * 100)),
                    queuedCount: queueRef.current.length,
                });
                await nextTick();
            }

            const content = builder(rows);
            const fileName = `zentro-export-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
            downloadBlob(fileName, content, mime);
            setJob({
                id,
                label,
                status: 'done',
                startedAt,
                finishedAt: Date.now(),
                processedRows: rows.length,
                totalRows: rows.length,
                progressPct: 100,
                queuedCount: queueRef.current.length,
            });
            notifyExport(fileName);
        } catch (error) {
            setJob({
                id,
                label,
                status: 'failed',
                startedAt,
                finishedAt: Date.now(),
                processedRows: 0,
                totalRows: rows.length,
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
            next.extension,
            next.mime,
            next.builder,
            next.rows,
        );

        if (queueRef.current.length > 0) {
            await drainQueue();
        }
    }, [runBackgroundExport]);

    const enqueueExport = React.useCallback((
        label: string,
        extension: string,
        mime: string,
        builder: (rows: string[][]) => string,
        rows: string[][],
    ) => {
        queueRef.current.push({ label, extension, mime, builder, rows });
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
        enqueueExport(label, 'csv', 'text/csv;charset=utf-8', (rows) => rowsToCsv(result.columns, rows), result.rows);
    };

    const handleExportJSON = async () => {
        if (!result?.columns || !result.rows) return;
        setShowExportMenu(false);
        const label = result.rows.length > SMALL_EXPORT_THRESHOLD ? 'JSON (queued)' : 'JSON';
        enqueueExport(label, 'json', 'application/json;charset=utf-8', (rows) => rowsToJson(result.columns, rows), result.rows);
    };

    const handleExportSQLConfirm = async () => {
        if (!result?.columns || !result.rows) return;
        const tableName = tableNameForExport.trim() || result.tableName || 'my_table';
        setShowTableNameInput(false);
        setTableNameForExport('');
        const label = result.rows.length > SMALL_EXPORT_THRESHOLD ? 'SQL INSERT (queued)' : 'SQL INSERT';
        enqueueExport(
            label,
            'sql',
            'text/sql;charset=utf-8',
            (rows) => rowsToSql(result.columns, rows, tableName),
            result.rows,
        );
    };

    return { handleExportCSV, handleExportJSON, handleExportSQLConfirm, exportJob: job, cancelExport };
}
