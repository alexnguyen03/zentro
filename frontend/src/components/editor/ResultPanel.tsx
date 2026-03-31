import React from 'react';
import {
    AlertCircle,
    CheckCircle,
    Copy,
    Download,
    FilePlus,
    Loader,
    Trash2,
    Play,
    Plus,
    Maximize2,
    Minimize2,
    RotateCcw,
    Save,
    Sparkles,
    Upload,
} from 'lucide-react';
import { ExecuteUpdateSync } from '../../services/queryService';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useResultStore, TabResult } from '../../stores/resultStore';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { models } from '../../../wailsjs/go/models';
import { Modal } from '../layout/Modal';
import { useToast } from '../layout/Toast';
import { Button } from '../ui';
import { ResultTable, type FocusCellRequest } from './ResultTable';
import { ResultFilterBar } from './ResultFilterBar';
import { JsonViewer, isJsonValue } from '../viewers/JsonViewer';
import { DOM_EVENT } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import { getErrorMessage } from '../../lib/errors';
import type { UiAction } from '../../types/uiAction';
import { LIMIT_OPTIONS, formatDuration } from './resultPanelUtils';
import { utils } from '../../../wailsjs/go/models';
import { FetchTotalRowCount } from '../../services/queryService';
import { useResultEditing } from './useResultEditing';
import { useResultKeyboard } from './useResultKeyboard';
import { useResultExport } from './useResultExport';
import { setClipboardText } from '../../services/clipboardService';
import { resolveResultFetchStrategy } from '../../features/query/resultStrategy';
import { useFeatureGate } from '../../features/license/useFeatureGate';
import { listResultActionContributions } from '../../features/query/contributionRegistry';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';

export type ResultPanelAction = UiAction;

