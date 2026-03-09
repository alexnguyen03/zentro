import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FetchTableColumns, AlterTableColumn } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { Loader, Check, X, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, Save } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { getTypesForDriver } from '../../lib/dbTypes';

interface TableInfoProps {
    tabId: string;
    tableName: string; // "schema.table"
}

type SubTab = 'info' | 'data' | 'erd';
type SortDir = 'asc' | 'desc' | null;
type SortField = keyof models.ColumnDef | '#';

interface RowState {
    original: models.ColumnDef;
    current: models.ColumnDef;
    deleted: boolean;
}

function parseTableName(t: string): { schema: string; table: string } {
    const parts = t.split('.');
    return parts.length > 1 ? { schema: parts[0], table: parts.slice(1).join('.') } : { schema: '', table: t };
}

function deepEq(a: models.ColumnDef, b: models.ColumnDef) {
    return a.Name === b.Name && a.DataType === b.DataType &&
        a.IsNullable === b.IsNullable && a.IsPrimaryKey === b.IsPrimaryKey &&
        a.DefaultValue === b.DefaultValue;
}

// ── DataTypeCell ──────────────────────────────────────────────────────────────
interface DataTypeCellProps {
    value: string;
    types: string[];
    isDirty: boolean;
    onChange: (v: string) => void;
}

