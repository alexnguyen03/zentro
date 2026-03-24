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
    isReadOnlyMode?: boolean;
}

export const DataExplorerView: React.FC<DataExplorerViewProps> = ({
    tabId, onRun, result, onActionsChange, schema, table, isReadOnlyMode = false
}) => {
    const handleActionsChange = React.useCallback((actions: ResultPanelAction[]) => {
        onActionsChange(actions as unknown as TabAction[]);
    }, [onActionsChange]);

    const handleFilterRun = React.useCallback((filter: string) => {
        onRun(filter);
    }, [onRun]);

    return (
        <div className="flex-1 h-full flex flex-col min-h-0 bg-bg-primary">
            <ResultPanel
                tabId={tabId}
                onRun={onRun}
                result={result}
                onActionsChange={handleActionsChange}
                onFilterRun={handleFilterRun}
                baseQuery={result?.lastExecutedQuery || `SELECT * FROM "${schema}"."${table}"`}
                isReadOnlyTab={isReadOnlyMode}
            />
        </div>
    );
};
