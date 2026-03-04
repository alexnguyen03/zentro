import React from 'react';
import { AlertCircle, CheckCircle, Download, Loader } from 'lucide-react';
import { TabResult } from '../../stores/resultStore';
import { useStatusStore } from '../../stores/statusStore';
import { ResultTable } from './ResultTable';
import { ExportCSV } from '../../../wailsjs/go/app/App';

interface ResultPanelProps {
    tabId: string;
    result?: TabResult;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ tabId, result }) => {
    if (!result) {
        return (
            <div className="result-panel result-empty">
                <span>Run a query to see results</span>
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

    // Show loading skeleton while streaming — avoid jitter from incremental renders
    if (!result.isDone) {
        return (
            <div className="result-panel result-loading">
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
        );
    }

    const handleExport = async () => {
        if (!result.columns || !result.rows) return;
        try {
            const path = await ExportCSV(result.columns, result.rows);
            if (path) {
                useStatusStore.getState().setMessage(`Exported to: ${path}`);
            }
        } catch (err) {
            useStatusStore.getState().setMessage(`Export failed: ${err}`);
            console.error('Export failed:', err);
        }
    };

    // SELECT result — fully rendered only when done
    return (
        <div className="result-panel result-table-container">
            <div className="result-toolbar">
                <div className="result-toolbar-left">
                    <span className="result-stats">{result.rows.length.toLocaleString()} rows · {formatDuration(result.duration)}</span>
                </div>
                <div className="result-toolbar-right">
                    <button className="result-toolbar-btn" onClick={handleExport} title="Export as CSV">
                        <Download size={13} />
                        <span>Export</span>
                    </button>
                </div>
            </div>
            <ResultTable
                columns={result.columns}
                rows={result.rows}
                isDone={true}
            />
        </div>
    );
};

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
