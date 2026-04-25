import React from 'react';
import {
    AlertCircle,
    CheckCircle,
    Loader,
} from 'lucide-react';
import { ExecuteUpdateSync } from '../../services/queryService';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useResultStore } from '../../stores/resultStore';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { models } from '../../../wailsjs/go/models';
import { useToast } from '../layout/Toast';
import { ResultTable } from './ResultTable';
import { ResultFilterBar } from './ResultFilterBar';
import { JsonViewer, isJsonValue } from '../viewers/JsonViewer';
import { useConnectionStore } from '../../stores/connectionStore';
import { formatDuration } from './resultPanelUtils';
import { utils } from '../../../wailsjs/go/models';
import { useResultEditing } from './useResultEditing';
import { useResultKeyboard } from './useResultKeyboard';
import { useResultExport } from './useResultExport';
import { setClipboardText } from '../../services/clipboardService';
import { resolveResultFetchStrategy } from '../../features/query/resultStrategy';
import { useFeatureGate } from '../../features/license/useFeatureGate';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';
import { ResultContextMenu } from './resultPanel/ResultContextMenu';
import { ResultPanelModals } from './resultPanel/ResultPanelModals';
import type { ResultPanelProps } from './resultPanel/types';
import { useResultContextMenuActions } from './resultPanel/useResultContextMenuActions';
import { useResultPanelCommands } from './resultPanel/useResultPanelCommands';
import { useResultPanelFilterSync } from './resultPanel/useResultPanelFilterSync';
import { useResultPanelToolbar } from './resultPanel/useResultPanelToolbar';

export type { ResultPanelAction } from './resultPanel/types';

