import React from 'react';
import { AlertCircle, CheckCircle, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { ExportCSV } from '../../services/queryService';
import { utils } from '../../../wailsjs/go/models';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { TabResult, useResultStore } from '../../stores/resultStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useStatusStore } from '../../stores/statusStore';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useResultPanelCount } from '../../features/editor/useResultPanelCount';
import { useResultPanelKeyboardShortcuts } from '../../features/editor/useResultPanelKeyboardShortcuts';
import { useResultPanelScriptActions } from '../../features/editor/useResultPanelScriptActions';
import { useToast } from '../layout/Toast';
import { ResultPanelMainContent } from './resultPanel/ResultPanelMainContent';
import { ResultPanelSaveModal } from './resultPanel/ResultPanelSaveModal';
import { ResultPanelStatusBar } from './resultPanel/ResultPanelStatusBar';

export type { ResultPanelAction } from './resultPanel/types';

interface ResultPanelProps {
    tabId: string;
    result?: TabResult;
    onRun?: () => void;
    onFilterRun?: (filter: string) => void;
    onActionsChange?: (actions: ResultPanelAction[]) => void;
    baseQuery?: string;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
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
}) => {
    const { defaultLimit, theme, fontSize, save } = useSettingsStore();
    const addTab = useEditorStore((state) => state.addTab);
    const updatePendingEdits = useResultStore((state) => state.updatePendingEdits);
    const { showRightSidebar, setShowRightSidebar } = useLayoutStore();
    const { openDetail } = useRowDetailStore();
    const { toast } = useToast();
    const containerRef = React.useRef<HTMLDivElement>(null);

    const filterExpr = result?.filterExpr || '';
    const setFilterExpr = React.useCallback((value: string) => {
        useResultStore.getState().setFilterExpr(tabId, value);
    }, [tabId]);

    const [editedCells, setEditedCells] = React.useState<Map<string, string>>(() =>
        result?.pendingEdits ? new Map(result.pendingEdits) : new Map(),
    );
    const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
    const [deletedRows, setDeletedRows] = React.useState<Set<number>>(() =>
        result?.pendingDeletions ? new Set(result.pendingDeletions) : new Set(),
    );
    const [showSaveModal, setShowSaveModal] = React.useState(false);

    const resetChangeState = React.useCallback(() => {
        setEditedCells(new Map());
        setSelectedCells(new Set());
        setDeletedRows(new Set());
        setShowSaveModal(false);
    }, []);

    const openRowDetail = React.useCallback((rowIndex: number) => {
        if (!result?.columns || !result.rows?.[rowIndex]) {
            return;
        }

        openDetail({
            columns: result.columns,
            row: result.rows[rowIndex],
            tableName: result.tableName,
            primaryKeys: result.primaryKeys,
            onSave: (columnIndex, newValue) => {
                setEditedCells((prev) => {
                    const next = new Map(prev);
                    next.set(`${rowIndex}:${columnIndex}`, newValue);
                    return next;
                });
            },
        });
    }, [result, openDetail]);

    React.useEffect(() => {
        if (!showRightSidebar || selectedCells.size === 0 || !result?.isDone) {
            return;
        }

        const firstCell = Array.from(selectedCells)[0];
        openRowDetail(Number(firstCell.split(':')[0]));
    }, [showRightSidebar, selectedCells, result?.isDone, openRowDetail]);

    React.useEffect(() => {
        updatePendingEdits(tabId, editedCells, deletedRows);
    }, [tabId, editedCells, deletedRows, updatePendingEdits]);

    const hasChanges = editedCells.size > 0 || deletedRows.size > 0;
    const isEditable = Boolean(
        result?.tableName
            && result?.primaryKeys
            && result.primaryKeys.every((primaryKey) => result.columns.includes(primaryKey)),
    );

    React.useEffect(() => {
        if (!onActionsChange) {
            return;
        }

        const actions: ResultPanelAction[] = [];
        if (hasChanges) {
            actions.push({
                id: 'discard',
                icon: <RotateCcw size={11} />,
                label: 'Discard',
                title: 'Discard',
                onClick: () => {
                    setEditedCells(new Map());
                    setDeletedRows(new Set());
                },
                danger: true,
            });
            actions.push({
                id: 'save',
                icon: <Save size={11} />,
                label: 'Save',
                title: 'Save',
                onClick: () => setShowSaveModal(true),
            });
        }

        if (!hasChanges && onRun) {
            actions.push({
                id: 'reload',
                icon: <RefreshCw size={11} />,
                label: 'Reload',
                title: 'Reload',
                onClick: onRun,
            });
        }

        onActionsChange(actions);
    }, [hasChanges, onActionsChange, onRun]);

    const { totalCount, isCounting, displayTotalCount } = useResultPanelCount({
        tabId,
        result,
        onQueryStarted: () => {
            resetChangeState();
            window.setTimeout(() => {
                containerRef.current?.focus({ preventScroll: true });
            }, 50);
        },
    });

    const {
        generateUpdateScript,
        handleCopyScript,
        handleOpenInNewTab,
        handleDirectExecute,
    } = useResultPanelScriptActions({
        tabId,
        result,
        editedCells,
        deletedRows,
        addTab,
        onCloseSaveModal: () => setShowSaveModal(false),
        onResetChanges: () => {
            setEditedCells(new Map());
            setDeletedRows(new Set());
        },
        onSuccessToast: toast.success,
        onErrorToast: toast.error,
    });

    const handleLimitChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(event.target.value, 10) || 1000;
        save(
            new utils.Preferences({
                theme,
                font_size: fontSize,
                default_limit: newLimit,
            }),
        );
    }, [save, theme, fontSize]);

    const handleExport = React.useCallback(async () => {
        if (!result?.columns || !result.rows) {
            return;
        }

        try {
            const path = await ExportCSV(result.columns, result.rows);
            if (path) {
                toast.success(`Exported to: ${path}`);
                useStatusStore.getState().setMessage(`Exported to: ${path}`);
            }
        } catch (err) {
            toast.error(`Export failed: ${err}`);
            useStatusStore.getState().setMessage(`Export failed: ${err}`);
            console.error('Export failed:', err);
        }
    }, [result, toast]);

    const handleKeyDown = useResultPanelKeyboardShortcuts({
        result: result || {
            columns: [],
            rows: [],
            isDone: true,
            affected: 0,
            duration: 0,
            isSelect: true,
            hasMore: false,
            offset: 0,
            isFetchingMore: false,
            filterExpr: '',
        },
        selectedCells,
        editedCells,
        deletedRows,
        isEditable,
        openRowDetail,
        setShowRightSidebar,
        setDeletedRows,
        setSelectedCells,
        setEditedCells,
        openSaveModal: () => setShowSaveModal(true),
        onPasteError: () => toast.error('Failed to read from clipboard'),
    });

    useResultPanelCommands({
        tabId,
        result,
        viewMode,
        hasPendingChanges,
        hasLegacyChanges,
        isSavingDraftRows,
        generatePendingScript,
        handleDirectExecute,
        onSaveRequest: handleSaveRequest,
        onRun,
        keepFilterFocusRef,
        containerRef,
        resetEditState,
        hasColumns: Boolean(result?.columns?.length),
        openExportModal: handleOpenExportModal,
    });
    React.useEffect(() => {
        if (!result?.isDone) {
            setShowSaveModal(false);
        }
    }, [result?.isDone]);

    const selectedExportColumnSet = React.useMemo(() => new Set(selectedExportColumns), [selectedExportColumns]);
    const orderedSelectedExportColumns = React.useMemo(
        () => (result?.columns || []).filter((col) => selectedExportColumnSet.has(col)),
        [result?.columns, selectedExportColumnSet],
    );
    const areAllExportColumnsSelected = allExportColumns.length > 0 && orderedSelectedExportColumns.length === allExportColumns.length;
    const previewExportRows = React.useMemo(() => {
        if (!result?.rows?.length || orderedSelectedExportColumns.length === 0) return [];
        const indexByColumn = new Map((result.columns || []).map((column, index) => [column, index]));
        return result.rows.slice(0, 10).map((row) => (
            orderedSelectedExportColumns.map((column) => {
                const colIndex = indexByColumn.get(column);
                return colIndex === undefined ? '' : (row[colIndex] ?? '');
            })
        ));
    }, [orderedSelectedExportColumns, result?.columns, result?.rows]);
    const toggleExportColumn = React.useCallback((column: string) => {
        setSelectedExportColumns((prev) => (
            prev.includes(column)
                ? prev.filter((name) => name !== column)
                : [...prev, column]
        ));
    }, []);
    const toggleAllExportColumns = React.useCallback(() => {
        setSelectedExportColumns((prev) => (
            prev.length === allExportColumns.length ? [] : [...allExportColumns]
        ));
    }, [allExportColumns]);
    const handleConfirmExport = React.useCallback(() => {
        if (orderedSelectedExportColumns.length === 0) {
            toast.error('Select at least one column to export.');
            return;
        }
        runExport({
            scope: exportScope,
            format: exportFormat,
            selectedColumns: orderedSelectedExportColumns,
            tableName: exportFormat === 'sql' ? exportTableName : undefined,
        });
        setShowExportModal(false);
    }, [exportFormat, exportScope, exportTableName, orderedSelectedExportColumns, runExport, toast]);

    const { panelActions, renderPanelAction } = useResultPanelToolbar({
        tabId,
        result,
        onActionsChange,
        canManageDraftRows,
        isSavingDraftRows,
        hasPendingChanges,
        viewMode,
        selectedPersistedRowIndices,
        selectedDraftIds,
        defaultLimit,
        canUseResultExport,
        showMaximizeControl,
        isMaximized,
        onToggleMaximize,
        exportRunningSignature: exportJob?.status === 'running' ? `export-running:${exportJob.progressPct ?? 0}` : undefined,
        handleAddRow,
        handleDuplicateRows,
        requestDeleteSelectedRows,
        resetEditState,
        setSelectedCells,
        handleSaveRequest,
        handleLimitChange,
        handleOpenExportModal,
        cancelExport,
        columnVisibility,
        setColumnVisibility,
        showColumnsPopover,
        setShowColumnsPopover,
        columnsPopoverRef,
    });

    // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const searchHits = React.useMemo(() => {
        if (!result || !quickFilter.trim()) return [];
        const query = quickFilter.trim().toLowerCase();
        const hits: number[] = [];
        result.rows.forEach((row, index) => {
            if (row.some((cell) => (cell || '').toLowerCase().includes(query))) {
                hits.push(index);
            }
        });
        return hits;
    }, [quickFilter, result]);
    const canUseResultSearch = featureGate.canUse('query.result.search');
    const canUseResultJump = featureGate.canUse('query.result.jump');

    const jumpToPersistedRow = React.useCallback((rowIndex: number) => {
        if (!result || rowIndex < 0 || rowIndex >= result.rows.length) return;
        setFocusCellRequest({
            rowKey: `p:${rowIndex}`,
            colIdx: 0,
            nonce: Date.now(),
        });
    }, [result, setFocusCellRequest]);

    const jumpToNextHit = React.useCallback(() => {
        if (searchHits.length === 0) return;
        const next = (activeSearchHit + 1) % searchHits.length;
        setActiveSearchHit(next);
        jumpToPersistedRow(searchHits[next]);
    }, [activeSearchHit, jumpToPersistedRow, searchHits]);

    const jumpToPrevHit = React.useCallback(() => {
        if (searchHits.length === 0) return;
        const next = (activeSearchHit - 1 + searchHits.length) % searchHits.length;
        setActiveSearchHit(next);
        jumpToPersistedRow(searchHits[next]);
    }, [activeSearchHit, jumpToPersistedRow, searchHits]);

    React.useEffect(() => {
        setActiveSearchHit(0);
    }, [quickFilter, result?.lastExecutedQuery]);

    const {
        contextMenu,
        contextMenuRef,
        contextMenuPosition,
        canCopy,
        canPaste,
        canSetNull,
        canDeleteRows,
        canDuplicateRows,
        copyDisabledTitle,
        pasteDisabledTitle,
        setNullDisabledTitle,
        duplicateDisabledTitle,
        deleteDisabledTitle,
        copyAsActions,
        handleCellContextMenu,
        handleContextCopy,
        handleContextSetNull,
        handleContextPaste,
        handleContextDelete,
        handleContextDuplicate,
        whereActions,
        canOpenRowInNewQueryTab,
        canUndoLastContextAction,
        undoDisabledTitle,
        openRowQueryDisabledTitle,
        handleOpenRowInNewQueryTab,
        handleUndoLastContextAction,
    } = useResultContextMenuActions({
        result,
        driver,
        displayRows,
        displayRowsByKey,
        rowOrder,
        editedCells,
        selectedCells,
        selectedRowKeys,
        selectedRowKeysFromHeader: Array.from(selectedRowKeysFromHeader),
        selectedPersistedRowIndices,
        selectedDraftIds,
        draftRows,
        deletedRows,
        columnDefsByName,
        isEditable,
        canManageDraftRows,
        isReadOnlyTab,
        viewMode,
        isSavingDraftRows,
        getPersistedRowValues,
        removeDraftRows,
        setEditedCells,
        setDraftRows,
        setSelectedCells,
        setDeletedRows,
        setFocusCellRequest,
        openQueryTab: openContextQueryTab,
    });

    React.useEffect(() => {
        setColumnVisibility({});
        setShowColumnsPopover(false);
    }, [result?.lastExecutedQuery]);

    React.useEffect(() => {
        if (!showColumnsPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (columnsPopoverRef.current && !columnsPopoverRef.current.contains(e.target as Node)) {
                setShowColumnsPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColumnsPopover]);

    const { handleKeyDown } = useResultKeyboard({
        tabId, result, hasPendingChanges, isReadOnlyTab, viewMode, isEditable,
        selectedCells, setSelectedCells, selectedRowKeys,
        displayRows, displayRowsByKey, rowOrder, editedCells, deletedRows, draftRows, isSavingDraftRows,
        onRun, onSaveRequest: handleSaveRequest, onDeleteSelected: handleContextDelete,
        onUndoLastAction: handleUndoLastContextAction,
        onSetShowRightSidebar: setShowRightSidebar,
        onFocusSearch: () => { if (canUseResultSearch) quickFilterRef.current?.focus(); },
        onFocusJump: () => { if (canUseResultJump) jumpRowRef.current?.focus(); },
        onSearchNext: () => { if (canUseResultSearch) jumpToNextHit(); },
        onSearchPrev: () => { if (canUseResultSearch) jumpToPrevHit(); },
        setEditedCells, setDraftRows,
    });

    // â”€â”€ Limit selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const shouldShowResultFilterBar = Boolean(result?.isSelect) && showResultFilterBar;
    const shouldShowFilterInput = generatedKind !== 'explain';
    const resultFilterBar = result && shouldShowResultFilterBar ? (
        <ResultFilterBar
            key={result.lastExecutedQuery}
            value={filterExpr}
            onChange={setFilterExpr}
            orderValue={orderByExpr}
            onOrderChange={setOrderByExpr}
            baseQuery={sourceQuery}
            columns={result.columns}
            tableName={result.tableName}
            showFilterInput={shouldShowFilterInput}
            onAppendToQuery={onAppendToQuery}
            onOpenInNewTab={onOpenInNewTab}
            onRun={(currentValue, currentOrder) => {
                keepFilterFocusRef.current = true;
                const nextExpr = typeof currentValue === 'string' ? currentValue : filterExpr;
                const nextOrder = typeof currentOrder === 'string' ? currentOrder : orderByExpr;
                if (nextExpr.trim() || nextOrder.trim()) onFilterRun?.(nextExpr, nextOrder, sourceQuery);
            }}
            onClear={() => {
                keepFilterFocusRef.current = true;
                setFilterExpr('');
                setOrderByExpr('');
                onFilterRun?.('', '', sourceQuery);
            }}
        >
            {!onActionsChange && panelActions.length > 0 && (
                <>
                    {panelActions.map(renderPanelAction)}
                </>
            )}
        </ResultFilterBar>
    ) : null;

    // â”€â”€ Early renders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!result) {
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground">
                <span>Run a query (Ctrl+Enter) to see results</span>
            </div>
        );
    }
    if (result.error) {
        if (shouldShowResultFilterBar) {
            return (
                <div className="flex flex-col items-stretch justify-start h-full text-[13px] text-muted-foreground overflow-hidden">
                    {resultFilterBar}
                    <div className="flex items-center justify-center flex-1 text-error gap-2">
                        <AlertCircle size={16} /><span>{result.error}</span>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-error gap-2">
                <AlertCircle size={16} /><span>{result.error}</span>
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

    return (
        <div
            className="flex flex-col items-stretch justify-start h-full text-[13px] text-muted-foreground overflow-hidden"
            ref={containerRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{ outline: 'none' }}
        >
            <ResultPanelMainContent
                tabId={tabId}
                result={result}
                filterExpr={filterExpr}
                onFilterExprChange={setFilterExpr}
                onFilterRun={onFilterRun}
                baseQuery={baseQuery}
                onAppendToQuery={onAppendToQuery}
                onOpenInNewTab={onOpenInNewTab}
                editedCells={editedCells}
                setEditedCells={setEditedCells}
                selectedCells={selectedCells}
                setSelectedCells={setSelectedCells}
                deletedRows={deletedRows}
                setDeletedRows={setDeletedRows}
            />

            <ResultPanelStatusBar
                rowCount={result.rows.length}
                defaultLimit={defaultLimit}
                durationText={formatDuration(result.duration)}
                displayTotalCount={displayTotalCount}
                totalCount={totalCount}
                isCounting={isCounting}
                hasChanges={hasChanges}
                pendingChangeCount={editedCells.size + deletedRows.size}
                onLimitChange={handleLimitChange}
                onExport={handleExport}
            />

            <ResultPanelSaveModal
                isOpen={showSaveModal}
                script={generateUpdateScript()}
                onClose={() => setShowSaveModal(false)}
                onCopyScript={handleCopyScript}
                onOpenInNewTab={handleOpenInNewTab}
                onExecute={handleDirectExecute}
            />
        </div>
    );
};

function formatDuration(milliseconds: number): string {
    return milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(2)}s` : `${milliseconds}ms`;
}



