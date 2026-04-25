import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emitCommand } from '../../../lib/commandBus';
import { DOM_EVENT } from '../../../lib/constants';
import {
    isDatetimeLike,
    makeCellId,
    parseCellId,
    toDatetimeLocalValue,
} from './cellUtils';
import { applyDraftRowValueChanges } from './draftRowUpdates';
import { TableMeta } from './types';
import { ResultTableInteractions, UseResultTableInteractionsArgs } from './interactionTypes';

export function useResultTableInteractions({
    tabId,
    isDone,
    columns,
    rows,
    selectedCells,
    setSelectedCells,
    selectedRowKeys,
    setSelectedRowKeys,
    editedCells,
    setEditedCells,
    deletedRows,
    setDeletedRows,
    setDraftRows,
    displayRows,
    displayRowsByKey,
    rowOrder,
    isEditable,
    focusCellRequest,
    onFocusCellRequestHandled,
    onRemoveDraftRows,
    onCellContextMenu,
    onRowHeaderContextMenu,
    onReadOnlyEditAttempt,
}: UseResultTableInteractionsArgs): ResultTableInteractions {
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [lastSelected, setLastSelected] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{
        rowKey: string;
        colIdx: number;
        active: boolean;
        initialSelected: Set<string>;
    } | null>(null);
    const [rowDragStart, setRowDragStart] = useState<{ rowKey: string; active: boolean } | null>(null);
    const pendingSelectionRef = useRef<{ cellId: string; rowKey: string; colIdx: number } | null>(null);
    const editValueRef = useRef(editValue);
    const editingCellRef = useRef(editingCell);
    const displayRowsRef = useRef(displayRows);

    useEffect(() => { editValueRef.current = editValue; }, [editValue]);
    useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);
    useEffect(() => { displayRowsRef.current = displayRows; }, [displayRows]);
    useEffect(() => {
        if (!isDone) {
            setEditingCell(null);
            setLastSelected(null);
            setDragStart(null);
        }
    }, [isDone, rows]);

    useEffect(() => {
        const handleMouseUp = () => { setDragStart(null); setRowDragStart(null); };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const emitSaveShortcut = useCallback(() => {
        emitCommand(DOM_EVENT.SAVE_TAB_ACTION, tabId);
    }, [tabId]);

    const focusCell = useCallback((rowKey: string, colIdx: number) => {
        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;

        const rawValue = displayRow.values[colIdx] ?? '';
        pendingSelectionRef.current = null;
        setSelectedCells(new Set([makeCellId(rowKey, colIdx)]));
        setLastSelected(makeCellId(rowKey, colIdx));
        setEditingCell(makeCellId(rowKey, colIdx));
        setEditValue(isDatetimeLike(rawValue) ? toDatetimeLocalValue(rawValue) : rawValue);
    }, [displayRowsByKey, setSelectedCells]);

    useEffect(() => {
        if (!focusCellRequest) return;
        focusCell(focusCellRequest.rowKey, focusCellRequest.colIdx);
        onFocusCellRequestHandled();
    }, [focusCell, focusCellRequest, onFocusCellRequestHandled]);

    const handleCellMouseDown = useCallback((event: React.MouseEvent, rowKey: string, colIdx: number) => {
        if (!isDone || event.button !== 0) return;
        const cellId = makeCellId(rowKey, colIdx);

        if (editingCellRef.current && editingCellRef.current !== cellId) {
            pendingSelectionRef.current = { cellId, rowKey, colIdx };
        } else {
            pendingSelectionRef.current = null;
        }

        if (event.shiftKey && lastSelected) {
            const { rowKey: lastRowKey, colIdx: lastColIdx } = parseCellId(lastSelected);
            const currentRowOrder = rowOrder.get(rowKey);
            const lastRowOrder = rowOrder.get(lastRowKey);
            if (currentRowOrder !== undefined && lastRowOrder !== undefined && lastColIdx === colIdx) {
                setSelectedCells((prev) => {
                    const next = new Set(prev);
                    const min = Math.min(currentRowOrder, lastRowOrder);
                    const max = Math.max(currentRowOrder, lastRowOrder);
                    for (let rowIndex = min; rowIndex <= max; rowIndex++) {
                        next.add(makeCellId(displayRows[rowIndex].key, colIdx));
                    }
                    return next;
                });
                return;
            }
        }

        if (event.ctrlKey || event.metaKey) {
            setSelectedCells((prev) => {
                const next = new Set(prev);
                if (next.has(cellId)) next.delete(cellId); else next.add(cellId);
                return next;
            });
        } else {
            setSelectedCells(new Set([cellId]));
            setDragStart({ rowKey, colIdx, active: true, initialSelected: new Set([cellId]) });
        }

        setLastSelected(cellId);
    }, [displayRows, isDone, lastSelected, rowOrder, setSelectedCells]);

    const handleCellMouseEnter = useCallback((rowKey: string, colIdx: number) => {
        if (!dragStart?.active) return;

        const startRowOrder = rowOrder.get(dragStart.rowKey);
        const currentRowOrder = rowOrder.get(rowKey);
        if (startRowOrder === undefined || currentRowOrder === undefined) return;

        setSelectedCells(() => {
            const next = new Set(dragStart.initialSelected);
            const minRow = Math.min(startRowOrder, currentRowOrder);
            const maxRow = Math.max(startRowOrder, currentRowOrder);
            const minCol = Math.min(dragStart.colIdx, colIdx);
            const maxCol = Math.max(dragStart.colIdx, colIdx);

            for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
                for (let nextCol = minCol; nextCol <= maxCol; nextCol++) {
                    next.add(makeCellId(displayRows[rowIndex].key, nextCol));
                }
            }
            return next;
        });
        setLastSelected(makeCellId(rowKey, colIdx));
    }, [displayRows, dragStart, rowOrder, setSelectedCells]);

    const handleCellDoubleClick = useCallback((rowKey: string, colIdx: number, val: string) => {
        if (!isDone) return;
        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;
        if (displayRow.kind === 'persisted' && !isEditable) {
            onReadOnlyEditAttempt?.();
            return;
        }

        const cellId = makeCellId(rowKey, colIdx);
        pendingSelectionRef.current = null;
        setEditingCell(cellId);
        setEditValue(isDatetimeLike(val) ? toDatetimeLocalValue(val) : val);
        setSelectedCells(new Set([cellId]));
        setLastSelected(cellId);
    }, [displayRowsByKey, isDone, isEditable, onReadOnlyEditAttempt, setSelectedCells]);

    const handleCellContextMenu = useCallback((event: React.MouseEvent, rowKey: string, colIdx: number) => {
        if (!isDone || !onCellContextMenu) return;
        event.preventDefault();
        event.stopPropagation();
        const cellId = makeCellId(rowKey, colIdx);
        if (!selectedCells.has(cellId)) {
            setSelectedCells(new Set([cellId]));
            setLastSelected(cellId);
        }
        onCellContextMenu({
            x: event.clientX,
            y: event.clientY,
            rowKey,
            colIdx,
            cellId,
        });
    }, [isDone, onCellContextMenu, selectedCells, setSelectedCells]);

    const commitEdit = useCallback(async (options?: { nextDirection?: 1 | -1 }) => {
        const currentEditingCell = editingCellRef.current;
        if (!currentEditingCell) return;

        const { rowKey, colIdx } = parseCellId(currentEditingCell);
        const displayRow = displayRowsRef.current.find((row) => row.key === rowKey);
        if (!displayRow) return;

        const nextValue = editValueRef.current;
        const originalValue = displayRow.values[colIdx] ?? '';
        if (displayRow.kind === 'persisted') {
            setEditedCells((prev) => {
                const key = `${displayRow.persistedIndex}:${colIdx}`;
                if (nextValue === originalValue) {
                    if (!prev.has(key)) return prev;
                    const next = new Map(prev);
                    next.delete(key);
                    return next;
                }
                const next = new Map(prev);
                next.set(key, nextValue);
                return next;
            });
        } else {
            if (nextValue !== originalValue) {
                applyDraftRowValueChanges(setDraftRows, [{ rowKey: displayRow.key, colIdx, value: nextValue }]);
            }
        }

        const currentRowOrder = rowOrder.get(rowKey);
        if (options?.nextDirection && currentRowOrder !== undefined) {
            const nextColIdx = colIdx + options.nextDirection;
            if (nextColIdx >= 0 && nextColIdx < columns.length) {
                pendingSelectionRef.current = null;
                const nextCellId = makeCellId(rowKey, nextColIdx);
                const nextCellValue = displayRow.kind === 'persisted'
                    ? (editedCells.get(`${displayRow.persistedIndex}:${nextColIdx}`) ?? displayRow.values[nextColIdx] ?? '')
                    : (displayRow.values[nextColIdx] ?? '');
                setEditingCell(nextCellId);
                setEditValue(isDatetimeLike(nextCellValue) ? toDatetimeLocalValue(nextCellValue) : nextCellValue);
                setSelectedCells(new Set([nextCellId]));
                setLastSelected(nextCellId);
                return;
            }
        }

        setEditingCell(null);
        if (pendingSelectionRef.current) {
            const { cellId } = pendingSelectionRef.current;
            pendingSelectionRef.current = null;
            setSelectedCells(new Set([cellId]));
            setLastSelected(cellId);
            return;
        }

        setSelectedCells(new Set([makeCellId(rowKey, colIdx)]));
    }, [columns.length, editedCells, rowOrder, setDraftRows, setEditedCells, setSelectedCells]);

    const handleRevertRow = useCallback((rowKey: string) => {
        const displayRow = displayRowsByKey.get(rowKey);
        if (!displayRow) return;

        if (displayRow.kind === 'draft') {
            onRemoveDraftRows([displayRow.draft!.id]);
            return;
        }

        const rowIndex = displayRow.persistedIndex as number;
        setEditedCells((prev) => {
            const next = new Map(prev);
            Array.from(next.keys()).forEach((key) => {
                if (key.startsWith(`${rowIndex}:`)) {
                    next.delete(key);
                }
            });
            return next;
        });

        if (setDeletedRows && deletedRows?.has(rowIndex)) {
            setDeletedRows((prev) => {
                const next = new Set(prev);
                next.delete(rowIndex);
                return next;
            });
        }
    }, [deletedRows, displayRowsByKey, onRemoveDraftRows, setDeletedRows, setEditedCells]);

    const handleRowHeaderMouseDown = useCallback((event: React.MouseEvent, rowKey: string) => {
        if (!isDone || event.button !== 0) return;
        event.preventDefault();
        setSelectedCells(new Set());
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            if (event.ctrlKey || event.metaKey) {
                if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
            } else if (event.shiftKey) {
                // Shift+click: range from last selected row
                const keys = Array.from(prev);
                const lastKey = keys[keys.length - 1];
                if (lastKey) {
                    const lastOrder = rowOrder.get(lastKey);
                    const currentOrder = rowOrder.get(rowKey);
                    if (lastOrder !== undefined && currentOrder !== undefined) {
                        const min = Math.min(lastOrder, currentOrder);
                        const max = Math.max(lastOrder, currentOrder);
                        for (let i = min; i <= max; i++) {
                            next.add(displayRows[i].key);
                        }
                        return next;
                    }
                }
                next.add(rowKey);
            } else {
                next.clear();
                next.add(rowKey);
            }
            return next;
        });
        setRowDragStart({ rowKey, active: true });
    }, [isDone, displayRows, rowOrder, setSelectedCells, setSelectedRowKeys]);

    const handleRowHeaderMouseEnter = useCallback((rowKey: string) => {
        if (!rowDragStart?.active) return;
        const startOrder = rowOrder.get(rowDragStart.rowKey);
        const currentOrder = rowOrder.get(rowKey);
        if (startOrder === undefined || currentOrder === undefined) return;
        const min = Math.min(startOrder, currentOrder);
        const max = Math.max(startOrder, currentOrder);
        setSelectedRowKeys(() => {
            const next = new Set<string>();
            for (let i = min; i <= max; i++) {
                next.add(displayRows[i].key);
            }
            return next;
        });
    }, [displayRows, rowDragStart, rowOrder, setSelectedRowKeys]);

    const handleRowHeaderClick = useCallback((event: React.MouseEvent, rowKey: string) => {
        if (!isDone) return;
        event.preventDefault();
        event.stopPropagation();
        setSelectedCells(new Set());
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
                if (next.has(rowKey)) next.delete(rowKey);
                else next.add(rowKey);
            } else {
                if (next.size === 1 && next.has(rowKey)) next.clear();
                else { next.clear(); next.add(rowKey); }
            }
            return next;
        });
    }, [isDone, setSelectedCells, setSelectedRowKeys]);

    const handleRowHeaderContextMenu = useCallback((event: React.MouseEvent, rowKey: string) => {
        if (!isDone || !onRowHeaderContextMenu) return;
        event.preventDefault();
        event.stopPropagation();
        // Ensure right-clicked row is in the selection
        setSelectedRowKeys((prev) => {
            if (prev.has(rowKey)) return prev;
            const next = new Set(prev);
            next.add(rowKey);
            return next;
        });
        setSelectedCells(new Set());
        onRowHeaderContextMenu({
            x: event.clientX,
            y: event.clientY,
            rowKey,
            colIdx: 0,
            cellId: makeCellId(rowKey, 0),
        });
    }, [isDone, onRowHeaderContextMenu, setSelectedCells, setSelectedRowKeys]);

    const tableMeta = useMemo<TableMeta>(() => ({
        selectedCells,
        selectedRowKeys,
        editedCells,
        editingCell,
        editValue,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleCellDoubleClick,
        handleCellContextMenu,
        handleRowHeaderMouseDown,
        handleRowHeaderMouseEnter,
        handleRowHeaderClick,
        handleRowHeaderContextMenu,
        setEditValue,
        setEditingCell,
        handleRevertRow,
    }), [
        selectedCells,
        selectedRowKeys,
        editedCells,
        editingCell,
        editValue,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleCellDoubleClick,
        handleCellContextMenu,
        handleRowHeaderMouseDown,
        handleRowHeaderMouseEnter,
        handleRowHeaderClick,
        handleRowHeaderContextMenu,
        handleRevertRow,
    ]);
    return {
        editingCell,
        editValue,
        setEditValue,
        setEditingCell,
        commitEdit,
        emitSaveShortcut,
        handleRevertRow,
        tableMeta,
    };
}
