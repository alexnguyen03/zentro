import React from 'react';
import { ErdView } from '../ErdView';

interface RelationshipViewProps {
    schema: string;
    table: string;
    refreshKey: number;
    onCountChange: (count: number | null) => void;
}

export const RelationshipView: React.FC<RelationshipViewProps> = ({
    schema, table, refreshKey, onCountChange
}) => {
    return (
        <div className="flex-1 h-full relative flex flex-col min-h-0 bg-background">
             <ErdView key={refreshKey} schema={schema} table={table} onCountChange={onCountChange} />
        </div>
    );
};
