import React from 'react';
import { ChevronDown, Database, Layers, Table2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useSchemaStore } from '../../../stores/schemaStore';
import {
    Button,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
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
    const [tableMenuOpen, setTableMenuOpen] = React.useState(false);
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
                    <BreadcrumbPage className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                        <Database size={12} className="shrink-0 text-muted-foreground" />
                        {dbName || 'N/A'}
                    </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
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
                                className="h-6 w-[220px] border-border/60 bg-background px-2 py-0 text-[12px] font-semibold"
                            />
                        </div>
                    ) : (
                        <DropdownMenu open={tableMenuOpen} onOpenChange={setTableMenuOpen}>
                            <DropdownMenuTrigger asChild>
                                <BreadcrumbLink asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            'h-8 max-w-65 items-center gap-1 rounded-sm px-1.5 text-[11px] font-semibold text-foreground',
                                            !hasTableOptions && 'opacity-80',
                                        )}
                                        disabled={!hasTableOptions}
                                    >
                                        <Table2 size={12} className="shrink-0 text-muted-foreground" />
                                        <span className="truncate">{table || 'N/A'}</span>
                                        <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
                                    </Button>
                                </BreadcrumbLink>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-64 min-w-[220px] overflow-y-auto">
                                {tablesInSchema.map((tableName) => (
                                    <DropdownMenuItem
                                        key={tableName}
                                        onSelect={(event) => {
                                            event.preventDefault();
                                            setTableMenuOpen(false);
                                            if (isCurrentTable(tableName)) return;
                                            onSelectTable(tableName);
                                        }}
                                        className={cn(
                                            'truncate gap-2',
                                            isCurrentTable(tableName) ? 'text-primary font-semibold' : '',
                                        )}
                                    >
                                        <Table2 size={12} className="shrink-0 opacity-80" />
                                        {tableName}
                                    </DropdownMenuItem>
                                ))}
                                {!hasTableOptions && (
                                    <DropdownMenuItem disabled>
                                        No tables in schema
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
};
