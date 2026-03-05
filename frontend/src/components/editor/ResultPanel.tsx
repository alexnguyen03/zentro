import React from 'react';
import { AlertCircle, CheckCircle, Download, Loader, RotateCcw, Calculator, Save, Undo, Play, Copy, FilePlus } from 'lucide-react';
import { TabResult } from '../../stores/resultStore';
import { useStatusStore } from '../../stores/statusStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { ResultTable } from './ResultTable';
import { ExportCSV, FetchTotalRowCount } from '../../../wailsjs/go/app/App';
import { utils } from '../../../wailsjs/go/models';
import { useToast } from '../layout/Toast';

interface ResultPanelProps {
    tabId: string;
    result?: TabResult;
    onRun?: () => void;
}

const LIMIT_OPTIONS = [100, 500, 1000, 5000, 10000, 50000];

export const ResultPanel: React.FC<ResultPanelProps> = ({ tabId, result, onRun }) => {
    const { defaultLimit, theme, fontSize, save } = useSettingsStore();
    const addTab = useEditorStore(s => s.addTab);
    const { toast } = useToast();

    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);

    // Inline edit states
    const [editedCells, setEditedCells] = React.useState<Map<string, string>>(new Map());
    const [showSaveModal, setShowSaveModal] = React.useState(false);

    React.useEffect(() => {
        if (!result?.isDone) {
            setTotalCount(null);
            setIsCounting(false);
            setEditedCells(new Map());
            setShowSaveModal(false);
        }
    }, [result?.isDone]);

    const handleCountTotal = async () => {
        if (!tabId) return;
        setIsCounting(true);
        try {
            const count = await FetchTotalRowCount(tabId);
            setTotalCount(count);
        } catch (err) {
            toast.error(`Count failed: ${err}`);
            useStatusStore.getState().setMessage(`Count failed: ${err}`);
        } finally {
            setIsCounting(false);
        }
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(e.target.value) || 1000;
        save(new utils.Preferences({
            theme,
            font_size: fontSize,
            default_limit: newLimit,
        }));
    };

    const generateUpdateScript = React.useCallback(() => {
        if (!result?.tableName || !result?.primaryKeys || editedCells.size === 0) return '';

        const updatesByRow = new Map<number, { col: string, val: string }[]>();
        editedCells.forEach((val, cellId) => {
            const [r, c] = cellId.split(':').map(Number);
            if (!updatesByRow.has(r)) updatesByRow.set(r, []);
            updatesByRow.get(r)!.push({ col: result.columns[c], val });
        });

        const sqlStmts = Array.from(updatesByRow.entries()).map(([r, edits]) => {
            const where = result.primaryKeys!.map(pk => {
                let v = result.rows[r][result.columns.indexOf(pk)];
                return typeof v === 'string' ? `"${pk}" = '${v.replace(/'/g, "''")}'` : `"${pk}" = ${v}`;
            }).join(' AND ');
            const sets = edits.map(e => `"${e.col}" = '${e.val.replace(/'/g, "''")}'`).join(', ');
            return `UPDATE "${result.tableName}" SET ${sets} WHERE ${where};`;
        });
        return sqlStmts.join('\n');
    }, [result, editedCells]);

    const handleCopyScript = () => {
        navigator.clipboard.writeText(generateUpdateScript());
        toast.success("Script copied to clipboard");
    };

    const handleOpenInNewTab = () => {
        addTab({ name: `Update ${result?.tableName}`, query: generateUpdateScript() });
        setShowSaveModal(false);
    };

    const handleExecuteScript = () => {
        if (onRun) {
            // Ideally we should execute the actual script directly, but since ResultPanel 
            // doesn't have an execute method, we pass it back or create a new tab.
            // Let's create a new tab and run it there.
            const newTabId = addTab({ name: `Update ${result?.tableName}`, query: generateUpdateScript() });
            // Close modal, let user run it. Running manually is safer.
            setShowSaveModal(false);
            setEditedCells(new Map());
            toast.success("Script opened in new tab. Execute it there.");
        }
    };

    if (!result) {
        return (
            <div className="result-panel result-empty">
                <span>Run a query (Ctrl+Enter) to see results</span>
            </div>
        );
    }

    if (result.error) {
        return (
            <div className="result-panel result-error-state">
                <AlertCircle size={16} />
                <span>{result.error}</span>
            </div>
        );
    }

    if (!result.isSelect) {
        return (
            <div className="result-panel result-success">
                <CheckCircle size={16} />
                <span>{result.affected} rows affected · {formatDuration(result.duration)}</span>
            </div>
        );
    }

    const handleExport = async () => {
        if (!result.columns || !result.rows) return;
        try {
            const path = await ExportCSV(result.columns, result.rows);
            if (path) {
                toast.success(`Exported to: ${path}`);
                useStatusStore.getState().setMessage(`Exported to: ${path}`);
            }
        } catch (err) {
            toast.error(`Export failed: ${err}`);
            useStatusStore.getState().setMessage(`Export failed: ${err}`);
            console.error('Export failed:', err);
        }
    };

    // SELECT result
    return (
        <div className="result-panel result-table-container">
            <div className="result-toolbar">
                <div className="result-toolbar-left">
                    <span className="result-stats">
                        Showing <strong>{result.rows.length.toLocaleString()}</strong> of&nbsp;
                        <select
                            className="result-limit-select"
                            value={defaultLimit}
                            onChange={handleLimitChange}
                            title="Row limit for next query"
                        >
                            {LIMIT_OPTIONS.map(n => (
                                <option key={n} value={n}>{n.toLocaleString()}</option>
                            ))}
                        </select>
                        &nbsp;rows&nbsp;·&nbsp;{formatDuration(result.duration)}
                    </span>
                    {totalCount !== null ? (
                        <span className="result-stats" style={{ marginLeft: 8 }}>
                            (Total: <strong>{totalCount.toLocaleString()}</strong>)
                        </span>
                    ) : (
                        <button
                            className="result-toolbar-btn"
                            style={{ marginLeft: 8 }}
                            onClick={handleCountTotal}
                            disabled={isCounting || !result.isDone}
                            title="Count total rows for this query"
                        >
                            {isCounting ? <Loader size={12} className="result-spinner" /> : <Calculator size={12} />}
                            <span style={{ marginLeft: 4 }}>{isCounting ? 'Counting...' : 'Total'}</span>
                        </button>
                    )}
                </div>
                <div className="result-toolbar-center">
                    {editedCells.size > 0 && (
                        <div style={{ display: 'flex', gap: '8px', background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-warning)', display: 'flex', alignItems: 'center' }}>
                                {editedCells.size} cell(s) edited
                            </span>
                            <button
                                className="result-toolbar-btn result-reload-btn"
                                onClick={() => setShowSaveModal(true)}
                                title="Review and Save Changes"
                                style={{ color: 'var(--color-success)' }}
                            >
                                <Save size={12} />
                                <span>Save</span>
                            </button>
                            <button
                                className="result-toolbar-btn result-reload-btn"
                                onClick={() => setEditedCells(new Map())}
                                title="Discard Changes"
                            >
                                <Undo size={12} />
                                <span>Reverse</span>
                            </button>
                        </div>
                    )}
                    {onRun && editedCells.size === 0 && (
                        <button
                            className="result-toolbar-btn result-reload-btn"
                            onClick={onRun}
                            title="Re-run query (Ctrl+Enter)"
                        >
                            <RotateCcw size={12} />
                            <span>Reload</span>
                        </button>
                    )}
                </div>
                <div className="result-toolbar-right">
                    <button className="result-toolbar-btn" onClick={handleExport} title="Export as CSV">
                        <Download size={13} />
                        <span>Export</span>
                    </button>
                </div>
            </div>
            {!result.isDone ? (
                <div className="result-loading result-loading-inline">
                    <div className="result-loading-inner">
                        <Loader size={18} className="result-spinner" />
                        <span>Streaming… {result.rows.length > 0 ? `${result.rows.length.toLocaleString()} rows received` : 'executing query'}</span>
                    </div>
                    <div className="result-skeleton">
                        <div className="result-skeleton-header" />
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="result-skeleton-row" style={{ opacity: 1 - i * 0.1 }} />
                        ))}
                    </div>
                </div>
            ) : (
                <ResultTable
                    tabId={tabId}
                    columns={result.columns}
                    rows={result.rows}
                    isDone={true}
                    editedCells={editedCells}
                    setEditedCells={setEditedCells}
                />
            )}

            {/* Save Confirmation Modal */}
            {showSaveModal && (
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal-content" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Confirm Changes</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: 12 }}>
                            The following script will be generated to apply your changes:
                        </p>
                        <div style={{
                            background: '#1e1e1e',
                            padding: '12px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            color: '#d4d4d4',
                            border: '1px solid var(--color-border)',
                            marginBottom: '16px'
                        }}>
                            {generateUpdateScript()}
                        </div>
                        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                            <button className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={handleCopyScript}>
                                    <Copy size={14} style={{ marginRight: 6 }} /> Copy
                                </button>
                                <button className="btn btn-secondary" onClick={handleOpenInNewTab}>
                                    <FilePlus size={14} style={{ marginRight: 6 }} /> Open in New Tab
                                </button>
                                <button className="btn btn-primary" onClick={handleExecuteScript}>
                                    <Play size={14} style={{ marginRight: 6 }} /> To Script Mode
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