const DataTypeCell: React.FC<DataTypeCellProps> = ({ value, types, isDirty, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    const filtered = search
        ? types.filter(t => t.toLowerCase().includes(search.toLowerCase()))
        : types;

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleSelect = (t: string) => { onChange(t); setOpen(false); setSearch(''); };

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            <input
                style={{
                    width: '100%', padding: '3px 6px', fontFamily: 'monospace', fontSize: 12,
                    border: `1px solid ${isDirty ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    borderRadius: 4, background: 'var(--bg-editor)', color: 'var(--text-primary)',
                    outline: 'none', boxSizing: 'border-box',
                }}
                value={open ? search : value}
                onFocus={() => { setOpen(true); setSearch(''); }}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0]);
                    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                }}
                placeholder={value}
            />
            {open && (
                <div style={{
                    position: 'absolute', zIndex: 9999, top: '100%', left: 0, right: 0,
                    maxHeight: 200, overflowY: 'auto',
                    background: 'var(--bg-toolbar)', border: '1px solid var(--border-color)',
                    borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}>
                    {filtered.length === 0
                        ? <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>No match</div>
                        : filtered.map(t => (
                            <div
                                key={t}
                                onMouseDown={() => handleSelect(t)}
                                style={{
                                    padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                                    fontFamily: 'monospace',
                                    background: t === value ? 'var(--accent-color)' : 'transparent',
                                    color: t === value ? '#fff' : 'var(--text-primary)',
                                }}
                            >
                                {t}
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
};

// ── TableInfo ─────────────────────────────────────────────────────────────────
export const TableInfo: React.FC<TableInfoProps> = ({ tabId, tableName }) => {
    const [rows, setRows] = useState<RowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('info');
    const [saving, setSaving] = useState(false);
    const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
    const [editCell, setEditCell] = useState<{ rowIdx: number; field: 'Name' | 'DefaultValue' } | null>(null);
    const [sortField, setSortField] = useState<SortField>('#');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const { activeProfile } = useConnectionStore();
    const driver = activeProfile?.driver ?? 'sqlserver';
    const types = getTypesForDriver(driver);
    const { schema, table } = parseTableName(tableName);

    const loadColumns = useCallback(async () => {
        try {
            setLoading(true);
            setFetchError(null);
            const cols = await FetchTableColumns(schema, table);
            setRows((cols || []).map(c => ({ original: { ...c }, current: { ...c }, deleted: false })));
            setRowErrors({});
        } catch (err: any) {
            setFetchError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [schema, table]);

    useEffect(() => { loadColumns(); }, [loadColumns]);

    // ── Sort ──
    const sortedIndices = (() => {
        const indices = rows.map((_, i) => i);
        if (!sortDir) return indices;
        return [...indices].sort((ai, bi) => {
            const a = rows[ai], b = rows[bi];
            let av: any, bv: any;
            if (sortField === '#') { av = ai; bv = bi; }
            else { av = a.current[sortField as keyof models.ColumnDef]; bv = b.current[sortField as keyof models.ColumnDef]; }
            if (typeof av === 'boolean') av = av ? 1 : 0;
            if (typeof bv === 'boolean') bv = bv ? 1 : 0;
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    })();

    const cycleSort = (field: SortField) => {
        if (sortField !== field) { setSortField(field); setSortDir('asc'); }
        else setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field || !sortDir) return <ArrowUpDown size={10} style={{ opacity: 0.4, marginLeft: 4 }} />;
        return sortDir === 'asc'
            ? <ArrowUp size={10} style={{ marginLeft: 4, color: 'var(--accent-color)' }} />
            : <ArrowDown size={10} style={{ marginLeft: 4, color: 'var(--accent-color)' }} />;
    };

    const updateRow = (rowIdx: number, patch: Partial<models.ColumnDef>) => {
        setRows(prev => prev.map((r, i) =>
            i === rowIdx ? { ...r, current: { ...r.current, ...patch } } : r
        ));
    };

    const discardRow = (rowIdx: number) => {
        setRows(prev => prev.map((r, i) =>
            i === rowIdx ? { ...r, current: { ...r.original }, deleted: false } : r
        ));
        setRowErrors(e => { const ne = { ...e }; delete ne[rowIdx]; return ne; });
    };

    const discardAll = () => {
        setRows(prev => prev.map(r => ({ ...r, current: { ...r.original }, deleted: false })));
        setRowErrors({});
    };

    const saveDirtyRows = async () => {
        setSaving(true);
        const newErrors: Record<number, string> = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r.deleted || deepEq(r.original, r.current)) continue;
            try {
                await AlterTableColumn(schema, table, r.original, r.current);
            } catch (err: any) {
                newErrors[i] = err.toString();
            }
        }
        setRowErrors(newErrors);
        if (Object.keys(newErrors).length === 0) await loadColumns();
        setSaving(false);
    };

    const dirtyCount = rows.filter((r, i) => !r.deleted && !deepEq(r.original, r.current)).length;
    const deletedCount = rows.filter(r => r.deleted).length;

    const thStyle: React.CSSProperties = {
        padding: '7px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600,
        background: 'var(--bg-toolbar)', cursor: 'pointer', userSelect: 'none',
        borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap',
        position: 'sticky', top: 0, zIndex: 10,
    };

    const subTabs: { key: SubTab; label: string }[] = [
        { key: 'info', label: 'Info' },
        { key: 'data', label: 'Data' },
        { key: 'erd', label: 'ERD' },
    ];

    if (loading) return (
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8, height: '100%', boxSizing: 'border-box' }}>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Loading schema…
        </div>
    );

    if (fetchError) return (
        <div style={{ padding: 20, color: 'var(--error-color)', height: '100%', boxSizing: 'border-box' }}>{fetchError}</div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-main)' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Table: {tableName}</div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    {subTabs.map(({ key, label }) => (
                        <div key={key} onClick={() => setActiveSubTab(key)} style={{
                            padding: '7px 16px', cursor: 'pointer', fontSize: 13,
                            fontWeight: activeSubTab === key ? 600 : 'normal',
                            borderBottom: activeSubTab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeSubTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}>
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {activeSubTab === 'info' && (
                    <div style={{ height: '100%', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: 36 }} />
                                <col style={{ width: '22%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: 44 }} />
                                <col style={{ width: 70 }} />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: 64 }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    {(['#', 'Name', 'DataType', 'IsPrimaryKey', 'IsNullable', 'DefaultValue'] as SortField[]).map((f, ci) => {
                                        const labels: Record<string, string> = {
                                            '#': '#', Name: 'Name', DataType: 'Data Type',
                                            IsPrimaryKey: 'PK', IsNullable: 'Nullable', DefaultValue: 'Default',
                                        };
                                        return (
                                            <th key={f} style={{ ...thStyle, width: ci === 0 ? 36 : undefined }}
                                                onClick={() => cycleSort(f)}>
                                                <span style={{ display: 'flex', alignItems: 'center' }}>
                                                    {labels[f]}<SortIcon field={f} />
                                                </span>
                                            </th>
                                        );
                                    })}
                                    <th style={{ ...thStyle, width: 64, cursor: 'default' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedIndices.map((rowIdx, displayIdx) => {
                                    const r = rows[rowIdx];
                                    const col = r.current;
                                    const isDeleted = r.deleted;
                                    const isDirty = !isDeleted && !deepEq(r.original, r.current);
                                    const isEditing = editCell?.rowIdx === rowIdx;
                                    const err = rowErrors[rowIdx];

                                    const rowBg = isDeleted
                                        ? 'rgba(var(--error-rgb,220,38,38),0.08)'
                                        : isDirty
                                            ? 'rgba(var(--accent-rgb,99,102,241),0.08)'
                                            : displayIdx % 2 === 1 ? 'var(--bg-toolbar)' : 'transparent';

                                    const td: React.CSSProperties = {
                                        padding: '5px 8px', borderBottom: '1px solid var(--border-dim)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        verticalAlign: 'middle',
                                    };

                                    return (
                                        <React.Fragment key={rowIdx}>
                                            <tr style={{ background: rowBg, opacity: isDeleted ? 0.55 : 1 }}>
                                                {/* # */}
                                                <td style={{ ...td, color: 'var(--text-secondary)', textAlign: 'center', fontSize: 11 }}>{rowIdx + 1}</td>

                                                {/* Name */}
                                                <td style={td}>
                                                    {editCell?.rowIdx === rowIdx && editCell.field === 'Name' ? (
                                                        <input
                                                            autoFocus
                                                            style={{ width: '100%', padding: '2px 6px', border: '1px solid var(--accent-color)', borderRadius: 4, background: 'var(--bg-editor)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                                            defaultValue={col.Name}
                                                            onBlur={e => { updateRow(rowIdx, { Name: e.target.value }); setEditCell(null); }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                if (e.key === 'Escape') setEditCell(null);
                                                            }}
                                                        />
                                                    ) : (
                                                        <span
                                                            onDoubleClick={() => !isDeleted && setEditCell({ rowIdx, field: 'Name' })}
                                                            style={{ fontWeight: col.IsPrimaryKey ? 600 : 'normal', cursor: 'text', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                            title={col.Name}
                                                        >
                                                            {col.Name}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* DataType */}
                                                <td style={{ ...td, padding: '4px 6px' }}>
                                                    {isDeleted
                                                        ? <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{col.DataType}</span>
                                                        : <DataTypeCell
                                                            value={col.DataType}
                                                            types={types}
                                                            isDirty={col.DataType !== r.original.DataType}
                                                            onChange={v => updateRow(rowIdx, { DataType: v })}
                                                        />
                                                    }
                                                </td>

                                                {/* PK */}
                                                <td style={{ ...td, textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={col.IsPrimaryKey}
                                                        disabled={isDeleted}
                                                        onChange={e => updateRow(rowIdx, { IsPrimaryKey: e.target.checked })}
                                                        style={{ cursor: isDeleted ? 'default' : 'pointer', accentColor: 'var(--accent-color)' }}
                                                    />
                                                </td>

                                                {/* Nullable */}
                                                <td style={{ ...td, textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={col.IsNullable}
                                                        disabled={isDeleted}
                                                        onChange={e => updateRow(rowIdx, { IsNullable: e.target.checked })}
                                                        style={{ cursor: isDeleted ? 'default' : 'pointer', accentColor: 'var(--accent-color)' }}
                                                    />
                                                </td>

                                                {/* Default */}
                                                <td style={{ ...td, padding: '4px 6px' }}>
                                                    {isDeleted
                                                        ? <span style={{ color: 'var(--text-secondary)' }}>{col.DefaultValue || '-'}</span>
                                                        : editCell?.rowIdx === rowIdx && editCell.field === 'DefaultValue'
                                                            ? (
                                                                <input
                                                                    autoFocus
                                                                    style={{ width: '100%', padding: '2px 6px', border: '1px solid var(--accent-color)', borderRadius: 4, background: 'var(--bg-editor)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                                                    defaultValue={col.DefaultValue}
                                                                    onBlur={e => { updateRow(rowIdx, { DefaultValue: e.target.value }); setEditCell(null); }}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                        if (e.key === 'Escape') setEditCell(null);
                                                                    }}
                                                                />
                                                            )
                                                            : (
                                                                <span
                                                                    style={{ color: col.DefaultValue ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'text', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                    onDoubleClick={() => setEditCell({ rowIdx, field: 'DefaultValue' })}
                                                                    title={col.DefaultValue || 'none'}
                                                                >
                                                                    {col.DefaultValue || '-'}
                                                                </span>
                                                            )
                                                    }
                                                </td>

                                                {/* Actions */}
                                                <td style={{ ...td, padding: '4px 8px' }}>
                                                    {(isDirty || isDeleted) && (
                                                        <button
                                                            onClick={() => discardRow(rowIdx)}
                                                            title="Discard row changes"
                                                            style={{
                                                                padding: '2px 5px', borderRadius: 3, border: '1px solid var(--border-color)',
                                                                background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)',
                                                            }}
                                                        >
                                                            <RotateCcw size={11} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {err && (
                                                <tr style={{ background: 'rgba(220,38,38,0.05)' }}>
                                                    <td colSpan={7} style={{ padding: '3px 12px', color: 'var(--error-color)', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
                                                        ⚠ {err}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>No columns found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeSubTab === 'data' && (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border-color)', borderRadius: 6 }}>
                            (Placeholder) Data View — {tableName}
                        </div>
                    </div>
                )}

                {activeSubTab === 'erd' && (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ textAlign: 'center', padding: 40, border: '1px dashed var(--border-color)', borderRadius: 6 }}>
                            (Placeholder) ERD View — {tableName}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Toolbar — fixed */}
            {activeSubTab === 'info' && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                    padding: '6px 12px', borderTop: '1px solid var(--border-color)',
                    background: 'var(--bg-toolbar)', fontSize: 12,
                }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>
                        {rows.length} columns
                        {dirtyCount > 0 && <> · <span style={{ color: 'var(--accent-color)' }}>{dirtyCount} modified</span></>}
                        {deletedCount > 0 && <> · <span style={{ color: 'var(--error-color)' }}>{deletedCount} deleted</span></>}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Double-click to edit Name/Default · click checkbox to toggle</span>
                    {(dirtyCount > 0 || deletedCount > 0) && (
                        <>
                            <button onClick={discardAll} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
                                <RotateCcw size={12} /> Discard All
                            </button>
                            <button onClick={saveDirtyRows} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--accent-color)', background: 'var(--accent-color)', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 12 }}>
                                {saving ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                                Apply Changes
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
