import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Eye,
    Hash,
    Layers,
    Link2,
    List,
    Plus,
    Search,
    Sigma,
    SpellCheck2,
    Table2,
    Trash2,
    Type,
    X,
    Zap,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { FetchDatabaseSchema } from '../../services/schemaService';
import { useSchemaStore } from '../../stores/schemaStore';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../lib/cn';
import { CreateTableModal } from '../layout/CreateTableModal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { DropObject } from '../../services/schemaService';
import { useToast } from '../layout/Toast';
import { useConnectionTreeModel } from './useConnectionTreeModel';
import type { CategoryGroupNode, ConnectionTreeIcon, SchemaBucketNode } from './connectionTreeTypes';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';

const iconClass = 'opacity-80 shrink-0';
const ALL_SCHEMAS_VALUE = '__all_schemas__';
const PRIMARY_CATEGORY_KEYS = new Set(['tables', 'views']);

function renderIcon(icon: ConnectionTreeIcon, size = 12): React.ReactNode {
    switch (icon) {
        case 'table':
            return <Table2 size={size} className={iconClass} />;
        case 'foreign_table':
            return <Link2 size={size} className={iconClass} />;
        case 'view':
            return <Eye size={size} className={iconClass} />;
        case 'materialized_view':
            return <Layers size={size} className={iconClass} />;
        case 'index':
            return <Hash size={size} className={iconClass} />;
        case 'function':
            return <Zap size={size} className={iconClass} />;
        case 'procedure':
            return <Zap size={size} className={iconClass} />;
        case 'sequence':
            return <List size={size} className={iconClass} />;
        case 'data_type':
            return <Type size={size} className={iconClass} />;
        case 'aggregate':
            return <Sigma size={size} className={iconClass} />;
        case 'schema':
        default:
            return <Layers size={size} className={iconClass} />;
    }
}

interface SchemaBucketNodeViewProps {
    bucket: SchemaBucketNode;
    category: CategoryGroupNode;
    expanded: boolean;
    readOnlyMode: boolean;
    onToggle: () => void;
    onOpenDefinition: (schemaName: string, objectName: string) => void;
    onDropObject: (schema: string, objectName: string, objectType: 'TABLE' | 'VIEW') => Promise<void>;
}

