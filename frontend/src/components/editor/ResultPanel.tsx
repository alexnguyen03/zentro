import React from 'react';
import {
    AlertCircle,
    CheckCircle,
    Columns,
    Copy,
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
import { useToast } from '../layout/Toast';
import {
    Button,
    Checkbox,
    Input,
    Label,
    Modal,
    RadioGroup,
    RadioGroupItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui';
import { ResultTable, type ResultCellContextMenuPayload } from './ResultTable';
import { ResultFilterBar } from './ResultFilterBar';
import { JsonViewer, isJsonValue } from '../viewers/JsonViewer';
import { DOM_EVENT } from '../../lib/constants';
import { onCommand } from '../../lib/commandBus';
import type { UiAction } from '../../types/uiAction';
import { cn } from '../../lib/cn';
import { useConnectionStore } from '../../stores/connectionStore';
import { LIMIT_OPTIONS, formatDuration, makeCellId, parseCellId } from './resultPanelUtils';
import { utils } from '../../../wailsjs/go/models';
import { FetchTotalRowCount } from '../../services/queryService';
import { useResultEditing } from './useResultEditing';
import { useResultKeyboard } from './useResultKeyboard';
import { useResultExport } from './useResultExport';
import { getClipboardText, setClipboardText } from '../../services/clipboardService';
import { resolveResultFetchStrategy } from '../../features/query/resultStrategy';
import { useFeatureGate } from '../../features/license/useFeatureGate';
import { listResultActionContributions } from '../../features/query/contributionRegistry';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';
import {
    applyClipboardPaste,
    applySetNullToSelection,
    buildSelectionMatrix,
    matrixToTsv,
    buildRowsAsInsertStatements,
    buildRowAsUpdateStatement,
} from './resultSelectionActions';

const RESULT_TOOLBAR_ICON_SIZE = 12;

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
    showResultFilterBar?: boolean;
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
    showResultFilterBar = true,
}) => {
    const actionsSignatureRef = React.useRef<string>('');
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

    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
    const [showColumnsPopover, setShowColumnsPopover] = React.useState(false);
    const columnsPopoverRef = React.useRef<HTMLDivElement>(null);
    const [showExportModal, setShowExportModal] = React.useState(false);
    const [exportScope, setExportScope] = React.useState<'all' | 'view'>('all');
    const [exportFormat, setExportFormat] = React.useState<'csv' | 'json' | 'sql'>('csv');
    const [selectedExportColumns, setSelectedExportColumns] = React.useState<string[]>([]);
    const [exportTableName, setExportTableName] = React.useState('');
    const [quickFilter, setQuickFilter] = React.useState(() => persistedContext?.resultQuickFilter || '');
    const [visibleRows, setVisibleRows] = React.useState(0);
    const [activeSearchHit, setActiveSearchHit] = React.useState(0);
    const [contextMenu, setContextMenu] = React.useState<ResultCellContextMenuPayload | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const contextMenuRef = React.useRef<HTMLDivElement>(null);
    const keepFilterFocusRef = React.useRef(false);
    const quickFilterRef = React.useRef<HTMLInputElement>(null);
    const jumpRowRef = React.useRef<HTMLInputElement>(null);

    // ── Domain hooks ──────────────────────────────────────────────────────────
    const editing = useResultEditing({ tabId, result });
    const {
        columnDefs, columnDefsByName, displayRows, displayRowsByKey, rowOrder,
        editedCells, setEditedCells, selectedCells, setSelectedCells,
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
                // Auto-count total rows when query finishes and there are more rows to load
                if (result.hasMore && result.isSelect) {
                    void handleCountTotal();
                }
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
    const { runExport, exportJob, cancelExport } = useResultExport({ tabId, result });
    const canUseResultExport = featureGate.canUse('query.result.export');
    const allExportColumns = result?.columns || [];
    const handleLimitChange = React.useCallback(async (value: string) => {
        const newLimit = parseInt(value, 10) || 1000;
        await save(new utils.Preferences({ theme, font_size: fontSize, default_limit: newLimit }));

        // Re-run immediately so the new limit applies without requiring manual reload.
        const activeFilter = filterExpr.trim();
        if (activeFilter && onFilterRun) {
            onFilterRun(activeFilter);
            return;
        }
        onRun?.();
    }, [filterExpr, fontSize, onFilterRun, onRun, save, theme]);
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

    const renderPanelAction = React.useCallback((action: ResultPanelAction) => {
        if (action.render) return <React.Fragment key={action.id}>{action.render()}</React.Fragment>;
        if (!action.onClick) return null;
        return (
            <Button
                key={action.id}
                variant="ghost"
                size="icon"
                onClick={() => action.onClick?.()}
                disabled={action.disabled || action.loading}
                title={action.title || action.label}
                className={action.danger ? 'h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive' : 'h-7 w-7 p-0'}
            >
                {action.loading ? <Loader size={RESULT_TOOLBAR_ICON_SIZE} className="animate-spin" /> : action.icon}
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
                icon: <Plus size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: 'Add Row',
                title: rowActionDisabledReason || 'Add Row',
                onClick: handleAddRow,
                disabled: rowActionsBlocked,
            });
            actions.push({
                id: 'duplicate-rows',
                icon: <Copy size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: 'Duplicate',
                title: rowActionDisabledReason || 'Duplicate Selected Rows',
                onClick: handleDuplicateRows,
                disabled: rowActionsBlocked || selectedPersistedRowIndices.length === 0,
            });
            actions.push({
                id: 'delete-rows',
                icon: <Trash2 size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: 'Delete',
                title: rowActionDisabledReason || 'Delete Selected Rows',
                danger: true,
                onClick: requestDeleteSelectedRows,
                disabled: rowActionsBlocked || (selectedPersistedRowIndices.length === 0 && selectedDraftIds.length === 0),
            });
        }
        if (hasPendingChanges) {
            actions.push({
                id: 'discard', icon: <RotateCcw size={RESULT_TOOLBAR_ICON_SIZE} />, label: 'Discard', title: 'Discard', danger: true,
                onClick: () => { resetEditState(); setSelectedCells(new Set()); },
            });
            if (!viewMode) {
                actions.push({ id: 'save', icon: <Save size={RESULT_TOOLBAR_ICON_SIZE} />, label: 'Save', title: 'Save', onClick: () => { void handleSaveRequest(); }, loading: isSavingDraftRows });
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
                icon: <Sparkles size={RESULT_TOOLBAR_ICON_SIZE} />,
                label: contribution.title,
                title: contribution.title,
                onClick: () => contribution.run(resultActionContext),
            }));
        actions.push(...extensionActions);

        actions.push({
            id: 'row-limit',
            signature: `limit:${defaultLimit}`,
            render: () => (
                <Select value={String(defaultLimit)} onValueChange={handleLimitChange}>
                    <SelectTrigger
                        className="h-7 w-[112px] border-border/40 bg-transparent px-2 py-0 text-[11px] text-muted-foreground hover:bg-muted/70"
                        title="Row limit for next query"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LIMIT_OPTIONS.map((value) => (
                            <SelectItem key={value} value={String(value)}>
                                {value.toLocaleString()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ),
        });

        if (result && result.columns.length > 0) {
            const hiddenCount = Object.values(columnVisibility).filter((v) => v === false).length;
            actions.push({
                id: 'columns-toggle',
                signature: `cols:${hiddenCount}:${showColumnsPopover ? 1 : 0}`,
                render: () => (
                    <div className="relative" ref={columnsPopoverRef}>
                        <Button
                            type="button"
                            variant={hiddenCount > 0 ? 'secondary' : 'ghost'}
                            className={cn('h-7 gap-1 px-2 text-[11px] border', hiddenCount > 0 ? 'border-success/40 bg-success/15' : 'border-transparent')}
                            title="Toggle column visibility"
                            onClick={() => setShowColumnsPopover((prev) => !prev)}
                        >
                            <Columns size={RESULT_TOOLBAR_ICON_SIZE} />
                            {hiddenCount > 0 && <span className="text-[10px]">-{hiddenCount}</span>}
                        </Button>
                        {showColumnsPopover && (
                            <div className="absolute right-0 top-full mt-1 z-panel-overlay min-w-[180px] max-h-[320px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg py-1">
                                <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
                                    Columns
                                </div>
                                {result.columns.map((col) => {
                                    const isVisible = columnVisibility[col] !== false;
                                    return (
                                        <button
                                            key={col}
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-muted text-left transition-colors"
                                            onClick={() => setColumnVisibility((prev) => ({ ...prev, [col]: !isVisible }))}
                                        >
                                            <span className={cn('w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center', isVisible ? 'bg-success border-success text-white' : 'border-border')}>
                                                {isVisible && <span className="text-[8px] leading-none">✓</span>}
                                            </span>
                                            <span className="truncate">{col}</span>
                                        </button>
                                    );
                                })}
                                {Object.values(columnVisibility).some((v) => v === false) && (
                                    <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="h-6 w-full text-[11px] text-muted-foreground"
                                            onClick={() => setColumnVisibility({})}
                                        >
                                            Show all
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ),
            });
        }

        actions.push({
            id: 'export',
            icon: <Upload size={RESULT_TOOLBAR_ICON_SIZE} />,
            label: 'Export',
            title: 'Export',
            onClick: handleOpenExportModal,
            disabled: !canUseResultExport,
        });

        if (showMaximizeControl) {
            actions.push({
                id: 'toggle-maximize',
                icon: isMaximized ? <Minimize2 size={RESULT_TOOLBAR_ICON_SIZE} /> : <Maximize2 size={RESULT_TOOLBAR_ICON_SIZE} />,
                title: isMaximized ? 'Restore result panel size' : 'Maximize result panel',
                onClick: onToggleMaximize,
                disabled: !onToggleMaximize,
                signature: `maximize:${isMaximized ? 1 : 0}:${onToggleMaximize ? 1 : 0}`,
            });
        }

        if (exportJob?.status === 'running') {
            actions.push({
                id: 'cancel-export',
                icon: <Loader size={RESULT_TOOLBAR_ICON_SIZE} className="animate-spin" />,
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
        handleOpenExportModal,
        showMaximizeControl,
        isMaximized,
        onToggleMaximize,
        exportJob?.status,
        exportJob?.progressPct,
        cancelExport,
        requestDeleteSelectedRows,
        onActionsChange,
        columnVisibility,
        showColumnsPopover,
        setColumnVisibility,
        setShowColumnsPopover,
        result?.columns,
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

    const nullableByColumnIndex = React.useMemo(
        () => (result?.columns || []).map((columnName) => columnDefsByName.get(columnName)?.IsNullable ?? true),
        [columnDefsByName, result?.columns],
    );
    const contextMenuRow = React.useMemo(
        () => (contextMenu ? displayRowsByKey.get(contextMenu.rowKey) : undefined),
        [contextMenu, displayRowsByKey],
    );
    const hasEditableCellSelection = selectedCells.size > 0 || Boolean(contextMenu?.cellId);
    const canMutateCells = isEditable && !isReadOnlyTab && !viewMode && !isSavingDraftRows;
    const canMutateRows = canManageDraftRows && !isReadOnlyTab && !viewMode && !isSavingDraftRows;
    const canDuplicateRows = selectedPersistedRowIndices.length > 0 || contextMenuRow?.kind === 'persisted';
    const canDeleteRows = selectedPersistedRowIndices.length > 0 || selectedDraftIds.length > 0 || Boolean(contextMenuRow);

    const closeContextMenu = React.useCallback(() => {
        setContextMenu(null);
    }, []);

    const getEffectiveSelection = React.useCallback(() => {
        if (selectedCells.size > 0) return selectedCells;
        if (!contextMenu?.cellId) return new Set<string>();
        return new Set([contextMenu.cellId]);
    }, [contextMenu?.cellId, selectedCells]);

    const handleCellContextMenu = React.useCallback((payload: ResultCellContextMenuPayload) => {
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
            displayRows,
            rowOrder,
            editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }

        void setClipboardText(matrixToTsv(matrix))
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, displayRows, editedCells, getEffectiveSelection, rowOrder, toast]);

    const handleContextCopyCellValue = React.useCallback(() => {
        if (!contextMenu) {
            closeContextMenu();
            return;
        }
        const { rowKey, colIdx } = contextMenu;
        const row = displayRowsByKey.get(rowKey);
        let value = '';
        if (row) {
            if (row.kind === 'persisted') {
                value = editedCells.get(`${row.persistedIndex}:${colIdx}`) ?? row.values[colIdx] ?? '';
            } else {
                value = row.values[colIdx] ?? '';
            }
        }
        void setClipboardText(value)
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, contextMenu, displayRowsByKey, editedCells, toast]);

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
            displayRows,
            rowOrder,
            editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }
        const colRange = getSelectionColumnRange(effectiveSelection);
        const columns = result?.columns ?? [];
        const headers = colRange ? columns.slice(colRange.minCol, colRange.maxCol + 1) : [];
        void setClipboardText(matrixToTsv([headers, ...matrix]))
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, displayRows, editedCells, getEffectiveSelection, getSelectionColumnRange, result?.columns, rowOrder, toast]);

    const handleContextCopyAsJson = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) {
            toast.info('Select at least one cell to copy.');
            closeContextMenu();
            return;
        }
        const matrix = buildSelectionMatrix({
            selectedCells: effectiveSelection,
            displayRows,
            rowOrder,
            editedCells,
        });
        if (matrix.length === 0) {
            toast.info('No copyable cells in current selection.');
            closeContextMenu();
            return;
        }
        const colRange = getSelectionColumnRange(effectiveSelection);
        const columns = result?.columns ?? [];
        const headers = colRange ? columns.slice(colRange.minCol, colRange.maxCol + 1) : [];
        const jsonRows = matrix.map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((col, i) => { obj[col] = row[i] ?? ''; });
            return obj;
        });
        void setClipboardText(JSON.stringify(jsonRows, null, 2))
            .catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [closeContextMenu, displayRows, editedCells, getEffectiveSelection, getSelectionColumnRange, result?.columns, rowOrder, toast]);

    const handleContextCopyAsInsert = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) { toast.info('Select at least one cell to copy.'); closeContextMenu(); return; }
        const columns = result?.columns ?? [];
        const tableName = result?.tableName ?? 'table_name';
        const sql = buildRowsAsInsertStatements({
            selectedCells: effectiveSelection, displayRows, rowOrder, editedCells, columns, tableName, driver,
        });
        if (!sql) { toast.info('No copyable cells in current selection.'); closeContextMenu(); return; }
        void setClipboardText(sql).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [driver, closeContextMenu, displayRows, editedCells, getEffectiveSelection, result?.columns, result?.tableName, rowOrder, toast]);

    const handleContextCopyAsUpdate = React.useCallback(() => {
        const effectiveSelection = getEffectiveSelection();
        if (effectiveSelection.size === 0) { toast.info('Select at least one cell to copy.'); closeContextMenu(); return; }
        const columns = result?.columns ?? [];
        const tableName = result?.tableName ?? 'table_name';
        const pkColumns = columnDefsByName
            ? Array.from(columnDefsByName.values()).filter((c) => c.IsPrimaryKey).map((c) => c.Name)
            : [];
        const sql = buildRowAsUpdateStatement({
            selectedCells: effectiveSelection, displayRows, rowOrder, editedCells, columns, pkColumns, tableName, driver,
        });
        if (!sql) { toast.info('No copyable cells in current selection.'); closeContextMenu(); return; }
        void setClipboardText(sql).catch(() => toast.error('Failed to write to clipboard'));
        closeContextMenu();
    }, [driver, closeContextMenu, columnDefsByName, displayRows, editedCells, getEffectiveSelection, result?.columns, result?.tableName, rowOrder, toast]);

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
                    displayRows,
                    rowOrder,
                    editedCells,
                    draftRows,
                    deletedRows,
                    columnCount: result?.columns.length || 0,
                });
                if (!pasteResult) {
                    toast.info('Clipboard data is empty or cannot be pasted here.');
                    return;
                }
                setEditedCells(pasteResult.nextEdited);
                setDraftRows(pasteResult.nextDraftRows);
                if (pasteResult.pastedCells.size > 0) {
                    setSelectedCells(pasteResult.pastedCells);
                }
            })
            .catch(() => toast.error('Failed to read from clipboard'));
        closeContextMenu();
    }, [
        canMutateCells,
        closeContextMenu,
        deletedRows,
        displayRows,
        draftRows,
        editedCells,
        getEffectiveSelection,
        result?.columns.length,
        rowOrder,
        setDraftRows,
        setEditedCells,
        setSelectedCells,
        toast,
    ]);

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
            displayRowsByKey,
            editedCells,
            draftRows,
            nullableByColumnIndex,
        });

        if (setNullResult.updatedCount > 0) {
            setEditedCells(setNullResult.nextEdited);
            setDraftRows(setNullResult.nextDraftRows);
            setSelectedCells(setNullResult.updatedCells);
        }

        if (setNullResult.updatedCount === 0 && setNullResult.skippedCount === 0) {
            toast.info('No editable cells in current selection.');
        } else if (setNullResult.updatedCount === 0) {
            toast.info(`Skipped ${setNullResult.skippedCount} non-nullable cell(s).`);
        } else if (setNullResult.skippedCount > 0) {
            toast.info(`Set NULL for ${setNullResult.updatedCount} cell(s), skipped ${setNullResult.skippedCount} non-nullable cell(s).`);
        }

        closeContextMenu();
    }, [
        canMutateCells,
        closeContextMenu,
        displayRowsByKey,
        draftRows,
        editedCells,
        getEffectiveSelection,
        nullableByColumnIndex,
        setDraftRows,
        setEditedCells,
        setSelectedCells,
        toast,
    ]);

    const handleContextDelete = React.useCallback(() => {
        if (!canMutateRows) {
            toast.error('Row actions are unavailable in current mode.');
            closeContextMenu();
            return;
        }

        const targetRowKeys = selectedRowKeys.length > 0
            ? selectedRowKeys
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

        if (targetPersistedIndices.length > 0 && !isEditable) {
            toast.error('Result is read-only. Make sure the query includes the primary key(s).');
            closeContextMenu();
            return;
        }

        if (targetDraftIds.length > 0) {
            removeDraftRows(targetDraftIds);
        }
        if (targetPersistedIndices.length > 0) {
            setDeletedRows((prev) => {
                const next = new Set(prev);
                targetPersistedIndices.forEach((rowIndex) => next.add(rowIndex));
                return next;
            });
        }

        closeContextMenu();
    }, [
        canMutateRows,
        closeContextMenu,
        contextMenu,
        isEditable,
        removeDraftRows,
        selectedRowKeys,
        setDeletedRows,
        toast,
    ]);

    const handleContextDuplicate = React.useCallback(() => {
        if (!canMutateRows) {
            toast.error('Row actions are unavailable in current mode.');
            closeContextMenu();
            return;
        }

        const selectedRowSet = new Set(selectedRowKeys);
        let targetRows = displayRows.filter((row) => row.kind === 'persisted' && selectedRowSet.has(row.key));
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
            values: getPersistedRowValues(row.persistedIndex as number),
            insertAfterRowIndex: lastRow.persistedIndex ?? null,
            sourceRowIndex: row.persistedIndex,
        }));

        setDraftRows((prev) => [...prev, ...duplicated]);
        const firstDraftKey = `d:${duplicated[0].id}`;
        setSelectedCells(new Set([makeCellId(firstDraftKey, 0)]));
        setFocusCellRequest({
            rowKey: firstDraftKey,
            colIdx: 0,
            nonce: Date.now(),
        });
        closeContextMenu();
    }, [
        canMutateRows,
        closeContextMenu,
        contextMenuRow,
        displayRows,
        getPersistedRowValues,
        selectedRowKeys,
        setDraftRows,
        setFocusCellRequest,
        setSelectedCells,
        toast,
    ]);

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
    }, [result?.isDone, result?.lastExecutedQuery]);

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

    // ── Limit selector ────────────────────────────────────────────────────────
    const shouldShowResultFilterBar = Boolean(result?.isSelect) && showResultFilterBar;
    const shouldShowFilterInput = generatedKind !== 'explain';
    const resultFilterBar = result && shouldShowResultFilterBar ? (
        <ResultFilterBar
            key={result.lastExecutedQuery}
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
            className="flex flex-col items-stretch justify-start h-full text-[13px] text-muted-foreground overflow-hidden"
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
                                    onCellContextMenu={handleCellContextMenu}
                                    columnVisibility={columnVisibility}
                                    onColumnVisibilityChange={setColumnVisibility}
                                />
                            )}
                        </div>
                    </div>
                );
            })()}

            {contextMenu && contextMenuPosition && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-panel-overlay min-w-40 rounded-md border border-border bg-background py-1 shadow-lg"
                    style={{ left: contextMenuPosition.left, top: contextMenuPosition.top }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-muted"
                        onClick={handleContextCopyCellValue}
                    >
                        Copy Cell Value
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!hasEditableCellSelection}
                        onClick={handleContextCopy}
                    >
                        Copy (TSV)
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!hasEditableCellSelection}
                        onClick={handleContextCopyWithHeaders}
                    >
                        Copy with Headers
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!hasEditableCellSelection}
                        onClick={handleContextCopyAsJson}
                    >
                        Copy as JSON
                    </Button>
                    {result?.tableName && (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                                disabled={!hasEditableCellSelection}
                                onClick={handleContextCopyAsInsert}
                            >
                                Copy as INSERT
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                                disabled={!hasEditableCellSelection}
                                onClick={handleContextCopyAsUpdate}
                            >
                                Copy as UPDATE
                            </Button>
                        </>
                    )}
                    <div className="my-1 h-px bg-border/70" />
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateCells && hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!canMutateCells || !hasEditableCellSelection}
                        onClick={handleContextSetNull}
                    >
                        Set NULL
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateCells && hasEditableCellSelection ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!canMutateCells || !hasEditableCellSelection}
                        onClick={handleContextPaste}
                    >
                        Paste
                    </Button>
                    <div className="my-1 h-px bg-border/70" />
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateRows && canDeleteRows ? 'text-destructive hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!canMutateRows || !canDeleteRows}
                        onClick={handleContextDelete}
                    >
                        Delete Row
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-3 py-1.5 text-left text-[12px] ${canMutateRows && canDuplicateRows ? 'text-foreground hover:bg-muted' : 'text-muted-foreground cursor-not-allowed'}`}
                        disabled={!canMutateRows || !canDuplicateRows}
                        onClick={handleContextDuplicate}
                    >
                        Duplicate Row
                    </Button>
                </div>
            )}

            {/* Status bar (info only) */}
            <div className="flex items-center justify-center relative px-3 py-1 text-[11px] text-muted-foreground border-t border-border shrink-0">
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
                                {exportJob.label || 'Exporting'} {typeof exportJob.progressPct === 'number' ? `${exportJob.progressPct}%` : 'running...'}
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
                        <Button variant="default" onClick={() => { void handleDirectExecute(); }} title="Execute Changes" autoFocus className="px-6">
                            <Play size={14} className="mr-2" />Execute Changes
                        </Button>
                    </>
                }
            >
                <div>
                    <div className="flex items-start gap-4 mb-4">
                        <div className="shrink-0 p-2 rounded-full bg-accent/10"><AlertCircle size={20} className="text-accent" /></div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground mb-1">Review generated script</p>
                            <p className="text-[12px] leading-relaxed text-muted-foreground">
                                Updates and deletes require confirmation. Pending inserts will be executed together with this script for <strong>{qualifiedTableName || result?.tableName}</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="p-3 bg-muted/50 border border-border/40 rounded-md font-mono text-[11px] max-h-[260px] overflow-y-auto whitespace-pre-wrap text-muted-foreground select-text">
                        {generatePendingScript()}
                    </div>
                </div>
            </Modal>

            {writeSafetyGuard.modals}

            <Modal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                title="Export Options"
                width={920}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowExportModal(false)}>Cancel</Button>
                        <Button variant="default" onClick={handleConfirmExport} autoFocus>Export</Button>
                    </>
                }
            >
                <div className="grid grid-cols-12 gap-4">
                    <section className="col-span-12 lg:col-span-5 space-y-4">
                        <div>
                            <p className="text-[12px] font-semibold text-foreground mb-2">Extraction</p>
                            <RadioGroup
                                value={exportScope}
                                onValueChange={(value) => setExportScope(value as 'all' | 'view')}
                                className="gap-2"
                            >
                                <div className="flex items-center gap-2 text-[12px] text-foreground">
                                    <RadioGroupItem value="all" id="export_scope_all" />
                                    <Label htmlFor="export_scope_all" className="text-[12px] font-normal text-foreground">
                                        Query the database (no paging)
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-foreground">
                                    <RadioGroupItem value="view" id="export_scope_view" />
                                    <Label htmlFor="export_scope_view" className="text-[12px] font-normal text-foreground">
                                        Use fetched rows (current table view)
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold text-foreground mb-1.5">Format</label>
                            <Select
                                value={exportFormat}
                                onValueChange={(value) => setExportFormat(value as 'csv' | 'json' | 'sql')}
                            >
                                <SelectTrigger className="w-full bg-background text-[13px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="csv">CSV</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                    <SelectItem value="sql">SQL INSERT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {exportFormat === 'sql' && (
                            <div>
                                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Table Name</label>
                                <Input
                                    type="text"
                                    className="h-9 w-full bg-background text-[13px]"
                                    placeholder={result?.tableName || 'my_table'}
                                    value={exportTableName}
                                    onChange={(event) => setExportTableName(event.target.value)}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                    Leave empty to use "{result?.tableName || 'my_table'}"
                                </p>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12px] font-semibold text-foreground">Columns</label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                                    onClick={toggleAllExportColumns}
                                >
                                    {areAllExportColumnsSelected ? 'Clear all' : 'Select all'}
                                </Button>
                            </div>
                            <div className="max-h-44 overflow-auto rounded-md border border-border/50 bg-background p-2 space-y-1">
                                {allExportColumns.map((column) => (
                                    <label key={column} className="flex items-center gap-2 text-[12px] text-foreground">
                                        <Checkbox
                                            checked={selectedExportColumnSet.has(column)}
                                            onCheckedChange={() => toggleExportColumn(column)}
                                        />
                                        <span className="truncate" title={column}>{column}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                                {orderedSelectedExportColumns.length}/{allExportColumns.length} columns selected
                            </p>
                        </div>
                    </section>

                    <section className="col-span-12 lg:col-span-7">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[12px] font-semibold text-foreground">Preview (10 rows)</p>
                            <p className="text-[11px] text-muted-foreground">
                                Showing loaded rows preview only
                            </p>
                        </div>
                        <div className="rounded-md border border-border/50 bg-background overflow-auto max-h-[360px]">
                            {orderedSelectedExportColumns.length === 0 ? (
                                <div className="px-3 py-8 text-[12px] text-muted-foreground text-center">
                                    Select at least one column to preview.
                                </div>
                            ) : previewExportRows.length === 0 ? (
                                <div className="px-3 py-8 text-[12px] text-muted-foreground text-center">
                                    No loaded rows to preview.
                                </div>
                            ) : (
                                <table className="w-full text-[11px] border-collapse">
                                    <thead className="sticky top-0 bg-card">
                                        <tr>
                                            {orderedSelectedExportColumns.map((column) => (
                                                <th key={column} className="text-left px-2 py-1.5 border-b border-border/60 whitespace-nowrap">
                                                    {column}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewExportRows.map((row, rowIdx) => (
                                            <tr key={`preview_${rowIdx}`} className="odd:bg-background even:bg-card/30">
                                                {row.map((cell, cellIdx) => (
                                                    <td key={`preview_${rowIdx}_${cellIdx}`} className="px-2 py-1.5 border-b border-border/20 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>
            </Modal>
        </div>
    );
};
