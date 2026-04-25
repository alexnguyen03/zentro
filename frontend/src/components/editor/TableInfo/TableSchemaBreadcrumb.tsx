import React from 'react';
import { Database, Layers, Table2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useSchemaStore } from '../../../stores/schemaStore';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui';

interface TableSchemaBreadcrumbProps {
    dbName: string;
    schema: string;
    table: string;
    onSelectTable: (nextTableName: string) => void;
    isCreateMode?: boolean;
    draftTableName?: string;
    onDraftTableNameChange?: (nextName: string) => void;
    onDraftTableNameReset?: () => void;
    tableInputRef?: React.Ref<HTMLInputElement>;
}

export const TableSchemaBreadcrumb: React.FC<TableSchemaBreadcrumbProps> = ({
    dbName,
    schema,
    table,
    onSelectTable,
    isCreateMode = false,
    draftTableName = '',
    onDraftTableNameChange,
    onDraftTableNameReset,
    tableInputRef,
}) => {
    const activeProfile = useConnectionStore((state) => state.activeProfile);
    const schemaTreeKey = activeProfile?.name && activeProfile?.db_name
        ? `${activeProfile.name}:${activeProfile.db_name}`
        : '';
    const schemas = useSchemaStore((state) => (schemaTreeKey ? state.trees[schemaTreeKey] : undefined));

    const tablesInSchema = React.useMemo(() => {
        const normalizedSchema = schema.trim().toLowerCase();
        const schemaNode = schemas?.find((node) => node.Name.trim().toLowerCase() === normalizedSchema);
        const next = new Set((schemaNode?.Tables || []).filter(Boolean));
        if (table) next.add(table);
        return Array.from(next).sort((left, right) => left.localeCompare(right));
    }, [schema, schemas, table]);

    const hasTableOptions = tablesInSchema.length > 0;
    const isCurrentTable = (name: string) => name.trim().toLowerCase() === table.trim().toLowerCase();

    return (
        <Breadcrumb>
            <BreadcrumbList className="flex-nowrap h-8">
                <BreadcrumbItem>
                    <BreadcrumbPage className="inline-flex items-center gap-1.5 text-body! text-foreground">
                        <Database size={12} className="shrink-0 text-muted-foreground" />
                        {dbName || 'N/A'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="inline-flex items-center gap-1.5 text-body! text-foreground">
                        <Layers size={12} className="shrink-0 text-muted-foreground" />
                        {schema || 'N/A'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    {isCreateMode ? (
                        <div className="inline-flex h-6 max-w-[320px] items-center gap-1.5">
                            <Table2 size={12} className="shrink-0 text-muted-foreground" />
                            <Input
                                ref={tableInputRef}
                                type="text"
                                value={draftTableName}
                                onChange={(event) => onDraftTableNameChange?.(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        onDraftTableNameReset?.();
                                    }
                                }}
                                placeholder="new_table"
                                className="h-6 w-[220px] border-border/60 bg-background px-2 py-0 text-small"
                            />
                        </div>
                    ) : (
                        hasTableOptions ? (
                            <Select
                                value={table || tablesInSchema[0]}
                                onValueChange={(value) => {
                                    if (isCurrentTable(value)) return;
                                    onSelectTable(value);
                                }}
                            >
                                <SelectTrigger
                                    aria-label="Select table"
                                    title={table || 'N/A'}
                                    className={cn(
                                        'outline-none flex h-8 max-w-65 min-w-0 rounded-sm border-0 bg-transparent px-1.5 text-body! text-foreground shadow-none hover:bg-muted/70 focus:ring-0',
                                    )}
                                >
                                    <div className="inline-flex min-w-0 items-center gap-1.5">
                                        <Table2 size={12} className="shrink-0 text-muted-foreground" />
                                        <span className="truncate">
                                            <SelectValue />
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {tablesInSchema.map((tableName) => (
                                        <SelectItem key={tableName} value={tableName}>
                                            {tableName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <BreadcrumbPage className="inline-flex items-center gap-1.5 text-body! text-foreground opacity-80">
                                <Table2 size={12} className="shrink-0 text-muted-foreground" />
                                {table || 'N/A'}
                            </BreadcrumbPage>
                        )
                    )}
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
};
