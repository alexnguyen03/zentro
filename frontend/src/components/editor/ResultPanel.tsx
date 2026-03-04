import React from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { TabResult } from '../../stores/resultStore';
import { ResultTable } from './ResultTable';

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

    // SELECT result (streaming or done)
    return (
        <div className="result-panel result-table-container">
            <div className="result-meta">
                <span>
                    {result.rows.length.toLocaleString()} rows
                    {result.isDone ? ` · ${formatDuration(result.duration)}` : ''}
                </span>
                {!result.isDone && (
                    <span className="result-streaming-badge">
                        <Loader size={11} className="result-spinner" />
                        streaming…
                    </span>
                )}
            </div>
            <ResultTable
                columns={result.columns}
                rows={result.rows}
                isDone={result.isDone}
            />
        </div>
    );
};

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
