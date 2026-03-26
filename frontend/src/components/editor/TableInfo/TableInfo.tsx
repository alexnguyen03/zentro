import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import cx from 'classnames';
import { Loader, RotateCcw, Save, RefreshCw, Plus, Trash2, Database, Table, Info, Table2, Network, Search } from 'lucide-react';
import { FetchTableColumns, AlterTableColumn, AddTableColumn, DropTableColumn } from '../../../services/schemaService';
import { ExecuteQuery } from '../../../services/queryService';
import { models } from '../../../../wailsjs/go/models';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useResultStore } from '../../../stores/resultStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { getTypesForDriver } from '../../../lib/dbTypes';
import { buildFilterQuery } from '../../../lib/queryBuilder';
import { DRIVER } from '../../../lib/constants';
import { Button, Spinner } from '../../ui';
import { Modal } from '../../layout/Modal';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { AlertCircle } from 'lucide-react';
import { getErrorMessage } from '../../../lib/errors';

import { SchemaInfoView } from './SchemaInfoView';
import { DataExplorerView } from './DataExplorerView';
import { RelationshipView } from './RelationshipView';
import { IndexInfoView } from './IndexInfoView';
import { DDLInfoView } from './DDLInfoView';
import { RowState, SubTab, SortCol, SortDir, TabAction } from './types';

type InfoTab = 'columns' | 'indexes' | 'ddl';

interface TableInfoProps {
    tabId: string;
    tableName: string;
}

const ToolbarButton: React.FC<{ action: TabAction }> = ({ action }) => (
    <Button
        variant="ghost"
        size="icon"
        danger={action.danger}
        onClick={() => {
            const res = action.onClick();
            if (res instanceof Promise) res.catch(() => {});
        }}
        disabled={action.disabled || action.loading}
        title={action.title || action.label}
    >
        {action.loading ? <Spinner size={12} /> : action.icon}
    </Button>
);

function parseTableName(t: string) {
    const parts = t.split('.');
    return parts.length > 1 ? { schema: parts[0], table: parts.slice(1).join('.') } : { schema: '', table: t };
}

