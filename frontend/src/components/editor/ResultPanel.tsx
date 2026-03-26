import React from 'react';
import {
    AlertCircle,
    CheckCircle,
    Copy,
    Download,
    FilePlus,
    Loader,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
} from 'lucide-react';
import { ExportCSV, ExecuteUpdateSync, ExportJSON, ExportSQLInsert, FetchTotalRowCount } from '../../services/queryService';
import { models, utils } from '../../../wailsjs/go/models';
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
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useResultStore, TabResult } from '../../stores/resultStore';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useStatusStore } from '../../stores/statusStore';
import { Modal } from '../layout/Modal';
import { useToast } from '../layout/Toast';
import { Button } from '../ui';
import { ResultTable, type FocusCellRequest } from './ResultTable';
import { ResultFilterBar } from './ResultFilterBar';
import { JsonViewer, isJsonValue } from '../viewers/JsonViewer';
import { DOM_EVENT } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import { getErrorMessage } from '../../lib/errors';

export interface ResultPanelAction {
    id: string;
    icon: React.ReactNode;
    label?: string;
    title?: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    danger?: boolean;
}

interface ResultPanelProps {
    tabId: string;
    result?: TabResult;
    onRun?: () => void;
    onFilterRun?: (filter: string) => void;
    onActionsChange?: (actions: ResultPanelAction[]) => void;
    baseQuery?: string;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
    isReadOnlyTab?: boolean;
    generatedKind?: 'result' | 'explain';
}

const LIMIT_OPTIONS = [100, 500, 1000, 5000, 10000, 50000];
const CELL_ID_SEPARATOR = '|';

function makeCellId(rowKey: string, colIdx: number): string {
    return `${rowKey}${CELL_ID_SEPARATOR}${colIdx}`;
}

