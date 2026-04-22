import React from 'react';
import { Download, Loader } from 'lucide-react';

const LIMIT_OPTIONS = [100, 500, 1000, 5000, 10000, 50000];

interface ResultPanelStatusBarProps {
    rowCount: number;
    defaultLimit: number;
    durationText: string;
    displayTotalCount?: number;
    totalCount: number | null;
    isCounting: boolean;
    hasChanges: boolean;
    pendingChangeCount: number;
    onLimitChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    onExport: () => void;
}

export const ResultPanelStatusBar: React.FC<ResultPanelStatusBarProps> = ({
    rowCount,
    defaultLimit,
    durationText,
    displayTotalCount,
    totalCount,
    isCounting,
    hasChanges,
    pendingChangeCount,
    onLimitChange,
    onExport,
}) => {
    return (
        <div className="flex items-center justify-between relative px-3 py-1 text-[11px] text-text-secondary border-t border-border shrink-0">
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                    Showing <strong>{rowCount.toLocaleString()}</strong> of&nbsp;
                    <select
                        className="bg-transparent border border-transparent text-text-secondary text-[11px] px-0.5 py-px rounded-sm cursor-pointer outline-none transition-colors duration-100 hover:border-border hover:bg-bg-tertiary focus:border-success appearance-auto"
                        value={defaultLimit}
                        onChange={onLimitChange}
                        title="Row limit for next query"
                    >
                        {LIMIT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option.toLocaleString()}
                            </option>
                        ))}
                    </select>
                    &nbsp;rows&nbsp;·&nbsp;{durationText}
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
                {hasChanges && <span className="text-[11px] text-warning flex items-center">{pendingChangeCount} pending change(s)</span>}
            </div>

            <div className="flex items-center gap-3">
                <button
                    className="bg-transparent border border-transparent text-text-secondary flex items-center gap-1 px-1.5 py-0.5 rounded-sm cursor-pointer text-[11px] transition-all duration-100 hover:bg-bg-tertiary hover:text-text-primary hover:border-border"
                    onClick={onExport}
                    title="Export as CSV"
                >
                    <Download size={13} />
                    <span>Export</span>
                </button>
            </div>
        </div>
    );
};
