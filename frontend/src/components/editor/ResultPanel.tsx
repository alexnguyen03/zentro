import React from 'react';
import { AlertCircle, CheckCircle, Download, Loader, RotateCcw, Save, RefreshCw, Play, Copy, FilePlus } from 'lucide-react';
import { TabResult, useResultStore } from '../../stores/resultStore';
import { useStatusStore } from '../../stores/statusStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { ResultTable } from './ResultTable';
import { ResultFilterBar } from './ResultFilterBar';
import { ExportCSV, FetchTotalRowCount, ExecuteUpdateSync } from '../../../wailsjs/go/app/App';
import { utils } from '../../../wailsjs/go/models';
import { useToast } from '../layout/Toast';
import { Modal } from '../layout/Modal';
import { Button, ConfirmationModal } from '../ui';
import { useRowDetailStore } from '../../stores/rowDetailStore';
import { useLayoutStore } from '../../stores/layoutStore';

export interface ResultPanelAction {
    id: string;
    icon: React.ReactNode;
    label?: string;
    title?: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    danger?: boolean;
}

interface ResultPanelProps {
    tabId: string;
    result?: TabResult;
    onRun?: () => void;
    /** Called with a WHERE filter expression; parent wraps base query and re-runs. */
    onFilterRun?: (filter: string) => void;
    onActionsChange?: (actions: ResultPanelAction[]) => void;
    /** The base query being wrapped */
    baseQuery?: string;
    /** Appends generated filter SQL to the end of the active editor */
    onAppendToQuery?: (fullQuery: string) => void;
    /** Opens generated filter SQL in a new query tab */
    onOpenInNewTab?: (fullQuery: string) => void;
}

const LIMIT_OPTIONS = [100, 500, 1000, 5000, 10000, 50000];

