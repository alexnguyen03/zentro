import React from 'react';
import { TabResult } from '../../stores/resultStore';

interface UseResultPanelKeyboardParams {
    result: TabResult;
    selectedCells: Set<string>;
    editedCells: Map<string, string>;
    deletedRows: Set<number>;
    isEditable: boolean;
    openRowDetail: (rowIndex: number) => void;
    setShowRightSidebar: (show: boolean) => void;
    setDeletedRows: React.Dispatch<React.SetStateAction<Set<number>>>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    openSaveModal: () => void;
    onPasteError: () => void;
}

export function useResultPanelKeyboardShortcuts({
    result,
    selectedCells,
    editedCells,
    deletedRows,
    isEditable,
    openRowDetail,
    setShowRightSidebar,
    setDeletedRows,
    setSelectedCells,
    setEditedCells,
    openSaveModal,
    onPasteError,
}: UseResultPanelKeyboardParams) {
    const lastTabTime = React.useRef(0);

    return React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        if (event.key === 'Tab' && selectedCells.size > 0) {
            event.preventDefault();
            const now = Date.now();
            if (now - lastTabTime.current < 400) {
                const firstCell = Array.from(selectedCells)[0];
                const rowIndex = Number(firstCell.split(':')[0]);
                openRowDetail(rowIndex);
                setShowRightSidebar(true);
                lastTabTime.current = 0;
            } else {
                lastTabTime.current = now;
            }
        }

        if (event.key === 'Delete' && isEditable && selectedCells.size > 0) {
            event.preventDefault();
            const rowsToDelete = new Set(Array.from(selectedCells).map((cell) => Number(cell.split(':')[0])));
            setDeletedRows((prev) => new Set([...prev, ...rowsToDelete]));
            setSelectedCells(new Set());
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && (editedCells.size > 0 || deletedRows.size > 0)) {
            event.preventDefault();
            openSaveModal();
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectedCells.size > 0) {
            event.preventDefault();
            let minRow = Infinity;
            let maxRow = -Infinity;
            let minColumn = Infinity;
            let maxColumn = -Infinity;

            Array.from(selectedCells).forEach((cell) => {
                const [row, column] = cell.split(':').map(Number);
                minRow = Math.min(minRow, row);
                maxRow = Math.max(maxRow, row);
                minColumn = Math.min(minColumn, column);
                maxColumn = Math.max(maxColumn, column);
            });

            const matrix: string[][] = [];
            for (let row = minRow; row <= maxRow; row++) {
                const matrixRow: string[] = [];
                for (let column = minColumn; column <= maxColumn; column++) {
                    const cellId = `${row}:${column}`;
                    if (selectedCells.has(cellId)) {
                        matrixRow.push(editedCells.has(cellId) ? editedCells.get(cellId)! : String(result.rows[row][column] ?? ''));
                    } else {
                        matrixRow.push('');
                    }
                }
                matrix.push(matrixRow);
            }

            navigator.clipboard.writeText(matrix.map((row) => row.join('\t')).join('\n'));
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && isEditable && selectedCells.size > 0) {
            event.preventDefault();
            navigator.clipboard
                .readText()
                .then((text) => {
                    if (!text) {
                        return;
                    }

                    const lines = text.split(/\r?\n/).map((line) => line.split('\t'));
                    if (lines.length === 0 || lines[0].length === 0) {
                        return;
                    }

                    let minRow = Infinity;
                    let minColumn = Infinity;
                    selectedCells.forEach((cellId) => {
                        const [row, column] = cellId.split(':').map(Number);
                        minRow = Math.min(minRow, row);
                        minColumn = Math.min(minColumn, column);
                    });

                    if (lines.length === 1 && lines[0].length === 1) {
                        const value = lines[0][0];
                        setEditedCells((prev) => {
                            const next = new Map(prev);
                            selectedCells.forEach((cellId) => {
                                const row = Number(cellId.split(':')[0]);
                                if (!deletedRows.has(row)) {
                                    next.set(cellId, value);
                                }
                            });
                            return next;
                        });
                        return;
                    }

                    const pastedCells = new Set<string>();
                    setEditedCells((prev) => {
                        const next = new Map(prev);
                        for (let rowOffset = 0; rowOffset < lines.length; rowOffset++) {
                            const row = minRow + rowOffset;
                            if (row >= result.rows.length || deletedRows.has(row)) {
                                continue;
                            }

                            for (let colOffset = 0; colOffset < lines[rowOffset].length; colOffset++) {
                                const column = minColumn + colOffset;
                                if (column >= result.columns.length) {
                                    break;
                                }

                                const cellId = `${row}:${column}`;
                                next.set(cellId, lines[rowOffset][colOffset]);
                                pastedCells.add(cellId);
                            }
                        }
                        return next;
                    });

                    if (pastedCells.size > 0) {
                        setSelectedCells(pastedCells);
                    }
                })
                .catch((error) => {
                    console.error('Paste error:', error);
                    onPasteError();
                });
        }
    }, [
        selectedCells,
        isEditable,
        editedCells,
        deletedRows,
        openRowDetail,
        setShowRightSidebar,
        setDeletedRows,
        setSelectedCells,
        openSaveModal,
        result,
        setEditedCells,
        onPasteError,
    ]);
}
