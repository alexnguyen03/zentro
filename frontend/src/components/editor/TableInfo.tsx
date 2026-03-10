import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    DndContext, closestCenter, PointerSensor,
    useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy,
    useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FetchTableColumns, AlterTableColumn, ReorderTableColumns } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { Loader, Check, X, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, Save, GripVertical } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { getTypesForDriver } from '../../lib/dbTypes';

interface TableInfoProps {
    tabId: string;
    tableName: string;
}

type SubTab = 'info' | 'data' | 'erd';
type SortDir = 'asc' | 'desc' | null;
type SortCol = 'idx' | 'Name' | 'DataType' | 'IsPrimaryKey' | 'IsNullable' | 'DefaultValue';

interface RowState {
    id: string; // stable dnd id
    original: models.ColumnDef;
    current: models.ColumnDef;
    deleted: boolean;
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
    const wrapRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const filtered = text
        ? types.filter(t => t.toLowerCase().includes(text.toLowerCase()))
        : types;

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
                {filtered.map(t => (
                    <div
                        key={t}
                        onMouseDown={e => { e.preventDefault(); handleSuggestionClick(t); }}
                        className={`px-3 py-1 text-xs font-mono cursor-pointer hover:bg-[var(--accent-color)] hover:text-white ${t === text ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-primary)]'
                            }`}
                    >
                        {t}
                    </div>
                ))}
            </div>,
            document.body
        )
        : null;

    if (!editing) {
        return (
            <span
                className={`font-mono text-xs block truncate cursor-default select-none ${isDirty ? 'text-[var(--accent-color)]' : ''}`}
                onDoubleClick={openEditor}
                title={`${value} (double-click to edit)`}
            >
                {value}
            </span>
        );
    }

    return (
        <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                autoFocus
                className="rt-cell-input"
                style={{ height: 24, fontSize: 12, fontFamily: 'monospace', borderRadius: 3, padding: '0 6px', width: '100%', boxSizing: 'border-box' }}
                value={text}
                onChange={e => { setText(e.target.value); }}
                onKeyDown={e => {
                    if (e.key === 'Enter') { commitAndClose(text); }
                    if (e.key === 'Escape') { closeWithoutCommit(); }
                    if (e.key === 'Tab') { commitAndClose(text); }
                }}
                onBlur={() => { setTimeout(() => commitAndClose(text), 150); }}
            />
            {dropdown}
        </div>
    );
};

