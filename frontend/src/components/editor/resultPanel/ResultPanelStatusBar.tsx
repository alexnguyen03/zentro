import React from 'react';
import { Download, Loader } from 'lucide-react';
import { Button } from '../../ui';
import { ResultLimitSelect } from './ResultLimitSelect';

interface ResultPanelStatusBarProps {
    rowCount: number;
    defaultLimit: number;
    durationText: string;
    displayTotalCount?: number;
    totalCount: number | null;
    isCounting: boolean;
    hasChanges: boolean;
    pendingChangeCount: number;
    onLimitChange: (value: string) => void;
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
        <div className="flex items-center justify-between relative px-3 py-1 text-label text-text-secondary border-t border-border shrink-0">
            <div className="flex items-center gap-3">
                {/* <span className="flex items-center gap-1">
                    Showing <strong>{rowCount.toLocaleString()}</strong> of&nbsp;
                    <ResultLimitSelect
                        value={defaultLimit}
                        onChange={onLimitChange}
                        variant="statusbar"
                    />
                    &nbsp;rows&nbsp;·&nbsp;{durationText}
                </span> */}

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
                {hasChanges && <span className="text-label text-warning flex items-center">{pendingChangeCount} pending change(s)</span>}
            </div>

            <div className="flex items-center gap-3">
                <Button className="bg-transparent border border-transparent text-text-secondary flex items-center gap-1 px-1.5 py-0.5 rounded-sm cursor-pointer text-label transition-all duration-100 hover:bg-bg-tertiary hover:text-text-primary hover:border-border" onClick={onExport} title="Export as CSV">
                    <Download size={13} />
                    <span>Export</span>
                </Button>
            </div>
        </div>
    );
};