export const ResultPanel: React.FC<ResultPanelProps> = ({
    tabId,
    contextTabId,
    result,
    onRun,
    onFilterRun,
    onActionsChange,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    isReadOnlyTab = false,
    generatedKind,
    isMaximized = false,
    onToggleMaximize,
    showMaximizeControl = true,
    showResultFilterBar = true,
    preferBaseQueryForFilter = false,
}) => {
    const { defaultLimit, theme, fontSize, save, viewMode } = useSettingsStore();
    const driver = useConnectionStore((state) => state.activeProfile?.driver);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const addTab = useEditorStore((s) => s.addTab);
    const updateTabContext = useEditorStore((s) => s.updateTabContext);
    const persistedContext = useEditorStore((state) => {
        const targetId = contextTabId || tabId;
        for (const group of state.groups) {
            const match = group.tabs.find((tab) => tab.id === targetId);
            if (match) return match.context;
        }
        return undefined;
    });
    const { toast } = useToast();
    const featureGate = useFeatureGate();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);
    const { openDetail } = useRowDetailStore();
    const { showRightSidebar, setShowRightSidebar } = useLayoutStore();

    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
    const [showColumnsPopover, setShowColumnsPopover] = React.useState(false);
    const columnsPopoverRef = React.useRef<HTMLDivElement>(null);
    const [showExportModal, setShowExportModal] = React.useState(false);
    const [pendingOpenExportModal, setPendingOpenExportModal] = React.useState(false);
    const [exportScope, setExportScope] = React.useState<'all' | 'view'>('all');
    const [exportFormat, setExportFormat] = React.useState<'csv' | 'json' | 'sql'>('csv');
    const [selectedExportColumns, setSelectedExportColumns] = React.useState<string[]>([]);
    const [exportTableName, setExportTableName] = React.useState('');
    const [visibleRows, setVisibleRows] = React.useState(0);
    const [activeSearchHit, setActiveSearchHit] = React.useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const keepFilterFocusRef = React.useRef(false);
    const quickFilterRef = React.useRef<HTMLInputElement>(null);
    const jumpRowRef = React.useRef<HTMLInputElement>(null);

    // ── Domain hooks ──────────────────────────────────────────────────────────
    const editing = useResultEditing({ tabId, result });
    const {
        columnDefs, columnDefsByName, displayRows, displayRowsByKey, rowOrder,
        editedCells, setEditedCells, selectedCells, setSelectedCells,
        selectedRowKeysFromHeader, setSelectedRowKeysFromHeader,
        deletedRows, setDeletedRows, draftRows, setDraftRows,
        isSavingDraftRows,
        focusCellRequest, setFocusCellRequest,
        selectedRowKeys, selectedPersistedRowIndices, selectedDraftIds,
        qualifiedTableName, isEditable, canManageDraftRows,
        hasLegacyChanges, hasPendingChanges,
        removeDraftRows, getPersistedRowValues, resetEditState,
        generatePendingScript,
        handleAddRow, handleDuplicateRows, requestDeleteSelectedRows,
    } = editing;
    const setFilterExprStore = React.useCallback((id: string, value: string) => {
        useResultStore.getState().setFilterExpr(id, value);
    }, []);
    const setOrderByExprStore = React.useCallback((id: string, value: string) => {
        useResultStore.getState().setOrderByExpr(id, value);
    }, []);

    const {
        quickFilter,
        setQuickFilter,
        filterExpr,
        orderByExpr,
        setFilterExpr,
        setOrderByExpr,
        sourceQuery,
    } = useResultPanelFilterSync({
        tabId,
        contextTabId,
        result,
        baseQuery,
        preferBaseQueryForFilter,
        persistedContext,
        updateTabContext,
        setFilterExprStore,
        setOrderByExprStore,
    });

    // ── Row Detail sidebar sync ───────────────────────────────────────────────
    // Stable save callback — uses setter functions so it doesn't need to capture
    // snapshot values of displayRowsByKey or draftRows, avoiding effect re-fires.
    const handleRowDetailSave = React.useCallback((rowKey: string, colIdx: number, newVal: string) => {
        if (rowKey.startsWith('p:')) {
            const persistedIndex = Number(rowKey.slice(2));
            setEditedCells((prev) => {
                const next = new Map(prev);
                next.set(`${persistedIndex}:${colIdx}`, newVal);
                return next;
            });
        } else {
            const draftId = rowKey.slice(2);
            setDraftRows((prev) => prev.map((dr) => {
                if (dr.id !== draftId) return dr;
                const vals = [...dr.values];
                vals[colIdx] = newVal;
                return { ...dr, values: vals };
            }));
        }
    }, [setEditedCells, setDraftRows]);

    React.useEffect(() => {
        if (!showRightSidebar || selectedRowKeys.length === 0 || !result?.isDone) return;
        const activeRowKey = selectedRowKeys[0];
        const displayRow = displayRowsByKey.get(activeRowKey);
        if (!displayRow) return;

        const rowValues =
            displayRow.kind === 'persisted'
                ? getPersistedRowValues(displayRow.persistedIndex as number)
                : [...displayRow.values];

        openDetail({
            columns: result.columns,
            columnTypes: result.columns.map((col) => columnDefsByName.get(col)?.DataType || ''),
            columnDefs: result.columns.map((col) =>
                columnDefsByName.get(col) ||
                models.ColumnDef.createFrom({ Name: col, DataType: '', IsNullable: true, IsPrimaryKey: false, DefaultValue: '' }),
            ),
            row: rowValues,
            tableName: qualifiedTableName || result.tableName,
            primaryKeys: result.primaryKeys,
            onSave: (colIdx, newVal) => handleRowDetailSave(activeRowKey, colIdx, newVal),
        });
    }, [columnDefsByName, displayRowsByKey, getPersistedRowValues, handleRowDetailSave, openDetail, qualifiedTableName, result?.columns, result?.isDone, result?.primaryKeys, result?.tableName, selectedRowKeys, showRightSidebar]);

    // ── Save flow ─────────────────────────────────────────────────────────────
    const handleDirectExecute = React.useCallback(async () => {
        const script = generatePendingScript();
        if (!script.trim()) {
            return;
        }

        const guard = await writeSafetyGuard.guardSql(script, 'Execute Changes');
        if (!guard.allowed) {
            if (guard.blockedReason) {
                toast.error(guard.blockedReason);
            }
            return;
        }

        await editing.handleDirectExecute(ExecuteUpdateSync);
        setShowSaveModal(false);
    }, [editing, generatePendingScript, toast, writeSafetyGuard]);

    const handleSaveRequest = React.useCallback(async () => {
        if (viewMode) { toast.error('View Mode is enabled. Write actions are blocked.'); return; }
        if (!hasPendingChanges) return;
        if (hasLegacyChanges) { setShowSaveModal(true); return; }
        await handleDirectExecute();
    }, [handleDirectExecute, hasLegacyChanges, hasPendingChanges, toast, viewMode]);

    const handleCopyScript = React.useCallback(() => {
        void setClipboardText(generatePendingScript())
            .then(() => toast.success('Script copied to clipboard'))
            .catch(() => toast.error('Failed to copy script'));
    }, [generatePendingScript, toast]);

    const handleOpenInNewTab = React.useCallback(() => {
        addTab({ name: `Apply ${result?.tableName}`, query: generatePendingScript() });
        setShowSaveModal(false);
        toast.success('Script opened in a new tab.');
    }, [addTab, generatePendingScript, result?.tableName, toast]);
    const openContextQueryTab = React.useCallback((query: string, title?: string) => {
        addTab({
            name: title || `Row ${result?.tableName || 'query'}`,
            query,
        });
    }, [addTab, result?.tableName]);

    // ── Panel actions (bubbled to toolbar) ────────────────────────────────────
    const { runExport, exportJob, cancelExport } = useResultExport({ tabId, result });
    const canUseResultExport = featureGate.canUse('query.result.export');
    const allExportColumns = result?.columns || [];
    const handleLimitChange = React.useCallback(async (value: string) => {
        const newLimit = parseInt(value, 10) || 1000;
        await save(new utils.Preferences({ theme, font_size: fontSize, default_limit: newLimit }));

        // Re-run immediately so the new limit applies without requiring manual reload.
        const activeFilter = filterExpr.trim();
        const activeOrderBy = orderByExpr.trim();
        if ((activeFilter || activeOrderBy) && onFilterRun) {
            onFilterRun(activeFilter, activeOrderBy, sourceQuery);
            return;
        }
        onRun?.();
    }, [filterExpr, fontSize, onFilterRun, onRun, orderByExpr, save, sourceQuery, theme]);
    const handleOpenExportModal = React.useCallback(() => {
        if (!result?.columns?.length) {
            toast.error('No columns available to export.');
            return;
        }
        setExportScope('all');
        setExportFormat('csv');
        setSelectedExportColumns([...result.columns]);
        setExportTableName(result.tableName || '');
        setShowExportModal(true);
    }, [result?.columns, result?.tableName, toast]);

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

    // ── Export ────────────────────────────────────────────────────────────────
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

    // ── Limit selector ────────────────────────────────────────────────────────
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

    // ── Early renders ─────────────────────────────────────────────────────────
    if (!result) {
        return (
            <div className="flex items-center justify-center h-full text-small text-muted-foreground">
                <span>Run a query (Ctrl+Enter) to see results</span>
            </div>
        );
    }
    if (result.error) {
        if (shouldShowResultFilterBar) {
            return (
                <div className="flex flex-col items-stretch justify-start h-full text-small text-muted-foreground overflow-hidden">
                    {resultFilterBar}
                    <div className="flex items-center justify-center flex-1 text-error gap-2">
                        <AlertCircle size={16} /><span>{result.error}</span>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center h-full text-small text-error gap-2">
                <AlertCircle size={16} /><span>{result.error}</span>
            </div>
        );
    }
    if (!result.isSelect) {
        return (
            <div className="flex items-center justify-center h-full text-small text-success gap-2">
                <CheckCircle size={16} />
                <span>{result.affected} rows affected · {formatDuration(result.duration)}</span>
            </div>
        );
    }

    const explainJsonValue =
        generatedKind === 'explain' && result.rows.length === 1 && result.rows[0]?.length === 1 && isJsonValue(result.rows[0][0])
            ? result.rows[0][0]
            : null;

    let displayTotalCount: number | undefined;
    if (result.isDone && !result.hasMore) {
        displayTotalCount = result.rows.length;
    }
    const viewportState = resolveResultFetchStrategy(result.rows.length, result.hasMore, result.isDone);
    const strategyTooltip = (() => {
        switch (viewportState.strategy) {
            case 'server_aware':
                return 'Server-aware: result may still stream or has more rows on server.';
            case 'incremental_client':
                return 'Incremental client: large completed dataset, client handles viewport incrementally.';
            case 'client_full':
            default:
                return 'Client full: result fits comfortably, client can handle all rows directly.';
        }
    })();
    const executionStartedAt = result.progress?.startedAt;
    const executionTimeText = (() => {
        if (!executionStartedAt) return null;
        return new Date(executionStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    })();
    const executionTimeTooltip = (() => {
        if (!executionStartedAt) return '';
        return `Execution started at ${new Date(executionStartedAt).toLocaleString()}`;
    })();
    const pendingChangeCounts = (() => {
        const updatedRowIndices = new Set<number>();
        editedCells.forEach((_, cellId) => {
            const [rowIndexRaw] = cellId.split(':');
            const rowIndex = Number(rowIndexRaw);
            if (!Number.isFinite(rowIndex) || deletedRows.has(rowIndex)) return;
            updatedRowIndices.add(rowIndex);
        });
        return {
            add: draftRows.length,
            update: updatedRowIndices.size,
            del: deletedRows.size,
        };
    })();
    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div
            className="flex flex-col items-stretch justify-start h-full text-small text-muted-foreground overflow-hidden"
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
                            <div className="flex flex-row items-center gap-2 px-3 py-2 text-small border-b border-border shrink-0">
                                <Loader size={14} className="animate-spin" />
                                <span className="text-muted-foreground">
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
                        {resultFilterBar}

                        {isLoading && (
                            <div className="z-sticky shrink-0" style={{ height: 2, background: 'var(--interactive-primary)', opacity: 0.7 }}>
                                <div style={{ height: '100%', width: '40%', background: 'rgba(255,255,255,0.6)', animation: 'shimmer 1.2s infinite linear', backgroundSize: '400px 100%' }} />
                            </div>
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
                                    quickFilter={quickFilter}
                                    onViewStatsChange={({ visibleRows: nextVisible }) => setVisibleRows(nextVisible)}
                                    editedCells={editedCells}
                                    setEditedCells={setEditedCells}
                                    selectedCells={selectedCells}
                                    setSelectedCells={setSelectedCells}
                                    selectedRowKeys={selectedRowKeysFromHeader}
                                    setSelectedRowKeys={setSelectedRowKeysFromHeader}
                                    deletedRows={deletedRows}
                                    setDeletedRows={setDeletedRows}
                                    draftRows={draftRows}
                                    setDraftRows={setDraftRows}
                                    columnDefs={columnDefs}
                                    focusCellRequest={focusCellRequest}
                                    onFocusCellRequestHandled={() => setFocusCellRequest(null)}
                                    onRemoveDraftRows={removeDraftRows}
                                    readOnlyMode={viewMode || isReadOnlyTab}
                                    onCellContextMenu={handleCellContextMenu}
                                    onRowHeaderContextMenu={handleCellContextMenu}
                                    columnVisibility={columnVisibility}
                                    onColumnVisibilityChange={setColumnVisibility}
                                />
                            )}
                        </div>
                    </div>
                );
            })()}

            <ResultContextMenu
                contextMenu={contextMenu}
                contextMenuRef={contextMenuRef}
                contextMenuPosition={contextMenuPosition}
                canCopy={canCopy}
                canPaste={canPaste}
                canSetNull={canSetNull}
                canDeleteRows={canDeleteRows}
                canDuplicateRows={canDuplicateRows}
                copyDisabledTitle={copyDisabledTitle}
                pasteDisabledTitle={pasteDisabledTitle}
                setNullDisabledTitle={setNullDisabledTitle}
                duplicateDisabledTitle={duplicateDisabledTitle}
                deleteDisabledTitle={deleteDisabledTitle}
                copyAsActions={copyAsActions}
                whereActions={whereActions}
                canOpenRowInNewQueryTab={canOpenRowInNewQueryTab}
                canUndoLastContextAction={canUndoLastContextAction}
                undoDisabledTitle={undoDisabledTitle}
                openRowQueryDisabledTitle={openRowQueryDisabledTitle}
                onCopy={handleContextCopy}
                onSetNull={handleContextSetNull}
                onPaste={handleContextPaste}
                onDeleteRow={handleContextDelete}
                onDuplicateRow={handleContextDuplicate}
                onOpenRowInNewQueryTab={handleOpenRowInNewQueryTab}
                onUndoLastContextAction={handleUndoLastContextAction}
            />

            {/* Status bar (info only) */}
            <div className="flex items-center justify-center relative px-3 py-1 text-label text-muted-foreground border-t border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        {displayTotalCount !== undefined ? (
                            <span className="flex items-center gap-1">(Total: <strong>{displayTotalCount.toLocaleString()}</strong>)</span>
                        ) : null}
                        <strong>{(quickFilter.trim() ? visibleRows : (result.rows.length + draftRows.length)).toLocaleString()}</strong>
                        of&nbsp;
                        <strong>{defaultLimit.toLocaleString()}</strong>&nbsp;rows&nbsp;&nbsp;{formatDuration(result.duration)}
                    </span>
                    <span className="" title={strategyTooltip}>
                        strategy: {viewportState.strategy}
                    </span>
                    {executionTimeText && (
                        <span title={executionTimeTooltip}>
                            executed: {executionTimeText}
                        </span>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    {exportJob?.status === 'running' && (
                        <div className="flex items-center gap-2 text-label border border-border rounded-sm px-2 py-0.5">
                            <Loader size={11} className="animate-spin" />
                            <span>
                                {exportJob.label || 'Exporting'} {typeof exportJob.progressPct === 'number' ? `${exportJob.progressPct}%` : 'running...'}
                                {typeof exportJob.totalRows === 'number' ? ` (${(exportJob.processedRows || 0).toLocaleString()}/${exportJob.totalRows.toLocaleString()})` : ''}
                                {exportJob.queuedCount ? ` +${exportJob.queuedCount} queued` : ''}
                            </span>
                        </div>
                    )}
                    {hasPendingChanges && (
                        <span className="text-label text-warning">
                            Add: {pendingChangeCounts.add} | Update: {pendingChangeCounts.update} | Del: {pendingChangeCounts.del}
                        </span>
                    )}
                </div>
            </div>

            <ResultPanelModals
                showSaveModal={showSaveModal}
                setShowSaveModal={setShowSaveModal}
                showExportModal={showExportModal}
                setShowExportModal={setShowExportModal}
                qualifiedTableName={qualifiedTableName}
                resultTableName={result?.tableName}
                generatePendingScript={generatePendingScript}
                handleCopyScript={handleCopyScript}
                handleOpenInNewTab={handleOpenInNewTab}
                handleDirectExecute={handleDirectExecute}
                exportScope={exportScope}
                setExportScope={setExportScope}
                exportFormat={exportFormat}
                setExportFormat={setExportFormat}
                exportTableName={exportTableName}
                setExportTableName={setExportTableName}
                allExportColumns={allExportColumns}
                orderedSelectedExportColumns={orderedSelectedExportColumns}
                selectedExportColumnSet={selectedExportColumnSet}
                toggleExportColumn={toggleExportColumn}
                toggleAllExportColumns={toggleAllExportColumns}
                areAllExportColumnsSelected={areAllExportColumnsSelected}
                previewExportRows={previewExportRows}
                handleConfirmExport={handleConfirmExport}
                writeSafetyModals={writeSafetyGuard.modals}
            />
        </div>
    );
};


