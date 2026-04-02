import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cx from 'classnames';
import {
    Database,
    FileCode2,
    Hash,
    Info,
    Loader,
    Network,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Table2,
    Trash2,
} from 'lucide-react';
import { FetchTableColumns, AlterTableColumn, AddTableColumn, DropTableColumn } from '../../../services/schemaService';
import { ExecuteQuery } from '../../../services/queryService';
import { models } from '../../../../wailsjs/go/models';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useResultStore } from '../../../stores/resultStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { getTypesForDriver } from '../../../lib/dbTypes';
import { buildFilterQuery } from '../../../lib/queryBuilder';
import { Button, Spinner } from '../../ui';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { getErrorMessage } from '../../../lib/errors';
import { useToast } from '../../layout/Toast';
import {
    analyzeOperationRisk,
    evaluateWriteSafetyDecision,
    type WriteOperationKind,
} from '../../../features/query/writeSafety';
import { useWriteSafetyGuard } from '../../../features/query/useWriteSafetyGuard';
import { resolveQueryPolicy } from '../../../features/query/policy';

import { SchemaInfoView } from './SchemaInfoView';
import { DataExplorerView } from './DataExplorerView';
import { RelationshipView } from './RelationshipView';
import { IndexInfoView } from './IndexInfoView';
import { DDLInfoView } from './DDLInfoView';
import { RowState, TableInfoTab, SortCol, SortDir, TabAction } from './types';

interface TableInfoProps {
    tabId: string;
    tableName: string;
}

const ToolbarButton: React.FC<{ action: TabAction }> = ({ action }) => {
    if (action.render) return <>{action.render()}</>;
    if (!action.onClick || !action.icon) return null;
    return (
        <Button
            variant="ghost"
            size="icon"
            danger={action.danger}
            onClick={() => {
                const res = action.onClick?.();
                if (res instanceof Promise) res.catch(() => {});
            }}
            disabled={action.disabled || action.loading}
            title={action.title || action.label}
        >
            {action.loading ? <Spinner size={12} /> : action.icon}
        </Button>
    );
};

function parseTableName(t: string) {
    const parts = t.split('.');
    return parts.length > 1 ? { schema: parts[0], table: parts.slice(1).join('.') } : { schema: '', table: t };
}

const TABLE_INFO_AUTO_RETRY_DELAYS_MS = [250, 500, 900, 1300, 1700, 2200];
const TABLE_INFO_AUTO_RETRY_MAX_ATTEMPTS = 10;