// ── SortableRow ────────────────────────────────────────────────
interface SortableRowProps {
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

const SortableRow: React.FC<SortableRowProps> = ({
    row, rowIdx, displayIdx, types, editCell, setEditCell, onUpdate, onDiscard, rowError
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
    const col = row.current;
    const isDeleted = row.deleted;
    const isDirty = !isDeleted && !deepEq(row.original, row.current);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : isDeleted ? 0.55 : 1,
        background: isDeleted
            ? 'rgba(220,38,38,.08)'
            : isDirty
                ? 'rgba(var(--accent-rgb,99,102,241),.09)'
                : displayIdx % 2 === 1 ? 'var(--bg-secondary)' : undefined,
        position: 'relative',
        zIndex: isDragging ? 999 : undefined,
    };

    const td: React.CSSProperties = {
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: 12,
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    };

    return (
        <>
            <tr ref={setNodeRef} style={style}>
                {/* Drag handle */}
                <td style={{ ...td, width: 28, textAlign: 'center', padding: '4px 4px', cursor: 'grab' }}
                    {...attributes} {...listeners}>
                    <GripVertical size={13} style={{ opacity: 0.35, display: 'block', margin: 'auto' }} />
                </td>

                {/* # */}
                <td style={{ ...td, width: 36, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
                    {rowIdx + 1}
                </td>

                {/* Name */}
                <td style={{ ...td }}>
                    {editCell?.rowIdx === rowIdx && editCell.field === 'Name' ? (
                        <input
                            autoFocus
                            className="rt-cell-input"
                            style={{ height: 24, fontSize: 12, borderRadius: 3, padding: '0 6px', width: '100%' }}
                            defaultValue={col.Name}
                            onBlur={e => { onUpdate(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditCell(null);
                            }}
                        />
                    ) : (
                        <span
                            className={`block truncate ${isDirty && col.Name !== row.original.Name ? 'text-[var(--accent-color)] font-semibold' : col.IsPrimaryKey ? 'font-semibold' : ''}`}
                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'Name' })}
                            title={col.Name}
                        >
                            {col.Name}
                        </span>
                    )}
                </td>

                {/* DataType */}
                <td style={{ ...td, padding: '3px 6px' }}>
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
                        style={{ cursor: isDeleted ? 'default' : 'pointer', accentColor: 'var(--accent-color)' }} />
                </td>

                {/* Nullable */}
                <td style={{ ...td, width: 68, textAlign: 'center' }}>
                    <input type="checkbox" checked={col.IsNullable} disabled={isDeleted}
                        onChange={e => onUpdate(rowIdx, { IsNullable: e.target.checked })}
                        style={{ cursor: isDeleted ? 'default' : 'pointer', accentColor: 'var(--accent-color)' }} />
                </td>

                {/* Default */}
                <td style={{ ...td, padding: '3px 6px' }}>
                    {isDeleted
                        ? <span className="text-[var(--text-secondary)]">{col.DefaultValue || '–'}</span>
                        : editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue'
                            ? <input autoFocus className="rt-cell-input"
                                style={{ height: 24, fontSize: 12, borderRadius: 3, padding: '0 6px', width: '100%' }}
                                defaultValue={col.DefaultValue}
                                onBlur={e => { onUpdate(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setEditCell(null);
                                }} />
                            : <span
                                className={`block truncate cursor-text ${col.DefaultValue ? '' : 'text-[var(--text-secondary)]'} ${isDirty && col.DefaultValue !== row.original.DefaultValue ? 'text-[var(--accent-color)]' : ''}`}
                                onDoubleClick={() => setEditCell({ rowIdx, field: 'DefaultValue' })}
                                title={col.DefaultValue || 'none'}
                            >
                                {col.DefaultValue || '–'}
                            </span>
                    }
                </td>

                {/* Actions */}
                <td style={{ ...td, width: 44, padding: '4px 6px' }}>
                    {(isDirty || isDeleted) && (
                        <button onClick={() => onDiscard(rowIdx)} title="Discard"
                            className="rt-th-sortable"
                            style={{ padding: '2px 5px', borderRadius: 3, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <RotateCcw size={11} />
                        </button>
                    )}
                </td>
            </tr>
            {rowError && (
                <tr style={{ background: 'rgba(220,38,38,.06)' }}>
                    <td colSpan={8} style={{ padding: '3px 12px', color: 'var(--error-color)', fontSize: 11, borderBottom: '1px solid var(--border-color)' }}>
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
    const [order, setOrder] = useState<string[]>([]); // dnd order by row.id
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('info');
    const [saving, setSaving] = useState(false);
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
    const [editCell, setEditCell] = useState<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>(null);
    const [sortCol, setSortCol] = useState<SortCol>('idx');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const { activeProfile } = useConnectionStore();
    const driver = activeProfile?.driver ?? 'sqlserver';
    const types = getTypesForDriver(driver);
    const { schema, table } = parseTableName(tableName);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const load = useCallback(async () => {
        try {
            setLoading(true); setFetchError(null);
            const cols = await FetchTableColumns(schema, table);
            const rs: RowState[] = (cols || []).map((c, i) => ({
                id: `col-${i}-${c.Name}`,
                original: { ...c }, current: { ...c }, deleted: false,
            }));
            setRows(rs);
            setOrder(rs.map(r => r.id));
            setRowErrors({});
        } catch (e: any) { setFetchError(e.toString()); }
        finally { setLoading(false); }
    }, [schema, table]);

    useEffect(() => { load(); }, [load]);

    // Sorted indices (original index order within rows array)
    const displayIds = (() => {
        if (!sortDir || sortCol === 'idx') {
            // use DnD order
            return order.filter(id => rows.find(r => r.id === id));
        }
        return [...order].sort((aid, bid) => {
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
                ? <ArrowUp size={10} style={{ marginLeft: 3, color: 'var(--accent-color)', flexShrink: 0 }} />
                : <ArrowDown size={10} style={{ marginLeft: 3, color: 'var(--accent-color)', flexShrink: 0 }} />
    );

    const handleDragEnd = async (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const newOrder = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
        // optimistic UI: apply immediately
        setOrder(newOrder);
        setSortCol('idx'); setSortDir('asc');
        // persist to DB
        const colNames = newOrder.map(id => rows.find(r => r.id === id)?.current.Name).filter(Boolean) as string[];
        try {
            await ReorderTableColumns(schema, table, colNames);
            // reload to confirm server state
            await load();
        } catch (err: any) {
            // revert order on failure
            setOrder(order);
            setRowErrors(e => ({ ...e, [-1]: `Reorder failed: ${err}` }));
        }
    };

    const updateRow = (rowIdx: number, patch: Partial<models.ColumnDef>) => {
        setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, current: { ...r.current, ...patch } } : r));
    };

    const discardRow = (rowIdx: number) => {
        setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, current: { ...r.original }, deleted: false } : r));
        setRowErrors(e => { const ne = { ...e }; delete ne[rowIdx]; return ne; });
    };

    const discardAll = () => {
        setRows(prev => prev.map(r => ({ ...r, current: { ...r.original }, deleted: false })));
        setRowErrors({});
    };

    const saveAll = async () => {
        setSaving(true);
        const errs: Record<number, string> = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r.deleted || deepEq(r.original, r.current)) continue;
            try { await AlterTableColumn(schema, table, r.original, r.current); }
            catch (e: any) { errs[i] = e.toString(); }
        }
        setRowErrors(errs);
        if (!Object.keys(errs).length) await load();
        setSaving(false);
    };

    const dirtyCount = rows.filter((r, i) => !r.deleted && !deepEq(r.original, r.current)).length;
    const deletedCount = rows.filter(r => r.deleted).length;

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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-main)' }}>
            {/* Header + sub-tabs */}
            <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Table: {tableName}</div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    {subTabs.map(({ key, label }) => (
                        <div key={key} onClick={() => setActiveSubTab(key)} style={{
                            padding: '6px 16px', cursor: 'pointer', fontSize: 12,
                            fontWeight: activeSubTab === key ? 600 : 'normal',
                            borderBottom: activeSubTab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeSubTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}>{label}</div>
                    ))}
                </div>
            </div>

            {/* Scrollable table area */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeSubTab === 'info' && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <div className="result-virtual-scroll" style={{ height: '100%' }}>
                            <table className="result-table-tanstack" style={{ tableLayout: 'fixed', minWidth: '100%', fontFamily: 'inherit' }}>
                                <colgroup>
                                    <col style={{ width: 28 }} /> {/* grip */}
                                    <col style={{ width: 36 }} /> {/* # */}
                                    <col style={{ width: '22%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: 44 }} />
                                    <col style={{ width: 70 }} />
                                    <col />
                                    <col style={{ width: 44 }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th className="rt-th" />
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
                                        <th className="rt-th"><span className="rt-th-label">Actions</span></th>
                                    </tr>
                                </thead>
                                <SortableContext items={displayIds} strategy={verticalListSortingStrategy}>
                                    <tbody>
                                        {displayIds.map((id, displayIdx) => {
                                            const rowIdx = rows.findIndex(r => r.id === id);
                                            const row = rows[rowIdx];
                                            if (!row) return null;
                                            return (
                                                <SortableRow
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
                                            <tr><td colSpan={8} className="p-5 text-center" style={{ color: 'var(--text-secondary)' }}>No columns found.</td></tr>
                                        )}
                                    </tbody>
                                </SortableContext>
                            </table>
                        </div>
                    </DndContext>
                )}

                {activeSubTab === 'data' && (
                    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
                        <div className="text-center p-10 border border-dashed rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                            (Placeholder) Data View — {tableName}
                        </div>
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

            {/* Bottom toolbar — fixed */}
            {activeSubTab === 'info' && (
                <div className="result-toolbar" style={{ flexShrink: 0 }}>
                    <span className="result-stats">
                        <span style={{ color: 'var(--text-secondary)' }}>{rows.length} columns</span>
                        {dirtyCount > 0 && <><span style={{ color: 'var(--text-secondary)' }}>·</span><span style={{ color: 'var(--accent-color)' }}>{dirtyCount} modified</span></>}
                        {deletedCount > 0 && <><span style={{ color: 'var(--text-secondary)' }}>·</span><span style={{ color: 'var(--error-color)' }}>{deletedCount} deleted</span></>}
                    </span>
                    <span className="result-toolbar-right">
                        {(dirtyCount > 0 || deletedCount > 0) && (
                            <>
                                <button onClick={discardAll} className="result-toolbar-btn">
                                    <RotateCcw size={11} /> Discard All
                                </button>
                                <button onClick={saveAll} disabled={saving} className="result-toolbar-btn" style={{ color: 'var(--accent-color)', borderColor: 'var(--accent-color)' }}>
                                    {saving ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={11} />} Apply Changes
                                </button>
                            </>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
};
