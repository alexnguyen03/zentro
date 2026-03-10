import React from 'react';
import { AlertCircle, CheckCircle, Download, Loader, RotateCcw, Calculator, Save, Undo, Play, Copy, FilePlus, Trash } from 'lucide-react';
import { TabResult, useResultStore } from '../../stores/resultStore';
import { useStatusStore } from '../../stores/statusStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { ResultTable } from './ResultTable';
import { ExportCSV, FetchTotalRowCount, ExecuteUpdateSync } from '../../../wailsjs/go/app/App';
import { utils } from '../../../wailsjs/go/models';
import { useToast } from '../layout/Toast';
import { Modal } from '../layout/Modal';

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
    const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
    const [deletedRows, setDeletedRows] = React.useState<Set<number>>(new Set());
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleCountTotal = React.useCallback(async () => {
        if (!tabId) return;
        setIsCounting(true);
        try {
            const count = await FetchTotalRowCount(tabId);
            setTotalCount(count);
        } catch (err) {
            console.warn(`Count failed in background: ${err}`);
            setTotalCount(-1);
        } finally {
            setIsCounting(false);
        }
    }, [tabId]);

    const prevIsDone = React.useRef(result?.isDone);

    React.useEffect(() => {
        if (!result) return;

        // This triggers when result.isDone transitions
        if (prevIsDone.current !== result.isDone) {
            if (!result.isDone) {
                // New query started
                setTotalCount(null);
                setIsCounting(false);
                setEditedCells(new Map());
                setSelectedCells(new Set());
                setDeletedRows(new Set());
                setShowSaveModal(false);

                // Automatically count in parallel
                handleCountTotal();

                // Focus container to enable keyboard shortcuts
                setTimeout(() => {
                    containerRef.current?.focus({ preventScroll: true });
                }, 50);
            }
            prevIsDone.current = result.isDone;
        }
    }, [result?.isDone, handleCountTotal]);

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(e.target.value) || 1000;
        save(new utils.Preferences({
            theme,
            font_size: fontSize,
            default_limit: newLimit,
        }));
    };

    const generateUpdateScript = React.useCallback(() => {
        if (!result?.tableName || !result?.primaryKeys || (editedCells.size === 0 && deletedRows.size === 0)) return '';

        const sqlStmts: string[] = [];

        // 1. DELETE statements
        Array.from(deletedRows).sort((a, b) => b - a).forEach(r => {
            const where = result.primaryKeys!.map(pk => {
                let v = result.rows[r][result.columns.indexOf(pk)];
                return typeof v === 'string' ? `"${pk}" = '${v.replace(/'/g, "''")}'` : `"${pk}" = ${v}`;
            }).join(' AND ');
            sqlStmts.push(`DELETE FROM "${result.tableName}" WHERE ${where};`);
        });

        // 2. UPDATE statements
        const updatesByRow = new Map<number, { col: string, val: string }[]>();
        editedCells.forEach((val, cellId) => {
            const [rStr, cStr] = cellId.split(':');
            const r = Number(rStr);
            if (deletedRows.has(r)) return; // Skip edits for deleted rows
            const c = Number(cStr);
            if (!updatesByRow.has(r)) updatesByRow.set(r, []);
            updatesByRow.get(r)!.push({ col: result.columns[c], val });
        });

        updatesByRow.forEach((edits, r) => {
            const where = result.primaryKeys!.map(pk => {
                let v = result.rows[r][result.columns.indexOf(pk)];
                return typeof v === 'string' ? `"${pk}" = '${v.replace(/'/g, "''")}'` : `"${pk}" = ${v}`;
            }).join(' AND ');
            const sets = edits.map(e => `"${e.col}" = '${e.val.replace(/'/g, "''")}'`).join(', ');
            sqlStmts.push(`UPDATE "${result.tableName}" SET ${sets} WHERE ${where};`);
        });

        return sqlStmts.join('\n');
    }, [result, editedCells, deletedRows]);

    const handleCopyScript = () => {
        navigator.clipboard.writeText(generateUpdateScript());
        toast.success("Script copied to clipboard");
    };

    const handleOpenInNewTab = () => {
        addTab({ name: `Update ${result?.tableName}`, query: generateUpdateScript() });
        setShowSaveModal(false);
        setEditedCells(new Map());
        setDeletedRows(new Set());
        toast.success("Script opened in a new tab.");
    };

    const applyEdits = useResultStore(s => s.applyEdits);

    const handleDirectExecute = async () => {
        const script = generateUpdateScript();
        if (!script) return;
        try {
            setShowSaveModal(false);
            const affected = await ExecuteUpdateSync(script);
            applyEdits(tabId, editedCells, deletedRows);
            setEditedCells(new Map());
            setDeletedRows(new Set());
            toast.success(`Update executed successfully (${affected} row${affected !== 1 ? 's' : ''} modified).`);
        } catch (err: any) {
            toast.error(`Update failed: ${err}`);
            console.error('Execute update error:', err);
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

    let displayTotalCount: number | undefined = undefined;
    if (totalCount !== null && totalCount >= 0) {
        displayTotalCount = totalCount;
    } else if (result.isDone && !result.hasMore) {
        displayTotalCount = result.rows.length;
    }

    const isEditable = result?.tableName && result?.primaryKeys && result.primaryKeys.every(pk => result.columns.includes(pk));

    // SELECT result
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'Delete' && isEditable && selectedCells.size > 0) {
            e.preventDefault();
            const rowsToDelete = new Set(Array.from(selectedCells).map(cell => Number(cell.split(':')[0])));
            setDeletedRows(prev => new Set([...prev, ...rowsToDelete]));
            setSelectedCells(new Set());
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            if (editedCells.size > 0 || deletedRows.size > 0) {
                e.preventDefault();
                setShowSaveModal(true);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            if (selectedCells.size > 0) {
                e.preventDefault();
                let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                const cells = Array.from(selectedCells).map(c => {
                    const [r, col] = c.split(':').map(Number);
                    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
                    minC = Math.min(minC, col); maxC = Math.max(maxC, col);
                    return { r, c: col };
                });

                const matrix: string[][] = [];
                for (let r = minR; r <= maxR; r++) {
                    const row: string[] = [];
                    for (let c = minC; c <= maxC; c++) {
                        const cellId = `${r}:${c}`;
                        if (selectedCells.has(cellId)) {
                            row.push(editedCells.has(cellId) ? editedCells.get(cellId)! : String(result.rows[r][c] ?? ''));
                        } else {
                            row.push('');
                        }
                    }
                    matrix.push(row);
                }
                const text = matrix.map(r => r.join('\t')).join('\n');
                navigator.clipboard.writeText(text);
                toast.success(`Copied ${cells.length} cell(s)`);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (isEditable && selectedCells.size > 0) {
                e.preventDefault();
                navigator.clipboard.readText().then(text => {
                    if (!text) return;

                    const lines = text.split(/\r?\n/).map(l => l.split('\t'));
                    if (lines.length === 0 || lines[0].length === 0) return;

                    let minR = Infinity, minC = Infinity;
                    selectedCells.forEach(cellId => {
                        const [r, c] = cellId.split(':').map(Number);
                        minR = Math.min(minR, r);
                        minC = Math.min(minC, c);
                    });

                    // Single value fill mode
                    if (lines.length === 1 && lines[0].length === 1) {
                        const val = lines[0][0];
                        setEditedCells(prev => {
                            const next = new Map(prev);
                            selectedCells.forEach(cellId => {
                                const r = Number(cellId.split(':')[0]);
                                if (!deletedRows.has(r)) next.set(cellId, val);
                            });
                            return next;
                        });
                        return;
                    }

                    // Grid paste mode
                    const pastedCells = new Set<string>();
                    setEditedCells(prev => {
                        const next = new Map(prev);
                        for (let i = 0; i < lines.length; i++) {
                            const r = minR + i;
                            if (r >= result.rows.length || deletedRows.has(r)) continue;

                            for (let j = 0; j < lines[i].length; j++) {
                                const c = minC + j;
                                if (c >= result.columns.length) break;

                                const val = lines[i][j];
                                next.set(`${r}:${c}`, val);
                                pastedCells.add(`${r}:${c}`);
                            }
                        }
                        return next;
                    });

                    if (pastedCells.size > 0) {
                        setSelectedCells(pastedCells);
                    }
                }).catch(err => {
                    console.error('Paste error:', err);
                    toast.error("Failed to read from clipboard");
                });
            }
        }
    };

    return (
        <div
            className="result-panel result-table-container"
            ref={containerRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{ outline: 'none' }}
        >
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
                    {displayTotalCount !== undefined ? (
                        <span className="result-stats" style={{ marginLeft: 8 }}>
                            (Total: <strong>{displayTotalCount.toLocaleString()}</strong>)
                        </span>
                    ) : totalCount === -1 ? (
                        <span className="result-stats" style={{ marginLeft: 8, color: 'var(--color-warning)' }} title="Failed to count total rows in background">
                            (Total: ?)
                        </span>
                    ) : isCounting ? (
                        <span className="result-stats" style={{ marginLeft: 8, opacity: 0.7 }}>
                            <Loader size={12} className="result-spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
                            Counting...
                        </span>
                    ) : null}
                </div>
                <div className="result-toolbar-center">
                    {isEditable && selectedCells.size > 0 && (
                        <button
                            className="result-toolbar-btn result-reload-btn"
                            onClick={() => {
                                const rowsToDelete = new Set(Array.from(selectedCells).map(cell => Number(cell.split(':')[0])));
                                setDeletedRows(prev => new Set([...prev, ...rowsToDelete]));
                                setSelectedCells(new Set());
                            }}
                            title="Delete Selected Rows"
                            style={{ color: 'var(--color-error)' }}
                        >
                            <Trash size={12} />
                            <span>Delete</span>
                        </button>
                    )}
                    {(editedCells.size > 0 || deletedRows.size > 0) && (
                        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-warning)', display: 'flex', alignItems: 'center' }}>
                                {editedCells.size + deletedRows.size} pending change(s)
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
                                onClick={() => {
                                    setEditedCells(new Map());
                                    setDeletedRows(new Set());
                                }}
                                title="Discard Changes"
                            >
                                <Undo size={12} />
                                <span>Reverse</span>
                            </button>
                        </div>
                    )}
                    {onRun && editedCells.size === 0 && deletedRows.size === 0 && (
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
                    selectedCells={selectedCells}
                    setSelectedCells={setSelectedCells}
                    deletedRows={deletedRows}
                />
            )}

            {/* Save Confirmation Modal */}
            <Modal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                title="Confirm Changes"
                width={600}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <button className="btn" onClick={() => setShowSaveModal(false)}>Cancel</button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn" onClick={handleCopyScript}>
                                <Copy size={14} style={{ marginRight: 6 }} /> Copy
                            </button>
                            <button className="btn" onClick={handleOpenInNewTab}>
                                <FilePlus size={14} style={{ marginRight: 6 }} /> Open in New Tab
                            </button>
                            <button className="btn primary" onClick={handleDirectExecute}>
                                <Play size={14} style={{ marginRight: 6 }} /> Execute Update
                            </button>
                        </div>
                    </div>
                }
            >
                <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: 12 }}>
                        The following script will be generated to apply your changes:
                    </p>
                    <div style={{
                        background: 'var(--color-bg-tertiary)',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)'
                    }}>
                        {generateUpdateScript()}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
