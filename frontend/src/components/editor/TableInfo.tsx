import React, { useEffect, useState } from 'react';
import { FetchTableColumns } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { Loader } from 'lucide-react';

interface TableInfoProps {
    tabId: string;
    tableName: string; // "schema.table"
}

export const TableInfo: React.FC<TableInfoProps> = ({ tabId, tableName }) => {
    const [columns, setColumns] = useState<models.ColumnDef[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'info' | 'data' | 'erd'>('info');

    useEffect(() => {
        let isMounted = true;
        const loadInfo = async () => {
            try {
                setLoading(true);
                setError(null);

                // Parse schema.table
                let schema = "";
                let table = tableName;
                const parts = tableName.split('.');
                if (parts.length > 1) {
                    schema = parts[0];
                    table = parts.slice(1).join('.'); // just in case
                }

                const cols = await FetchTableColumns(schema, table);
                if (isMounted) setColumns(cols);
            } catch (err: any) {
                if (isMounted) setError(err.toString());
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadInfo();
        return () => { isMounted = false; };
    }, [tableName]);

    if (loading) {
        return (
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Loading table schema...
            </div>
        );
    }

    if (error) {
        return <div style={{ padding: 20, color: 'var(--error-color)' }}>{error}</div>;
    }

    return (
        <div className="table-info-pane" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>Table: {tableName}</h2>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
                {(['info', 'data', 'erd'] as const).map(tab => (
                    <div
                        key={tab}
                        onClick={() => setActiveSubTab(tab)}
                        style={{
                            padding: '8px 16px',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontWeight: activeSubTab === tab ? 600 : 'normal',
                            borderBottom: activeSubTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeSubTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        {tab === 'info' ? 'Info' : tab === 'data' ? 'Data' : 'ERD'}
                    </div>
                ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
                {activeSubTab === 'info' && (
                    <div className="table-container" style={{ borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                            <thead style={{ backgroundColor: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '8px 12px' }}>Name</th>
                                    <th style={{ padding: '8px 12px' }}>Data Type</th>
                                    <th style={{ padding: '8px 12px' }}>PK</th>
                                    <th style={{ padding: '8px 12px' }}>Nullable</th>
                                    <th style={{ padding: '8px 12px' }}>Default</th>
                                </tr>
                            </thead>
                            <tbody>
                                {columns?.map((col, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: col.IsPrimaryKey ? 600 : 'normal' }}>
                                            {col.Name}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{col.DataType}</td>
                                        <td style={{ padding: '8px 12px' }}>{col.IsPrimaryKey ? '🔑' : ''}</td>
                                        <td style={{ padding: '8px 12px' }}>{col.IsNullable ? 'YES' : 'NO'}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                            {col.DefaultValue || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {(!columns || columns.length === 0) && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No columns found or empty table.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