export const ResultPanel: React.FC<ResultPanelProps> = ({ tabId, result, onRun, onFilterRun, onActionsChange, baseQuery, onAppendToQuery, onOpenInNewTab }) => {
    const { defaultLimit, theme, fontSize, save } = useSettingsStore();
    const addTab = useEditorStore(s => s.addTab);
    const { toast } = useToast();

    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);

    // Bind filter expr to result store so "Run" can clear it externally
    const filterExpr = result?.filterExpr || '';
    const setFilterExpr = React.useCallback((val: string) => {
        useResultStore.getState().setFilterExpr(tabId, val);
    }, [tabId]);

    // Inline edit states — initialized from resultStore if available to persist between subtab switches
    const [editedCells, setEditedCells] = React.useState<Map<string, string>>(() => result?.pendingEdits ? new Map(result.pendingEdits) : new Map());
    const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
    const [deletedRows, setDeletedRows] = React.useState<Set<number>>(() => result?.pendingDeletions ? new Set(result.pendingDeletions) : new Set());
    const [showSaveModal, setShowSaveModal] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const { openDetail } = useRowDetailStore();
    const { showRightSidebar, setShowRightSidebar } = useLayoutStore();
    const lastTabTime = React.useRef(0);

    // Helper: build and push detail for a given row index
    const openRowDetail = React.useCallback((rIdx: number) => {
        if (!result?.columns || !result?.rows?.[rIdx]) return;
        openDetail({
            columns: result.columns,
            row: result.rows[rIdx],
            tableName: result.tableName,
            primaryKeys: result.primaryKeys,
            onSave: (colIdx, newVal) => {
                setEditedCells(prev => {
                    const next = new Map(prev);
                    next.set(`${rIdx}:${colIdx}`, newVal);
                    return next;
                });
            }
        });
    }, [result, openDetail, setEditedCells]);

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

    // Auto-load row detail when sidebar is already open and user clicks any cell
    React.useEffect(() => {
        if (!showRightSidebar || selectedCells.size === 0 || !result?.isDone) return;
        const firstCell = Array.from(selectedCells)[0];
        const rIdx = Number(firstCell.split(':')[0]);
        openRowDetail(rIdx);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCells]);

    // Sync local edits back to resultStore for persistence across subtab switches
    const updatePendingEdits = useResultStore(s => s.updatePendingEdits);
    React.useEffect(() => {
        updatePendingEdits(tabId, editedCells, deletedRows);
    }, [tabId, editedCells, deletedRows, updatePendingEdits]);

    // Publish actions to parent whenever relevant state changes
    const hasChanges = editedCells.size > 0 || deletedRows.size > 0;
    const isEditable = result?.tableName && result?.primaryKeys && result.primaryKeys.every(pk => result.columns.includes(pk));

    React.useEffect(() => {
        if (!onActionsChange) return;
        const actions: ResultPanelAction[] = [];

        if (hasChanges) {
            actions.push({
                id: 'discard',
                icon: <RotateCcw size={11} />,
                label: 'Discard',
                title: 'Discard',
                onClick: () => { setEditedCells(new Map()); setDeletedRows(new Set()); },
                danger: true,
            });
            actions.push({
                id: 'save',
                icon: <Save size={11} />,
                label: 'Save',
                title: 'Save',
                onClick: () => setShowSaveModal(true),
            });
        }

        if (!hasChanges && onRun) {
            actions.push({
                id: 'reload',
                icon: <RefreshCw size={11} />,
                label: 'Reload',
                title: 'Reload',
                onClick: onRun,
            });
        }

        onActionsChange(actions);
    }, [hasChanges, onRun, onActionsChange]);

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
            <div className="flex items-center justify-center h-full text-[13px] text-text-secondary">
                <span>Run a query (Ctrl+Enter) to see results</span>
            </div>
        );
    }

    if (result.error) {
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-error gap-2">
                <AlertCircle size={16} />
                <span>{result.error}</span>
            </div>
        );
    }

    if (!result.isSelect) {
        return (
            <div className="flex items-center justify-center h-full text-[13px] text-success gap-2">
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'Tab') {
            if (selectedCells.size > 0 && result.columns && result.rows) {
                e.preventDefault();
                const now = Date.now();
                if (now - lastTabTime.current < 400) {
                    // Double tab — open sidebar if not open
                    const firstCell = Array.from(selectedCells)[0];
                    const rIdx = Number(firstCell.split(':')[0]);
                    openRowDetail(rIdx);
                    setShowRightSidebar(true);
                    lastTabTime.current = 0; // reset
                } else {
                    lastTabTime.current = now;
                }
            }
        }

        if (e.key === 'Delete' || (e.key === 'Backspace' && (e.ctrlKey || e.metaKey))) {
            const rowsToDelete = Array.from(selectedCells).map(cell => Number(cell.split(':')[0]));
            if (rowsToDelete.length === 0) return;
            
            e.preventDefault();
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
                Array.from(selectedCells).map(c => {
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
            className="flex flex-col items-stretch justify-start h-full text-[13px] text-text-secondary overflow-hidden"
            ref={containerRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{ outline: 'none' }}
        >
            {/* Progressive rendering: keep old table visible while reloading */}
            {(() => {
                const hasData = result.columns.length > 0;
                const isLoading = !result.isDone;

                // First run with NO data yet — show minimal streaming indicator
                if (isLoading && !hasData) {
                    return (
                        <div className="flex flex-col items-stretch flex-1 overflow-hidden min-h-0 text-success gap-0">
                            <div className="flex flex-row items-center gap-2 px-3 py-2 text-xs border-b border-border shrink-0">
                                <Loader size={14} className="animate-spin" />
                                <span className="text-text-secondary">
                                    {result.rows.length > 0
                                        ? `Streaming… ${result.rows.length.toLocaleString()} rows`
                                        : 'Executing query…'}
                                </span>
                            </div>
                        </div>
                    );
                }

                // Has data (either done or reloading over existing data)
                return (
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0 relative">
                        {/* Thin progress bar on reload */}
                        {isLoading && (
                            <div
                                className="absolute top-0 left-0 right-0 z-10"
                                style={{ height: 2, background: 'var(--success-color)', opacity: 0.7 }}
                            >
                                <div style={{
                                    height: '100%',
                                    width: '40%',
                                    background: 'rgba(255,255,255,0.6)',
                                    animation: 'shimmer 1.2s infinite linear',
                                    backgroundSize: '400px 100%',
                                }} />
                            </div>
                        )}

                        {/* Filter bar - always visible if it's a select context */}
                        {(result.isSelect || filterExpr !== '') && (
                            <ResultFilterBar
                                value={filterExpr}
                                onChange={setFilterExpr}
                                baseQuery={baseQuery}
                                onAppendToQuery={onAppendToQuery}
                                onOpenInNewTab={onOpenInNewTab}
                                onRun={() => { if (filterExpr.trim()) onFilterRun?.(filterExpr); }}
                                onClear={() => {
                                    setFilterExpr('');
                                    onFilterRun?.('');
                                }}
                            />
                        )}

                        {/* Table — always visible, slightly dimmed while reloading */}
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isLoading ? 0.5 : 1 }}>
                            <ResultTable
                                tabId={tabId}
                                columns={result.columns}
                                rows={result.rows}
                                isDone={result.isDone}
                                editedCells={editedCells}
                                setEditedCells={setEditedCells}
                                selectedCells={selectedCells}
                                setSelectedCells={setSelectedCells}
                                deletedRows={deletedRows}
                                setDeletedRows={setDeletedRows}
                            />
                        </div>
                    </div>
                );
            })()}
            {/* Bottom status bar */}
            <div className="flex items-center justify-between relative px-3 py-1 text-[11px] text-text-secondary border-t border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        Showing <strong>{result.rows.length.toLocaleString()}</strong> of&nbsp;
                        <select
                            className="bg-transparent border border-transparent text-text-secondary text-[11px] px-0.5 py-px rounded-sm cursor-pointer outline-none transition-colors duration-100 hover:border-border hover:bg-bg-tertiary focus:border-success appearance-auto"
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
                        <span className="flex items-center gap-1">
                            (Total: <strong>{displayTotalCount.toLocaleString()}</strong>)
                        </span>
                    ) : totalCount === -1 ? (
                        <span className="flex items-center gap-1 text-warning" title="Failed to count total rows in background">
                            (Total: ?)
                        </span>
                    ) : isCounting ? (
                        <span className="flex items-center gap-1 opacity-70">
                            <Loader size={12} className="animate-spin inline-block align-middle mr-1" />
                            Counting...
                        </span>
                    ) : null}
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                    {hasChanges && (
                        <span className="text-[11px] text-warning flex items-center">
                            {editedCells.size + deletedRows.size} pending change(s)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-transparent border border-transparent text-text-secondary flex items-center gap-1 px-1.5 py-0.5 rounded-sm cursor-pointer text-[11px] transition-all duration-100 hover:bg-bg-tertiary hover:text-text-primary hover:border-border" onClick={handleExport} title="Export as CSV">
                        <Download size={13} />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* Save Confirmation Modal */}
            <Modal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                title="Confirm Changes"
                width={560}
                footer={
                    <>
                        <Button variant="ghost" size="icon" onClick={handleCopyScript} title="Copy Script">
                            <Copy size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleOpenInNewTab} title="Open in New Tab">
                            <FilePlus size={14} />
                        </Button>
                        <Button variant="primary" onClick={handleDirectExecute} title="Execute Update" autoFocus className="px-6">
                            <Play size={14} className="mr-2" />
                            Execute Changes
                        </Button>
                    </>
                }
            >
                <div>
                    <div className="flex items-start gap-4 mb-4">
                        <div className="shrink-0 p-2 rounded-full bg-accent/10">
                            <AlertCircle size={20} className="text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-text-primary mb-1">Review generated script</p>
                            <p className="text-[12px] leading-relaxed text-text-secondary">
                                The following SQL will be executed to apply your pending edits and deletions to <strong>{result?.tableName}</strong>.
                            </p>
                        </div>
                    </div>
                    
                    <div className="p-3 bg-bg-tertiary/50 border border-border/40 rounded-lg font-mono text-[11px] max-h-[260px] overflow-y-auto whitespace-pre-wrap text-text-secondary select-text">
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
