import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FetchTableColumns, AlterTableColumn, AddTableColumn, ExecuteQuery } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { Loader, Check, X, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, Save, RefreshCw, Search, Plus } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { getTypesForDriver } from '../../lib/dbTypes';
import { buildFilterQuery } from '../../lib/queryBuilder';
import { ResultPanel, type ResultPanelAction } from './ResultPanel';
import { Button, Spinner } from '../ui';

interface TableInfoProps {
    tabId: string;
    tableName: string;
}

type SubTab = 'info' | 'data' | 'erd';
type SortDir = 'asc' | 'desc' | null;
type SortCol = 'idx' | 'Name' | 'DataType' | 'IsPrimaryKey' | 'IsNullable' | 'DefaultValue';

// ── TabAction pattern — extend per sub-tab as needed ───────────
interface TabAction {
    id: string;
    icon: React.ReactNode;
    label?: string;
    title?: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    danger?: boolean;
}

const ToolbarButton: React.FC<{ action: TabAction }> = ({ action }) => (
    <Button
        variant={action.danger ? 'danger' : 'ghost'}
        className="h-[26px] px-2 text-[11px] gap-1.5 rounded-sm"
        onClick={action.onClick}
        disabled={action.disabled || action.loading}
        title={action.title || action.label}
    >
        {action.loading ? <Spinner size={11} /> : action.icon}
        {action.label && <span>{action.label}</span>}
    </Button>
);

interface RowState {
    id: string; // stable dnd id
    original: models.ColumnDef;
    current: models.ColumnDef;
    deleted: boolean;
    isNew?: boolean;
}

function parseTableName(t: string) {
    const parts = t.split('.');
    return parts.length > 1 ? { schema: parts[0], table: parts.slice(1).join('.') } : { schema: '', table: t };
}

function deepEq(a: models.ColumnDef, b: models.ColumnDef) {
    return a.Name === b.Name && a.DataType === b.DataType &&
        a.IsNullable === b.IsNullable && a.IsPrimaryKey === b.IsPrimaryKey &&
        a.DefaultValue === b.DefaultValue;
}

// ── DataTypeCell ──────────────────────────────────────────────
interface DataTypeCellProps {
    value: string;
    types: string[];
    isDirty: boolean;
    disabled: boolean;
    onCommit: (v: string) => void;
}