function parseCellId(cellId: string): { rowKey: string; colIdx: number } {
    const separatorIndex = cellId.lastIndexOf(CELL_ID_SEPARATOR);
    return {
        rowKey: cellId.slice(0, separatorIndex),
        colIdx: Number(cellId.slice(separatorIndex + 1)),
    };
}

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
    tabId,
    result,
    onRun,
    onFilterRun,
    onActionsChange,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    isReadOnlyTab = false,
    generatedKind,
}) => {
    const { defaultLimit, theme, fontSize, save, viewMode } = useSettingsStore();
    const { activeProfile } = useConnectionStore();
    const checkAndFetchColumns = useSchemaStore((state) => state.checkAndFetchColumns);
    const addTab = useEditorStore((state) => state.addTab);
    const { toast } = useToast();
    const { openDetail } = useRowDetailStore();
    const { showRightSidebar, setShowRightSidebar } = useLayoutStore();
    const updatePendingState = useResultStore((state) => state.updatePendingState);
    const applyEdits = useResultStore((state) => state.applyEdits);
    const appendInsertedRows = useResultStore((state) => state.appendInsertedRows);

    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);
    const [columnDefs, setColumnDefs] = React.useState<models.ColumnDef[]>([]);
    const [editedCells, setEditedCells] = React.useState<Map<string, string>>(() => result?.pendingEdits ? new Map(result.pendingEdits) : new Map());
    const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
    const [deletedRows, setDeletedRows] = React.useState<Set<number>>(() => result?.pendingDeletions ? new Set(result.pendingDeletions) : new Set());
    const [draftRows, setDraftRows] = React.useState<DraftRow[]>(() => result?.pendingDraftRows ? [...result.pendingDraftRows] : []);
    const [isSavingDraftRows, setIsSavingDraftRows] = React.useState(false);
    const [focusCellRequest, setFocusCellRequest] = React.useState<FocusCellRequest | null>(null);
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [showExportMenu, setShowExportMenu] = React.useState(false);
    const [showTableNameInput, setShowTableNameInput] = React.useState(false);
    const [tableNameForExport, setTableNameForExport] = React.useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);
    const lastTabTime = React.useRef(0);

    const filterExpr = result?.filterExpr || '';
    const sourceQuery = baseQuery || result?.lastExecutedQuery;
    const tableRef = React.useMemo(() => parseTableReference(sourceQuery, result?.tableName), [sourceQuery, result?.tableName]);
    const qualifiedTableName = React.useMemo(() => resolveQualifiedTableName(sourceQuery, result?.tableName), [sourceQuery, result?.tableName]);
    const columnDefsByName = React.useMemo(() => new Map(columnDefs.map((column) => [column.Name, column])), [columnDefs]);
    const displayRows = React.useMemo(() => buildDisplayRows(result?.rows || [], draftRows), [result?.rows, draftRows]);
    const displayRowsByKey = React.useMemo(() => new Map(displayRows.map((row) => [row.key, row])), [displayRows]);
    const rowOrder = React.useMemo(() => new Map(displayRows.map((row, index) => [row.key, index])), [displayRows]);
    const selectedRowKeys = React.useMemo(() => {
        const rowKeys = new Set<string>();
        selectedCells.forEach((cellId) => rowKeys.add(parseCellId(cellId).rowKey));
        return Array.from(rowKeys);
    }, [selectedCells]);
    const selectedPersistedRowIndices = React.useMemo(
        () => selectedRowKeys.filter((rowKey) => rowKey.startsWith('p:')).map((rowKey) => Number(rowKey.slice(2))).filter((rowIndex) => Number.isFinite(rowIndex)),
        [selectedRowKeys],
    );
    const selectedDraftIds = React.useMemo(
        () => selectedRowKeys.filter((rowKey) => rowKey.startsWith('d:')).map((rowKey) => rowKey.slice(2)),
        [selectedRowKeys],
    );
    const isEditable = Boolean(
        !viewMode &&
        !isReadOnlyTab &&
        result?.tableName &&
        result?.primaryKeys &&
        result.primaryKeys.length > 0 &&
        result.primaryKeys.every((primaryKey) => result.columns.includes(primaryKey)),
    );
    const canManageDraftRows = Boolean(
        isEditable &&
        result?.columns.length &&
        columnDefs.length > 0 &&
        result.columns.every((column) => columnDefsByName.has(column)) &&
        qualifiedTableName,
    );
    const hasLegacyChanges = editedCells.size > 0 || deletedRows.size > 0;
    const hasPendingChanges = hasLegacyChanges || draftRows.length > 0;

    const setFilterExpr = React.useCallback((value: string) => {
        useResultStore.getState().setFilterExpr(tabId, value);
    }, [tabId]);

    const queueFocusCell = React.useCallback((rowKey: string, colIdx = 0) => {
        setFocusCellRequest({ rowKey, colIdx, nonce: Date.now() });
    }, []);

    const removeDraftRows = React.useCallback((draftIds: string[]) => {
        if (draftIds.length === 0) return;

        const removedRowKeys = new Set(draftIds.map((draftId) => `d:${draftId}`));
        setDraftRows((prev) => prev.filter((draftRow) => !removedRowKeys.has(`d:${draftRow.id}`)));
        setSelectedCells((prev) => new Set(Array.from(prev).filter((cellId) => !removedRowKeys.has(parseCellId(cellId).rowKey))));
    }, []);

    const getPersistedRowValues = React.useCallback((rowIndex: number): string[] => {
        if (!result) return [];
        return result.columns.map((_, colIdx) => editedCells.get(`${rowIndex}:${colIdx}`) ?? result.rows[rowIndex]?.[colIdx] ?? '');
    }, [editedCells, result]);

    const handleCountTotal = React.useCallback(async () => {
        if (!tabId) return;
        setIsCounting(true);
        try {
            const count = await FetchTotalRowCount(tabId);
            setTotalCount(count);
        } catch (error) {
            console.warn(`Count failed in background: ${error}`);
            setTotalCount(-1);
        } finally {
            setIsCounting(false);
        }
    }, [tabId]);

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
        ).then((columns) => {
            if (!cancelled) {
                setColumnDefs(columns || []);
            }
        }).catch((error) => {
            if (!cancelled) {
                console.error('Failed to load column metadata', error);
                setColumnDefs([]);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        activeProfile?.db_name,
        activeProfile?.name,
        checkAndFetchColumns,
        isEditable,
        result?.tableName,
        tableRef.schema,
        tableRef.table,
    ]);

    const prevIsDone = React.useRef(result?.isDone);

    React.useEffect(() => {
        if (!result) return;

        if (prevIsDone.current !== result.isDone) {
            if (!result.isDone) {
                setTotalCount(null);
                setIsCounting(false);
                setEditedCells(new Map());
                setSelectedCells(new Set());
                setDeletedRows(new Set());
                setDraftRows([]);
                setShowSaveModal(false);
                setFocusCellRequest(null);

                handleCountTotal();

                setTimeout(() => {
                    containerRef.current?.focus({ preventScroll: true });
                }, 50);
            }
            prevIsDone.current = result.isDone;
        }
    }, [handleCountTotal, result]);

    React.useEffect(() => {
        updatePendingState(tabId, editedCells, deletedRows, draftRows);
    }, [deletedRows, draftRows, editedCells, tabId, updatePendingState]);

    React.useEffect(() => {
        if (!showRightSidebar || selectedRowKeys.length === 0 || !result?.isDone) return;

        const activeRowKey = selectedRowKeys[0];
        const displayRow = displayRowsByKey.get(activeRowKey);
        if (!displayRow) return;

        const rowValues = displayRow.kind === 'persisted'
            ? getPersistedRowValues(displayRow.persistedIndex as number)
            : [...displayRow.values];

        openDetail({
            columns: result.columns,
            columnTypes: result.columns.map((column) => columnDefsByName.get(column)?.DataType || ''),
            columnDefs: result.columns.map((column) => columnDefsByName.get(column) || models.ColumnDef.createFrom({
                Name: column,
                DataType: '',
                IsNullable: true,
                IsPrimaryKey: false,
                DefaultValue: '',
            })),
            row: rowValues,
            tableName: qualifiedTableName || result.tableName,
            primaryKeys: result.primaryKeys,
            onSave: (colIdx, newVal) => {
                if (displayRow.kind === 'persisted') {
                    setEditedCells((prev) => {
                        const next = new Map(prev);
                        next.set(`${displayRow.persistedIndex}:${colIdx}`, newVal);
                        return next;
                    });
                    return;
                }

                setDraftRows((prev) => prev.map((draftRow) => {
                    if (draftRow.id !== displayRow.draft?.id) return draftRow;
                    const nextValues = [...draftRow.values];
                    nextValues[colIdx] = newVal;
                    return { ...draftRow, values: nextValues };
                }));
            },
        });
    }, [
        columnDefsByName,
        displayRowsByKey,
        getPersistedRowValues,
        openDetail,
        qualifiedTableName,
        result,
        selectedRowKeys,
        showRightSidebar,
        toast,
    ]);

    const generateUpdateScript = React.useCallback(() => {
        if (!result?.primaryKeys || !qualifiedTableName || (editedCells.size === 0 && deletedRows.size === 0)) {
            return '';
        }

        const sqlStatements: string[] = [];

        Array.from(deletedRows).sort((a, b) => b - a).forEach((rowIndex) => {
            const whereClause = result.primaryKeys!.map((primaryKey) => {
                const columnIndex = result.columns.indexOf(primaryKey);
                const baseValue = result.rows[rowIndex]?.[columnIndex] ?? '';
                return `"${primaryKey}" = ${toSqlLiteral(baseValue, columnDefsByName.get(primaryKey))}`;
            }).join(' AND ');
            sqlStatements.push(`DELETE FROM ${qualifiedTableName} WHERE ${whereClause};`);
        });

        const updatesByRow = new Map<number, { col: string; val: string }[]>();
        editedCells.forEach((value, cellId) => {
            const [rowIndex, colIdx] = cellId.split(':').map(Number);
            if (deletedRows.has(rowIndex)) return;
            const editsForRow = updatesByRow.get(rowIndex) || [];
            editsForRow.push({ col: result.columns[colIdx], val: value });
            updatesByRow.set(rowIndex, editsForRow);
        });

        updatesByRow.forEach((edits, rowIndex) => {
            const whereClause = result.primaryKeys!.map((primaryKey) => {
                const columnIndex = result.columns.indexOf(primaryKey);
                const baseValue = result.rows[rowIndex]?.[columnIndex] ?? '';
                return `"${primaryKey}" = ${toSqlLiteral(baseValue, columnDefsByName.get(primaryKey))}`;
            }).join(' AND ');
            const setClause = edits
                .map((edit) => `"${edit.col}" = ${toSqlLiteral(edit.val, columnDefsByName.get(edit.col))}`)
                .join(', ');
            sqlStatements.push(`UPDATE ${qualifiedTableName} SET ${setClause} WHERE ${whereClause};`);
        });

        return sqlStatements.join('\n');
    }, [columnDefsByName, deletedRows, editedCells, qualifiedTableName, result]);

    const generateInsertScript = React.useCallback(() => {
        if (!result || draftRows.length === 0 || !canManageDraftRows) {
            return '';
        }

        return buildInsertScript(
            result.tableName || tableRef.table,
            result.columns,
            draftRows,
            columnDefs,
            sourceQuery,
        );
    }, [canManageDraftRows, columnDefs, draftRows, result, sourceQuery, tableRef.table]);

    const generatePendingScript = React.useCallback(() => {
        return [generateUpdateScript(), generateInsertScript()]
            .filter((script) => script.trim().length > 0)
            .join('\n');
    }, [generateInsertScript, generateUpdateScript]);

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

        const selectedRowKeySet = new Set(selectedRowKeys);
        const selectedDisplayRows = displayRows.filter((row) => row.kind === 'persisted' && selectedRowKeySet.has(row.key));
        if (selectedDisplayRows.length === 0) return;

        const lastSelectedRow = selectedDisplayRows[selectedDisplayRows.length - 1];
        const duplicatedRows: DraftRow[] = selectedDisplayRows.map((row) => ({
            id: crypto.randomUUID(),
            kind: 'duplicate',
            values: getPersistedRowValues(row.persistedIndex as number),
            insertAfterRowIndex: lastSelectedRow.persistedIndex ?? null,
            sourceRowIndex: row.persistedIndex,
        }));

        setDraftRows((prev) => [...prev, ...duplicatedRows]);
        setSelectedCells(new Set([makeCellId(`d:${duplicatedRows[0].id}`, 0)]));
        queueFocusCell(`d:${duplicatedRows[0].id}`, 0);
    }, [canManageDraftRows, displayRows, getPersistedRowValues, queueFocusCell, result, selectedRowKeys]);

    const requestDeleteSelectedRows = React.useCallback(() => {
        if (viewMode) {
            toast.error('View Mode is enabled. Write actions are blocked.');
            return;
        }

        if (selectedDraftIds.length > 0) {
            removeDraftRows(selectedDraftIds);
        }

        if (selectedPersistedRowIndices.length === 0) return;
        if (!isEditable) {
            toast.error('Result is read-only. Make sure the query includes the primary key(s).');
            return;
        }
        setDeletedRows((prev) => {
            const next = new Set(prev);
            selectedPersistedRowIndices.forEach((rowIndex) => next.add(rowIndex));
            return next;
        });
    }, [isEditable, removeDraftRows, selectedDraftIds, selectedPersistedRowIndices, toast, viewMode]);

    const handleCopyScript = React.useCallback(() => {
        navigator.clipboard.writeText(generatePendingScript());
        toast.success('Script copied to clipboard');
    }, [generatePendingScript, toast]);

    const handleOpenInNewTab = React.useCallback(() => {
        addTab({ name: `Apply ${result?.tableName}`, query: generatePendingScript() });
        setShowSaveModal(false);
        toast.success('Script opened in a new tab.');
    }, [addTab, generatePendingScript, result?.tableName, toast]);

    const handleDirectExecute = React.useCallback(async () => {
        if (viewMode) {
            toast.error('View Mode is enabled. Write actions are blocked.');
            return;
        }

        const script = generatePendingScript();
        if (!script) return;

        try {
            setIsSavingDraftRows(true);
            setShowSaveModal(false);
            const affected = await ExecuteUpdateSync(script);
            if (editedCells.size > 0 || deletedRows.size > 0) {
                applyEdits(tabId, editedCells, deletedRows);
            }
            if (draftRows.length > 0) {
                appendInsertedRows(tabId, draftRows.map((draftRow) => [...draftRow.values]));
            }
            setEditedCells(new Map());
            setDeletedRows(new Set());
            setDraftRows([]);
            setSelectedCells(new Set());
            toast.success(`Saved successfully (${affected} row${affected !== 1 ? 's' : ''} affected).`);
        } catch (error: unknown) {
            toast.error(`Save failed: ${getErrorMessage(error)}`);
            console.error('Execute pending changes error:', error);
        } finally {
            setIsSavingDraftRows(false);
        }
    }, [appendInsertedRows, applyEdits, deletedRows, draftRows, editedCells, generatePendingScript, tabId, toast, viewMode]);

    const handleSaveRequest = React.useCallback(async () => {
        if (viewMode) {
            toast.error('View Mode is enabled. Write actions are blocked.');
            return;
        }

        if (!hasPendingChanges) {
            return;
        }

        if (hasLegacyChanges) {
            setShowSaveModal(true);
            return;
        }

        await handleDirectExecute();
    }, [handleDirectExecute, hasLegacyChanges, hasPendingChanges, toast, viewMode]);

    const panelActions = React.useMemo(() => {
        const actions: ResultPanelAction[] = [];

        if (canManageDraftRows) {
            actions.push({
                id: 'add-row',
                icon: <Plus size={11} />,
                label: 'Add Row',
                title: 'Add Row',
                onClick: handleAddRow,
                disabled: isSavingDraftRows,
            });
            actions.push({
                id: 'duplicate-rows',
                icon: <Copy size={11} />,
                label: 'Duplicate',
                title: 'Duplicate Selected Rows',
                onClick: handleDuplicateRows,
                disabled: selectedPersistedRowIndices.length === 0 || isSavingDraftRows,
            });
        }

        if (hasPendingChanges) {
            actions.push({
                id: 'discard',
                icon: <RotateCcw size={11} />,
                label: 'Discard',
                title: 'Discard',
                onClick: () => {
                    setEditedCells(new Map());
                    setDeletedRows(new Set());
                    setDraftRows([]);
                    setSelectedCells(new Set());
                },
                danger: true,
            });
            if (!viewMode) {
                actions.push({
                    id: 'save',
                    icon: <Save size={11} />,
                    label: 'Save',
                    title: 'Save',
                    onClick: () => { void handleSaveRequest(); },
                    loading: isSavingDraftRows,
                });
            }
        }

        // Handle F5 elsewhere

        return actions;
    }, [
        canManageDraftRows,
        draftRows,
        handleAddRow,
        handleDuplicateRows,
        handleSaveRequest,
        hasPendingChanges,
        isSavingDraftRows,
        onRun,
        selectedPersistedRowIndices.length,
        viewMode,
    ]);

    React.useEffect(() => {
        onActionsChange?.(panelActions);
    }, [onActionsChange, panelActions]);

    React.useEffect(() => {
        const off = onCommand(DOM_EVENT.SAVE_TAB_ACTION, (detail) => {
            if (detail && detail !== tabId) return;
            if (viewMode) return;
            if (!hasPendingChanges || isSavingDraftRows) return;
            void handleSaveRequest();
        });
        return off;
    }, [handleSaveRequest, hasPendingChanges, isSavingDraftRows, tabId, viewMode]);

    const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(event.target.value, 10) || 1000;
        save(new utils.Preferences({
            theme,
            font_size: fontSize,
            default_limit: newLimit,
        }));
    };

    const handleExport = async () => {
        if (!result?.columns || !result.rows) return;
        try {
            const path = await ExportCSV(result.columns, result.rows);
            if (path) {
                toast.success(`Exported to: ${path}`);
                useStatusStore.getState().setMessage(`Exported to: ${path}`);
            }
        } catch (error) {
            toast.error(`Export failed: ${error}`);
            useStatusStore.getState().setMessage(`Export failed: ${error}`);
        }
    };

    const handleExportJSON = async () => {
        if (!result?.columns || !result.rows) return;
        setShowExportMenu(false);
        try {
            const path = await ExportJSON(result.columns, result.rows);
            if (path) {
                toast.success(`Exported to: ${path}`);
                useStatusStore.getState().setMessage(`Exported to: ${path}`);
            }
        } catch (error) {
            toast.error(`Export failed: ${error}`);
            useStatusStore.getState().setMessage(`Export failed: ${error}`);
        }
    };

    const handleExportSQLConfirm = async () => {
        if (!result?.columns || !result.rows) return;
        const exportTableName = tableNameForExport.trim() || result.tableName || 'my_table';
        setShowTableNameInput(false);
        setTableNameForExport('');
        try {
            const path = await ExportSQLInsert(result.columns, result.rows, exportTableName);
            if (path) {
                toast.success(`Exported to: ${path}`);
                useStatusStore.getState().setMessage(`Exported to: ${path}`);
            }
        } catch (error) {
            toast.error(`Export failed: ${error}`);
            useStatusStore.getState().setMessage(`Export failed: ${error}`);
        }
    };

    let displayTotalCount: number | undefined;
    if (totalCount !== null && totalCount >= 0) {
        displayTotalCount = totalCount;
    } else if (result?.isDone && !result.hasMore) {
        displayTotalCount = result.rows.length;
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        if (!result) return;

        if (event.key === 'F5') {
            event.preventDefault();
            if (onRun && !hasPendingChanges && !isReadOnlyTab) {
                onRun();
            }
            return;
        }

        if (event.key === 'Tab') {
            if (selectedCells.size > 0 && result.columns.length > 0) {
                event.preventDefault();
                const now = Date.now();
                if (now - lastTabTime.current < 400) {
                    const activeRowKey = selectedRowKeys[0];
                    if (activeRowKey && displayRowsByKey.get(activeRowKey)) {
                        setShowRightSidebar(true);
                    }
                    lastTabTime.current = 0;
                } else {
                    lastTabTime.current = now;
                }
            }
        }

        if (event.key === 'Delete' || (event.key === 'Backspace' && (event.ctrlKey || event.metaKey))) {
            if (viewMode) return;
            if (selectedCells.size === 0) return;
            event.preventDefault();
            requestDeleteSelectedRows();
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            if (viewMode) return;
            if (hasPendingChanges) {
                event.preventDefault();
                void handleSaveRequest();
            }
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            if (selectedCells.size === 0) return;
            event.preventDefault();

            let minRowOrder = Infinity;
            let maxRowOrder = -Infinity;
            let minCol = Infinity;
            let maxCol = -Infinity;

            selectedCells.forEach((cellId) => {
                const { rowKey, colIdx } = parseCellId(cellId);
                const rowIndex = rowOrder.get(rowKey);
                if (rowIndex === undefined) return;
                minRowOrder = Math.min(minRowOrder, rowIndex);
                maxRowOrder = Math.max(maxRowOrder, rowIndex);
                minCol = Math.min(minCol, colIdx);
                maxCol = Math.max(maxCol, colIdx);
            });

            const matrix: string[][] = [];
            for (let rowIndex = minRowOrder; rowIndex <= maxRowOrder; rowIndex++) {
                const displayRow = displayRows[rowIndex];
                const row: string[] = [];
                for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
                    const cellId = makeCellId(displayRow.key, colIdx);
                    if (!selectedCells.has(cellId)) {
                        row.push('');
                        continue;
                    }

                    if (displayRow.kind === 'persisted') {
                        row.push(editedCells.get(`${displayRow.persistedIndex}:${colIdx}`) ?? displayRow.values[colIdx] ?? '');
                    } else {
                        row.push(displayRow.values[colIdx] ?? '');
                    }
                }
                matrix.push(row);
            }

            navigator.clipboard.writeText(matrix.map((row) => row.join('\t')).join('\n'));
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
            if (!isEditable || selectedCells.size === 0) return;
            event.preventDefault();

            navigator.clipboard.readText().then((text) => {
                if (!text) return;

                const lines = text.split(/\r?\n/).map((line) => line.split('\t'));
                if (lines.length === 0 || lines[0].length === 0) return;

                let minRowOrder = Infinity;
                let minCol = Infinity;

                selectedCells.forEach((cellId) => {
                    const { rowKey, colIdx } = parseCellId(cellId);
                    const rowIndex = rowOrder.get(rowKey);
                    if (rowIndex === undefined) return;
                    minRowOrder = Math.min(minRowOrder, rowIndex);
                    minCol = Math.min(minCol, colIdx);
                });

                const nextEditedCells = new Map(editedCells);
                const nextDraftRows = draftRows.map((draftRow) => ({ ...draftRow, values: [...draftRow.values] }));
                const pastedCells = new Set<string>();

                for (let rowOffset = 0; rowOffset < lines.length; rowOffset++) {
                    const displayRow = displayRows[minRowOrder + rowOffset];
                    if (!displayRow) break;
                    if (displayRow.kind === 'persisted' && deletedRows.has(displayRow.persistedIndex as number)) continue;

                    for (let colOffset = 0; colOffset < lines[rowOffset].length; colOffset++) {
                        const colIdx = minCol + colOffset;
                        if (colIdx >= result.columns.length) break;

                        const value = lines[rowOffset][colOffset];
                        const cellId = makeCellId(displayRow.key, colIdx);

                        if (displayRow.kind === 'persisted') {
                            nextEditedCells.set(`${displayRow.persistedIndex}:${colIdx}`, value);
                        } else {
                            const targetDraft = nextDraftRows.find((draftRow) => draftRow.id === displayRow.draft?.id);
                            if (targetDraft) {
                                targetDraft.values[colIdx] = value;
                            }
                        }
                        pastedCells.add(cellId);
                    }
                }

                setEditedCells(nextEditedCells);
                setDraftRows(nextDraftRows);
                if (pastedCells.size > 0) {
                    setSelectedCells(pastedCells);
                }
            }).catch((error) => {
                console.error('Paste error:', error);
                toast.error('Failed to read from clipboard');
            });
        }
    };

    if (!result) {
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-text-secondary">
                <span>Run a query (Ctrl+Enter) to see results</span>
            </div>
        );
    }

    if (result.error) {
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-error gap-2">
                <AlertCircle size={16} />
                <span>{result.error}</span>
            </div>
        );
    }

    if (!result.isSelect) {
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-success gap-2">
                <CheckCircle size={16} />
                <span>{result.affected} rows affected · {formatDuration(result.duration)}</span>
            </div>
        );
    }

    const explainJsonValue = generatedKind === 'explain' && result.rows.length === 1 && result.rows[0]?.length === 1 && isJsonValue(result.rows[0][0])
        ? result.rows[0][0]
        : null;

    return (
        <div
            className="flex flex-col items-stretch justify-start h-full text-[13px] text-text-secondary overflow-hidden"
            ref={containerRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{ outline: 'none' }}
        >
            {(() => {
                const hasData = result.columns.length > 0;
                const isLoading = !result.isDone;

                if (isLoading && !hasData) {
                    return (
                        <div className="flex flex-col items-stretch flex-1 overflow-hidden min-h-0 text-success gap-0">
                            <div className="flex flex-row items-center gap-2 px-3 py-2 text-xs border-b border-border shrink-0">
                                <Loader size={14} className="animate-spin" />
                                <span className="text-text-secondary">
                                    {result.rows.length > 0
                                        ? `Streaming… ${result.rows.length.toLocaleString()} rows`
                                        : 'Executing query…'}
                                </span>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0 relative">
                        {isLoading && (
                            <div
                                className="absolute top-0 left-0 right-0 z-sticky"
                                style={{ height: 2, background: 'var(--status-success)', opacity: 0.7 }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: '40%',
                                        background: 'rgba(255,255,255,0.6)',
                                        animation: 'shimmer 1.2s infinite linear',
                                        backgroundSize: '400px 100%',
                                    }}
                                />
                            </div>
                        )}

                        {(result.isSelect || filterExpr !== '') && generatedKind !== 'explain' && (
                            <ResultFilterBar
                                value={filterExpr}
                                onChange={setFilterExpr}
                                baseQuery={baseQuery}
                                onAppendToQuery={onAppendToQuery}
                                onOpenInNewTab={onOpenInNewTab}
                                onRun={() => { if (filterExpr.trim()) onFilterRun?.(filterExpr); }}
                                onClear={() => {
                                    setFilterExpr('');
                                    onFilterRun?.('');
                                }}
                            >
                                {!onActionsChange && panelActions.length > 0 && (
                                    <>
                                        {panelActions.map((action) => (
                                            <Button
                                                key={action.id}
                                                variant="ghost"
                                                size="icon"
                                                danger={action.danger}
                                                onClick={() => action.onClick()}
                                                disabled={action.disabled || action.loading}
                                                title={action.title || action.label}
                                            >
                                                {action.loading ? <Loader size={12} className="animate-spin" /> : action.icon}
                                            </Button>
                                        ))}
                                    </>
                                )}
                            </ResultFilterBar>
                        )}

                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isLoading ? 0.5 : 1 }}>
                            {explainJsonValue ? (
                                <div className="flex-1 overflow-hidden p-3">
                                    <JsonViewer value={explainJsonValue} height="100%" useMonaco={true} />
                                </div>
                            ) : (
                                <ResultTable
                                    tabId={tabId}
                                    columns={result.columns}
                                    rows={result.rows}
                                    isDone={result.isDone}
                                    editedCells={editedCells}
                                    setEditedCells={setEditedCells}
                                    selectedCells={selectedCells}
                                    setSelectedCells={setSelectedCells}
                                    deletedRows={deletedRows}
                                    setDeletedRows={setDeletedRows}
                                    draftRows={draftRows}
                                    setDraftRows={setDraftRows}
                                    columnDefs={columnDefs}
                                    focusCellRequest={focusCellRequest}
                                    onFocusCellRequestHandled={() => setFocusCellRequest(null)}
                                    onRemoveDraftRows={removeDraftRows}
                                    readOnlyMode={viewMode || isReadOnlyTab}
                                />
                            )}
                        </div>
                    </div>
                );
            })()}
            <div className="flex items-center justify-between relative px-3 py-1 text-[11px] text-text-secondary border-t border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        Showing <strong>{(result.rows.length + draftRows.length).toLocaleString()}</strong> of&nbsp;
                        <select
                            className="bg-transparent border border-transparent text-text-secondary text-[11px] px-0.5 py-px rounded-sm cursor-pointer outline-none transition-colors duration-100 hover:border-border hover:bg-bg-tertiary focus:border-success appearance-auto"
                            value={defaultLimit}
                            onChange={handleLimitChange}
                            title="Row limit for next query"
                        >
                            {LIMIT_OPTIONS.map((value) => (
                                <option key={value} value={value}>{value.toLocaleString()}</option>
                            ))}
                        </select>
                        &nbsp;rows&nbsp;·&nbsp;{formatDuration(result.duration)}
                    </span>
                    {displayTotalCount !== undefined ? (
                        <span className="flex items-center gap-1">
                            (Total: <strong>{displayTotalCount.toLocaleString()}</strong>)
                        </span>
                    ) : totalCount === -1 ? (
                        <span className="flex items-center gap-1 text-warning" title="Failed to count total rows in background">
                            (Total: ?)
                        </span>
                    ) : isCounting ? (
                        <span className="flex items-center gap-1 opacity-70">
                            <Loader size={12} className="animate-spin inline-block align-middle mr-1" />
                            Counting...
                        </span>
                    ) : null}
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                    {hasPendingChanges && (
                        <span className="text-[11px] text-warning flex items-center">
                            {editedCells.size + deletedRows.size + draftRows.length} pending change(s)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button
                            className="bg-transparent border border-transparent text-text-secondary flex items-center gap-1 px-1.5 py-0.5 rounded-sm cursor-pointer text-[11px] transition-all duration-100 hover:bg-bg-tertiary hover:text-text-primary hover:border-border"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            title="Export"
                        >
                            <Download size={13} />
                            <span>Export</span>
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 top-full z-panel-overlay mt-1 min-w-[160px] rounded-md border border-border bg-bg-primary py-1 shadow-lg">
                                <button
                                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                                    onClick={handleExport}
                                >
                                    <span className="w-4">📄</span>
                                    CSV
                                </button>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                                    onClick={handleExportJSON}
                                >
                                    <span className="w-4">📋</span>
                                    JSON
                                </button>
                                <button
                                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                                    onClick={() => {
                                        setShowExportMenu(false);
                                        setShowTableNameInput(true);
                                    }}
                                >
                                    <span className="w-4">💾</span>
                                    SQL INSERT
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                title="Confirm Changes"
                width={560}
                footer={(
                    <>
                        <Button variant="ghost" size="icon" onClick={handleCopyScript} title="Copy Script">
                            <Copy size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleOpenInNewTab} title="Open in New Tab">
                            <FilePlus size={14} />
                        </Button>
                        <Button variant="primary" onClick={() => { void handleDirectExecute(); }} title="Execute Changes" autoFocus className="px-6">
                            <Play size={14} className="mr-2" />
                            Execute Changes
                        </Button>
                    </>
                )}
            >
                <div>
                    <div className="flex items-start gap-4 mb-4">
                        <div className="shrink-0 p-2 rounded-full bg-accent/10">
                            <AlertCircle size={20} className="text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-text-primary mb-1">Review generated script</p>
                            <p className="text-[12px] leading-relaxed text-text-secondary">
                                Updates and deletes require confirmation. Pending inserts will be executed together with this script for <strong>{qualifiedTableName || result?.tableName}</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="p-3 bg-bg-tertiary/50 border border-border/40 rounded-lg font-mono text-[11px] max-h-[260px] overflow-y-auto whitespace-pre-wrap text-text-secondary select-text">
                        {generatePendingScript()}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showTableNameInput}
                onClose={() => { setShowTableNameInput(false); setTableNameForExport(''); }}
                title="Export as SQL INSERT"
                width={400}
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => { setShowTableNameInput(false); setTableNameForExport(''); }}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={() => { void handleExportSQLConfirm(); }} autoFocus>
                            Export
                        </Button>
                    </>
                )}
            >
                <div className="py-2">
                    <label className="block text-[12px] text-text-secondary mb-1.5">Table Name</label>
                    <input
                        type="text"
                        className="w-full bg-bg-primary border border-border text-text-primary text-[13px] px-3 py-2 rounded-md outline-none focus:border-accent"
                        placeholder={result?.tableName || 'my_table'}
                        value={tableNameForExport}
                        onChange={(event) => setTableNameForExport(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleExportSQLConfirm()}
                        autoFocus
                    />
                    <p className="text-[11px] text-text-muted mt-2">
                        Leave empty to use "{result?.tableName || 'my_table'}"
                    </p>
                </div>
            </Modal>
        </div>
    );
};

