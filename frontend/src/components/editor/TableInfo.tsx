import React, { useEffect, useState, useCallback } from 'react';
import { FetchTableColumns, AlterTableColumn } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { Loader, Check, X, Pencil } from 'lucide-react';

interface TableInfoProps {
    tabId: string;
    tableName: string; // "schema.table"
}

type SubTab = 'info' | 'data' | 'erd';

interface EditState {
    rowIdx: number;
    field: keyof models.ColumnDef;
    value: string | boolean;
}

// Parse "schema.table" into parts
function parseTableName(tableName: string): { schema: string; table: string } {
    const parts = tableName.split('.');
    if (parts.length > 1) {
        return { schema: parts[0], table: parts.slice(1).join('.') };
    }
    return { schema: '', table: tableName };
}

export const TableInfo: React.FC<TableInfoProps> = ({ tabId, tableName }) => {
    const [originalColumns, setOriginalColumns] = useState<models.ColumnDef[]>([]);
    const [columns, setColumns] = useState<models.ColumnDef[]>([]);
    const [dirty, setDirty] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState<Set<number>>(new Set());
    const [errors, setErrors] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('info');
    const [editState, setEditState] = useState<EditState | null>(null);

    const { schema, table } = parseTableName(tableName);

    const loadColumns = useCallback(async () => {
        try {
            setLoading(true);
            setFetchError(null);
            const cols = await FetchTableColumns(schema, table);
            const normalized = (cols || []) as models.ColumnDef[];
            setOriginalColumns(normalized.map(c => ({ ...c })));
            setColumns(normalized.map(c => ({ ...c })));
            setDirty(new Set());
            setErrors({});
        } catch (err: any) {
            setFetchError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [schema, table]);

    useEffect(() => { loadColumns(); }, [loadColumns]);

    const startEdit = (rowIdx: number, field: keyof models.ColumnDef, currentValue: string | boolean) => {
        setEditState({ rowIdx, field, value: currentValue });
    };

    const commitCell = (rowIdx: number, field: keyof models.ColumnDef, value: string | boolean) => {
        setEditState(null);
        setColumns(prev => {
            const next = prev.map((c, i) => i === rowIdx ? { ...c, [field]: value } : c);
            const orig = originalColumns[rowIdx];
            const updated = next[rowIdx];
            const isDirty = orig && (
                orig.Name !== updated.Name ||
                orig.DataType !== updated.DataType ||
                orig.IsNullable !== updated.IsNullable ||
                orig.IsPrimaryKey !== updated.IsPrimaryKey ||
                orig.DefaultValue !== updated.DefaultValue
            );
            setDirty(d => {
                const nd = new Set(d);
                isDirty ? nd.add(rowIdx) : nd.delete(rowIdx);
                return nd;
            });
            return next;
        });
    };

    const discardRow = (rowIdx: number) => {
        setColumns(prev => prev.map((c, i) => i === rowIdx ? { ...originalColumns[i] } : c));
        setDirty(d => { const nd = new Set(d); nd.delete(rowIdx); return nd; });
        setErrors(e => { const ne = { ...e }; delete ne[rowIdx]; return ne; });
    };

    const saveRow = async (rowIdx: number) => {
        const old = originalColumns[rowIdx];
        const updated = columns[rowIdx];
        setSaving(s => new Set(s).add(rowIdx));
        setErrors(e => { const ne = { ...e }; delete ne[rowIdx]; return ne; });
        try {
            await AlterTableColumn(schema, table, old, updated);
            setOriginalColumns(prev => prev.map((c, i) => i === rowIdx ? { ...updated } : c));
            setDirty(d => { const nd = new Set(d); nd.delete(rowIdx); return nd; });
        } catch (err: any) {
            setErrors(e => ({ ...e, [rowIdx]: err.toString() }));
        } finally {
            setSaving(s => { const ns = new Set(s); ns.delete(rowIdx); return ns; });
        }
    };

    const renderCell = (col: models.ColumnDef, rowIdx: number, field: keyof models.ColumnDef) => {
        const value = col[field];
        const isEditing = editState?.rowIdx === rowIdx && editState?.field === field;

        if (field === 'IsPrimaryKey' || field === 'IsNullable') {
            const boolVal = value as boolean;
            return (
                <td
                    style={{ padding: '6px 12px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => commitCell(rowIdx, field, !boolVal)}
                    title="Click to toggle"
                >
                    {field === 'IsPrimaryKey'
                        ? (boolVal ? '🔑' : '')
                        : (boolVal ? 'YES' : 'NO')}
                </td>
            );
        }

        if (isEditing) {
            return (
                <td style={{ padding: '2px 4px' }}>
                    <input
                        autoFocus
                        style={{
                            width: '100%', padding: '4px 8px', border: '1px solid var(--accent-color)',
                            borderRadius: 4, background: 'var(--bg-editor)', color: 'var(--text-primary)',
                            fontFamily: field === 'DataType' ? 'monospace' : 'inherit', fontSize: 12,
                            outline: 'none',
                        }}
                        defaultValue={value as string}
                        onBlur={(e) => commitCell(rowIdx, field, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditState(null);
                        }}
                    />
                </td>
            );
        }

        const displayVal = field === 'DefaultValue' ? (value as string) || '-' : value as string;
        return (
            <td
                style={{
                    padding: '6px 12px',
                    fontFamily: field === 'DataType' ? 'monospace' : 'inherit',
                    cursor: 'text',
                }}
                onDoubleClick={() => startEdit(rowIdx, field, value as string)}
                title="Double-click to edit"
            >
                {displayVal}
            </td>
        );
    };

    if (loading) {
        return (
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Loading table schema...
            </div>
        );
    }

    if (fetchError) {
        return <div style={{ padding: 20, color: 'var(--error-color)' }}>{fetchError}</div>;
    }

    const subTabs: { key: SubTab; label: string }[] = [
        { key: 'info', label: 'Info' },
        { key: 'data', label: 'Data' },
        { key: 'erd', label: 'ERD' },
    ];

    return (
        <div className="table-info-pane" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Table: {tableName}</h2>

            {/* Sub-tab navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
                {subTabs.map(({ key, label }) => (
                    <div
                        key={key}
                        onClick={() => setActiveSubTab(key)}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontWeight: activeSubTab === key ? 600 : 'normal',
                            borderBottom: activeSubTab === key ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeSubTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
                {activeSubTab === 'info' && (
                    <div style={{ borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                            <thead style={{ backgroundColor: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '8px 12px' }}>Name</th>
                                    <th style={{ padding: '8px 12px' }}>Data Type</th>
                                    <th style={{ padding: '8px 12px' }}>PK</th>
                                    <th style={{ padding: '8px 12px' }}>Nullable</th>
                                    <th style={{ padding: '8px 12px' }}>Default</th>
                                    <th style={{ padding: '8px 12px', width: 80 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {columns.map((col, i) => (
                                    <React.Fragment key={i}>
                                        <tr style={{
                                            borderBottom: '1px solid var(--border-dim)',
                                            backgroundColor: dirty.has(i) ? 'var(--bg-toolbar)' : undefined,
                                        }}>
                                            {renderCell(col, i, 'Name')}
                                            {renderCell(col, i, 'DataType')}
                                            {renderCell(col, i, 'IsPrimaryKey')}
                                            {renderCell(col, i, 'IsNullable')}
                                            {renderCell(col, i, 'DefaultValue')}
                                            <td style={{ padding: '6px 8px' }}>
                                                {dirty.has(i) && (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button
                                                            onClick={() => saveRow(i)}
                                                            disabled={saving.has(i)}
                                                            title="Apply changes"
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 2,
                                                                padding: '2px 6px', borderRadius: 4,
                                                                border: '1px solid var(--border-color)',
                                                                background: 'var(--bg-toolbar)',
                                                                cursor: 'pointer', fontSize: 11,
                                                                color: 'var(--success-color)',
                                                            }}
                                                        >
                                                            {saving.has(i)
                                                                ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                                                : <Check size={11} />}
                                                        </button>
                                                        <button
                                                            onClick={() => discardRow(i)}
                                                            disabled={saving.has(i)}
                                                            title="Discard changes"
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 2,
                                                                padding: '2px 6px', borderRadius: 4,
                                                                border: '1px solid var(--border-color)',
                                                                background: 'var(--bg-toolbar)',
                                                                cursor: 'pointer', fontSize: 11,
                                                                color: 'var(--error-color)',
                                                            }}
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {errors[i] && (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '4px 12px', color: 'var(--error-color)', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
                                                    ⚠ {errors[i]}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {columns.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No columns found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-dim)' }}>
                            Double-click a cell to edit. Click PK / Nullable to toggle.
                        </div>
                    </div>
                )}

                {activeSubTab === 'data' && (
                    <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 6 }}>
                        (Placeholder) Data View for {tableName}
                    </div>
                )}

                {activeSubTab === 'erd' && (
                    <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 6 }}>
                        (Placeholder) ERD View for {tableName}
                    </div>
                )}
            </div>
        </div>
    );
};
