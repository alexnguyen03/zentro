import React from 'react';
import { TabResult, useResultStore } from '../../stores/resultStore';
import { ExecuteUpdateSync } from '../../services/queryService';

interface UseResultPanelScriptActionsParams {
    tabId: string;
    result?: TabResult;
    editedCells: Map<string, string>;
    deletedRows: Set<number>;
    addTab: (tab: { name: string; query: string }) => void;
    onCloseSaveModal: () => void;
    onResetChanges: () => void;
    onSuccessToast: (message: string) => void;
    onErrorToast: (message: string) => void;
}

function toSqlValue(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NULL';
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
        return `${value}`;
    }

    if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }

    return `'${String(value).replace(/'/g, "''")}'`;
}

export function useResultPanelScriptActions({
    tabId,
    result,
    editedCells,
    deletedRows,
    addTab,
    onCloseSaveModal,
    onResetChanges,
    onSuccessToast,
    onErrorToast,
}: UseResultPanelScriptActionsParams) {
    const applyEdits = useResultStore((s) => s.applyEdits);

    const generateUpdateScript = React.useCallback(() => {
        if (!result?.tableName || !result.primaryKeys || (editedCells.size === 0 && deletedRows.size === 0)) {
            return '';
        }

        const sqlStmts: string[] = [];

        Array.from(deletedRows)
            .sort((a, b) => b - a)
            .forEach((rowIndex) => {
                const where = result.primaryKeys!
                    .map((pk) => {
                        const value = result.rows[rowIndex][result.columns.indexOf(pk)];
                        return `"${pk}" = ${toSqlValue(value)}`;
                    })
                    .join(' AND ');
                sqlStmts.push(`DELETE FROM "${result.tableName}" WHERE ${where};`);
            });

        const updatesByRow = new Map<number, { col: string; val: string }[]>();
        editedCells.forEach((val, cellId) => {
            const [rowString, columnString] = cellId.split(':');
            const rowIndex = Number(rowString);
            if (deletedRows.has(rowIndex)) {
                return;
            }

            const columnIndex = Number(columnString);
            if (!updatesByRow.has(rowIndex)) {
                updatesByRow.set(rowIndex, []);
            }
            updatesByRow.get(rowIndex)!.push({ col: result.columns[columnIndex], val });
        });

        updatesByRow.forEach((edits, rowIndex) => {
            const where = result.primaryKeys!
                .map((pk) => {
                    const value = result.rows[rowIndex][result.columns.indexOf(pk)];
                    return `"${pk}" = ${toSqlValue(value)}`;
                })
                .join(' AND ');
            const sets = edits
                .map((edit) => `"${edit.col}" = ${toSqlValue(edit.val)}`)
                .join(', ');
            sqlStmts.push(`UPDATE "${result.tableName}" SET ${sets} WHERE ${where};`);
        });

        return sqlStmts.join('\n');
    }, [result, editedCells, deletedRows]);

    const handleCopyScript = React.useCallback(() => {
        navigator.clipboard.writeText(generateUpdateScript());
        onSuccessToast('Script copied to clipboard');
    }, [generateUpdateScript, onSuccessToast]);

    const handleOpenInNewTab = React.useCallback(() => {
        addTab({ name: `Update ${result?.tableName}`, query: generateUpdateScript() });
        onCloseSaveModal();
        onResetChanges();
        onSuccessToast('Script opened in a new tab.');
    }, [addTab, result, generateUpdateScript, onCloseSaveModal, onResetChanges, onSuccessToast]);

    const handleDirectExecute = React.useCallback(async () => {
        const script = generateUpdateScript();
        if (!script) {
            return;
        }

        try {
            onCloseSaveModal();
            const affected = await ExecuteUpdateSync(script);
            applyEdits(tabId, editedCells, deletedRows);
            onResetChanges();
            onSuccessToast(`Update executed successfully (${affected} row${affected !== 1 ? 's' : ''} modified).`);
        } catch (err) {
            onErrorToast(`Update failed: ${err}`);
            console.error('Execute update error:', err);
        }
    }, [generateUpdateScript, onCloseSaveModal, applyEdits, tabId, editedCells, deletedRows, onResetChanges, onSuccessToast, onErrorToast]);

    return {
        generateUpdateScript,
        handleCopyScript,
        handleOpenInNewTab,
        handleDirectExecute,
    };
}
