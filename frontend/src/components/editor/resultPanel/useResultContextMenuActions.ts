import React from 'react';
import { getClipboardText, setClipboardText } from '../../../services/clipboardService';
import type { DraftRow } from '../../../lib/dataEditing';
import { buildFilterQuery } from '../../../lib/queryBuilder';
import {
    applyClipboardPaste,
    applySetNullToSelection,
    buildSelectByPrimaryKeyQuery,
    buildRowsAsInsertStatements,
    buildRowAsUpdateStatement,
    buildSelectionMatrix,
    buildWhereClauseByPrimaryKeys,
    buildWhereClauseBySelectionIn,
    matrixToTsv,
} from '../resultSelectionActions';
import { makeCellId, parseCellId } from '../resultPanelUtils';
import { useToast } from '../../layout/Toast';
import type { ResultContextCopyAsAction, ResultContextMenuDeps, ResultContextMenuPayload, ResultContextWhereAction } from './types';

function escapeCsvField(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function matrixToCsv(rows: string[][]): string {
    return rows.map((row) => row.map((cell) => escapeCsvField(cell ?? '')).join(',')).join('\n');
}

export function useResultContextMenuActions(deps: ResultContextMenuDeps) {
    const { toast } = useToast();
    const [contextMenu, setContextMenu] = React.useState<ResultContextMenuPayload | null>(null);
    const [lastUndoLabel, setLastUndoLabel] = React.useState<string | null>(null);
    const undoActionRef = React.useRef<(() => void) | null>(null);
    const contextMenuRef = React.useRef<HTMLDivElement>(null);

    const cloneDraftRows = React.useCallback(
        (rows: DraftRow[]) => rows.map((row) => ({ ...row, values: [...row.values] })),
        [],
    );
    const captureSnapshot = React.useCallback(() => ({
        editedCells: new Map(deps.editedCells),
        draftRows: cloneDraftRows(deps.draftRows),
        deletedRows: new Set(deps.deletedRows),
        selectedCells: new Set(deps.selectedCells),
    }), [cloneDraftRows, deps.deletedRows, deps.draftRows, deps.editedCells, deps.selectedCells]);
    const registerUndoAction = React.useCallback((label: string, snapshot: ReturnType<typeof captureSnapshot>) => {
        undoActionRef.current = () => {
            deps.setEditedCells(new Map(snapshot.editedCells));
            deps.setDraftRows(cloneDraftRows(snapshot.draftRows));
            deps.setDeletedRows(new Set(snapshot.deletedRows));
            deps.setSelectedCells(new Set(snapshot.selectedCells));
        };
        setLastUndoLabel(label);
    }, [cloneDraftRows, deps]);

    const nullableByColumnIndex = React.useMemo(
        () => (deps.result?.columns || []).map((columnName) => deps.columnDefsByName.get(columnName)?.IsNullable ?? true),
        [deps.columnDefsByName, deps.result?.columns],
    );
    const contextMenuRow = React.useMemo(
        () => (contextMenu ? deps.displayRowsByKey.get(contextMenu.rowKey) : undefined),
        [contextMenu, deps.displayRowsByKey],
    );
    const hasEditableCellSelection = deps.selectedCells.size > 0 || Boolean(contextMenu?.cellId);
    const canMutateCells = deps.isEditable && !deps.isReadOnlyTab && !deps.viewMode && !deps.isSavingDraftRows;
    const canMutateRows = deps.canManageDraftRows && !deps.isReadOnlyTab && !deps.viewMode && !deps.isSavingDraftRows;
    const canDuplicateRows = deps.selectedPersistedRowIndices.length > 0 || contextMenuRow?.kind === 'persisted';
    const canDeleteRows = deps.selectedPersistedRowIndices.length > 0 || deps.selectedDraftIds.length > 0 || Boolean(contextMenuRow);
    const canCopy = hasEditableCellSelection;
    const canSetNull = canMutateCells && hasEditableCellSelection;
    const canPaste = canMutateCells && hasEditableCellSelection;
    const pkColumns = React.useMemo(
        () => (deps.columnDefsByName ? Array.from(deps.columnDefsByName.values()).filter((column) => column.IsPrimaryKey).map((column) => column.Name) : []),
        [deps.columnDefsByName],
    );

    const closeContextMenu = React.useCallback(() => {
        setContextMenu(null);
    }, []);
    const buildQueryFromGeneratedWhere = React.useCallback((clause: string): string => {
        const whereExpr = clause.trim();
        if (!whereExpr) return '';
        const baseQuery = deps.result?.lastExecutedQuery?.trim() || '';
        if (!baseQuery) return `WHERE ${whereExpr}`;
        return buildFilterQuery(baseQuery, whereExpr);
    }, [deps.result?.lastExecutedQuery]);

    const getEffectiveSelection = React.useCallback(() => {
        if (deps.selectedCells.size > 0) return deps.selectedCells;
        if (!contextMenu?.cellId) return new Set<string>();
        return new Set([contextMenu.cellId]);
    }, [contextMenu?.cellId, deps.selectedCells]);

    const handleCellContextMenu = React.useCallback((payload: ResultContextMenuPayload) => {
        setContextMenu(payload);
    }, []);

    const getTargetPersistedRowIndices = React.useCallback((): number[] => {
        const fromSelection = deps.selectedRowKeys
            .filter((rowKey) => rowKey.startsWith('p:'))
            .map((rowKey) => Number(rowKey.slice(2)))
            .filter((rowIndex) => Number.isFinite(rowIndex));
        if (fromSelection.length > 0) {
            return Array.from(new Set(fromSelection));
        }

        const fromCells = Array.from(getEffectiveSelection())
            .map((cellId) => parseCellId(cellId).rowKey)
            .filter((rowKey) => rowKey.startsWith('p:'))
            .map((rowKey) => Number(rowKey.slice(2)))
            .filter((rowIndex) => Number.isFinite(rowIndex));
        if (fromCells.length > 0) {
            return Array.from(new Set(fromCells));
        }

        if (contextMenu?.rowKey?.startsWith('p:')) {
            const rowIndex = Number(contextMenu.rowKey.slice(2));
            if (Number.isFinite(rowIndex)) return [rowIndex];
        }
        return [];
    }, [contextMenu?.rowKey, deps.selectedRowKeys, getEffectiveSelection]);

    const handleContextCopy = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to copy.');
            closeContextMenu();
            return;
        }

        const matrix = buildSelectionMatrix({
            selectedCells: effectiveSelection,
            displayRows: deps.displayRows,
            rowOrder: deps.rowOrder,
            editedCells: deps.editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }

        void setClipboardText(matrixToTsv(matrix))
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, deps.displayRows, deps.editedCells, deps.rowOrder, getEffectiveSelection, toast]);

    const getSelectionColumnRange = React.useCallback((effectiveSelection: Set<string>): { minCol: number; maxCol: number } | null => {
        let minCol = Infinity;
        let maxCol = -Infinity;
        effectiveSelection.forEach((cellId) => {
            const { colIdx } = parseCellId(cellId);
            if (!Number.isNaN(colIdx)) {
                minCol = Math.min(minCol, colIdx);
                maxCol = Math.max(maxCol, colIdx);
            }
        });
        if (!Number.isFinite(minCol)) return null;
        return { minCol, maxCol };
    }, []);

    const handleContextCopyWithHeaders = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to copy.');
            closeContextMenu();
            return;
        }
        const matrix = buildSelectionMatrix({
            selectedCells: effectiveSelection,
            displayRows: deps.displayRows,
            rowOrder: deps.rowOrder,
            editedCells: deps.editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }
        const colRange = getSelectionColumnRange(effectiveSelection);
        const columns = deps.result?.columns ?? [];
        const headers = colRange ? columns.slice(colRange.minCol, colRange.maxCol + 1) : [];
        void setClipboardText(matrixToTsv([headers, ...matrix]))
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, deps.displayRows, deps.editedCells, deps.result?.columns, deps.rowOrder, getEffectiveSelection, getSelectionColumnRange, toast]);

    const handleContextCopyAsJson = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to copy.');
            closeContextMenu();
            return;
        }
        const matrix = buildSelectionMatrix({
            selectedCells: effectiveSelection,
            displayRows: deps.displayRows,
            rowOrder: deps.rowOrder,
            editedCells: deps.editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }
        const colRange = getSelectionColumnRange(effectiveSelection);
        const columns = deps.result?.columns ?? [];
        const headers = colRange ? columns.slice(colRange.minCol, colRange.maxCol + 1) : [];
        const jsonRows = matrix.map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((col, i) => { obj[col] = row[i] ?? ''; });
            return obj;
        });
        void setClipboardText(JSON.stringify(jsonRows, null, 2))
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, deps.displayRows, deps.editedCells, deps.result?.columns, deps.rowOrder, getEffectiveSelection, getSelectionColumnRange, toast]);

    const handleContextCopyAsCsvWithHeaders = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to copy.');
            closeContextMenu();
            return;
        }
        const matrix = buildSelectionMatrix({
            selectedCells: effectiveSelection,
            displayRows: deps.displayRows,
            rowOrder: deps.rowOrder,
            editedCells: deps.editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }
        const colRange = getSelectionColumnRange(effectiveSelection);
        const columns = deps.result?.columns ?? [];
        const headers = colRange ? columns.slice(colRange.minCol, colRange.maxCol + 1) : [];
        const csv = matrixToCsv([headers, ...matrix]);
        void setClipboardText(csv).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, deps.displayRows, deps.editedCells, deps.result?.columns, deps.rowOrder, getEffectiveSelection, getSelectionColumnRange, toast]);

    const handleContextCopyAsInsert = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) { toast.info('Select at least one cell to copy.'); closeContextMenu(); return; }
        const columns = deps.result?.columns ?? [];
        const tableName = deps.result?.tableName ?? 'table_name';
        const sql = buildRowsAsInsertStatements({
            selectedCells: effectiveSelection, displayRows: deps.displayRows, rowOrder: deps.rowOrder, editedCells: deps.editedCells, columns, tableName, driver: deps.driver || '',
        });
        if (!sql) { toast.info('No copyable cells in current selection.'); closeContextMenu(); return; }
        void setClipboardText(sql).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [deps.displayRows, deps.driver, deps.editedCells, deps.result?.columns, deps.result?.tableName, deps.rowOrder, getEffectiveSelection, closeContextMenu, toast]);

    const handleContextCopyAsUpdate = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) { toast.info('Select at least one cell to copy.'); closeContextMenu(); return; }
        const columns = deps.result?.columns ?? [];
        const tableName = deps.result?.tableName ?? 'table_name';
        const sql = buildRowAsUpdateStatement({
            selectedCells: effectiveSelection, displayRows: deps.displayRows, rowOrder: deps.rowOrder, editedCells: deps.editedCells, columns, pkColumns, tableName, driver: deps.driver || '',
        });
        if (!sql) { toast.info('No copyable cells in current selection.'); closeContextMenu(); return; }
        void setClipboardText(sql).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, deps.displayRows, deps.driver, deps.editedCells, deps.result?.columns, deps.result?.tableName, deps.rowOrder, getEffectiveSelection, pkColumns, toast]);

    const handleGenerateWhereByPk = React.useCallback(() => {
        const persistedRowIndices = getTargetPersistedRowIndices();
        if (persistedRowIndices.length === 0) {
            toast.info('Select at least one persisted row to generate WHERE clause.');
            closeContextMenu();
            return;
        }
        if (pkColumns.length === 0) {
            toast.info('Primary key is required to generate WHERE by row.');
            closeContextMenu();
            return;
        }
        const columns = deps.result?.columns ?? [];
        const clause = buildWhereClauseByPrimaryKeys({
            persistedRowIndices,
            displayRows: deps.displayRows,
            editedCells: deps.editedCells,
            columns,
            pkColumns,
            driver: deps.driver || '',
        });
        if (!clause) {
            toast.info('Unable to generate WHERE clause from current selection.');
            closeContextMenu();
            return;
        }
        const queryText = buildQueryFromGeneratedWhere(clause);
        void setClipboardText(queryText).then(() => {
            toast.success('Query copied to clipboard');
        }).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [buildQueryFromGeneratedWhere, closeContextMenu, deps.displayRows, deps.driver, deps.editedCells, deps.result?.columns, getTargetPersistedRowIndices, pkColumns, toast]);

    const handleGenerateWhereByIn = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to generate WHERE clause.');
            closeContextMenu();
            return;
        }
        const columns = deps.result?.columns ?? [];
        const clause = buildWhereClauseBySelectionIn({
            selectedCells: effectiveSelection,
            displayRowsByKey: deps.displayRowsByKey,
            editedCells: deps.editedCells,
            columns,
            driver: deps.driver || '',
        });
        if (!clause) {
            toast.info('Select cells from a single column to generate WHERE IN clause.');
            closeContextMenu();
            return;
        }
        const queryText = buildQueryFromGeneratedWhere(clause);
        void setClipboardText(queryText).then(() => {
            toast.success('Query copied to clipboard');
        }).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [buildQueryFromGeneratedWhere, closeContextMenu, deps.displayRowsByKey, deps.driver, deps.editedCells, deps.result?.columns, getEffectiveSelection, toast]);

    const handleOpenRowInNewQueryTab = React.useCallback(() => {
        const persistedRowIndices = getTargetPersistedRowIndices();
        if (persistedRowIndices.length === 0) {
            toast.info('Right-click a persisted row (or select one) to open row query.');
            closeContextMenu();
            return;
        }
        if (!deps.result?.tableName) {
            toast.info('No table context available for this result.');
            closeContextMenu();
            return;
        }
        if (pkColumns.length === 0) {
            toast.info('Primary key is required to open row query.');
            closeContextMenu();
            return;
        }
        const rowIndex = persistedRowIndices[0];
        const query = buildSelectByPrimaryKeyQuery({
            persistedRowIndex: rowIndex,
            displayRows: deps.displayRows,
            editedCells: deps.editedCells,
            columns: deps.result.columns ?? [],
            pkColumns,
            tableName: deps.result.tableName,
            driver: deps.driver || '',
        });
        if (!query) {
            toast.info('Unable to build query from selected row.');
            closeContextMenu();
            return;
        }
        deps.openQueryTab(query, `Row ${deps.result.tableName}`);
        if (persistedRowIndices.length > 1) {
            toast.info('Opened query for the first selected row.');
        }
        closeContextMenu();
    }, [closeContextMenu, deps, getTargetPersistedRowIndices, pkColumns, toast]);

    const handleUndoLastContextAction = React.useCallback(() => {
        const undo = undoActionRef.current;
        if (!undo) {
            toast.info('No context action to undo.');
            closeContextMenu();
            return;
        }
        undo();
        undoActionRef.current = null;
        setLastUndoLabel(null);
        closeContextMenu();
    }, [closeContextMenu, toast]);

    const handleContextPaste = React.useCallback(() => {
        if (!canMutateCells) {
            toast.error('Result is read-only. Paste is unavailable.');
            closeContextMenu();
            return;
        }

        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one target cell to paste.');
            closeContextMenu();
            return;
        }

        void getClipboardText()
            .then((text) => {
                const snapshot = captureSnapshot();
                const pasteResult = applyClipboardPaste({
                    text,
                    selectedCells: effectiveSelection,
                    displayRows: deps.displayRows,
                    rowOrder: deps.rowOrder,
                    editedCells: deps.editedCells,
                    draftRows: deps.draftRows,
                    deletedRows: deps.deletedRows,
                    columnCount: deps.result?.columns.length || 0,
                });
                if (!pasteResult) {
                    toast.info('Clipboard data is empty or cannot be pasted here.');
                    return;
                }
                registerUndoAction('paste', snapshot);
                deps.setEditedCells(pasteResult.nextEdited);
                deps.setDraftRows(pasteResult.nextDraftRows);
                if (pasteResult.pastedCells.size > 0) {
                    deps.setSelectedCells(pasteResult.pastedCells);
                }
            })
            .catch(() => toast.error('Failed to read from clipboard'));
        closeContextMenu();
    }, [canMutateCells, captureSnapshot, closeContextMenu, deps, getEffectiveSelection, registerUndoAction, toast]);

    const handleContextSetNull = React.useCallback(() => {
        if (!canMutateCells) {
            toast.error('Result is read-only. Set NULL is unavailable.');
            closeContextMenu();
            return;
        }

        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to set NULL.');
            closeContextMenu();
            return;
        }

        const setNullResult = applySetNullToSelection({
            selectedCells: effectiveSelection,
            displayRowsByKey: deps.displayRowsByKey,
            editedCells: deps.editedCells,
            draftRows: deps.draftRows,
            nullableByColumnIndex,
        });

        if (setNullResult.updatedCount > 0) {
            registerUndoAction('set NULL', captureSnapshot());
            deps.setEditedCells(setNullResult.nextEdited);
            deps.setDraftRows(setNullResult.nextDraftRows);
            deps.setSelectedCells(setNullResult.updatedCells);
        }

        if (setNullResult.updatedCount === 0 && setNullResult.skippedCount === 0) {
            toast.info('No editable cells in current selection.');
        } else if (setNullResult.updatedCount === 0) {
            toast.info(`Skipped ${setNullResult.skippedCount} non-nullable cell(s).`);
        } else if (setNullResult.skippedCount > 0) {
            toast.info(`Set NULL for ${setNullResult.updatedCount} cell(s), skipped ${setNullResult.skippedCount} non-nullable cell(s).`);
        }

        closeContextMenu();
    }, [canMutateCells, captureSnapshot, closeContextMenu, deps.displayRowsByKey, deps.draftRows, deps.editedCells, deps.setDraftRows, deps.setEditedCells, deps.setSelectedCells, getEffectiveSelection, nullableByColumnIndex, registerUndoAction, toast]);

    const handleContextDelete = React.useCallback(() => {
        if (!canMutateRows) {
            toast.error('Row actions are unavailable in current mode.');
            closeContextMenu();
            return;
        }

        const targetRowKeys = deps.selectedRowKeys.length > 0
            ? deps.selectedRowKeys
            : (contextMenu ? [contextMenu.rowKey] : []);
        if (targetRowKeys.length === 0) {
            toast.info('Select row(s) to delete.');
            closeContextMenu();
            return;
        }

        const targetDraftIds = targetRowKeys
            .filter((rowKey) => rowKey.startsWith('d:'))
            .map((rowKey) => rowKey.slice(2));
        const targetPersistedIndices = Array.from(new Set(targetRowKeys
            .filter((rowKey) => rowKey.startsWith('p:'))
            .map((rowKey) => Number(rowKey.slice(2)))
            .filter((rowIndex) => Number.isFinite(rowIndex))));

        if (targetPersistedIndices.length > 0 && !deps.isEditable) {
            toast.error('Result is read-only. Make sure the query includes the primary key(s).');
            closeContextMenu();
            return;
        }

        if (targetDraftIds.length > 0) {
            registerUndoAction('delete row', captureSnapshot());
            deps.removeDraftRows(targetDraftIds);
        }
        if (targetPersistedIndices.length > 0) {
            if (targetDraftIds.length === 0) {
                registerUndoAction('delete row', captureSnapshot());
            }
            deps.setDeletedRows((prev) => {
                const next = new Set(prev);
                targetPersistedIndices.forEach((rowIndex) => next.add(rowIndex));
                return next;
            });
        }

        closeContextMenu();
    }, [canMutateRows, captureSnapshot, closeContextMenu, contextMenu, deps, registerUndoAction, toast]);

    const handleContextDuplicate = React.useCallback(() => {
        if (!canMutateRows) {
            toast.error('Row actions are unavailable in current mode.');
            closeContextMenu();
            return;
        }

        const selectedRowSet = new Set(deps.selectedRowKeys);
        let targetRows = deps.displayRows.filter((row) => row.kind === 'persisted' && selectedRowSet.has(row.key));
        if (targetRows.length === 0 && contextMenuRow?.kind === 'persisted') {
            targetRows = [contextMenuRow];
        }
        if (targetRows.length === 0) {
            toast.info('Select at least one persisted row to duplicate.');
            closeContextMenu();
            return;
        }

        const lastRow = targetRows[targetRows.length - 1];
        const duplicated = targetRows.map((row) => ({
            id: crypto.randomUUID(),
            kind: 'duplicate' as const,
            values: deps.getPersistedRowValues(row.persistedIndex as number),
            insertAfterRowIndex: lastRow.persistedIndex ?? null,
            sourceRowIndex: row.persistedIndex,
        }));

        registerUndoAction('duplicate row', captureSnapshot());
        deps.setDraftRows((prev) => [...prev, ...duplicated]);
        const firstDraftKey = `d:${duplicated[0].id}`;
        deps.setSelectedCells(new Set([makeCellId(firstDraftKey, 0)]));
        deps.setFocusCellRequest({
            rowKey: firstDraftKey,
            colIdx: 0,
            nonce: Date.now(),
        });
        closeContextMenu();
    }, [canMutateRows, captureSnapshot, closeContextMenu, contextMenuRow, deps, registerUndoAction, toast]);

    React.useEffect(() => {
        if (!contextMenu) return;
        const handleMouseDown = (event: MouseEvent) => {
            if (contextMenuRef.current?.contains(event.target as Node)) return;
            setContextMenu(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setContextMenu(null);
        };
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', closeContextMenu);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', closeContextMenu);
        };
    }, [closeContextMenu, contextMenu]);

    React.useEffect(() => {
        setContextMenu(null);
    }, [deps.result?.isDone, deps.result?.lastExecutedQuery]);

    const contextMenuPosition = React.useMemo(() => {
        if (!contextMenu || typeof window === 'undefined') return null;
        const estimatedWidth = 190;
        const estimatedHeight = 320;
        const left = Math.min(contextMenu.x, window.innerWidth - estimatedWidth - 8);
        const top = Math.min(contextMenu.y, window.innerHeight - estimatedHeight - 8);
        return {
            left: Math.max(8, left),
            top: Math.max(8, top),
        };
    }, [contextMenu]);

    const copyDisabledTitle = canCopy ? 'Copy selected cells (TSV)' : 'Select at least one cell to copy.';
    const pasteDisabledTitle = canPaste ? 'Paste into selected cells (Ctrl+V)' : !canMutateCells ? 'Result is read-only. Paste is unavailable.' : 'Select at least one target cell to paste.';
    const setNullDisabledTitle = canSetNull ? 'Set selected editable cells to NULL' : !canMutateCells ? 'Result is read-only. Set NULL is unavailable.' : 'Select at least one editable cell.';
    const duplicateDisabledTitle = canDuplicateRows && canMutateRows ? 'Duplicate selected persisted row(s)' : !canMutateRows ? 'Row actions are unavailable in current mode.' : 'Select at least one persisted row to duplicate.';
    const deleteDisabledTitle = canDeleteRows && canMutateRows ? 'Delete selected row(s)' : !canMutateRows ? 'Row actions are unavailable in current mode.' : 'Select row(s) to delete.';
    const canGenerateWhereByPk = getTargetPersistedRowIndices().length > 0 && pkColumns.length > 0;
    const canGenerateWhereByIn = getEffectiveSelection().size > 0;
    const canOpenRowInNewQueryTab = Boolean(deps.result?.tableName) && getTargetPersistedRowIndices().length > 0 && pkColumns.length > 0;
    const undoDisabledTitle = lastUndoLabel ? `Undo ${lastUndoLabel}` : 'No context action to undo.';
    const openRowQueryDisabledTitle = canOpenRowInNewQueryTab ? 'Open SELECT query in a new tab for the selected row' : pkColumns.length === 0 ? 'Primary key is required to open row query.' : 'Select a persisted row first.';

    const copyAsActions = React.useMemo<ResultContextCopyAsAction[]>(() => {
        const actions: ResultContextCopyAsAction[] = [
            {
                id: 'copy-with-headers',
                label: 'TSV (with headers)',
                onSelect: handleContextCopyWithHeaders,
                disabled: !canCopy,
                title: canCopy ? 'Copy selected cells with column headers' : 'Select at least one cell to copy.',
            },
            {
                id: 'copy-csv-with-headers',
                label: 'CSV (with headers)',
                onSelect: handleContextCopyAsCsvWithHeaders,
                disabled: !canCopy,
                title: canCopy ? 'Copy selected cells as CSV with headers' : 'Select at least one cell to copy.',
            },
            {
                id: 'copy-json',
                label: 'JSON',
                onSelect: handleContextCopyAsJson,
                disabled: !canCopy,
                title: canCopy ? 'Copy selected cells as JSON' : 'Select at least one cell to copy.',
            },
        ];
        if (deps.result?.tableName) {
            actions.push({
                id: 'copy-insert',
                label: 'INSERT',
                onSelect: handleContextCopyAsInsert,
                disabled: !canCopy,
                title: canCopy ? 'Copy selected cells as INSERT statements' : 'Select at least one cell to copy.',
            });
            actions.push({
                id: 'copy-update',
                label: 'UPDATE',
                onSelect: handleContextCopyAsUpdate,
                disabled: !canCopy,
                title: canCopy ? 'Copy selected cells as UPDATE statement' : 'Select at least one cell to copy.',
            });
        }
        return actions;
    }, [
        canCopy,
        deps.result?.tableName,
        handleContextCopyAsCsvWithHeaders,
        handleContextCopyAsInsert,
        handleContextCopyAsJson,
        handleContextCopyAsUpdate,
        handleContextCopyWithHeaders,
    ]);

    const whereActions = React.useMemo<ResultContextWhereAction[]>(() => ([
        {
            id: 'where-by-pk',
            label: 'By Row PK',
            onSelect: handleGenerateWhereByPk,
            disabled: !canGenerateWhereByPk,
            title: canGenerateWhereByPk ? 'Generate WHERE clause using selected row primary key(s)' : 'Select persisted row(s) with available primary key.',
        },
        {
            id: 'where-by-in',
            label: 'By Selected Values (IN)',
            onSelect: handleGenerateWhereByIn,
            disabled: !canGenerateWhereByIn,
            title: canGenerateWhereByIn ? 'Generate WHERE IN from selected values in one column' : 'Select at least one column cell first.',
        },
    ]), [canGenerateWhereByIn, canGenerateWhereByPk, handleGenerateWhereByIn, handleGenerateWhereByPk]);

    return {
        contextMenu,
        contextMenuRef,
        contextMenuPosition,
        canCopy,
        canPaste,
        canSetNull,
        canDeleteRows: canDeleteRows && canMutateRows,
        canDuplicateRows: canDuplicateRows && canMutateRows,
        copyDisabledTitle,
        pasteDisabledTitle,
        setNullDisabledTitle,
        duplicateDisabledTitle,
        deleteDisabledTitle,
        undoDisabledTitle,
        openRowQueryDisabledTitle,
        copyAsActions,
        whereActions,
        canOpenRowInNewQueryTab,
        canUndoLastContextAction: Boolean(lastUndoLabel),
        handleCellContextMenu,
        handleContextCopy,
        handleContextSetNull,
        handleContextPaste,
        handleContextDelete,
        handleContextDuplicate,
        handleOpenRowInNewQueryTab,
        handleUndoLastContextAction,
    };
}
