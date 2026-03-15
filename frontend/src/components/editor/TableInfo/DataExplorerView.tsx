import React from 'react';
import { ResultPanel, type ResultPanelAction } from '../ResultPanel';
import { TabAction } from './types';

interface DataExplorerViewProps {
    tabId: string;
    onRun: (filter?: string) => Promise<void>;
    result: any;
    onActionsChange: (actions: TabAction[]) => void;
    schema: string;
    table: string;
}

export const DataExplorerView: React.FC<DataExplorerViewProps> = ({
    tabId, onRun, result, onActionsChange, schema, table
}) => {
    return (
        <div className="flex-1 h-full flex flex-col min-h-0 bg-bg-primary">
            <ResultPanel
                tabId={tabId}
                onRun={onRun}
                result={result}
                onActionsChange={(actions) => {
                  // Map any actions if needed, but here simple conversion works
                  onActionsChange(actions as unknown as TabAction[]);
                }}
                onFilterRun={(filter) => onRun(filter)}
                baseQuery={result?.lastExecutedQuery || `SELECT * FROM "${schema}"."${table}"`}
            />
        </div>
    );
};