const DataTypeCell: React.FC<DataTypeCellProps> = ({ value, types, isDirty, disabled, onCommit }) => {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value);
    const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    const filtered = text
        ? types.filter(t => t.toLowerCase().includes(text.toLowerCase()))
        : types;

    useEffect(() => {
        setSelectedIndex(-1);
    }, [text]);

    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const el = listRef.current.children[selectedIndex] as HTMLDivElement;
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    // Close on outside click — must also allow clicks inside the portal dropdown
    useEffect(() => {
        if (!editing) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const insideWrap = wrapRef.current?.contains(target);
            // portal dropdown has data-dtype-drop attribute
            const insideDrop = (target as Element).closest?.('[data-dtype-drop]');
            if (!insideWrap && !insideDrop) commitAndClose(text);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [editing, text]);

    // useLayoutEffect: runs synchronously after DOM paint — guarantees correct rect
    useLayoutEffect(() => {
        if (!editing || !inputRef.current) return;
        const r = inputRef.current.getBoundingClientRect();
        setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 180) });
    }, [editing]);

    const openEditor = () => {
        if (disabled) return;
        setText(value);
        setEditing(true);
    };

    const commitAndClose = (v: string) => {
        const trimmed = v.trim();
        if (trimmed && trimmed !== value) onCommit(trimmed);
        setEditing(false);
        setDropPos(null);
    };

    const closeWithoutCommit = () => {
        setEditing(false);
        setDropPos(null);
    };

    const handleSuggestionClick = (t: string) => {
        setText(t);
        requestAnimationFrame(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
                const r = inputRef.current.getBoundingClientRect();
                setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 180) });
            }
        });
    };

    const dropdown = dropPos && filtered.length > 0
        ? ReactDOM.createPortal(
            <div
                ref={listRef}
                data-dtype-drop
                style={{
                    position: 'fixed',
                    zIndex: 99999,
                    top: dropPos.top,
                    left: dropPos.left,
                    width: dropPos.width,
                    maxHeight: 220,
                    overflowY: 'auto',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    boxShadow: '0 6px 20px rgba(0,0,0,.35)',
                }}
            >
                {filtered.map((t, index) => {
                    const isSelected = index === selectedIndex || (selectedIndex === -1 && t === text);
                    return (
                        <div
                            key={t}
                            onMouseDown={e => { e.preventDefault(); handleSuggestionClick(t); }}
                            className={`px-3 py-1 text-xs font-mono cursor-pointer hover:bg-(--success-color) hover:text-white ${isSelected ? 'bg-(--success-color) text-white' : 'text-(--text-primary)'}`}
                        >
                            {t}
                        </div>
                    );
                })}
            </div>,
            document.body
        )
        : null;

    if (!editing) {
        return (
            <div
                className={`rt-cell-content font-mono text-[11.5px] cursor-default select-none ${isDirty ? 'text-(--success-color)' : ''}`}
                onDoubleClick={openEditor}
                title={`${value} (double-click to edit)`}
            >
                {value}
            </div>
        );
    }

    return (
        <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <input
                ref={inputRef}
                autoFocus
                onFocus={(e) => e.target.select()}
                className="rt-cell-input font-mono"
                value={text}
                onChange={e => { setText(e.target.value); }}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filtered.length > 0) {
                            setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filtered.length > 0) {
                            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
                        }
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedIndex >= 0 && selectedIndex < filtered.length) {
                            handleSuggestionClick(filtered[selectedIndex]);
                        } else {
                            commitAndClose(text);
                        }
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeWithoutCommit();
                    } else if (e.key === 'Tab') {
                        commitAndClose(text);
                    }
                }}
                onBlur={() => { setTimeout(() => commitAndClose(text), 150); }}
            />
            {dropdown}
        </div>
    );
};

// ── Row ────────────────────────────────────────────────────────
interface RowProps {
    row: RowState;
    rowIdx: number;
    displayIdx: number;
    types: string[];
    editCell: { rowIdx: number; field: 'Name' | 'DefaultValue' } | null;
    setEditCell: React.Dispatch<React.SetStateAction<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>>;
    onUpdate: (rowIdx: number, patch: Partial<models.ColumnDef>) => void;
    onDiscard: (rowIdx: number) => void;
    rowError: string | undefined;
}

