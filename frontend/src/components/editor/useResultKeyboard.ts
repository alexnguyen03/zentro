import React from 'react';
import type { DraftRow } from '../../lib/dataEditing';
import { parseCellId, makeCellId } from './resultPanelUtils';
import { useToast } from '../layout/Toast';

interface UseResultKeyboardOptions {
    tabId: string;
    result: {
        columns: string[];
        rows: string[][];
        isDone: boolean;
        isSelect: boolean;
    } | undefined;
    hasPendingChanges: boolean;
    isReadOnlyTab: boolean;
    viewMode: boolean;
    isEditable: boolean;
    selectedCells: Set<string>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedRowKeys: string[];
    displayRows: Array<{ key: string; kind: 'persisted' | 'draft'; persistedIndex?: number | null; values: string[]; draft?: { id: string } | null }>;
    displayRowsByKey: Map<string, { key: string; kind: 'persisted' | 'draft'; persistedIndex?: number | null; values: string[]; draft?: { id: string } | null }>;
    rowOrder: Map<string, number>;
    editedCells: Map<string, string>;
    deletedRows: Set<number>;
    draftRows: DraftRow[];
    isSavingDraftRows: boolean;
    onRun?: () => void;
    onSaveRequest: () => Promise<void> | void;
    onDeleteSelected: () => void;
    onSetShowRightSidebar: (show: boolean) => void;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    setDraftRows: React.Dispatch<React.SetStateAction<DraftRow[]>>;
}

/**
 * Returns an `onKeyDown` handler for the ResultPanel container div.
 * Handles: F5 re-run, Tab double-tap to open row detail, Delete rows,
 * Ctrl+S save, Ctrl+C copy matrix, Ctrl+V paste matrix.
 */
export function useResultKeyboard({
    result,
    hasPendingChanges,
    isReadOnlyTab,
    viewMode,
    isEditable,
    selectedCells,
    setSelectedCells,
    selectedRowKeys,
    displayRows,
    displayRowsByKey,
    rowOrder,
    editedCells,
    deletedRows,
    draftRows,
    isSavingDraftRows,
    onRun,
    onSaveRequest,
    onDeleteSelected,
    onSetShowRightSidebar,
    setEditedCells,
    setDraftRows,
}: UseResultKeyboardOptions) {
    const lastTabTime = React.useRef(0);
    const { toast } = useToast();

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
            if (!result) return;

            // F5 — re-run
            if (event.key === 'F5') {
                event.preventDefault();
                if (onRun && !hasPendingChanges && !isReadOnlyTab) onRun();
                return;
            }

            // Tab (double) — open row detail sidebar
            if (event.key === 'Tab') {
                if (selectedCells.size > 0 && result.columns.length > 0) {
                    event.preventDefault();
                    const now = Date.now();
                    if (now - lastTabTime.current < 400) {
                        const activeRowKey = selectedRowKeys[0];
                        if (activeRowKey && displayRowsByKey.get(activeRowKey)) {
                            onSetShowRightSidebar(true);
                        }
                        lastTabTime.current = 0;
                    } else {
                        lastTabTime.current = now;
                    }
                }
                return;
            }

            // Delete / Backspace+Ctrl — delete rows
            if (event.key === 'Delete' || (event.key === 'Backspace' && (event.ctrlKey || event.metaKey))) {
                if (viewMode || selectedCells.size === 0) return;
                event.preventDefault();
                onDeleteSelected();
                return;
            }

            // Ctrl+S — save
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                if (viewMode || !hasPendingChanges || isSavingDraftRows) return;
                event.preventDefault();
                void onSaveRequest();
                return;
            }

            // Ctrl+C — copy selection as TSV matrix
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
                if (selectedCells.size === 0) return;
                event.preventDefault();

                let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
                selectedCells.forEach((cellId) => {
                    const { rowKey, colIdx } = parseCellId(cellId);
                    const rowIndex = rowOrder.get(rowKey);
                    if (rowIndex === undefined) return;
                    minRow = Math.min(minRow, rowIndex);
                    maxRow = Math.max(maxRow, rowIndex);
                    minCol = Math.min(minCol, colIdx);
                    maxCol = Math.max(maxCol, colIdx);
                });

                const matrix: string[][] = [];
                for (let ri = minRow; ri <= maxRow; ri++) {
                    const displayRow = displayRows[ri];
                    const row: string[] = [];
                    for (let ci = minCol; ci <= maxCol; ci++) {
                        const cellId = makeCellId(displayRow.key, ci);
                        if (!selectedCells.has(cellId)) { row.push(''); continue; }
                        row.push(
                            displayRow.kind === 'persisted'
                                ? (editedCells.get(`${displayRow.persistedIndex}:${ci}`) ?? displayRow.values[ci] ?? '')
                                : (displayRow.values[ci] ?? ''),
                        );
                    }
                    matrix.push(row);
                }
                navigator.clipboard.writeText(matrix.map((r) => r.join('\t')).join('\n'));
                return;
            }

            // Ctrl+V — paste TSV matrix
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
                if (!isEditable || selectedCells.size === 0) return;
                event.preventDefault();

                navigator.clipboard.readText().then((text) => {
                    if (!text) return;
                    const lines = text.split(/\r?\n/).map((l) => l.split('\t'));
                    if (lines.length === 0 || lines[0].length === 0) return;

                    let minRow = Infinity, minCol = Infinity;
                    selectedCells.forEach((cellId) => {
                        const { rowKey, colIdx } = parseCellId(cellId);
                        const rowIndex = rowOrder.get(rowKey);
                        if (rowIndex === undefined) return;
                        minRow = Math.min(minRow, rowIndex);
                        minCol = Math.min(minCol, colIdx);
                    });

                    const nextEdited = new Map(editedCells);
                    const nextDrafts = draftRows.map((dr) => ({ ...dr, values: [...dr.values] }));
                    const pasted = new Set<string>();

                    for (let rowOffset = 0; rowOffset < lines.length; rowOffset++) {
                        const displayRow = displayRows[minRow + rowOffset];
                        if (!displayRow) break;
                        if (displayRow.kind === 'persisted' && deletedRows.has(displayRow.persistedIndex as number)) continue;

                        for (let colOffset = 0; colOffset < lines[rowOffset].length; colOffset++) {
                            const colIdx = minCol + colOffset;
                            if (colIdx >= result.columns.length) break;
                            const value = lines[rowOffset][colOffset];
                            const cellId = makeCellId(displayRow.key, colIdx);

                            if (displayRow.kind === 'persisted') {
                                nextEdited.set(`${displayRow.persistedIndex}:${colIdx}`, value);
                            } else {
                                const target = nextDrafts.find((dr) => dr.id === displayRow.draft?.id);
                                if (target) target.values[colIdx] = value;
                            }
                            pasted.add(cellId);
                        }
                    }

                    setEditedCells(nextEdited);
                    setDraftRows(nextDrafts);
                    if (pasted.size > 0) setSelectedCells(pasted);
                }).catch(() => toast.error('Failed to read from clipboard'));
            }
        },
        [
            deletedRows, displayRows, displayRowsByKey, draftRows, editedCells,
            hasPendingChanges, isEditable, isSavingDraftRows, isReadOnlyTab,
            onDeleteSelected, onRun, onSaveRequest, onSetShowRightSidebar,
            result, rowOrder, selectedCells, selectedRowKeys,
            setDraftRows, setEditedCells, setSelectedCells, toast, viewMode,
        ],
    );

    return { handleKeyDown };
}