export const TableInfo: React.FC<TableInfoProps> = ({ tabId, tableName }) => {
    // ... states remain same ...
    const [rows, setRows] = useState<RowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('info');
    const [activeInfoTab, setActiveInfoTab] = useState<InfoTab>('columns');
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
    const [erdRelCount, setErdRelCount] = useState<number | null>(null);
    const [erdRefreshKey, setErdRefreshKey] = useState(0);
    const prevConnRef = useRef<string>('');

    const { activeProfile } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const { activeGroupId, groups } = useEditorStore();
    const driver = activeProfile?.driver ?? 'sqlserver';
    const types = getTypesForDriver(driver);
    const { schema, table } = parseTableName(tableName);

    const dataTabId = `data-${tabId}`;
    const dataResult = useResultStore(s => s.results[dataTabId]);

    const loadInfo = useCallback(async (silent = false) => {
        try {
            if (silent) setReloading(true); else setLoading(true);
            setFetchError(null);
            const cols = await FetchTableColumns(schema, table);
            const rs: RowState[] = (cols || []).map((c, i) => ({
                id: `col-${i}-${c.Name}`,
                original: { ...c }, current: { ...c }, deleted: false,
            }));
            setRows(rs);
            setRowErrors({});
        } catch (error: unknown) { setFetchError(getErrorMessage(error)); }
        finally { setLoading(false); setReloading(false); }
    }, [schema, table]);

    const loadData = useCallback(async (filter?: string) => {
        if (!activeGroupId) return;
        const baseTableQuery = `SELECT * FROM "${schema}"."${table}"`;
        const query = filter?.trim() ? buildFilterQuery(baseTableQuery, filter) : baseTableQuery;
        useResultStore.getState().setLastExecutedQuery(dataTabId, baseTableQuery);
        ExecuteQuery(dataTabId, query).catch(console.error);
    }, [schema, table, activeGroupId, dataTabId]);

    useEffect(() => {
        if (activeSubTab === 'data' && !dataResult) loadData();
    }, [activeSubTab, dataResult, loadData]);

    const handleRowMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStartIdx(idx);
        if (e.ctrlKey || e.metaKey) {
            setSelectedRows(prev => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx); else next.add(idx);
                return next;
            });
        } else if (e.shiftKey && selectedRows.size > 0) {
            const arr = Array.from(selectedRows);
            const start = Math.min(...arr);
            const min = Math.min(start, idx), max = Math.max(start, idx);
            const next = new Set<number>();
            for (let i = min; i <= max; i++) next.add(i);
            setSelectedRows(next);
        } else setSelectedRows(new Set([idx]));
    }, [selectedRows]);

    const handleRowMouseEnter = useCallback((idx: number) => {
        if (!isDragging || dragStartIdx === null) return;
        const min = Math.min(dragStartIdx, idx), max = Math.max(dragStartIdx, idx);
        const next = new Set<number>();
        for (let i = min; i <= max; i++) next.add(i);
        setSelectedRows(next);
    }, [isDragging, dragStartIdx]);

    useEffect(() => {
        const h = () => { setIsDragging(false); setDragStartIdx(null); };
        window.addEventListener('mouseup', h);
        return () => window.removeEventListener('mouseup', h);
    }, []);

    const toggleDeleteRows = useCallback(() => {
        if (viewMode) return;
        if (!selectedRows.size) return;
        
        setRows(prev => prev.map((r, i) => {
            if (selectedRows.has(i)) {
                if (r.isNew) return null;
                return { ...r, deleted: !r.deleted };
            }
            return r;
        }).filter(Boolean) as RowState[]);
        setSelectedRows(new Set());
    }, [selectedRows, viewMode]);

    useEffect(() => {
        if (activeSubTab !== 'info') return;
        const h = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Delete' || (e.key === 'Backspace' && (e.ctrlKey || e.metaKey))) toggleDeleteRows();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [activeSubTab, toggleDeleteRows]);

    const loadErd = useCallback(async () => setErdRefreshKey(k => k + 1), []);
    const [infoRefreshKey, setInfoRefreshKey] = useState(0);
    const tabReload: Record<SubTab, () => void> = useMemo(() => ({
        info: () => {
            if (activeInfoTab === 'columns') loadInfo(true);
            else setInfoRefreshKey(k => k + 1);
        },
        data: loadData,
        erd: loadErd
    }), [loadInfo, loadData, loadErd, activeInfoTab]);

    useEffect(() => { loadInfo(); }, [loadInfo]);
    useEffect(() => {
        const c = `${activeProfile?.name}:${activeProfile?.db_name}`;
        if (prevConnRef.current && c !== prevConnRef.current) tabReload[activeSubTab]();
        prevConnRef.current = c;
    }, [activeProfile?.name, activeProfile?.db_name, activeSubTab, tabReload]);

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
            } catch (error: unknown) { errs[i] = getErrorMessage(error); }
        }
        setRowErrors(errs);
        if (!Object.keys(errs).length) await loadInfo(true);
        setSaving(false);
    }, [rows, schema, table, loadInfo, viewMode]);

    const saveAll = useCallback(async () => {
        if (viewMode) return;
        const deletedCount = rows.filter(r => r.deleted).length;
        if (deletedCount > 0) {
            setShowDeleteConfirm(true);
            return;
        }
        await performSave();
    }, [rows, performSave, viewMode]);

    const hasChanges = useMemo(() => rows.some(r => r.isNew || r.deleted || JSON.stringify(r.original) !== JSON.stringify(r.current)), [rows]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const activeGroup = groups.find(g => g.id === activeGroupId);
            const isTabActive = activeGroup?.activeTabId === tabId;
            if (e.key === 'F5' && isTabActive) { e.preventDefault(); tabReload[activeSubTab](); return; }
            
            // Ctrl + S to Save
            if (e.ctrlKey && e.key.toLowerCase() === 's' && isTabActive) {
                e.preventDefault();
                if (activeSubTab === 'info' && hasChanges && !saving && !viewMode) {
                    saveAll();
                }
                return;
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'f' && isTabActive) {
                const activeEl = document.activeElement;
                if (activeEl?.closest('.sidebar')) return;
                e.preventDefault();
                if (activeSubTab !== 'info') setActiveSubTab('info');
                setTimeout(() => filterInputRef.current?.focus(), 10);
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [groups, activeGroupId, tabId, activeSubTab, tabReload, hasChanges, saving, saveAll, viewMode]);

    const displayIds = useMemo(() => {
        let rs = rows;
        if (filterCol.trim() !== '') {
            const f = filterCol.trim().toLowerCase();
            rs = rows.filter(r => r.current.Name.toLowerCase().includes(f));
        }
        if (!sortDir || sortCol === 'idx') return rs.map(r => r.id);
        return [...rs].sort((a, b) => {
            let av = a.current[sortCol as keyof models.ColumnDef] as string | boolean | number;
            let bv = b.current[sortCol as keyof models.ColumnDef] as string | boolean | number;
            if (typeof av === 'boolean') av = av ? 1 : 0;
            if (typeof bv === 'boolean') bv = bv ? 1 : 0;
            const res = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === 'asc' ? res : -res;
        }).map(r => r.id);
    }, [rows, filterCol, sortCol, sortDir]);

    const updateRow = (idx: number, patch: Partial<models.ColumnDef>) => {
        if (viewMode) return;
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, current: { ...r.current, ...patch } } : r));
    };
    const discardRow = (idx: number) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, current: { ...r.original }, deleted: false } : r));
        setRowErrors(e => { const ne = { ...e }; delete ne[idx]; return ne; });
    };
    const discardAll = () => {
        setRows(prev => prev.filter(r => !r.isNew).map(r => ({ ...r, current: { ...r.original }, deleted: false })));
        setRowErrors({});
        setSelectedRows(new Set());
    };
    const addColumn = () => {
        if (viewMode) return;
        const newCol: models.ColumnDef = {
            Name: `new_column_${rows.length + 1}`,
            DataType: driver === 'postgres' || driver === 'mysql' ? 'varchar(255)' : 'nvarchar(255)',
            DefaultValue: '', IsNullable: true, IsPrimaryKey: false,
        };
        setRows(prev => [...prev, { id: `new-${Date.now()}`, original: { ...newCol }, current: { ...newCol }, deleted: false, isNew: true }]);
    };

    const hasDataChanges = (dataResult?.pendingEdits?.size ?? 0) > 0 || (dataResult?.pendingDeletions?.size ?? 0) > 0;
    const reloadAction: TabAction = { id: 'reload', icon: <RefreshCw size={12} />, label: 'Reload', title: 'Reload (F5)', onClick: tabReload[activeSubTab], loading: reloading };

    const actions: Record<SubTab, TabAction[]> = {
        info: [
            ...(activeInfoTab === 'columns' ? [
                ...(viewMode ? [] : [{ id: 'add', icon: <Plus size={12} />, label: 'Add Column', onClick: addColumn, disabled: saving }]),
                ...(!viewMode && selectedRows.size > 0 ? [{ id: 'delete', icon: <Trash2 size={12} />, label: 'Delete', onClick: toggleDeleteRows, disabled: saving, danger: true }] : []),
                ...(hasChanges ? [
                    { id: 'discard', icon: <RotateCcw size={12} />, label: 'Discard', onClick: discardAll, disabled: saving, danger: true },
                    ...(!viewMode ? [
                    { id: 'save', icon: <Save size={12} />, label: 'Save Change', onClick: saveAll, disabled: saving, loading: saving },
                    ] : []),
                ] : []),
            ] : []),
            reloadAction,
        ],
        data: dataTabActions,
        erd: [reloadAction],
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center gap-4 h-full bg-bg-primary">
            <Loader size={24} className="animate-spin text-accent" />
            <span className="text-sm text-text-secondary font-medium animate-pulse">Fetching table schema...</span>
        </div>
    );

    if (fetchError) return (
        <div className="flex flex-col items-center justify-center p-12 h-full bg-bg-primary text-center">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-6"><Info size={32} className="text-error" /></div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Failed to load table</h2>
            <p className="text-text-secondary max-w-md mb-8">{fetchError}</p>
            <Button onClick={() => loadInfo()} variant="solid" className="rounded-xl px-8">Try Again</Button>
        </div>
    );

    return (
        <div ref={containerRef} tabIndex={-1} className="flex flex-col h-full overflow-hidden bg-bg-primary outline-none">
            <header className="shrink-0 px-6 h-11 border-b border-border/40 bg-bg-secondary/20 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-text-muted/60 text-[11px] uppercase tracking-wider select-none">Table</span>
                        {schema && (
                            <span className="text-[10px] font-mono text-text-muted/60 bg-bg-tertiary/50 px-1.5 py-0.5 rounded tracking-tight select-none">
                                {schema}
                            </span>
                        )}
                        <h1 className="text-[14px] font-bold text-text-primary truncate tracking-tight">
                            {table}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-8 h-full">
                    <div className="flex items-center gap-6 h-full">
                        {([
                            { key: 'info', label: 'Info', icon: <Info size={14} />, isModified: hasChanges, count: null },
                            { key: 'data', label: 'Data', icon: <Database size={14} />, isModified: hasDataChanges, count: null },
                            { key: 'erd', label: 'Erd', icon: <Network size={14} />, isModified: false, count: erdRelCount },
                        ] as { key: SubTab; label: string; icon: React.ReactNode; isModified: boolean; count: number | null }[]).map(({ key, label, icon, isModified, count }) => (
                            <button
                                key={key}
                                onClick={() => setActiveSubTab(key)}
                                className={cx(
                                    "relative flex items-center gap-2 h-full text-[11px] font-bold transition-all duration-200 cursor-pointer outline-none",
                                    activeSubTab === key ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                                )}
                            >
                                <span className={cx(activeSubTab === key ? "text-accent" : "opacity-50")}>{icon}</span>
                                <span>{label}</span>
                                {count !== null && <span className="text-[10px] opacity-40 ml-0.5">{count}</span>}
                                {isModified && <span className="w-1.5 h-1.5 rounded-full bg-success ml-1" />}
                                {activeSubTab === key && (
                                    <div className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent rounded-t-full transition-all" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="shrink-0 h-10 px-4 border-b border-border/40 bg-bg-primary flex items-center justify-between">
                {/* LEFT: Actions */}
                <div className="flex items-center gap-1 w-1/3">
                    {actions[activeSubTab].map(action => (
                        <ToolbarButton key={action.id} action={action} />
                    ))}
                </div>

                {/* CENTER: Filter */}
                {activeSubTab === 'info' && (
                    <div className="w-1/3 flex justify-center">
                        <div className="relative group flex items-center w-64 max-w-full">
                            <Search size={11} className="absolute left-3 text-text-muted group-focus-within:text-accent transition-colors" />
                            <input
                                ref={filterInputRef}
                                type="text"
                                placeholder={`Filter ${activeInfoTab}...`}
                                value={filterCol}
                                onChange={(e) => {
                                    setSortCol('idx');
                                    setSortDir('asc');
                                    setFilterCol(e.target.value);
                                }}
                                onKeyDown={(e) => e.key === 'Escape' && setFilterCol('')}
                                className="w-full h-7 pl-8 pr-3 bg-bg-tertiary/40 border border-border/30 rounded-lg text-[11px] outline-none focus:border-accent/40 focus:bg-bg-tertiary/60 transition-all placeholder:text-text-muted/40"
                            />
                        </div>
                    </div>
                )}

                {/* RIGHT: Sub-tabs */}
                <div className="flex items-center justify-end w-1/3 gap-4 h-full">
                    {activeSubTab === 'info' && (
                        <div className="flex items-center gap-4 h-full">
                            {([
                                { key: 'columns', label: 'Columns' },
                                { key: 'indexes', label: 'Indexes' },
                                { key: 'ddl', label: 'DDL' }
                            ] as const).map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => { setActiveInfoTab(key); setFilterCol(''); }}
                                    className={cx(
                                        "relative flex items-center h-full text-[11px] font-bold transition-all duration-200 cursor-pointer outline-none uppercase tracking-wider",
                                        activeInfoTab === key ? "text-accent" : "text-text-muted hover:text-text-secondary"
                                    )}
                                >
                                    <span>{label}</span>
                                    {activeInfoTab === key && (
                                        <div className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent rounded-t-full transition-all" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <main className="flex-1 flex flex-col min-h-0 relative">
                {activeSubTab === 'info' && (
                    <>
                        {activeInfoTab === 'columns' && (
                            <div className="flex-1 overflow-hidden">
                            <SchemaInfoView
                                rows={rows} displayIds={displayIds} types={types} editCell={editCell} setEditCell={setEditCell}
                                onUpdate={updateRow} onDiscard={discardRow} rowErrors={rowErrors} selectedRows={selectedRows}
                                onRowMouseDown={handleRowMouseDown} onRowMouseEnter={handleRowMouseEnter}
                                readOnlyMode={viewMode}
                                sortCol={sortCol} sortDir={sortDir} onSort={c => {
                                    if (sortCol !== c) {
                                        setSortCol(c);
                                        setSortDir('asc');
                                    } else {
                                        setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
                                    }
                                }}
                                filterText={filterCol} onFilterChange={setFilterCol} filterInputRef={filterInputRef}
                            />
                            </div>
                        )}
                        {activeInfoTab === 'indexes' && (
                            <div className="flex-1 overflow-hidden">
                            <IndexInfoView schema={schema} tableName={table} filterText={filterCol} refreshKey={infoRefreshKey} readOnlyMode={viewMode} />
                            </div>
                        )}
                        {activeInfoTab === 'ddl' && (
                            <div className="flex-1 overflow-hidden">
                            <DDLInfoView schema={schema} tableName={table} refreshKey={infoRefreshKey} />
                            </div>
                        )}
                    </>
                )}
                {activeSubTab === 'data' && (
                    <DataExplorerView tabId={dataTabId} onRun={loadData} result={dataResult} onActionsChange={setDataTabActions} schema={schema} table={table} isReadOnlyMode={viewMode} />
                )}
                {activeSubTab === 'erd' && (
                    <RelationshipView schema={schema} table={table} refreshKey={erdRefreshKey} onCountChange={setErdRelCount} />
                )}
            </main>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={performSave}
                title="Confirm Destruction"
                message="Are you sure?"
                description={`You are about to permanently delete ${rows.filter(r => r.deleted).length} ${rows.filter(r => r.deleted).length === 1 ? 'column' : 'columns'}. This action cannot be undone.`}
                confirmLabel="Delete Permanently"
                variant="danger"
            />
        </div>
    );
};