export const TableInfo: React.FC<TableInfoProps> = ({ tabId, tableName }) => {
    const [rows, setRows] = useState<RowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TableInfoTab>('columns');
    const [saving, setSaving] = useState(false);
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
    const [editCell, setEditCell] = useState<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sortCol, setSortCol] = useState<SortCol>('idx');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [filterCol, setFilterCol] = useState('');
    const filterInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dataTabActions, setDataTabActions] = useState<TabAction[]>([]);
    const [indexTabActions, setIndexTabActions] = useState<TabAction[]>([]);
    const [ddlTabActions, setDdlTabActions] = useState<TabAction[]>([]);
    const [erdRelCount, setErdRelCount] = useState<number | null>(null);
    const [erdRefreshKey, setErdRefreshKey] = useState(0);
    const [fadeInContent, setFadeInContent] = useState(false);
    const prevConnRef = useRef<string>('');
    const fadeInTimerRef = useRef<number | null>(null);
    const autoRetryTimerRef = useRef<number | null>(null);
    const autoRetryAttemptRef = useRef(0);
    const autoRetryConnectionRef = useRef('');
    const filterTabs = useMemo<Set<TableInfoTab>>(() => new Set(['columns', 'indexes']), []);

    const { activeProfile, isConnected } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);
    const { activeGroupId, groups } = useEditorStore();
    const driver = activeProfile?.driver ?? 'sqlserver';
    const types = getTypesForDriver(driver);
    const { schema, table } = parseTableName(tableName);

    const dataTabId = `data-${tabId}`;
    const dataResult = useResultStore((s) => s.results[dataTabId]);
    const isTableTabActive = useMemo(() => {
        const activeGroup = groups.find((group) => group.id === activeGroupId);
        return activeGroup?.activeTabId === tabId;
    }, [activeGroupId, groups, tabId]);
    const canAutoRecoverConnectionError = useMemo(() => {
        if (typeof fetchError !== 'string') return false;
        const normalized = fetchError.toLowerCase();
        return [
            'no active connection',
            'database is closed',
            'connection is closed',
            'bad connection',
        ].some((needle) => normalized.includes(needle));
    }, [fetchError]);
    const triggerContentFadeIn = useCallback(() => {
        setFadeInContent(false);
        if (fadeInTimerRef.current !== null) {
            window.clearTimeout(fadeInTimerRef.current);
        }
        fadeInTimerRef.current = window.setTimeout(() => {
            setFadeInContent(true);
            fadeInTimerRef.current = window.setTimeout(() => {
                setFadeInContent(false);
                fadeInTimerRef.current = null;
            }, 260);
        }, 0);
    }, []);
    const clearAutoRetryTimer = useCallback(() => {
        if (autoRetryTimerRef.current !== null) {
            window.clearTimeout(autoRetryTimerRef.current);
            autoRetryTimerRef.current = null;
        }
    }, []);

    const loadInfo = useCallback(async (silent = false) => {
        try {
            if (silent) setReloading(true);
            else setLoading(true);
            if (!silent) setFetchError(null);
            const cols = await FetchTableColumns(schema, table);
            const rs: RowState[] = (cols || []).map((c, i) => ({
                id: `col-${i}-${c.Name}`,
                original: { ...c },
                current: { ...c },
                deleted: false,
            }));
            setRows(rs);
            setRowErrors({});
            setFetchError(null);
            triggerContentFadeIn();
        } catch (error: unknown) {
            setFetchError(getErrorMessage(error));
        } finally {
            setLoading(false);
            setReloading(false);
        }
    }, [schema, table, triggerContentFadeIn]);

    const loadData = useCallback(async (filter?: string) => {
        if (!activeGroupId) return;
        const baseTableQuery = `SELECT * FROM "${schema}"."${table}"`;
        const query = filter?.trim() ? buildFilterQuery(baseTableQuery, filter) : baseTableQuery;
        useResultStore.getState().setLastExecutedQuery(dataTabId, baseTableQuery);
        ExecuteQuery(dataTabId, query).catch(console.error);
    }, [schema, table, activeGroupId, dataTabId]);

    useEffect(() => {
        if (activeTab === 'data' && !dataResult) loadData();
    }, [activeTab, dataResult, loadData]);

    const handleRowMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStartIdx(idx);
        if (e.ctrlKey || e.metaKey) {
            setSelectedRows((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                return next;
            });
        } else if (e.shiftKey && selectedRows.size > 0) {
            const arr = Array.from(selectedRows);
            const start = Math.min(...arr);
            const min = Math.min(start, idx);
            const max = Math.max(start, idx);
            const next = new Set<number>();
            for (let i = min; i <= max; i++) next.add(i);
            setSelectedRows(next);
        } else {
            setSelectedRows(new Set([idx]));
        }
    }, [selectedRows]);

    const handleRowMouseEnter = useCallback((idx: number) => {
        if (!isDragging || dragStartIdx === null) return;
        const min = Math.min(dragStartIdx, idx);
        const max = Math.max(dragStartIdx, idx);
        const next = new Set<number>();
        for (let i = min; i <= max; i++) next.add(i);
        setSelectedRows(next);
    }, [isDragging, dragStartIdx]);

    useEffect(() => {
        const h = () => {
            setIsDragging(false);
            setDragStartIdx(null);
        };
        window.addEventListener('mouseup', h);
        return () => window.removeEventListener('mouseup', h);
    }, []);

    const toggleDeleteRows = useCallback(() => {
        if (viewMode || !selectedRows.size) return;
        setRows((prev) => prev
            .map((r, i) => {
                if (selectedRows.has(i)) {
                    if (r.isNew) return null;
                    return { ...r, deleted: !r.deleted };
                }
                return r;
            })
            .filter(Boolean) as RowState[]);
        setSelectedRows(new Set());
    }, [selectedRows, viewMode]);

    useEffect(() => {
        if (activeTab !== 'columns') return;
        const h = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Delete' || (e.key === 'Backspace' && (e.ctrlKey || e.metaKey))) toggleDeleteRows();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [activeTab, toggleDeleteRows]);

    const loadErd = useCallback(async () => setErdRefreshKey((k) => k + 1), []);
    const [infoRefreshKey, setInfoRefreshKey] = useState(0);
    const tabReload: Record<TableInfoTab, () => void> = useMemo(() => ({
        columns: () => loadInfo(true),
        data: loadData,
        erd: loadErd,
        indexes: () => setInfoRefreshKey((k) => k + 1),
        ddl: () => setInfoRefreshKey((k) => k + 1),
    }), [loadInfo, loadData, loadErd]);

    useEffect(() => { loadInfo(); }, [loadInfo]);
    useEffect(() => () => {
        if (fadeInTimerRef.current !== null) {
            window.clearTimeout(fadeInTimerRef.current);
        }
        clearAutoRetryTimer();
    }, [clearAutoRetryTimer]);
    useEffect(() => {
        const c = `${activeProfile?.name}:${activeProfile?.db_name}`;
        if (prevConnRef.current && c !== prevConnRef.current) tabReload[activeTab]();
        prevConnRef.current = c;
    }, [activeProfile?.name, activeProfile?.db_name, activeTab, tabReload]);
    useEffect(() => {
        if (!canAutoRecoverConnectionError) {
            autoRetryAttemptRef.current = 0;
            autoRetryConnectionRef.current = '';
            clearAutoRetryTimer();
        }
    }, [canAutoRecoverConnectionError, clearAutoRetryTimer]);
    useEffect(() => {
        if (!isConnected || !isTableTabActive) {
            if (!isConnected) {
                autoRetryAttemptRef.current = 0;
                autoRetryConnectionRef.current = '';
            }
            clearAutoRetryTimer();
            return;
        }

        if (!canAutoRecoverConnectionError || loading || reloading) {
            clearAutoRetryTimer();
            return;
        }

        const connectionKey = `${activeProfile?.name || ''}:${activeProfile?.db_name || ''}`;
        if (!connectionKey) return;

        if (autoRetryConnectionRef.current !== connectionKey) {
            autoRetryConnectionRef.current = connectionKey;
            autoRetryAttemptRef.current = 0;
        }

        if (autoRetryAttemptRef.current >= TABLE_INFO_AUTO_RETRY_MAX_ATTEMPTS) return;
        if (autoRetryTimerRef.current !== null) return;

        const delayIdx = Math.min(autoRetryAttemptRef.current, TABLE_INFO_AUTO_RETRY_DELAYS_MS.length - 1);
        const retryDelay = TABLE_INFO_AUTO_RETRY_DELAYS_MS[delayIdx];
        autoRetryTimerRef.current = window.setTimeout(() => {
            autoRetryTimerRef.current = null;
            autoRetryAttemptRef.current += 1;
            void loadInfo(true);
        }, retryDelay);

        return clearAutoRetryTimer;
    }, [
        activeProfile?.db_name,
        activeProfile?.name,
        canAutoRecoverConnectionError,
        clearAutoRetryTimer,
        isConnected,
        isTableTabActive,
        loadInfo,
        loading,
        reloading,
    ]);

    const performSave = useCallback(async () => {
        if (viewMode) return;
        setSaving(true);
        const errs: Record<number, string> = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            try {
                if (r.deleted) await DropTableColumn(schema, table, r.original.Name);
                else if (r.isNew) await AddTableColumn(schema, table, r.current);
                else if (JSON.stringify(r.original) !== JSON.stringify(r.current)) await AlterTableColumn(schema, table, r.original, r.current);
            } catch (error: unknown) {
                errs[i] = getErrorMessage(error);
            }
        }
        setRowErrors(errs);
        if (!Object.keys(errs).length) await loadInfo(true);
        setSaving(false);
    }, [rows, schema, table, loadInfo, viewMode]);

    const collectWriteOperations = useCallback((): WriteOperationKind[] => {
        const operations: WriteOperationKind[] = [];
        rows.forEach((row) => {
            if (row.deleted) {
                operations.push('drop');
                return;
            }
            if (row.isNew) {
                operations.push('create');
                return;
            }
            if (JSON.stringify(row.original) !== JSON.stringify(row.current)) {
                operations.push('alter');
            }
        });
        return operations;
    }, [rows]);

    const confirmSafetyAndSave = useCallback(async () => {
        const operations = collectWriteOperations();
        if (operations.length > 0) {
            const guard = await writeSafetyGuard.guardOperations(operations, 'Apply Table Schema Changes');
            if (!guard.allowed) {
                if (guard.blockedReason) toast.error(guard.blockedReason);
                return;
            }
        }
        await performSave();
    }, [collectWriteOperations, performSave, toast, writeSafetyGuard]);

    const saveAll = useCallback(async () => {
        if (viewMode) return;
        const operations = collectWriteOperations();
        const deletedCount = rows.filter((r) => r.deleted).length;
        if (deletedCount > 0) {
            const policy = resolveQueryPolicy(activeEnvironmentKey || undefined);
            const decision = evaluateWriteSafetyDecision({
                analysis: analyzeOperationRisk(operations),
                actionLabel: 'Apply Table Schema Changes',
                environmentKey: activeEnvironmentKey,
                safetyLevel: policy.safetyLevel,
                strongConfirmFromEnvironment: policy.strongConfirmFromEnvironment,
            });

            if (decision.action === 'allow') {
                setShowDeleteConfirm(true);
                return;
            }
        }
        await confirmSafetyAndSave();
    }, [rows, collectWriteOperations, activeEnvironmentKey, confirmSafetyAndSave, viewMode]);

    const hasChanges = useMemo(() => rows.some((r) => r.isNew || r.deleted || JSON.stringify(r.original) !== JSON.stringify(r.current)), [rows]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const activeGroup = groups.find((g) => g.id === activeGroupId);
            const isTabActive = activeGroup?.activeTabId === tabId;
            if (!isTabActive) return;

            if (e.key === 'F5') {
                e.preventDefault();
                tabReload[activeTab]();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (activeTab === 'columns' && hasChanges && !saving && !viewMode) saveAll();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                if (!filterTabs.has(activeTab)) return;
                const activeEl = document.activeElement;
                if (activeEl?.closest('.sidebar')) return;
                e.preventDefault();
                setTimeout(() => filterInputRef.current?.focus(), 10);
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [groups, activeGroupId, tabId, activeTab, tabReload, hasChanges, saving, saveAll, viewMode, filterTabs]);

    const displayIds = useMemo(() => {
        let rs = rows;
        if (filterCol.trim() !== '') {
            const f = filterCol.trim().toLowerCase();
            rs = rows.filter((r) => r.current.Name.toLowerCase().includes(f));
        }
        if (!sortDir || sortCol === 'idx') return rs.map((r) => r.id);
        return [...rs].sort((a, b) => {
            let av = a.current[sortCol as keyof models.ColumnDef] as string | boolean | number;
            let bv = b.current[sortCol as keyof models.ColumnDef] as string | boolean | number;
            if (typeof av === 'boolean') av = av ? 1 : 0;
            if (typeof bv === 'boolean') bv = bv ? 1 : 0;
            const res = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === 'asc' ? res : -res;
        }).map((r) => r.id);
    }, [rows, filterCol, sortCol, sortDir]);

    const updateRow = (idx: number, patch: Partial<models.ColumnDef>) => {
        if (viewMode) return;
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, current: { ...r.current, ...patch } } : r)));
    };

    const discardRow = (idx: number) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, current: { ...r.original }, deleted: false } : r)));
        setRowErrors((e) => {
            const ne = { ...e };
            delete ne[idx];
            return ne;
        });
    };

    const discardAll = () => {
        setRows((prev) => prev.filter((r) => !r.isNew).map((r) => ({ ...r, current: { ...r.original }, deleted: false })));
        setRowErrors({});
        setSelectedRows(new Set());
    };

    const addColumn = () => {
        if (viewMode) return;
        const newCol: models.ColumnDef = {
            Name: `new_column_${rows.length + 1}`,
            DataType: driver === 'postgres' || driver === 'mysql' ? 'varchar(255)' : 'nvarchar(255)',
            DefaultValue: '',
            IsNullable: true,
            IsPrimaryKey: false,
        };
        setRows((prev) => [...prev, {
            id: `new-${Date.now()}`,
            original: { ...newCol },
            current: { ...newCol },
            deleted: false,
            isNew: true,
        }]);
    };

    const hasDataChanges = (dataResult?.pendingEdits?.size ?? 0) > 0 || (dataResult?.pendingDeletions?.size ?? 0) > 0;
    const reloadAction: TabAction = {
        id: 'reload',
        icon: <RefreshCw size={12} />,
        label: 'Reload',
        title: 'Reload (F5)',
        onClick: tabReload[activeTab],
        loading: reloading,
    };

    const actionsByTab: Record<TableInfoTab, TabAction[]> = {
        columns: [
            ...(viewMode ? [] : [{ id: 'add', icon: <Plus size={12} />, label: 'Add Column', onClick: addColumn, disabled: saving }]),
            ...(!viewMode && selectedRows.size > 0 ? [{ id: 'delete', icon: <Trash2 size={12} />, label: 'Delete', onClick: toggleDeleteRows, disabled: saving, danger: true }] : []),
            ...(hasChanges ? [
                { id: 'discard', icon: <RotateCcw size={12} />, label: 'Discard', onClick: discardAll, disabled: saving, danger: true },
                ...(!viewMode ? [{ id: 'save', icon: <Save size={12} />, label: 'Save Change', onClick: saveAll, disabled: saving, loading: saving }] : []),
            ] : []),
            reloadAction,
        ],
        data: [...dataTabActions, reloadAction],
        erd: [reloadAction],
        indexes: [...indexTabActions, reloadAction],
        ddl: [...ddlTabActions, reloadAction],
    };

    const tabs: Array<{ key: TableInfoTab; label: string; icon: React.ReactNode; isModified: boolean; count?: number | null }> = [
        { key: 'columns', label: 'Columns', icon: <Table2 size={13} />, isModified: hasChanges },
        { key: 'data', label: 'Data', icon: <Database size={13} />, isModified: hasDataChanges },
        { key: 'erd', label: 'Erd', icon: <Network size={13} />, isModified: false, count: erdRelCount },
        { key: 'indexes', label: 'Indexes', icon: <Hash size={13} />, isModified: false },
        { key: 'ddl', label: 'DDL', icon: <FileCode2 size={13} />, isModified: false },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 h-full bg-bg-primary">
                <Loader size={24} className="animate-spin text-accent" />
                <span className="text-sm text-text-secondary font-medium animate-pulse">Fetching table schema...</span>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full bg-bg-primary text-center">
                <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-6">
                    <Info size={32} className="text-error" />
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Failed to load table</h2>
                <p className="text-text-secondary max-w-md mb-8">{fetchError}</p>
                <Button onClick={() => loadInfo()} variant="solid" className="rounded-md px-8">Try Again</Button>
            </div>
        );
    }

    return (
        <div ref={containerRef} tabIndex={-1} className="flex flex-col h-full overflow-hidden bg-bg-primary outline-none">
            <div className="shrink-0 h-10 px-4 border-b border-border/40 bg-bg-primary grid grid-cols-10 items-center gap-2">
                <div className="col-span-4 flex items-center gap-2 min-w-0 overflow-hidden">
                    {tabs.map(({ key, label, icon, isModified, count }) => (
                        <button
                            key={key}
                            onClick={() => {
                                setActiveTab(key);
                                setFilterCol('');
                            }}
                            className={cx(
                                'relative flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer outline-none shrink-0',
                                activeTab === key
                                    ? 'text-text-primary bg-bg-secondary/70'
                                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-secondary/30',
                            )}
                        >
                            <span className={cx(activeTab === key ? 'text-accent' : 'opacity-60')}>{icon}</span>
                            <span className="uppercase tracking-wider">{label}</span>
                            {count !== undefined && count !== null && <span className="text-[10px] opacity-55">{count}</span>}
                            {isModified && <span className="w-1.5 h-1.5 rounded-full bg-success ml-0.5" />}
                        </button>
                    ))}
                </div>

                {filterTabs.has(activeTab) ? (
                    <>
                        <div className="col-span-2 flex items-center justify-center gap-1 min-w-0">
                            {actionsByTab[activeTab].map((action) => (
                                <ToolbarButton key={action.id} action={action} />
                            ))}
                        </div>
                        <div className="col-span-4 flex items-center justify-end min-w-0">
                            <div className="relative group flex items-center w-full max-w-[28rem]">
                                <Search size={11} className="absolute left-3 text-text-muted group-focus-within:text-accent transition-colors" />
                                <input
                                    ref={filterInputRef}
                                    type="text"
                                    placeholder={activeTab === 'columns' ? 'Filter columns...' : 'Filter indexes...'}
                                    value={filterCol}
                                    onChange={(e) => {
                                        if (activeTab === 'columns') {
                                            setSortCol('idx');
                                            setSortDir('asc');
                                        }
                                        setFilterCol(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setFilterCol('');
                                    }}
                                    className="w-full h-7 pl-8 pr-3 bg-bg-tertiary/40 border border-border/30 rounded-md text-[11px] outline-none focus:border-accent/40 focus:bg-bg-tertiary/60 transition-all placeholder:text-text-muted/40"
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="col-span-2" />
                        <div className="col-span-4 flex items-center justify-end gap-1 min-w-0">
                            {actionsByTab[activeTab].map((action) => (
                                <ToolbarButton key={action.id} action={action} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <main className={`flex-1 flex flex-col min-h-0 relative ${fadeInContent ? 'ti-fade-in' : ''}`}>
                {activeTab === 'columns' && (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <SchemaInfoView
                            rows={rows}
                            displayIds={displayIds}
                            types={types}
                            editCell={editCell}
                            setEditCell={setEditCell}
                            onUpdate={updateRow}
                            onDiscard={discardRow}
                            rowErrors={rowErrors}
                            selectedRows={selectedRows}
                            onRowMouseDown={handleRowMouseDown}
                            onRowMouseEnter={handleRowMouseEnter}
                            readOnlyMode={viewMode}
                            sortCol={sortCol}
                            sortDir={sortDir}
                            onSort={(c) => {
                                if (sortCol !== c) {
                                    setSortCol(c);
                                    setSortDir('asc');
                                } else {
                                    setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
                                }
                            }}
                            filterText={filterCol}
                            onFilterChange={setFilterCol}
                            filterInputRef={filterInputRef}
                        />
                    </div>
                )}

                {activeTab === 'data' && (
                    <DataExplorerView
                        tabId={dataTabId}
                        onRun={loadData}
                        result={dataResult}
                        onActionsChange={setDataTabActions}
                        schema={schema}
                        table={table}
                        isReadOnlyMode={viewMode}
                    />
                )}

                {activeTab === 'erd' && (
                    <RelationshipView schema={schema} table={table} refreshKey={erdRefreshKey} onCountChange={setErdRelCount} />
                )}

                {activeTab === 'indexes' && (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <IndexInfoView
                            schema={schema}
                            tableName={table}
                            filterText={filterCol}
                            refreshKey={infoRefreshKey}
                            readOnlyMode={viewMode}
                            onActionsChange={setIndexTabActions}
                        />
                    </div>
                )}

                {activeTab === 'ddl' && (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <DDLInfoView
                            schema={schema}
                            tableName={table}
                            refreshKey={infoRefreshKey}
                            onActionsChange={setDdlTabActions}
                        />
                    </div>
                )}
            </main>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    void confirmSafetyAndSave();
                }}
                title="Confirm Destruction"
                message="Are you sure?"
                description={`You are about to permanently delete ${rows.filter((r) => r.deleted).length} ${rows.filter((r) => r.deleted).length === 1 ? 'column' : 'columns'}. This action cannot be undone.`}
                confirmLabel="Delete Permanently"
                variant="danger"
            />
            {writeSafetyGuard.modals}
        </div>
    );
};