const SchemaBucketNodeView: React.FC<SchemaBucketNodeViewProps> = ({
    bucket,
    category,
    expanded,
    readOnlyMode,
    onToggle,
    onOpenDefinition,
    onDropObject,
}) => {
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [contextMenuItem, setContextMenuItem] = useState<string | null>(null);
    const [dropModal, setDropModal] = useState<{ schema: string; item: string; type: 'TABLE' | 'VIEW' } | null>(null);

    const canDrop = Boolean(category.dropObjectType) && !readOnlyMode;

    const handleContextMenu = (event: React.MouseEvent, itemName: string) => {
        if (!canDrop) return;
        event.preventDefault();
        setContextMenuItem(itemName);
    };

    const requestDrop = () => {
        if (!contextMenuItem || !category.dropObjectType) return;
        setDropModal({
            schema: bucket.schemaName,
            item: contextMenuItem,
            type: category.dropObjectType,
        });
        setContextMenuItem(null);
    };

    const confirmDrop = async () => {
        if (!dropModal) return;
        await onDropObject(dropModal.schema, dropModal.item, dropModal.type);
        setDropModal(null);
    };

    return (
        <div>
            <CreateTableModal
                isOpen={showCreateTable}
                onClose={() => setShowCreateTable(false)}
                schema={bucket.schemaName}
            />
            <ConfirmationModal
                isOpen={Boolean(dropModal)}
                onClose={() => setDropModal(null)}
                onConfirm={() => {
                    void confirmDrop();
                }}
                title={`Drop ${dropModal?.type || 'Object'}`}
                message={`Are you sure you want to drop "${dropModal?.item}"?`}
                description="This action cannot be undone."
                confirmLabel="Drop"
                variant="destructive"
            />

            <div
                className={cn(
                    'group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-foreground transition-colors duration-100 hover:bg-muted/80',
                    expanded && 'sticky top-0 z-[2] -mx-0.5 rounded-none px-2 bg-card',
                )}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
            >
                {expanded ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
                {renderIcon('schema')}
                <span className="truncate flex-1">{bucket.schemaName}</span>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                    {bucket.totalCount}
                </span>
                {category.allowCreateTable && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!readOnlyMode) setShowCreateTable(true);
                        }}
                        className="h-6 w-6 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted shrink-0 transition-opacity"
                        title="New Table"
                        disabled={readOnlyMode}
                    >
                        <Plus size={12} />
                    </Button>
                )}
            </div>

            {expanded && (
                <div className="pl-3 relative">
                    {bucket.items.map((item, index) => (
                        <div
                            key={`${item.id}:${index}`}
                            className="flex items-center gap-1.5 px-1.5 py-0.5 text-[12px] text-foreground rounded-md transition-colors duration-100 hover:bg-muted/80 overflow-hidden"
                            onDoubleClick={() => {
                                if (!category.canOpenDefinition) return;
                                onOpenDefinition(item.schemaName, item.name);
                            }}
                            onContextMenu={(event) => handleContextMenu(event, item.name)}
                            title={item.name}
                        >
                            <span className="w-[13px] shrink-0 inline-block" />
                            {renderIcon(category.itemIcon, 12)}
                            <span className="truncate flex-1">{item.name}</span>
                            {canDrop && (
                                <DropdownMenu
                                    open={contextMenuItem === item.name}
                                    onOpenChange={(open) => {
                                        if (!open) setContextMenuItem(null);
                                    }}
                                >
                                    <DropdownMenuTrigger asChild>
                                        <span className="h-0 w-0 overflow-hidden" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" sideOffset={4} className="min-w-[160px]">
                                        <DropdownMenuItem
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                requestDrop();
                                            }}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 size={14} />
                                            Drop {category.dropObjectType === 'TABLE' ? 'Table' : 'View'}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ConnectionTree: React.FC = () => {
    const { isConnected, activeProfile } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const addTab = useEditorStore((state) => state.addTab);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);
    const [filter, setFilter] = useState('');
    const [fuzzyMatch, setFuzzyMatch] = useState(false);
    const [activeCategoryKey, setActiveCategoryKey] = useState<string>('tables');
    const [selectedSchema, setSelectedSchema] = useState<string>(ALL_SCHEMAS_VALUE);
    const [showMoreCategories, setShowMoreCategories] = useState(false);
    const filterInputRef = useRef<HTMLInputElement>(null);
    const schemaTreeKey = activeProfile?.name && activeProfile?.db_name ? `${activeProfile.name}:${activeProfile.db_name}` : '';
    const schemas = useSchemaStore((state) => (schemaTreeKey ? state.trees[schemaTreeKey] : undefined));

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'f') {
                const activeEl = document.activeElement;
                if (activeEl?.closest('.sidebar')) {
                    event.preventDefault();
                    filterInputRef.current?.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        setSelectedSchema(ALL_SCHEMAS_VALUE);
    }, [schemaTreeKey]);

    if (!isConnected || !activeProfile || !activeProfile.db_name || !activeProfile.name) {
        return null;
    }

    const {
        categories,
        isLoading,
        hasLoadedSchemas,
        isSchemaExpanded,
        toggleSchema,
    } = useConnectionTreeModel({
        profileName: activeProfile.name,
        dbName: activeProfile.db_name,
        driver: activeProfile.driver || '',
        filter,
        fuzzyMatch,
    });

    const availableSchemas = useMemo(() => {
        if (!schemas || schemas.length === 0) return [];
        return Array.from(new Set(schemas.map((schema) => schema.Name).filter(Boolean))).sort((left, right) =>
            left.localeCompare(right),
        );
    }, [schemas]);

    const scopedCategories = useMemo(() => {
        if (selectedSchema === ALL_SCHEMAS_VALUE) return categories;
        return categories.map((category) => {
            const scopedSchemas = category.schemas.filter((bucket) => bucket.schemaName === selectedSchema);
            return {
                ...category,
                schemas: scopedSchemas,
                totalCount: scopedSchemas.reduce((sum, bucket) => sum + bucket.totalCount, 0),
            };
        });
    }, [categories, selectedSchema]);
    const primaryCategories = useMemo(
        () => scopedCategories.filter((category) => PRIMARY_CATEGORY_KEYS.has(category.key)),
        [scopedCategories],
    );
    const secondaryCategories = useMemo(
        () => scopedCategories.filter((category) => !PRIMARY_CATEGORY_KEYS.has(category.key)),
        [scopedCategories],
    );
    const visibleCategories = useMemo(
        () => (showMoreCategories ? scopedCategories : primaryCategories),
        [primaryCategories, scopedCategories, showMoreCategories],
    );

    const filterLower = filter.trim().toLowerCase();
    const isFiltering = filterLower.length > 0;
    const activeCategory = useMemo(
        () => scopedCategories.find((category) => category.key === activeCategoryKey) || scopedCategories[0] || null,
        [activeCategoryKey, scopedCategories],
    );

    useEffect(() => {
        if (scopedCategories.length === 0) return;
        const hasActive = scopedCategories.some((category) => category.key === activeCategoryKey);
        if (!hasActive) {
            const tablesCategory = scopedCategories.find((category) => category.key === 'tables');
            setActiveCategoryKey((tablesCategory || scopedCategories[0]).key);
        }
    }, [activeCategoryKey, scopedCategories]);
    useEffect(() => {
        if (visibleCategories.length === 0) return;
        const hasVisibleActive = visibleCategories.some((category) => category.key === activeCategoryKey);
        if (!hasVisibleActive) {
            const tablesCategory = visibleCategories.find((category) => category.key === 'tables');
            const viewsCategory = visibleCategories.find((category) => category.key === 'views');
            setActiveCategoryKey((tablesCategory || viewsCategory || visibleCategories[0]).key);
        }
    }, [activeCategoryKey, visibleCategories]);

    const handleOpenDefinition = (schemaName: string, objectName: string) => {
        addTab({
            type: 'table',
            name: `${schemaName}.${objectName}`,
            content: `${schemaName}.${objectName}`,
            query: '',
        });
    };

    const handleDropObject = async (schema: string, objectName: string, objectType: 'TABLE' | 'VIEW') => {
        if (!activeProfile?.name || !activeProfile?.db_name) return;
        const guard = await writeSafetyGuard.guardOperations(['drop'], `Drop ${objectType}`);
        if (!guard.allowed) {
            if (guard.blockedReason) {
                toast.error(guard.blockedReason);
            }
            return;
        }
        try {
            await DropObject(activeProfile.name, schema, objectName, objectType);
            toast.success(`${objectType} "${objectName}" dropped successfully`);
            await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
        } catch (error) {
            toast.error(`Failed to drop: ${error}`);
        }
    };
    const emptyMessage = useMemo(() => {
        if (isLoading && !hasLoadedSchemas) return 'Loading schemas...';
        if (!activeCategory) return 'No categories found';
        return isFiltering ? 'No matches in this group' : 'No objects';
    }, [activeCategory, hasLoadedSchemas, isFiltering, isLoading]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-card/80">
            <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 bg-card/70">
                <div className="flex-1 relative flex items-center min-w-0">
                    <Search size={11} className="absolute left-1.5 text-muted-foreground pointer-events-none" />
                    <Input
                        ref={filterInputRef}
                        type="text"
                        className="h-7 w-full rounded-md border-border/70 bg-background/90 py-[5px] pl-[22px] pr-1.5 text-[11px]"
                        placeholder="Filter objects..."
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') setFilter('');
                        }}
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'p-0 text-muted-foreground hover:text-foreground',
                        fuzzyMatch && 'bg-muted/80 text-accent',
                    )}
                    title={fuzzyMatch ? 'Fuzzy match: On' : 'Fuzzy match: Off'}
                    aria-label="Toggle fuzzy match"
                    aria-pressed={fuzzyMatch}
                    onClick={() => setFuzzyMatch((value) => !value)}
                >
                    <SpellCheck2 size={12} className="opacity-90" />
                </Button>
                {filter && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                        onClick={() => setFilter('')}
                        title="Clear filter"
                    >
                        <X size={13} />
                    </Button>
                )}
            </div>
            <div className="px-2 pb-1 shrink-0 bg-card/70">
                <div className="flex items-center gap-1.5 justify-between">
                    <span className='text-xs'>Schema</span>
                    <div className="min-w-0">
                        <Select
                            value={selectedSchema}
                            onValueChange={(value) => setSelectedSchema(value)}
                        >
                            <SelectTrigger
                                aria-label="Select schema"
                                title={selectedSchema === ALL_SCHEMAS_VALUE ? 'All schemas' : selectedSchema}
                                className="h-7 w-full min-w-0 rounded-sm border-0 bg-transparent px-2 text-center text-accent shadow-none hover:bg-muted/70 focus:ring-0"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_SCHEMAS_VALUE}>All schemas</SelectItem>
                                {availableSchemas.map((schemaName) => (
                                    <SelectItem key={schemaName} value={schemaName}>
                                        {schemaName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {secondaryCategories.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'h-7 w-7 p-0 text-muted-foreground hover:text-foreground',
                                showMoreCategories && 'text-accent bg-muted/50',
                            )}
                            onClick={() => setShowMoreCategories((current) => !current)}
                            aria-expanded={showMoreCategories}
                            title={showMoreCategories ? 'Show fewer actions' : 'Show more actions'}
                        >
                            <ChevronDown size={12} className={cn('transition-transform', showMoreCategories && 'rotate-180')} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col p-1.5 gap-1.5 overflow-hidden">
                <div className="shrink-0 pb-1 border-b border-border/70 ">
                    {visibleCategories.map((category) => (
                        <Button
                            key={category.id}
                            variant="ghost"
                            type="button"
                            className={cn(
                                'h-auto w-full justify-start gap-1.5 rounded-md px-1.5 py-0.5 text-[13px] text-foreground transition-colors duration-100 hover:bg-muted/80',
                                activeCategory?.key === category.key && 'bg-muted/90 text-foreground',
                            )}
                            onClick={() => setActiveCategoryKey(category.key)}
                        >
                            {renderIcon(category.icon, 12)}
                            <span className="text-xs truncate">{category.label}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                {category.totalCount}
                            </span>
                        </Button>
                    ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md bg-card/45 p-0">
                    {!activeCategory ? (
                        <div className={cn('flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-muted-foreground rounded-md')}>
                            {emptyMessage}
                        </div>
                    ) : activeCategory.schemas.length === 0 ? (
                        <div className={cn('flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-muted-foreground rounded-md')}>
                            {emptyMessage}
                        </div>
                    ) : (
                        <div>
                            {activeCategory.schemas.map((bucket) => (
                                <SchemaBucketNodeView
                                    key={bucket.id}
                                    bucket={bucket}
                                    category={activeCategory}
                                    expanded={isSchemaExpanded(activeCategory.key, bucket.schemaName)}
                                    readOnlyMode={viewMode}
                                    onToggle={() => toggleSchema(activeCategory.key, bucket.schemaName)}
                                    onOpenDefinition={handleOpenDefinition}
                                    onDropObject={handleDropObject}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {writeSafetyGuard.modals}
        </div>
    );
};
