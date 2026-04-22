import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cx from 'classnames';
import {
    Database,
    FileCode2,
    Info,
    KeyRound,
    Network,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Table2,
    Trash2,
} from 'lucide-react';
import {
    AddTableColumn,
    AlterTableColumn,
    CreateTable,
    DropTableColumn,
    FetchDatabaseSchema,
    FetchTableColumns,
} from '../../../services/schemaService';
import { ExecuteQuery } from '../../../services/queryService';
import { models } from '../../../../wailsjs/go/models';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useResultStore } from '../../../stores/resultStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { getTypesForDriver } from '../../../lib/dbTypes';
import { buildFilterOrderQuery } from '../../../lib/queryBuilder';
import { Button, Input, Tabs, TabsList, TabsTrigger } from '../../ui';
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
import { parseTableTarget } from '../../../lib/tableTargets';
import { DOM_EVENT } from '../../../lib/constants';
import { emitCommand, onCommand } from '../../../lib/commandBus';

import { SchemaInfoView } from './SchemaInfoView';
import { DataExplorerView } from './DataExplorerView';
import { RelationshipView } from './RelationshipView';
import { DDLInfoView } from './DDLInfoView';
import { KeysView } from './KeysView';
import { TableSchemaBreadcrumb } from './TableSchemaBreadcrumb';
import { RowState, TableInfoTab, SortCol, SortDir, TabAction } from './types';
import { getColumnsDirtyCount, getDataDirtyCount } from './changeBadge';

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
            onClick={() => {
                const res = action.onClick?.();
                if (res instanceof Promise) res.catch(() => {});
            }}
            disabled={action.disabled || action.loading}
            title={action.title || action.label}
            className={cx(
                'h-7 w-7 rounded-sm p-0',
                action.danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : '',
            )}
        >
            {action.icon}
        </Button>
    );
};

