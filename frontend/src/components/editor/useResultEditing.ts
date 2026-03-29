import React from 'react';
import { models } from '../../../wailsjs/go/models';
import {
    DraftRow,
    buildDisplayRows,
    buildInsertScript,
    getDraftDefaultValues,
    parseTableReference,
    resolveQualifiedTableName,
    toSqlLiteral,
} from '../../lib/dataEditing';
import { useConnectionStore } from '../../stores/connectionStore';
import { useResultStore, TabResult } from '../../stores/resultStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../layout/Toast';
import { makeCellId, parseCellId } from './resultPanelUtils';

interface UseResultEditingOptions {
    tabId: string;
    result: TabResult | undefined;
}

export interface FocusCellRequest {
    rowKey: string;
    colIdx: number;
    nonce: number;
}

/**
 * Encapsulates all draft-row / cell-edit / delete state and derived helpers
 * for ResultPanel. Keeps the orchestrating component focused on layout.
 */
export function useResultEditing({ tabId, result }: UseResultEditingOptions) {
    const { viewMode } = useSettingsStore();
    const { activeProfile } = useConnectionStore();
    const checkAndFetchColumns = useSchemaStore((s) => s.checkAndFetchColumns);
    const updatePendingState = useResultStore((s) => s.updatePendingState);
    const applyEdits = useResultStore((s) => s.applyEdits);
    const appendInsertedRows = useResultStore((s) => s.appendInsertedRows);
    const { toast } = useToast();

    const [columnDefs, setColumnDefs] = React.useState<models.ColumnDef[]>([]);
    const [editedCells, setEditedCells] = React.useState<Map<string, string>>(
        () => (result?.pendingEdits ? new Map(result.pendingEdits) : new Map()),
    );
    const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
    const [deletedRows, setDeletedRows] = React.useState<Set<number>>(
        () => (result?.pendingDeletions ? new Set(result.pendingDeletions) : new Set()),
    );
    const [draftRows, setDraftRows] = React.useState<DraftRow[]>(
        () => (result?.pendingDraftRows ? [...result.pendingDraftRows] : []),
    );
    const [isSavingDraftRows, setIsSavingDraftRows] = React.useState(false);
    const [focusCellRequest, setFocusCellRequest] = React.useState<FocusCellRequest | null>(null);

    // ── Derived ──────────────────────────────────────────────────────────────

    const sourceQuery = result?.lastExecutedQuery;
    const tableRef = React.useMemo(
        () => parseTableReference(sourceQuery, result?.tableName),
        [sourceQuery, result?.tableName],
    );
    const qualifiedTableName = React.useMemo(
        () => resolveQualifiedTableName(sourceQuery, result?.tableName),
        [sourceQuery, result?.tableName],
    );
    const columnDefsByName = React.useMemo(
        () => new Map(columnDefs.map((col) => [col.Name, col])),
        [columnDefs],
    );
    const displayRows = React.useMemo(
        () => buildDisplayRows(result?.rows || [], draftRows),
        [result?.rows, draftRows],
    );
    const displayRowsByKey = React.useMemo(
        () => new Map(displayRows.map((row) => [row.key, row])),
        [displayRows],
    );
    const rowOrder = React.useMemo(
        () => new Map(displayRows.map((row, index) => [row.key, index])),
        [displayRows],
    );
    const selectedRowKeys = React.useMemo(() => {
        const keys = new Set<string>();
        selectedCells.forEach((cellId) => keys.add(parseCellId(cellId).rowKey));
        return Array.from(keys);
    }, [selectedCells]);
    const selectedPersistedRowIndices = React.useMemo(
        () =>
            selectedRowKeys
                .filter((k) => k.startsWith('p:'))
                .map((k) => Number(k.slice(2)))
                .filter((n) => Number.isFinite(n)),
        [selectedRowKeys],
    );
    const selectedDraftIds = React.useMemo(
        () => selectedRowKeys.filter((k) => k.startsWith('d:')).map((k) => k.slice(2)),
        [selectedRowKeys],
    );
    const isEditable = Boolean(
        !viewMode &&
        result?.tableName &&
        result?.primaryKeys &&
        result.primaryKeys.length > 0 &&
        result.primaryKeys.every((pk) => result.columns.includes(pk)),
    );
    const canManageDraftRows = Boolean(
        isEditable &&
        result?.columns.length &&
        qualifiedTableName,
    );
    const hasLegacyChanges = editedCells.size > 0 || deletedRows.size > 0;
    const hasPendingChanges = hasLegacyChanges || draftRows.length > 0;

    // ── Side-effects ─────────────────────────────────────────────────────────

    React.useEffect(() => {
        let cancelled = false;
        if (!activeProfile?.name || !activeProfile.db_name || !result?.tableName || !isEditable) {
            setColumnDefs([]);
            return;
        }
        checkAndFetchColumns(
            activeProfile.name,
            activeProfile.db_name,
            tableRef.schema,
            tableRef.table || result.tableName,
        )
            .then((cols) => { if (!cancelled) setColumnDefs(cols || []); })
            .catch(() => { if (!cancelled) setColumnDefs([]); });
        return () => { cancelled = true; };
    }, [
        activeProfile?.db_name,
        activeProfile?.name,
        checkAndFetchColumns,
        isEditable,
        result?.tableName,
        tableRef.schema,
        tableRef.table,
    ]);

    React.useEffect(() => {
        updatePendingState(tabId, editedCells, deletedRows, draftRows);
    }, [deletedRows, draftRows, editedCells, tabId, updatePendingState]);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const queueFocusCell = React.useCallback((rowKey: string, colIdx = 0) => {
        setFocusCellRequest({ rowKey, colIdx, nonce: Date.now() });
    }, []);

    const removeDraftRows = React.useCallback((draftIds: string[]) => {
        if (draftIds.length === 0) return;
        const removedKeys = new Set(draftIds.map((id) => `d:${id}`));
        setDraftRows((prev) => prev.filter((dr) => !removedKeys.has(`d:${dr.id}`)));
        setSelectedCells((prev) => new Set(Array.from(prev).filter((cellId) => !removedKeys.has(parseCellId(cellId).rowKey))));
    }, []);

    const getPersistedRowValues = React.useCallback((rowIndex: number): string[] => {
        if (!result) return [];
        return result.columns.map((_, colIdx) => editedCells.get(`${rowIndex}:${colIdx}`) ?? result.rows[rowIndex]?.[colIdx] ?? '');
    }, [editedCells, result]);

    const resetEditState = React.useCallback(() => {
        setEditedCells(new Map());
        setSelectedCells(new Set());
        setDeletedRows(new Set());
        setDraftRows([]);
        setFocusCellRequest(null);
    }, []);

    // ── Script generators ─────────────────────────────────────────────────────

    const generateUpdateScript = React.useCallback((): string => {
        if (!result?.primaryKeys || !qualifiedTableName || (editedCells.size === 0 && deletedRows.size === 0)) return '';

        const statements: string[] = [];

        Array.from(deletedRows).sort((a, b) => b - a).forEach((rowIndex) => {
            const where = result.primaryKeys!.map((pk) => {
                const colIndex = result.columns.indexOf(pk);
                const base = result.rows[rowIndex]?.[colIndex] ?? '';
                return `"${pk}" = ${toSqlLiteral(base, columnDefsByName.get(pk))}`;
            }).join(' AND ');
            statements.push(`DELETE FROM ${qualifiedTableName} WHERE ${where};`);
        });

        const updatesByRow = new Map<number, { col: string; val: string }[]>();
        editedCells.forEach((value, cellId) => {
            const [rowIndex, colIdx] = cellId.split(':').map(Number);
            if (deletedRows.has(rowIndex)) return;
            const edits = updatesByRow.get(rowIndex) || [];
            edits.push({ col: result.columns[colIdx], val: value });
            updatesByRow.set(rowIndex, edits);
        });

        updatesByRow.forEach((edits, rowIndex) => {
            const where = result.primaryKeys!.map((pk) => {
                const colIndex = result.columns.indexOf(pk);
                const base = result.rows[rowIndex]?.[colIndex] ?? '';
                return `"${pk}" = ${toSqlLiteral(base, columnDefsByName.get(pk))}`;
            }).join(' AND ');
            const set = edits.map((e) => `"${e.col}" = ${toSqlLiteral(e.val, columnDefsByName.get(e.col))}`).join(', ');
            statements.push(`UPDATE ${qualifiedTableName} SET ${set} WHERE ${where};`);
        });

        return statements.join('\n');
    }, [columnDefsByName, deletedRows, editedCells, qualifiedTableName, result]);

    const generateInsertScript = React.useCallback((): string => {
        if (!result || draftRows.length === 0 || !canManageDraftRows) return '';
        return buildInsertScript(
            result.tableName || tableRef.table,
            result.columns,
            draftRows,
            columnDefs,
            sourceQuery,
        );
    }, [canManageDraftRows, columnDefs, draftRows, result, sourceQuery, tableRef.table]);

    const generatePendingScript = React.useCallback((): string => {
        return [generateUpdateScript(), generateInsertScript()]
            .filter((s) => s.trim().length > 0)
            .join('\n');
    }, [generateInsertScript, generateUpdateScript]);

    // ── Row actions ───────────────────────────────────────────────────────────

    const handleAddRow = React.useCallback(() => {
        if (!result || !canManageDraftRows) return;
        const draftRow: DraftRow = {
            id: crypto.randomUUID(),
            kind: 'new',
            values: getDraftDefaultValues(result.columns, columnDefs),
            insertAfterRowIndex: null,
        };
        setDraftRows((prev) => [draftRow, ...prev]);
        setSelectedCells(new Set([makeCellId(`d:${draftRow.id}`, 0)]));
        queueFocusCell(`d:${draftRow.id}`, 0);
    }, [canManageDraftRows, columnDefs, queueFocusCell, result]);

    const handleDuplicateRows = React.useCallback(() => {
        if (!result || !canManageDraftRows) return;
        const selectedKeys = new Set(selectedRowKeys);
        const selected = displayRows.filter((row) => row.kind === 'persisted' && selectedKeys.has(row.key));
        if (selected.length === 0) return;

        const last = selected[selected.length - 1];
        const duplicated: DraftRow[] = selected.map((row) => ({
            id: crypto.randomUUID(),
            kind: 'duplicate',
            values: getPersistedRowValues(row.persistedIndex as number),
            insertAfterRowIndex: last.persistedIndex ?? null,
            sourceRowIndex: row.persistedIndex,
        }));

        setDraftRows((prev) => [...prev, ...duplicated]);
        setSelectedCells(new Set([makeCellId(`d:${duplicated[0].id}`, 0)]));
        queueFocusCell(`d:${duplicated[0].id}`, 0);
    }, [canManageDraftRows, displayRows, getPersistedRowValues, queueFocusCell, result, selectedRowKeys]);

    const requestDeleteSelectedRows = React.useCallback(() => {
        if (viewMode) {
            toast.error('View Mode is enabled. Write actions are blocked.');
            return;
        }
        if (selectedDraftIds.length > 0) removeDraftRows(selectedDraftIds);
        if (selectedPersistedRowIndices.length === 0) return;
        if (!isEditable) {
            toast.error('Result is read-only. Make sure the query includes the primary key(s).');
            return;
        }
        setDeletedRows((prev) => {
            const next = new Set(prev);
            selectedPersistedRowIndices.forEach((idx) => next.add(idx));
            return next;
        });
    }, [isEditable, removeDraftRows, selectedDraftIds, selectedPersistedRowIndices, toast, viewMode]);

    // ── Persist actions ───────────────────────────────────────────────────────

    const handleDirectExecute = React.useCallback(async (
        ExecuteUpdateSync: (script: string) => Promise<number>,
    ) => {
        if (viewMode) {
            toast.error('View Mode is enabled. Write actions are blocked.');
            return;
        }
        const script = generatePendingScript();
        if (!script) return;

        try {
            setIsSavingDraftRows(true);
            const affected = await ExecuteUpdateSync(script);
            if (editedCells.size > 0 || deletedRows.size > 0) applyEdits(tabId, editedCells, deletedRows);
            if (draftRows.length > 0) appendInsertedRows(tabId, draftRows.map((dr) => [...dr.values]));
            resetEditState();
            toast.success(`Saved successfully (${affected} row${affected !== 1 ? 's' : ''} affected).`);
        } catch (error: unknown) {
            toast.error(`Save failed: ${error}`);
        } finally {
            setIsSavingDraftRows(false);
        }
    }, [appendInsertedRows, applyEdits, deletedRows, draftRows, editedCells, generatePendingScript, resetEditState, tabId, toast, viewMode]);

    return {
        // State
        columnDefs,
        editedCells, setEditedCells,
        selectedCells, setSelectedCells,
        deletedRows, setDeletedRows,
        draftRows, setDraftRows,
        isSavingDraftRows, setIsSavingDraftRows,
        focusCellRequest, setFocusCellRequest,
        // Derived
        tableRef,
        qualifiedTableName,
        columnDefsByName,
        displayRows,
        displayRowsByKey,
        rowOrder,
        selectedRowKeys,
        selectedPersistedRowIndices,
        selectedDraftIds,
        isEditable,
        canManageDraftRows,
        hasLegacyChanges,
        hasPendingChanges,
        // Actions
        queueFocusCell,
        removeDraftRows,
        getPersistedRowValues,
        resetEditState,
        generateUpdateScript,
        generateInsertScript,
        generatePendingScript,
        handleAddRow,
        handleDuplicateRows,
        requestDeleteSelectedRows,
        handleDirectExecute,
    };
}
