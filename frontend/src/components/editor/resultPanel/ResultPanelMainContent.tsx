import React from 'react';
import { Loader } from 'lucide-react';
import type { DraftRow } from '../../../lib/dataEditing';
import { models } from '../../../../wailsjs/go/models';
import { TabResult } from '../../../stores/resultStore';
import { ResultFilterBar } from '../ResultFilterBar';
import { ResultTable } from '../ResultTable';

interface ResultPanelMainContentProps {
    tabId: string;
    result: TabResult;
    filterExpr: string;
    onFilterExprChange: (value: string) => void;
    onFilterRun?: (filter: string) => void;
    baseQuery?: string;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
    editedCells: Map<string, string>;
    setEditedCells: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    selectedCells: Set<string>;
    setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>;
    deletedRows: Set<number>;
    setDeletedRows: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export const ResultPanelMainContent: React.FC<ResultPanelMainContentProps> = ({
    tabId,
    result,
    filterExpr,
    onFilterExprChange,
    onFilterRun,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    editedCells,
    setEditedCells,
    selectedCells,
    setSelectedCells,
    deletedRows,
    setDeletedRows,
}) => {
    const [selectedRowKeys, setSelectedRowKeys] = React.useState<Set<string>>(new Set());
    const [draftRows, setDraftRows] = React.useState<DraftRow[]>([]);
    const hasData = result.columns.length > 0;
    const isLoading = !result.isDone;

    if (isLoading && !hasData) {
        return (
            <div className="flex flex-col items-stretch flex-1 overflow-hidden min-h-0 text-success gap-0">
                <div className="flex flex-row items-center gap-2 px-3 py-2 text-small border-b border-border shrink-0">
                    <Loader size={14} className="animate-spin" />
                    <span className="text-text-secondary">
                        {result.rows.length > 0
                            ? `Streaming... ${result.rows.length.toLocaleString()} rows`
                            : 'Executing query...'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0 relative">
            {isLoading && (
                <div className="absolute top-0 left-0 right-0 z-10" style={{ height: 2, background: 'var(--success-color)', opacity: 0.7 }}>
                    <div
                        style={{
                            height: '100%',
                            width: '40%',
                            background: 'rgba(255,255,255,0.6)',
                            animation: 'shimmer 1.2s infinite linear',
                            backgroundSize: '400px 100%',
                        }}
                    />
                </div>
            )}

            {(result.isSelect || filterExpr !== '') && (
                <ResultFilterBar
                    value={filterExpr}
                    onChange={onFilterExprChange}
                    baseQuery={baseQuery}
                    onAppendToQuery={onAppendToQuery}
                    onOpenInNewTab={onOpenInNewTab}
                    onRun={() => {
                        if (filterExpr.trim()) {
                            onFilterRun?.(filterExpr);
                        }
                    }}
                    onClear={() => {
                        onFilterExprChange('');
                        onFilterRun?.('');
                    }}
                />
            )}

            <div
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: isLoading ? 0.5 : 1,
                }}
            >
                <ResultTable
                    tabId={tabId}
                    columns={result.columns}
                    rows={result.rows}
                    isDone={result.isDone}
                    editedCells={editedCells}
                    setEditedCells={setEditedCells}
                    selectedCells={selectedCells}
                    setSelectedCells={setSelectedCells}
                    selectedRowKeys={selectedRowKeys}
                    setSelectedRowKeys={setSelectedRowKeys}
                    deletedRows={deletedRows}
                    setDeletedRows={setDeletedRows}
                    draftRows={draftRows}
                    setDraftRows={setDraftRows}
                    columnDefs={[] as models.ColumnDef[]}
                    focusCellRequest={null}
                    onFocusCellRequestHandled={() => {}}
                    onRemoveDraftRows={() => {}}
                />
            </div>
        </div>
    );
};