const TABLE_INFO_AUTO_RETRY_DELAYS_MS = [250, 500, 900, 1300, 1700, 2200];
const TABLE_INFO_AUTO_RETRY_MAX_ATTEMPTS = 10;
const TABLE_TAB_ICON_SIZE = 13;
const TABLE_TAB_BADGE_CLASSNAME = 'absolute right-0 top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-600 px-0.5 text-[9px] font-semibold leading-none text-white';

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
    const createNameInputRef = useRef<HTMLInputElement>(null);
    const createNameAutoSelectedRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dataTabActions, setDataTabActions] = useState<TabAction[]>([]);
    const [keysDirtyCount, setKeysDirtyCount] = useState(0);
    const [ddlTabActions, setDdlTabActions] = useState<TabAction[]>([]);
    const [pendingOpenExport, setPendingOpenExport] = useState(false);
    const [erdRefreshKey, setErdRefreshKey] = useState(0);
    const prevConnRef = useRef<string>('');
    const autoRetryTimerRef = useRef<number | null>(null);
    const autoRetryAttemptRef = useRef(0);
    const autoRetryConnectionRef = useRef('');
    const latestLoadRequestRef = useRef(0);
    const filterTabs = useMemo<Set<TableInfoTab>>(() => new Set(['columns']), []);

    const { activeProfile, isConnected } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);
    const { activeGroupId, groups, addTab } = useEditorStore();
    const driver = activeProfile?.driver ?? 'sqlserver';
    const types = getTypesForDriver(driver);
    const target = useMemo(() => parseTableTarget(tableName), [tableName]);
    const { schema, table } = target;
    const [isCreateMode, setIsCreateMode] = useState(target.isCreateDraft);
    const [draftTableName, setDraftTableName] = useState(target.table || 'new_table');

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
    const clearAutoRetryTimer = useCallback(() => {
        if (autoRetryTimerRef.current !== null) {
            window.clearTimeout(autoRetryTimerRef.current);
            autoRetryTimerRef.current = null;
        }
    }, []);
    const handleErdCountChange = useCallback((_count: number | null) => {}, []);

    useEffect(() => {
        setIsCreateMode(target.isCreateDraft);
    }, [target.isCreateDraft]);

    useEffect(() => {
        setDraftTableName(target.table || 'new_table');
    }, [target.table]);

    useEffect(() => {
        if (!isCreateMode) {
            createNameAutoSelectedRef.current = false;
            return;
        }
        if (!isTableTabActive || createNameAutoSelectedRef.current) return;

        const timer = window.setTimeout(() => {
            const input = createNameInputRef.current;
            if (!input) return;
            input.focus();
            input.select();
            createNameAutoSelectedRef.current = true;
        }, 0);

        return () => window.clearTimeout(timer);
    }, [isCreateMode, isTableTabActive]);

    useEffect(() => {
        if (isCreateMode && activeTab !== 'columns') {
            setActiveTab('columns');
        }
    }, [activeTab, isCreateMode]);

    const loadInfo = useCallback(async (silent = false) => {
        if (isCreateMode) {
            setLoading(false);
            setReloading(false);
            setFetchError(null);
            setRows((prev) => {
                if (prev.length > 0) return prev;
                const defaultIdType = driver === 'postgres'
                    ? 'SERIAL'
                    : driver === 'sqlite'
                        ? 'INTEGER'
                        : 'INT';
                const initialColumn: models.ColumnDef = {
                    Name: 'id',
                    DataType: defaultIdType,
                    DefaultValue: '',
                    IsNullable: false,
                    IsPrimaryKey: true,
                };
                return [{
                    id: 'new-id',
                    original: { ...initialColumn },
                    current: { ...initialColumn },
                    deleted: false,
                    isNew: true,
                }];
            });
            setRowErrors({});
            return;
        }

        const requestId = latestLoadRequestRef.current + 1;
        latestLoadRequestRef.current = requestId;

        try {
            if (silent) setReloading(true);
            else setLoading(true);
            if (!silent) setFetchError(null);
            const cols = await FetchTableColumns(schema, table);
            if (latestLoadRequestRef.current != requestId) return;
            const rs: RowState[] = (cols || []).map((c, i) => ({
                id: `col-${i}-${c.Name}`,
                original: { ...c },
                current: { ...c },
                deleted: false,
            }));
            setRows(rs);
            setRowErrors({});
            setFetchError(null);
        } catch (error: unknown) {
            if (latestLoadRequestRef.current != requestId) return;
            setFetchError(getErrorMessage(error));
        } finally {
            if (latestLoadRequestRef.current != requestId) return;
            setLoading(false);
            setReloading(false);
        }
    }, [driver, isCreateMode, schema, table]);

    const loadData = useCallback(async (filter = '', orderByExpr = '', filterBaseQuery?: string) => {
        if (isCreateMode) return;
        if (!activeGroupId) return;
        const canonicalBaseQuery = `SELECT * FROM "${schema}"."${table}"`;
        const providedBaseQuery = (filterBaseQuery || '').trim();
        const baseQuery = providedBaseQuery || canonicalBaseQuery;
        const query = buildFilterOrderQuery(baseQuery, filter, orderByExpr);
        useResultStore.getState().setLastExecutedQuery(dataTabId, canonicalBaseQuery);
        ExecuteQuery(dataTabId, query).catch(console.error);
    }, [isCreateMode, schema, table, activeGroupId, dataTabId]);

    useEffect(() => {
        if (activeTab === 'data' && !dataResult) loadData();
    }, [activeTab, dataResult, loadData]);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_TABLE_EXPORT, (detail) => {
            if (!detail || detail.tableTabId !== tabId) return;
            setActiveTab('data');
            setPendingOpenExport(true);
            if (!dataResult) {
                void loadData();
            }
        });
        return off;
    }, [dataResult, dataTabId, loadData, tabId]);

    useEffect(() => {
        if (!pendingOpenExport) return;
        if (activeTab !== 'data') return;
        const timer = window.setTimeout(() => {
            emitCommand(DOM_EVENT.OPEN_RESULT_EXPORT, { tabId: dataTabId });
            setPendingOpenExport(false);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [activeTab, dataTabId, pendingOpenExport]);

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
        keys: () => setInfoRefreshKey((k) => k + 1),
        ddl: () => setInfoRefreshKey((k) => k + 1),
    }), [loadInfo, loadData, loadErd]);

    useEffect(() => { loadInfo(); }, [loadInfo]);
    useEffect(() => () => {
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

        if (isCreateMode) {
            if (!activeProfile?.name) {
                toast.error('No active connection');
                return;
            }
            const nextTableName = draftTableName.trim();
            if (!schema || !nextTableName) {
                toast.error('Invalid table target');
                return;
            }
            const nextQualifiedName = `${schema}.${nextTableName}`;

            const createColumns = rows
                .filter((row) => !row.deleted)
                .map((row) => row.current)
                .filter((column) => column.Name.trim().length > 0);

            if (createColumns.length === 0) {
                toast.error('At least one column is required');
                return;
            }

            setSaving(true);
            try {
                await CreateTable(activeProfile.name, schema, nextTableName, createColumns);
                if (activeProfile.db_name) {
                    await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
                }
                addTab({
                    id: tabId,
                    type: 'table',
                    name: nextQualifiedName,
                    content: nextQualifiedName,
                    query: '',
                });
                setIsCreateMode(false);
                toast.success(`Table "${nextQualifiedName}" created successfully`);
            } catch (error: unknown) {
                toast.error(getErrorMessage(error));
            } finally {
                setSaving(false);
            }
            return;
        }

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
    }, [activeProfile?.db_name, activeProfile?.name, addTab, draftTableName, isCreateMode, loadInfo, rows, schema, tabId, toast, viewMode]);

    const collectWriteOperations = useCallback((): WriteOperationKind[] => {
        if (isCreateMode) {
            return ['create'];
        }
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
    }, [isCreateMode, rows]);

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
        if (isCreateMode) {
            await confirmSafetyAndSave();
            return;
        }
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
    }, [rows, collectWriteOperations, activeEnvironmentKey, confirmSafetyAndSave, isCreateMode, viewMode]);

    const columnsDirtyCount = useMemo(() => getColumnsDirtyCount(rows), [rows]);
    const hasChanges = columnsDirtyCount > 0;

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
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
                if (isCreateMode) return;
                if (!filterTabs.has(activeTab)) return;
                const activeEl = document.activeElement;
                if (activeEl?.closest('.sidebar')) return;
                e.preventDefault();
                setTimeout(() => filterInputRef.current?.focus(), 10);
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [groups, activeGroupId, tabId, activeTab, tabReload, hasChanges, isCreateMode, saving, saveAll, viewMode, filterTabs]);

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

    const dataDirtyCount = useMemo(() => getDataDirtyCount(dataResult), [dataResult]);
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
                ...(!viewMode ? [{
                    id: 'save',
                    icon: <Save size={12} />,
                    label: isCreateMode ? 'Create Table' : 'Save Change',
                    title: isCreateMode ? 'Create Table' : 'Save Change',
                    onClick: saveAll,
                    disabled: saving,
                    loading: saving,
                }] : []),
            ] : []),
            reloadAction,
        ],
        data: [...dataTabActions, reloadAction],
        erd: [reloadAction],
        keys: [reloadAction],
        ddl: [...ddlTabActions, reloadAction],
    };

    const tabs: Array<{ key: TableInfoTab; label: string; icon: React.ReactNode; dirtyCount?: number; count?: number | null }> = useMemo(() => {
        if (isCreateMode) {
            return [{ key: 'columns', label: 'Columns', icon: <Table2 size={TABLE_TAB_ICON_SIZE} />, dirtyCount: columnsDirtyCount }];
        }
        return [
            { key: 'columns', label: 'Columns', icon: <Table2 size={TABLE_TAB_ICON_SIZE} />, dirtyCount: columnsDirtyCount },
            { key: 'data', label: 'Data', icon: <Database size={TABLE_TAB_ICON_SIZE} />, dirtyCount: dataDirtyCount },
            { key: 'erd', label: 'Erd', icon: <Network size={TABLE_TAB_ICON_SIZE} /> },
            { key: 'keys', label: 'Keys', icon: <KeyRound size={TABLE_TAB_ICON_SIZE} />, dirtyCount: keysDirtyCount },
            { key: 'ddl', label: 'DDL', icon: <FileCode2 size={TABLE_TAB_ICON_SIZE} /> },
        ];
    }, [columnsDirtyCount, dataDirtyCount, keysDirtyCount, isCreateMode]);

    const handleSelectTableFromBreadcrumb = useCallback((nextTableName: string) => {
        const normalized = nextTableName.trim();
        if (!normalized || normalized === table) return;
        const nextQualifiedName = schema ? `${schema}.${normalized}` : normalized;
        addTab({
            type: 'table',
            name: nextQualifiedName,
            content: nextQualifiedName,
            query: '',
        });
    }, [addTab, schema, table]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 h-full bg-background">
                <Table2 size={24} className="text-accent" />
                <span className="text-sm text-muted-foreground font-medium">Fetching table schema...</span>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full bg-background text-center">
                <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-6">
                    <Info size={32} className="text-error" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Failed to load table</h2>
                <p className="text-muted-foreground max-w-md mb-8">{fetchError}</p>
                <Button onClick={() => loadInfo()} variant="secondary" className="rounded-sm px-8">Try Again</Button>
            </div>
        );
    }

    return (
        <div ref={containerRef} tabIndex={-1} className="flex flex-col h-full overflow-hidden bg-background outline-none">
            <div className="shrink-0 px-4 bg-background grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <div className="min-w-0 overflow-x-auto whitespace-nowrap">
                    <TableSchemaBreadcrumb
                        dbName={activeProfile?.db_name || ''}
                        schema={schema}
                        table={table}
                        onSelectTable={handleSelectTableFromBreadcrumb}
                        isCreateMode={isCreateMode}
                        draftTableName={draftTableName}
                        onDraftTableNameChange={setDraftTableName}
                        onDraftTableNameReset={() => setDraftTableName(target.table || 'new_table')}
                        tableInputRef={createNameInputRef}
                    />
                </div>

                <div className="justify-self-center flex items-center min-w-0">
                    <Tabs
                        value={activeTab}
                        onValueChange={(value) => {
                            setActiveTab(value as TableInfoTab);
                            setFilterCol('');
                        }}
                        className="min-w-0"
                    >
                        <TabsList className="h-9 w-full justify-start gap-0 p-0 bg-transparent">
                            {tabs.map(({ key, label, icon, dirtyCount, count }) => {
                                const dirtyBadgeCount = typeof dirtyCount === 'number' && dirtyCount > 0 ? dirtyCount : null;
                                const badgeValue = count ?? dirtyBadgeCount;
                                const title = count !== undefined && count !== null
                                    ? `${label} (${count})`
                                    : (dirtyCount ?? 0) > 0
                                        ? `${label} (${dirtyCount} unsaved)`
                                        : label;
                                return (
                                    <TabsTrigger
                                        key={key}
                                        value={key}
                                        title={title}
                                        aria-label={label}
                                        className="relative h-8 my-1 rounded-sm cursor-pointer bg-transparent px-2.5 text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                                    >
                                        {icon}
                                        {typeof badgeValue === 'number' && badgeValue > 0 && (
                                            <span className={TABLE_TAB_BADGE_CLASSNAME}>
                                                {badgeValue}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </Tabs>
                </div>

                <div className="min-w-0 justify-self-end flex items-center gap-1">
                    {actionsByTab[activeTab].map((action) => (
                        <ToolbarButton key={action.id} action={action} />
                    ))}

                    {!isCreateMode && filterTabs.has(activeTab) && (
                        <div className="relative group flex items-center w-[180px] min-w-[180px]">
                            <Search size={11} className="absolute left-3 text-muted-foreground group-focus-within:text-accent" />
                            <Input
                                ref={filterInputRef}
                                type="text"
                                placeholder="Filter columns..."
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
                                size="sm"
                                variant="ghost"
                                className="w-full border-border/30 pl-8 pr-3 placeholder:text-muted-foreground/40"
                            />
                        </div>
                    )}
                </div>
            </div>

            <main className="flex-1 flex flex-col min-h-0 relative">
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
                    <RelationshipView schema={schema} table={table} refreshKey={erdRefreshKey} onCountChange={handleErdCountChange} />
                )}

                {/* Always rendered to preserve batch-edit state across tab switches */}
                <div className={`flex-1 min-h-0 overflow-hidden flex-col ${activeTab === 'keys' ? 'flex' : 'hidden'}`}>
                    <KeysView
                        schema={schema}
                        tableName={table}
                        refreshKey={infoRefreshKey}
                        readOnlyMode={viewMode}
                        isActive={activeTab === 'keys'}
                        tableColumns={rows.map((r) => r.current.Name)}
                        onDirtyCountChange={setKeysDirtyCount}
                        driver={activeProfile?.driver}
                    />
                </div>

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
                variant="destructive"
            />
            {writeSafetyGuard.modals}
        </div>
    );
};
