import React from 'react';
import { getClipboardText, setClipboardText } from '../../../services/clipboardService';
import {
    applyClipboardPaste,
    applySetNullToSelection,
    buildRowsAsInsertStatements,
    buildRowAsUpdateStatement,
    buildSelectionMatrix,
    matrixToTsv,
} from '../resultSelectionActions';
import { makeCellId, parseCellId } from '../resultPanelUtils';
import { useToast } from '../../layout/Toast';
import type { ResultContextMenuDeps, ResultContextMenuPayload } from './types';

export function useResultContextMenuActions(deps: ResultContextMenuDeps) {
    const { toast } = useToast();
    const [contextMenu, setContextMenu] = React.useState<ResultContextMenuPayload | null>(null);
    const contextMenuRef = React.useRef<HTMLDivElement>(null);

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

    const closeContextMenu = React.useCallback(() => {
        setContextMenu(null);
    }, []);

    const getEffectiveSelection = React.useCallback(() => {
        if (deps.selectedCells.size > 0) return deps.selectedCells;
        if (!contextMenu?.cellId) return new Set<string>();
        return new Set([contextMenu.cellId]);
    }, [contextMenu?.cellId, deps.selectedCells]);

    const handleCellContextMenu = React.useCallback((payload: ResultContextMenuPayload) => {
        setContextMenu(payload);
    }, []);

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

    const handleContextCopyCellValue = React.useCallback(() => {
        if (!contextMenu) {
            closeContextMenu();
            return;
        }
        const { rowKey, colIdx } = contextMenu;
        const row = deps.displayRowsByKey.get(rowKey);
        let value = '';
        if (row) {
            if (row.kind === 'persisted') {
                value = deps.editedCells.get(`${row.persistedIndex}:${colIdx}`) ?? row.values[colIdx] ?? '';
            } else {
                value = row.values[colIdx] ?? '';
            }
        }
        void setClipboardText(value)
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, contextMenu, deps.displayRowsByKey, deps.editedCells, toast]);

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
        const pkColumns = deps.columnDefsByName
            ? Array.from(deps.columnDefsByName.values()).filter((c) => c.IsPrimaryKey).map((c) => c.Name)
            : [];
        const sql = buildRowAsUpdateStatement({
            selectedCells: effectiveSelection, displayRows: deps.displayRows, rowOrder: deps.rowOrder, editedCells: deps.editedCells, columns, pkColumns, tableName, driver: deps.driver || '',
        });
        if (!sql) { toast.info('No copyable cells in current selection.'); closeContextMenu(); return; }
        void setClipboardText(sql).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [deps.columnDefsByName, deps.displayRows, deps.driver, deps.editedCells, deps.result?.columns, deps.result?.tableName, deps.rowOrder, getEffectiveSelection, closeContextMenu, toast]);

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
                deps.setEditedCells(pasteResult.nextEdited);
                deps.setDraftRows(pasteResult.nextDraftRows);
                if (pasteResult.pastedCells.size > 0) {
                    deps.setSelectedCells(pasteResult.pastedCells);
                }
            })
            .catch(() => toast.error('Failed to read from clipboard'));
        closeContextMenu();
    }, [canMutateCells, closeContextMenu, deps, getEffectiveSelection, toast]);

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
    }, [canMutateCells, closeContextMenu, deps.displayRowsByKey, deps.draftRows, deps.editedCells, deps.setDraftRows, deps.setEditedCells, deps.setSelectedCells, getEffectiveSelection, nullableByColumnIndex, toast]);

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
            deps.removeDraftRows(targetDraftIds);
        }
        if (targetPersistedIndices.length > 0) {
            deps.setDeletedRows((prev) => {
                const next = new Set(prev);
                targetPersistedIndices.forEach((rowIndex) => next.add(rowIndex));
                return next;
            });
        }

        closeContextMenu();
    }, [canMutateRows, closeContextMenu, contextMenu, deps, toast]);

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

        deps.setDraftRows((prev) => [...prev, ...duplicated]);
        const firstDraftKey = `d:${duplicated[0].id}`;
        deps.setSelectedCells(new Set([makeCellId(firstDraftKey, 0)]));
        deps.setFocusCellRequest({
            rowKey: firstDraftKey,
            colIdx: 0,
            nonce: Date.now(),
        });
        closeContextMenu();
    }, [canMutateRows, closeContextMenu, contextMenuRow, deps, toast]);

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

    return {
        contextMenu,
        contextMenuRef,
        contextMenuPosition,
        hasEditableCellSelection,
        canMutateCells,
        canMutateRows,
        canDeleteRows,
        canDuplicateRows,
        handleCellContextMenu,
        handleContextCopy,
        handleContextCopyCellValue,
        handleContextCopyWithHeaders,
        handleContextCopyAsJson,
        handleContextCopyAsInsert,
        handleContextCopyAsUpdate,
        handleContextSetNull,
        handleContextPaste,
        handleContextDelete,
        handleContextDuplicate,
    };
}
