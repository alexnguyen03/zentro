import React from 'react';
import { AlertCircle, CheckCircle, Download, Loader, RotateCcw, Calculator } from 'lucide-react';
import { TabResult } from '../../stores/resultStore';
import { useStatusStore } from '../../stores/statusStore';
import { useSettingsStore } from '../../stores/settingsStore';
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
    const { toast } = useToast();

    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);

    React.useEffect(() => {
        if (!result?.isDone) {
            setTotalCount(null);
            setIsCounting(false);
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
                    {onRun && (
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
                />
            )}
        </div>
    );
};

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
