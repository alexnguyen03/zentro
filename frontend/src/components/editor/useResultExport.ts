import { ExportCSV, ExportJSON, ExportSQLInsert } from '../../services/queryService';
import { useToast } from '../layout/Toast';
import { useStatusStore } from '../../stores/statusStore';

interface UseResultExportOptions {
    result: { columns: string[]; rows: string[][]; tableName?: string } | undefined;
    tableNameForExport: string;
    setTableNameForExport: (v: string) => void;
    setShowExportMenu: (v: boolean) => void;
    setShowTableNameInput: (v: boolean) => void;
}

/**
 * Thin hook that exposes export handlers for ResultPanel.
 * Keeps the CSV / JSON / SQL-INSERT boilerplate out of the main component.
 */
export function useResultExport({
    result,
    tableNameForExport,
    setTableNameForExport,
    setShowExportMenu,
    setShowTableNameInput,
}: UseResultExportOptions) {
    const { toast } = useToast();

    const notifyExport = (path: string | undefined) => {
        if (!path) return;
        toast.success(`Exported to: ${path}`);
        useStatusStore.getState().setMessage(`Exported to: ${path}`);
    };

    const notifyExportError = (error: unknown, label = 'Export') => {
        toast.error(`${label} failed: ${error}`);
        useStatusStore.getState().setMessage(`${label} failed: ${error}`);
    };

    const handleExportCSV = async () => {
        if (!result?.columns || !result.rows) return;
        setShowExportMenu(false);
        try {
            const path = await ExportCSV(result.columns, result.rows);
            notifyExport(path);
        } catch (error) {
            notifyExportError(error, 'CSV export');
        }
    };

    const handleExportJSON = async () => {
        if (!result?.columns || !result.rows) return;
        setShowExportMenu(false);
        try {
            const path = await ExportJSON(result.columns, result.rows);
            notifyExport(path);
        } catch (error) {
            notifyExportError(error, 'JSON export');
        }
    };

    const handleExportSQLConfirm = async () => {
        if (!result?.columns || !result.rows) return;
        const tableName = tableNameForExport.trim() || result.tableName || 'my_table';
        setShowTableNameInput(false);
        setTableNameForExport('');
        try {
            const path = await ExportSQLInsert(result.columns, result.rows, tableName);
            notifyExport(path);
        } catch (error) {
            notifyExportError(error, 'SQL INSERT export');
        }
    };

    return { handleExportCSV, handleExportJSON, handleExportSQLConfirm };
}