const Row: React.FC<RowProps> = ({
    row, rowIdx, displayIdx, types, editCell, setEditCell, onUpdate, onDiscard, rowError
}) => {
    const col = row.current;
    const isDeleted = row.deleted;
    const isNew = row.isNew;
    const isDirty = !isDeleted && !isNew && !deepEq(row.original, row.current);

    const style: React.CSSProperties = {
        opacity: isDeleted ? 0.55 : 1,
        background: isDeleted
            ? 'rgba(220,38,38,.08)'
            : isNew
                ? 'rgba(34,197,94,.08)'
                : isDirty
                    ? 'rgba(var(--accent-rgb,99,102,241),.09)'
                    : displayIdx % 2 === 1 ? 'var(--bg-secondary)' : undefined,
    };

    const td: React.CSSProperties = {
        padding: 0,
        height: 30,
        verticalAlign: 'middle',
    };

    return (
        <>
            <tr style={style}>
                {/* # — double-click to discard changes */}
                <td
                    style={{
                        ...td,
                        width: 36,
                        textAlign: 'center',
                        fontSize: 11,
                        color: (isDirty || isDeleted) ? 'var(--error-color)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                    onDoubleClick={() => (isDirty || isDeleted) && onDiscard(rowIdx)}
                    title={(isDirty || isDeleted) ? 'Double-click to discard changes' : undefined}
                >
                    {rowIdx + 1}
                </td>

                {/* Name */}
                <td style={{ ...td }}>
                    {editCell?.rowIdx === rowIdx && editCell.field === 'Name' ? (
                        <input
                            autoFocus
                            onFocus={e => e.target.select()}
                            className="rt-cell-input"
                            defaultValue={col.Name}
                            onBlur={e => { onUpdate(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                            }}
                        />
                    ) : (
                        <div
                            className={`rt-cell-content cursor-text ${isDirty && col.Name !== row.original.Name ? 'text-(--success-color) font-semibold' : col.IsPrimaryKey ? 'font-semibold' : ''}`}
                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'Name' })}
                            title={col.Name}
                        >
                            {col.Name}
                        </div>
                    )}
                </td>

                {/* DataType */}
                <td style={{ ...td }}>
                    <DataTypeCell
                        value={col.DataType}
                        types={types}
                        isDirty={col.DataType !== row.original.DataType}
                        disabled={isDeleted}
                        onCommit={v => onUpdate(rowIdx, { DataType: v })}
                    />
                </td>

                {/* PK */}
                <td style={{ ...td, width: 44, textAlign: 'center' }}>
                    <input type="checkbox" checked={col.IsPrimaryKey} disabled={isDeleted}
                        onChange={e => onUpdate(rowIdx, { IsPrimaryKey: e.target.checked })}
                        style={{ cursor: isDeleted ? 'default' : 'pointer', accentColor: 'var(--success-color)' }} />
                </td>

                {/* Nullable */}
                <td style={{ ...td, width: 70, textAlign: 'center' }}>
                    <input type="checkbox" checked={col.IsNullable} disabled={isDeleted}
                        onChange={e => onUpdate(rowIdx, { IsNullable: e.target.checked })}
                        style={{ cursor: isDeleted ? 'default' : 'pointer', accentColor: 'var(--success-color)' }} />
                </td>

                {/* Default */}
                <td style={{ ...td }}>
                    {isDeleted
                        ? <div className="rt-cell-content text-(--text-secondary)">{col.DefaultValue || '–'}</div>
                        : editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue'
                            ? <input autoFocus onFocus={e => e.target.select()} className="rt-cell-input"
                                defaultValue={col.DefaultValue}
                                onBlur={e => { onUpdate(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditCell(null);
                                }} />
                            : <div
                                className={`rt-cell-content cursor-text ${col.DefaultValue ? '' : 'text-(--text-secondary)'} ${isDirty && col.DefaultValue !== row.original.DefaultValue ? 'text-(--success-color)' : ''}`}
                                onDoubleClick={() => setEditCell({ rowIdx, field: 'DefaultValue' })}
                                title={col.DefaultValue || 'none'}
                            >
                                {col.DefaultValue || '–'}
                            </div>
                    }
                </td>

            </tr>
            {rowError && (
                <tr style={{ background: 'rgba(220,38,38,.06)' }}>
                    <td colSpan={6} style={{ padding: '3px 12px', color: 'var(--error-color)', fontSize: 11, borderBottom: '1px solid var(--border-color)' }}>
                        ⚠ {rowError}
                    </td>
                </tr>
            )}
        </>
    );
};

// ── Main TableInfo ─────────────────────────────────────────────
export const TableInfo: React.FC<TableInfoProps> = ({ tabId, tableName }) => {
    const [rows, setRows] = useState<RowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false); // per-tab reload in progress
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('info');
    const [saving, setSaving] = useState(false);
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
    const [editCell, setEditCell] = useState<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>(null);
    const [sortCol, setSortCol] = useState<SortCol>('idx');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [filterCol, setFilterCol] = useState('');
    const filterInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dataTabActions, setDataTabActions] = useState<TabAction[]>([]);

    const { activeProfile } = useConnectionStore();
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
        } catch (e: any) { setFetchError(e.toString()); }
        finally { setLoading(false); setReloading(false); }
    }, [schema, table]);

    const loadData = useCallback(async (filter?: string) => {
        if (!activeGroupId) return;
        const baseTableQuery = `SELECT * FROM "${schema}"."${table}"`;
        const query = filter?.trim()
            ? buildFilterQuery(baseTableQuery, filter)
            : baseTableQuery;
        // Track the base query so the tooltip reflects the actual executed query
        useResultStore.getState().setLastExecutedQuery(dataTabId, baseTableQuery);
        ExecuteQuery(dataTabId, query).catch(console.error);
    }, [schema, table, activeGroupId, dataTabId]);

    const { addTab } = useEditorStore();

    useEffect(() => {
        if (activeSubTab === 'data' && !dataResult) {
            loadData();
        }
    }, [activeSubTab, dataResult, loadData]);

    const loadErd = useCallback(async () => {
        // TODO: fetch ERD relationships
    }, [schema, table]);

    const tabReload: Record<SubTab, () => void> = {
        info: () => loadInfo(true),
        data: loadData,
        erd: loadErd,
    };

    useEffect(() => { loadInfo(); }, [loadInfo]);

    // Auto-focus the container so Ctrl+F can detect this tab is active
    useEffect(() => {
        containerRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
                const activeEl = document.activeElement;
                if (activeEl?.closest('.sidebar')) return; // Let sidebar handle its own search

                const activeGroup = groups.find(g => g.id === activeGroupId);
                if (activeGroup?.activeTabId === tabId) {
                    e.preventDefault();
                    if (activeSubTab !== 'info') setActiveSubTab('info');
                    setTimeout(() => filterInputRef.current?.focus(), 10);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [groups, activeGroupId, tabId, activeSubTab]);

    // Sorted indices (original index order within rows array)
    const displayIds = (() => {
        let filteredRows = rows;
        if (filterCol.trim() !== '') {
            const f = filterCol.trim().toLowerCase();
            filteredRows = rows.filter(r => r.current.Name.toLowerCase().includes(f));
        }

        if (!sortDir || sortCol === 'idx') {
            return filteredRows.map(r => r.id);
        }
        const ids = filteredRows.map(r => r.id);
        return ids.sort((aid, bid) => {
            const a = rows.find(r => r.id === aid)!;
            const b = rows.find(r => r.id === bid)!;
            let av: any = a.current[sortCol as keyof models.ColumnDef];
            let bv: any = b.current[sortCol as keyof models.ColumnDef];
            if (typeof av === 'boolean') av = av ? 1 : 0;
            if (typeof bv === 'boolean') bv = bv ? 1 : 0;
            return sortDir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
        });
    })();

    const cycling: SortCol[] = ['idx', 'Name', 'DataType', 'IsPrimaryKey', 'IsNullable', 'DefaultValue'];
    const cycleSort = (col: SortCol) => {
        if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
        else setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    };

    const SortIcon = ({ col }: { col: SortCol }) => (
        sortCol !== col || !sortDir
            ? <ArrowUpDown size={10} style={{ opacity: .35, marginLeft: 3, flexShrink: 0 }} />
            : sortDir === 'asc'
                ? <ArrowUp size={10} style={{ marginLeft: 3, color: 'var(--success-color)', flexShrink: 0 }} />
                : <ArrowDown size={10} style={{ marginLeft: 3, color: 'var(--success-color)', flexShrink: 0 }} />
    );


    const updateRow = (rowIdx: number, patch: Partial<models.ColumnDef>) => {
        setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, current: { ...r.current, ...patch } } : r));
    };

    const discardRow = (rowIdx: number) => {
        setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, current: { ...r.original }, deleted: false } : r));
        setRowErrors(e => { const ne = { ...e }; delete ne[rowIdx]; return ne; });
    };

    const discardAll = () => {
        setRows(prev => prev.filter(r => !r.isNew).map(r => ({ ...r, current: { ...r.original }, deleted: false })));
        setRowErrors({});
    };

    const addColumn = () => {
        const newCol: models.ColumnDef = {
            Name: `new_column_${rows.length + 1}`,
            DataType: driver === 'postgres' ? 'varchar(255)' : driver === 'mysql' ? 'varchar(255)' : 'nvarchar(255)',
            DefaultValue: '',
            IsNullable: true,
            IsPrimaryKey: false,
        };
        const newRow: RowState = {
            id: `new-${Date.now()}`,
            original: { ...newCol },
            current: { ...newCol },
            deleted: false,
            isNew: true,
        };
        setRows(prev => [...prev, newRow]);
        // Scroll to bottom after state update
        setTimeout(() => {
            const table = containerRef.current?.querySelector('.result-virtual-scroll');
            if (table) table.scrollTop = table.scrollHeight;
        }, 50);
    };

    const saveAll = async () => {
        setSaving(true);
        const errs: Record<number, string> = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r.deleted) continue; // Future: DropTableColumn
            
            try {
                if (r.isNew) {
                    await AddTableColumn(schema, table, r.current);
                } else if (!deepEq(r.original, r.current)) {
                    await AlterTableColumn(schema, table, r.original, r.current);
                }
            } catch (e: any) {
                errs[i] = e.toString();
            }
        }
        setRowErrors(errs);
        if (!Object.keys(errs).length) await loadInfo(true);
        setSaving(false);
    };

    const dirtyCount = rows.filter((r, i) => !r.isNew && !r.deleted && !deepEq(r.original, r.current)).length;
    const addedCount = rows.filter(r => r.isNew).length;
    const deletedCount = rows.filter(r => r.deleted).length;
    const hasChanges = dirtyCount > 0 || addedCount > 0 || deletedCount > 0;

    const reloadAction: TabAction = {
        id: 'reload',
        icon: <RefreshCw size={11} />,
        label: 'Reload',
        onClick: tabReload[activeSubTab],
        loading: reloading,
    };

    const tabActions: Record<SubTab, TabAction[]> = {
        info: [
            {
                id: 'add',
                icon: <Plus size={11} />,
                label: 'Add Column',
                onClick: addColumn,
                disabled: saving,
            },
            ...(hasChanges ? [
                {
                    id: 'discard',
                    icon: <RotateCcw size={11} />,
                    label: 'Discard',
                    onClick: discardAll,
                    disabled: saving,
                    danger: true,
                },
                {
                    id: 'save',
                    icon: <Save size={11} />,
                    label: 'Save',
                    onClick: saveAll,
                    disabled: saving,
                    loading: saving,
                },
            ] : []),
            reloadAction,
        ],
        data: dataTabActions,
        erd: [reloadAction],
    };

    const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

    const subTabs: { key: SubTab; label: string }[] = [
        { key: 'info', label: 'Info' },
        { key: 'data', label: 'Data' },
        { key: 'erd', label: 'ERD' },
    ];

    if (loading) return (
        <div className="flex items-center gap-2 p-5 h-full" style={{ background: 'var(--bg-main)' }}>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading schema…
        </div>
    );
    if (fetchError) return <div className="p-5 h-full" style={{ color: 'var(--error-color)', background: 'var(--bg-main)' }}>{fetchError}</div>;

    return (
        <div ref={containerRef} tabIndex={-1} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-main)', outline: 'none' }}>
            {/* Header: single flex row — table name | tabs | actions */}
            <div style={{ padding: '0 12px', flexShrink: 0, borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, minHeight: 40 }}>
                    {/* Table name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, paddingRight: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            Table: {tableName}
                        </span>
                    </div>

                    {/* Sub-tabs — flush with bottom border */}
                    <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
                        {subTabs.map(({ key, label }) => (
                            <div key={key} onClick={() => setActiveSubTab(key)} style={{
                                display: 'flex', alignItems: 'center',
                                padding: '0 14px', cursor: 'pointer', fontSize: 12,
                                fontWeight: activeSubTab === key ? 600 : 'normal',
                                borderBottom: activeSubTab === key ? '2px solid var(--success-color)' : '2px solid transparent',
                                color: activeSubTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                marginBottom: -1,
                            }}>{label}</div>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flex: 1 }}>
                        {tabActions[activeSubTab].map(action => (
                            <ToolbarButton key={action.id} action={action} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable table area */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeSubTab === 'info' && (
                    <div className="result-virtual-scroll" style={{ height: '100%' }}>
                        <table className="result-table-tanstack" style={{ tableLayout: 'fixed', minWidth: '100%', fontFamily: 'inherit' }}>
                            <colgroup>
                                <col style={{ width: 36 }} />
                                <col style={{ width: '22%' }} />
                                <col style={{ width: '24%' }} />
                                <col style={{ width: 44 }} />
                                <col style={{ width: 70 }} />
                                <col />
                            </colgroup>
                            <thead>
                                <tr>
                                    {([
                                        { col: 'idx' as SortCol, label: '#' },
                                        { col: 'Name' as SortCol, label: 'Name' },
                                        { col: 'DataType' as SortCol, label: 'Data Type' },
                                        { col: 'IsPrimaryKey' as SortCol, label: 'PK' },
                                        { col: 'IsNullable' as SortCol, label: 'Nullable' },
                                        { col: 'DefaultValue' as SortCol, label: 'Default' },
                                    ]).map(({ col, label }) => (
                                        <th key={col} className="rt-th rt-th-sortable" style={thStyle} onClick={() => cycleSort(col)}>
                                            <span className="rt-th-label">
                                                {label}<SortIcon col={col} />
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayIds.map((id, displayIdx) => {
                                    const rowIdx = rows.findIndex(r => r.id === id);
                                    const row = rows[rowIdx];
                                    if (!row) return null;
                                    return (
                                        <Row
                                            key={id}
                                            row={row}
                                            rowIdx={rowIdx}
                                            displayIdx={displayIdx}
                                            types={types}
                                            editCell={editCell}
                                            setEditCell={setEditCell}
                                            onUpdate={updateRow}
                                            onDiscard={discardRow}
                                            rowError={rowErrors[rowIdx]}
                                        />
                                    );
                                })}
                                {rows.length === 0 && (
                                    <tr><td colSpan={6} className="p-5 text-center" style={{ color: 'var(--text-secondary)' }}>No columns found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeSubTab === 'data' && (
                    <div className="flex-1" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <ResultPanel
                            tabId={dataTabId}
                            onRun={loadData}
                            result={dataResult}
                            onActionsChange={setDataTabActions}
                            onFilterRun={(filter) => loadData(filter)}
                            baseQuery={dataResult?.lastExecutedQuery || `SELECT * FROM "${schema}"."${table}"`}
                        />
                    </div>
                )}

                {activeSubTab === 'erd' && (
                    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
                        <div className="text-center p-10 border border-dashed rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                            (Placeholder) ERD View — {tableName}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom status bar */}
            {activeSubTab !== 'data' && (
                <div style={{
                    flexShrink: 0,
                    borderTop: '1px solid var(--border-color)',
                    padding: '4px 12px',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    {/* Left: Info */}
                    <div style={{ display: 'flex', alignItems: 'center', minHeight: 24 }}>
                        {activeSubTab === 'info' && (
                            <span>
                                Total {rows.length} columns {hasChanges && <span style={{ color: 'var(--text-secondary)' }}> · </span>}
                                {addedCount > 0 && <span style={{ color: 'var(--success-color)' }}>{addedCount} added</span>}
                                {addedCount > 0 && (dirtyCount > 0 || deletedCount > 0) && <span style={{ color: 'var(--text-secondary)' }}> · </span>}
                                {dirtyCount > 0 && <span style={{ color: 'var(--success-color)' }}>{dirtyCount} modified</span>}
                                {dirtyCount > 0 && deletedCount > 0 && <span style={{ color: 'var(--text-secondary)' }}> · </span>}
                                {deletedCount > 0 && <span style={{ color: 'var(--error-color)' }}>{deletedCount} deleted</span>}
                            </span>
                        )}
                        {activeSubTab === 'erd' && <span>Total 0 relationships</span>}
                    </div>

                    {/* Right: Actions/Filters depending on tab */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {activeSubTab === 'info' && (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={11} style={{ position: 'absolute', left: 6, color: 'var(--text-secondary)' }} />
                                <input
                                    ref={filterInputRef}
                                    type="text"
                                    placeholder="Filter columns..."
                                    value={filterCol}
                                    onChange={(e) => setFilterCol(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Escape' && setFilterCol('')}
                                    style={{
                                        fontSize: 11,
                                        padding: '2px 6px 2px 20px',
                                        borderRadius: 4,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                        width: 150,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
