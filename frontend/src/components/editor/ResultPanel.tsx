import React from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { TabResult } from '../../stores/resultStore';

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

    if (!result.isDone) {
        return (
            <div className="result-panel result-loading">
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Streaming results… {result.rows.length.toLocaleString()} rows received</span>
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

    // SELECT result: placeholder table header until Phase 5 wires TanStack grid
    return (
        <div className="result-panel result-table-container">
            <div className="result-meta">
                <span>{result.rows.length.toLocaleString()} rows · {formatDuration(result.duration)}</span>
            </div>
            <div className="result-table-scroll">
                <table className="result-table">
                    <thead>
                        <tr>
                            <th className="row-num-col">#</th>
                            {result.columns.map((col) => (
                                <th key={col} title={col}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {result.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className={rowIdx % 2 === 0 ? '' : 'alt'}>
                                <td className="row-num-col">{rowIdx + 1}</td>
                                {row.map((cell, colIdx) => (
                                    <td key={colIdx} title={cell}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

function formatDuration(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