interface ResultPanelProps {
    tabId: string;
    contextTabId?: string;
    result?: TabResult;
    onRun?: () => void;
    onFilterRun?: (filter: string) => void;
    onActionsChange?: (actions: ResultPanelAction[]) => void;
    baseQuery?: string;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
    isReadOnlyTab?: boolean;
    generatedKind?: 'result' | 'explain';
    isMaximized?: boolean;
    onToggleMaximize?: () => void;
    showMaximizeControl?: boolean;
}

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
}) => {
    const actionsSignatureRef = React.useRef<string>('');
    const { defaultLimit, theme, fontSize, save, viewMode } = useSettingsStore();
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

    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [showExportMenu, setShowExportMenu] = React.useState(false);
    const [showTableNameInput, setShowTableNameInput] = React.useState(false);
    const [tableNameForExport, setTableNameForExport] = React.useState('');
    const [quickFilter, setQuickFilter] = React.useState(() => persistedContext?.resultQuickFilter || '');
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
        deletedRows, setDeletedRows, draftRows, setDraftRows,
        isSavingDraftRows, setIsSavingDraftRows,
        focusCellRequest, setFocusCellRequest,
        selectedRowKeys, selectedPersistedRowIndices, selectedDraftIds,
        qualifiedTableName, isEditable, canManageDraftRows,
        hasLegacyChanges, hasPendingChanges,
        removeDraftRows, getPersistedRowValues, resetEditState,
        generatePendingScript,
        handleAddRow, handleDuplicateRows, requestDeleteSelectedRows,
    } = editing;

    const setFilterExpr = React.useCallback((value: string) => {
        useResultStore.getState().setFilterExpr(tabId, value);
        updateTabContext(contextTabId || tabId, { resultFilterExpr: value });
    }, [contextTabId, tabId, updateTabContext]);
    const filterExpr = result?.filterExpr || '';
    const sourceQuery = baseQuery || result?.lastExecutedQuery;
    const handleHeaderFilterRun = React.useCallback((expr: string) => {
        keepFilterFocusRef.current = true;
        setFilterExpr(expr);
        onFilterRun?.(expr);
    }, [onFilterRun, setFilterExpr]);

    React.useEffect(() => {
        const nextFilter = persistedContext?.resultQuickFilter || '';
        setQuickFilter(nextFilter);
    }, [contextTabId, persistedContext?.resultQuickFilter, tabId]);

    React.useEffect(() => {
        const nextExpr = persistedContext?.resultFilterExpr;
        if (typeof nextExpr !== 'string') return;
        useResultStore.getState().setFilterExpr(tabId, nextExpr);
    }, [persistedContext?.resultFilterExpr, tabId]);

    React.useEffect(() => {
        updateTabContext(contextTabId || tabId, { resultQuickFilter: quickFilter });
    }, [contextTabId, quickFilter, tabId, updateTabContext]);

    // ── Row count ─────────────────────────────────────────────────────────────
    const handleCountTotal = React.useCallback(async () => {
        if (!tabId) return;
        setIsCounting(true);
        try {
            const count = await FetchTotalRowCount(tabId);
            setTotalCount(count);
        } catch {
            setTotalCount(-1);
        } finally {
            setIsCounting(false);
        }
    }, [tabId]);

    const prevIsDone = React.useRef(result?.isDone);
    React.useEffect(() => {
        if (!result) return;
        if (prevIsDone.current !== result.isDone) {
            if (!result.isDone) {
                setTotalCount(null);
                setIsCounting(false);
                resetEditState();
                setShowSaveModal(false);
                handleCountTotal();
                if (!keepFilterFocusRef.current) {
                    setTimeout(() => containerRef.current?.focus({ preventScroll: true }), 50);
                }
            } else {
                keepFilterFocusRef.current = false;
            }
            prevIsDone.current = result.isDone;
        }
    }, [handleCountTotal, resetEditState, result]);

    // ── Row Detail sidebar sync ───────────────────────────────────────────────
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
            onSave: (colIdx, newVal) => {
                if (displayRow.kind === 'persisted') {
                    setEditedCells((prev) => { const next = new Map(prev); next.set(`${displayRow.persistedIndex}:${colIdx}`, newVal); return next; });
                } else {
                    setDraftRows((prev: unknown) => (prev as typeof draftRows).map((dr) => {
                        if (dr.id !== displayRow.draft?.id) return dr;
                        const vals = [...dr.values]; vals[colIdx] = newVal;
                        return { ...dr, values: vals };
                    }));
                }
            },
        });
    }, [columnDefsByName, displayRowsByKey, getPersistedRowValues, openDetail, qualifiedTableName, result, selectedRowKeys, showRightSidebar, toast]);

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

    React.useEffect(() => {
        const off = onCommand(DOM_EVENT.SAVE_TAB_ACTION, (detail) => {
            if (detail && detail !== tabId) return;
            if (viewMode || !hasPendingChanges || isSavingDraftRows) return;
            void handleSaveRequest();
        });
        return off;
    }, [handleSaveRequest, hasPendingChanges, isSavingDraftRows, tabId, viewMode]);

    // ── Panel actions (bubbled to toolbar) ────────────────────────────────────
    const { handleExportCSV, handleExportJSON, handleExportSQLConfirm, exportJob, cancelExport } = useResultExport({
        result, tableNameForExport, setTableNameForExport, setShowExportMenu, setShowTableNameInput,
    });
    const canUseResultExport = featureGate.canUse('query.result.export');
    const handleLimitChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(event.target.value, 10) || 1000;
        save(new utils.Preferences({ theme, font_size: fontSize, default_limit: newLimit }));
    }, [fontSize, save, theme]);

    const renderPanelAction = React.useCallback((action: ResultPanelAction) => {
        if (action.render) return <React.Fragment key={action.id}>{action.render()}</React.Fragment>;
        if (!action.onClick) return null;
        return (
            <Button
                key={action.id}
                variant="ghost"
                size="icon"
                danger={action.danger}
                onClick={() => action.onClick?.()}
                disabled={action.disabled || action.loading}
                title={action.title || action.label}
            >
                {action.loading ? <Loader size={12} className="animate-spin" /> : action.icon}
            </Button>
        );
    }, []);

    const panelActions = React.useMemo(() => {
        const actions: ResultPanelAction[] = [];
        const shouldAlwaysShowRowActions = !onActionsChange;
        const showRowActions = canManageDraftRows || shouldAlwaysShowRowActions;
        const rowActionsBlocked = !canManageDraftRows || isSavingDraftRows;
        const rowActionDisabledReason = !canManageDraftRows
            ? 'Row actions require editable table result with primary keys.'
            : undefined;

        if (showRowActions) {
            actions.push({
                id: 'add-row',
                icon: <Plus size={11} />,
                label: 'Add Row',
                title: rowActionDisabledReason || 'Add Row',
                onClick: handleAddRow,
                disabled: rowActionsBlocked,
            });
            actions.push({
                id: 'duplicate-rows',
                icon: <Copy size={11} />,
                label: 'Duplicate',
                title: rowActionDisabledReason || 'Duplicate Selected Rows',
                onClick: handleDuplicateRows,
                disabled: rowActionsBlocked || selectedPersistedRowIndices.length === 0,
            });
            actions.push({
                id: 'delete-rows',
                icon: <Trash2 size={11} />,
                label: 'Delete',
                title: rowActionDisabledReason || 'Delete Selected Rows',
                danger: true,
                onClick: requestDeleteSelectedRows,
                disabled: rowActionsBlocked || (selectedPersistedRowIndices.length === 0 && selectedDraftIds.length === 0),
            });
        }
        if (hasPendingChanges) {
            actions.push({
                id: 'discard', icon: <RotateCcw size={11} />, label: 'Discard', title: 'Discard', danger: true,
                onClick: () => { resetEditState(); setSelectedCells(new Set()); },
            });
            if (!viewMode) {
                actions.push({ id: 'save', icon: <Save size={11} />, label: 'Save', title: 'Save', onClick: () => { void handleSaveRequest(); }, loading: isSavingDraftRows });
            }
        }

        const resultActionContext = {
            tabId,
            rowCount: result?.rows.length || 0,
            columnCount: result?.columns.length || 0,
        };
        const extensionActions = listResultActionContributions()
            .filter((contribution) => (contribution.isAvailable ? contribution.isAvailable(resultActionContext) : true))
            .map<ResultPanelAction>((contribution) => ({
                id: `ext:${contribution.id}`,
                icon: <Sparkles size={11} />,
                label: contribution.title,
                title: contribution.title,
                onClick: () => contribution.run(resultActionContext),
            }));
        actions.push(...extensionActions);

        actions.push({
            id: 'row-limit',
            signature: `limit:${defaultLimit}`,
            render: () => (
                <select
                    className="bg-transparent border border-border/40 text-text-secondary text-[11px] px-1.5 py-0.5 h-7 rounded-md cursor-pointer outline-none transition-colors duration-100 hover:bg-bg-tertiary focus:border-success appearance-auto"
                    value={defaultLimit}
                    onChange={handleLimitChange}
                    title="Row limit for next query"
                >
                    {LIMIT_OPTIONS.map((value) => (
                        <option key={value} value={value}>{value.toLocaleString()}</option>
                    ))}
                </select>
            ),
        });

        actions.push({
            id: 'export-dropdown',
            signature: `export:${canUseResultExport ? 1 : 0}:${showExportMenu ? 1 : 0}`,
            render: () => (
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowExportMenu((prev) => !prev)}
                        disabled={!canUseResultExport}
                        title="Export"
                        className="gap-1"
                    >
                        <Upload size={13} />
                    </Button>
                    {showExportMenu && (
                        <div className="absolute right-0 top-full z-panel-overlay mt-1 min-w-40 rounded-md border border-border bg-bg-primary py-1 shadow-lg">
                            <button className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-tertiary flex items-center gap-2" onClick={handleExportCSV}>
                                <span>CSV</span>
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-tertiary flex items-center gap-2" onClick={handleExportJSON}>
                                <span>JSON</span>
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-tertiary flex items-center gap-2" onClick={() => { setShowExportMenu(false); setShowTableNameInput(true); }}>
                                <span>SQL INSERT</span>
                            </button>
                        </div>
                    )}
                </div>
            ),
        });

        if (showMaximizeControl) {
            actions.push({
                id: 'toggle-maximize',
                icon: isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />,
                title: isMaximized ? 'Restore result panel size' : 'Maximize result panel',
                onClick: onToggleMaximize,
                disabled: !onToggleMaximize,
                signature: `maximize:${isMaximized ? 1 : 0}:${onToggleMaximize ? 1 : 0}`,
            });
        }

        if (exportJob?.status === 'running') {
            actions.push({
                id: 'cancel-export',
                icon: <Loader size={12} className="animate-spin" />,
                title: 'Cancel export',
                onClick: cancelExport,
                signature: `export-running:${exportJob.progressPct ?? 0}`,
            });
        }

        return actions;
    }, [
        canManageDraftRows,
        handleAddRow,
        handleDuplicateRows,
        handleSaveRequest,
        hasPendingChanges,
        isSavingDraftRows,
        resetEditState,
        result?.columns.length,
        result?.rows.length,
        selectedPersistedRowIndices.length,
        selectedDraftIds.length,
        setSelectedCells,
        tabId,
        viewMode,
        defaultLimit,
        canUseResultExport,
        showExportMenu,
        handleExportCSV,
        handleExportJSON,
        showMaximizeControl,
        isMaximized,
        onToggleMaximize,
        exportJob?.status,
        exportJob?.progressPct,
        cancelExport,
        requestDeleteSelectedRows,
        onActionsChange,
    ]);

    React.useEffect(() => {
        if (!onActionsChange) return;
        const signature = panelActions
            .map((action) => `${action.id}:${action.disabled ? 1 : 0}:${action.loading ? 1 : 0}:${action.danger ? 1 : 0}:${action.label || ''}:${action.title || ''}:${action.signature || ''}:${action.render ? 1 : 0}`)
            .join('|');
        if (actionsSignatureRef.current === signature) return;
        actionsSignatureRef.current = signature;
        onActionsChange(panelActions);
    }, [onActionsChange, panelActions]);

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

    // ── Keyboard ──────────────────────────────────────────────────────────────
    const { handleKeyDown } = useResultKeyboard({
        tabId, result, hasPendingChanges, isReadOnlyTab, viewMode, isEditable,
        selectedCells, setSelectedCells, selectedRowKeys,
        displayRows, displayRowsByKey, rowOrder, editedCells, deletedRows, draftRows, isSavingDraftRows,
        onRun, onSaveRequest: handleSaveRequest, onDeleteSelected: requestDeleteSelectedRows,
        onSetShowRightSidebar: setShowRightSidebar,
        onFocusSearch: () => { if (canUseResultSearch) quickFilterRef.current?.focus(); },
        onFocusJump: () => { if (canUseResultJump) jumpRowRef.current?.focus(); },
        onSearchNext: () => { if (canUseResultSearch) jumpToNextHit(); },
        onSearchPrev: () => { if (canUseResultSearch) jumpToPrevHit(); },
        setEditedCells, setDraftRows,
    });

    // ── Limit selector ────────────────────────────────────────────────────────
    const shouldShowResultFilterBar = Boolean(result?.isSelect);
    const shouldShowFilterInput = generatedKind !== 'explain';
    const resultFilterBar = result && shouldShowResultFilterBar ? (
        <ResultFilterBar
            value={filterExpr}
            onChange={setFilterExpr}
            baseQuery={baseQuery}
            columns={result.columns}
            tableName={result.tableName}
            showFilterInput={shouldShowFilterInput}
            onAppendToQuery={onAppendToQuery}
            onOpenInNewTab={onOpenInNewTab}
            onRun={(currentValue) => {
                keepFilterFocusRef.current = true;
                const nextExpr = typeof currentValue === 'string' ? currentValue : filterExpr;
                if (nextExpr.trim()) onFilterRun?.(nextExpr);
            }}
            onClear={() => { keepFilterFocusRef.current = true; setFilterExpr(''); onFilterRun?.(''); }}
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
            <div className="flex items-center justify-center h-full text-[13px] text-text-secondary">
                <span>Run a query (Ctrl+Enter) to see results</span>
            </div>
        );
    }
    if (result.error) {
        if (shouldShowResultFilterBar) {
            return (
                <div className="flex flex-col items-stretch justify-start h-full text-[13px] text-text-secondary overflow-hidden">
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

    const explainJsonValue =
        generatedKind === 'explain' && result.rows.length === 1 && result.rows[0]?.length === 1 && isJsonValue(result.rows[0][0])
            ? result.rows[0][0]
            : null;

    let displayTotalCount: number | undefined;
    if (totalCount !== null && totalCount >= 0) {
        displayTotalCount = totalCount;
    } else if (result.isDone && !result.hasMore) {
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
                            <div className="absolute top-0 left-0 right-0 z-sticky" style={{ height: 2, background: 'var(--status-success)', opacity: 0.7 }}>
                                <div style={{ height: '100%', width: '40%', background: 'rgba(255,255,255,0.6)', animation: 'shimmer 1.2s infinite linear', backgroundSize: '400px 100%' }} />
                            </div>
                        )}

                        {resultFilterBar}

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
                                    filterExpr={filterExpr}
                                    onHeaderFilterRun={handleHeaderFilterRun}
                                    onViewStatsChange={({ visibleRows: nextVisible }) => setVisibleRows(nextVisible)}
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

            {/* Status bar (info only) */}
            <div className="flex items-center justify-center relative px-3 py-1 text-[11px] text-text-secondary border-t border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        {displayTotalCount !== undefined ? (
                            <span className="flex items-center gap-1">(Total: <strong>{displayTotalCount.toLocaleString()}</strong>)</span>
                        ) : totalCount === -1 ? (
                            <span className="flex items-center gap-1 text-warning" title="Failed to count total rows in background">(Total: ?)</span>
                        ) : isCounting ? (
                            <span className="flex items-center gap-1 opacity-70">
                                <Loader size={12} className="animate-spin inline-block align-middle mr-1" />Counting...
                            </span>
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
                        <div className="flex items-center gap-2 text-[11px] border border-border rounded-md px-2 py-0.5">
                            <Loader size={11} className="animate-spin" />
                            <span>
                                {exportJob.label || 'Exporting'} {exportJob.progressPct ?? 0}%
                                {typeof exportJob.totalRows === 'number' ? ` (${(exportJob.processedRows || 0).toLocaleString()}/${exportJob.totalRows.toLocaleString()})` : ''}
                                {exportJob.queuedCount ? ` +${exportJob.queuedCount} queued` : ''}
                            </span>
                        </div>
                    )}
                    {hasPendingChanges && (
                        <span className="text-[11px] text-warning">
                            Add: {pendingChangeCounts.add} | Update: {pendingChangeCounts.update} | Del: {pendingChangeCounts.del}
                        </span>
                    )}
                </div>
            </div>

            {/* Save confirmation modal */}
            <Modal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                title="Confirm Changes"
                width={560}
                footer={
                    <>
                        <Button variant="ghost" size="icon" onClick={handleCopyScript} title="Copy Script"><Copy size={14} /></Button>
                        <Button variant="ghost" size="icon" onClick={handleOpenInNewTab} title="Open in New Tab"><FilePlus size={14} /></Button>
                        <Button variant="primary" onClick={() => { void handleDirectExecute(); }} title="Execute Changes" autoFocus className="px-6">
                            <Play size={14} className="mr-2" />Execute Changes
                        </Button>
                    </>
                }
            >
                <div>
                    <div className="flex items-start gap-4 mb-4">
                        <div className="shrink-0 p-2 rounded-full bg-accent/10"><AlertCircle size={20} className="text-accent" /></div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-text-primary mb-1">Review generated script</p>
                            <p className="text-[12px] leading-relaxed text-text-secondary">
                                Updates and deletes require confirmation. Pending inserts will be executed together with this script for <strong>{qualifiedTableName || result?.tableName}</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="p-3 bg-bg-tertiary/50 border border-border/40 rounded-md font-mono text-[11px] max-h-[260px] overflow-y-auto whitespace-pre-wrap text-text-secondary select-text">
                        {generatePendingScript()}
                    </div>
                </div>
            </Modal>

            {writeSafetyGuard.modals}

            {/* SQL export table name modal */}
            <Modal
                isOpen={showTableNameInput}
                onClose={() => { setShowTableNameInput(false); setTableNameForExport(''); }}
                title="Export as SQL INSERT"
                width={400}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setShowTableNameInput(false); setTableNameForExport(''); }}>Cancel</Button>
                        <Button variant="primary" onClick={() => { void handleExportSQLConfirm(); }} autoFocus>Export</Button>
                    </>
                }
            >
                <div className="py-2">
                    <label className="block text-[12px] text-text-secondary mb-1.5">Table Name</label>
                    <input
                        type="text"
                        className="w-full bg-bg-primary border border-border text-text-primary text-[13px] px-3 py-2 rounded-md outline-none focus:border-accent"
                        placeholder={result?.tableName || 'my_table'}
                        value={tableNameForExport}
                        onChange={(e) => setTableNameForExport(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleExportSQLConfirm()}
                        autoFocus
                    />
                    <p className="text-[11px] text-text-muted mt-2">Leave empty to use "{result?.tableName || 'my_table'}"</p>
                </div>
            </Modal>
        </div>
    );
};
