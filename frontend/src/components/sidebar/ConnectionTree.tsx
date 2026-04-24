import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Eye,
    Hash,
    Layers,
    Link2,
    List,
    Plus,
    RefreshCw,
    Sigma,
    SpellCheck2,
    Table2,
    Trash2,
    Type,
    Zap,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { FetchDatabaseSchema } from '../../services/schemaService';
import { useSchemaStore } from '../../stores/schemaStore';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../lib/cn';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { DropObjectAdvanced, TruncateTable } from '../../services/schemaService';
import { useToast } from '../layout/Toast';
import { useConnectionTreeModel } from './useConnectionTreeModel';
import type { CategoryGroupNode, ConnectionTreeIcon, SchemaBucketNode } from './connectionTreeTypes';
import {
    Button,
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { EXPLORER_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';
import { buildNewTableDraftTarget } from '../../lib/tableTargets';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
import { emitCommand } from '../../lib/commandBus';

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
    driver: string;
    expanded: boolean;
    selectedObjectKey: string | null;
    readOnlyMode: boolean;
    onToggle: () => void;
    onCreateTable: (schemaName: string) => void;
    onSelectObject: (schemaName: string, objectName: string, categoryKey: string) => void;
    onOpenDefinition: (schemaName: string, objectName: string) => void;
    onDropObject: (schema: string, objectName: string, objectType: 'TABLE' | 'VIEW', cascade: boolean) => Promise<void>;
    onTruncateTable: (schema: string, tableName: string, cascade: boolean, restartIdentity: boolean) => Promise<void>;
    onRefreshSchema: () => Promise<void>;
    onExportData: (schema: string, tableName: string) => void;
}

const SchemaBucketNodeView: React.FC<SchemaBucketNodeViewProps> = ({
    bucket,
    category,
    driver,
    expanded,
    selectedObjectKey,
    readOnlyMode,
    onToggle,
    onCreateTable,
    onSelectObject,
    onOpenDefinition,
    onDropObject,
    onTruncateTable,
    onRefreshSchema,
    onExportData,
}) => {
    const [dropModal, setDropModal] = useState<{ schema: string; item: string; type: 'TABLE' | 'VIEW'; cascade: boolean } | null>(null);
    const [truncateModal, setTruncateModal] = useState<{ schema: string; tableName: string; cascade: boolean; restartIdentity: boolean } | null>(null);

    const objectType = category.dropObjectType;
    const isTableCategory = objectType === 'TABLE';
    const isViewCategory = objectType === 'VIEW';
    const canOpenContextMenu = Boolean(objectType);
    const supportsDropCascade = driver === 'postgres' && (isTableCategory || isViewCategory);
    const supportsTruncate = isTableCategory && driver !== 'sqlite';
    const supportsTruncateCascade = isTableCategory && driver === 'postgres';
    const supportsTruncateRestartIdentity = isTableCategory && driver === 'postgres';

    const requestDrop = (itemName: string, cascade: boolean) => {
        if (!objectType) return;
        setDropModal({
            schema: bucket.schemaName,
            item: itemName,
            type: objectType,
            cascade,
        });
    };

    const requestTruncate = (tableName: string, cascade: boolean, restartIdentity: boolean) => {
        setTruncateModal({
            schema: bucket.schemaName,
            tableName,
            cascade,
            restartIdentity,
        });
    };

    const confirmDrop = async () => {
        if (!dropModal) return;
        await onDropObject(dropModal.schema, dropModal.item, dropModal.type, dropModal.cascade);
        setDropModal(null);
    };

    const confirmTruncate = async () => {
        if (!truncateModal) return;
        await onTruncateTable(
            truncateModal.schema,
            truncateModal.tableName,
            truncateModal.cascade,
            truncateModal.restartIdentity,
        );
        setTruncateModal(null);
    };

    return (
        <div>
            <ConfirmationModal
                isOpen={Boolean(dropModal)}
                onClose={() => setDropModal(null)}
                onConfirm={() => {
                    void confirmDrop();
                }}
                title={`Drop ${dropModal?.type || 'Object'}`}
                message={`Are you sure you want to drop "${dropModal?.item}"?`}
                description={dropModal?.cascade ? 'This action cannot be undone and will include CASCADE.' : 'This action cannot be undone.'}
                confirmLabel="Drop"
                variant="destructive"
            />
            <ConfirmationModal
                isOpen={Boolean(truncateModal)}
                onClose={() => setTruncateModal(null)}
                onConfirm={() => {
                    void confirmTruncate();
                }}
                title="Truncate Table"
                message={`Are you sure you want to truncate "${truncateModal?.tableName}"?`}
                description={
                    truncateModal?.cascade
                        ? 'This will remove all rows (CASCADE) and cannot be undone.'
                        : truncateModal?.restartIdentity
                            ? 'This will remove all rows and restart identity values.'
                            : 'This will remove all rows and cannot be undone.'
                }
                confirmLabel="Truncate"
                variant="destructive"
            />

            <div
                className={cn(
                    'group h-7 bg-transparent flex items-center gap-1 rounded-sm px-1.5 text-body! text-foreground transition-colors duration-fast',
                    expanded && 'sticky top-0 z-sticky -mx-0.5 rounded-none border-b border-border/40 bg-card px-2',
                )}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
            >
                {expanded ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
                {renderIcon('schema')}
                <span className="flex-1 cursor-pointer truncate leading-5">{bucket.schemaName}</span>
                {category.allowCreateTable && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!readOnlyMode) onCreateTable(bucket.schemaName);
                        }}
                        className="h-7 w-7 p-0.5 cursor-pointer opacity-0 group-hover:opacity-100 hover:bg-muted text-label! shrink-0 transition-opacity"
                        title="New Table"
                        disabled={readOnlyMode}
                    >
                        <Plus size={12} />
                    </Button>
                )}
                <span className="min-w-[18px] shrink-0 rounded-full bg-muted px-1.5 text-center tabular-nums text-muted-foreground">
                    {bucket.totalCount}
                </span>
            </div>

            {expanded && (
                <div className="pl-3 relative">
                    {bucket.items.map((item, index) => (
                        <ContextMenu key={`${item.id}:${index}`}>
                            <ContextMenuTrigger asChild disabled={!canOpenContextMenu}>
                                <div
                                    className={cn(
                                        'group mb-0.5 flex h-7 items-center gap-1.5 overflow-hidden rounded-sm bg-transparent px-1.5 text-caption! text-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)]',
                                        selectedObjectKey === `${category.key}:${item.schemaName}.${item.name}` && 'bg-[var(--state-selected-bg)] text-[var(--state-selected-text)]',
                                        category.canOpenDefinition && 'cursor-pointer focus-visible:outline-none',
                                    )}
                                    onClick={() => {
                                        if (!category.canOpenDefinition) return;
                                        onSelectObject(item.schemaName, item.name, category.key);
                                        onOpenDefinition(item.schemaName, item.name);
                                    }}
                                    title={item.name}
                                >
                                    <span className="w-[13px] shrink-0 inline-block" />
                                    {renderIcon(category.itemIcon, 12)}
                                    <span className="flex-1 truncate leading-5">{item.name}</span>
                                </div>
                            </ContextMenuTrigger>
                            {canOpenContextMenu && (
                                <ContextMenuContent className="min-w-[220px]">
                                    <ContextMenuItem
                                        onSelect={(event: Event) => {
                                            event.preventDefault();
                                            if (readOnlyMode) return;
                                            requestDrop(item.name, false);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                        disabled={readOnlyMode}
                                    >
                                        <Trash2 size={14} />
                                        Drop
                                        <ContextMenuShortcut>Alt+Shift+D</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    {supportsDropCascade && (
                                        <ContextMenuItem
                                            onSelect={(event: Event) => {
                                                event.preventDefault();
                                                if (readOnlyMode) return;
                                                requestDrop(item.name, true);
                                            }}
                                            className="text-destructive focus:text-destructive"
                                            disabled={readOnlyMode}
                                        >
                                            <Trash2 size={14} />
                                            Drop (Cascade)
                                        </ContextMenuItem>
                                    )}
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                        onSelect={(event: Event) => {
                                            event.preventDefault();
                                            void onRefreshSchema();
                                        }}
                                    >
                                        <RefreshCw size={14} />
                                        Refresh...
                                        <ContextMenuShortcut>F5</ContextMenuShortcut>
                                    </ContextMenuItem>

                                    <ContextMenuItem
                                        onSelect={(event: Event) => event.preventDefault()}
                                        title="Coming soon"
                                        className="cursor-not-allowed opacity-50"
                                    >
                                        Restore...
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        onSelect={(event: Event) => event.preventDefault()}
                                        title="Coming soon"
                                        className="cursor-not-allowed opacity-50"
                                    >
                                        Backup...
                                    </ContextMenuItem>

                                    <ContextMenuSub>
                                        <ContextMenuSubTrigger>Import/Export Data...</ContextMenuSubTrigger>
                                        <ContextMenuSubContent className="min-w-[200px]">
                                            <ContextMenuItem
                                                onSelect={(event: Event) => event.preventDefault()}
                                                title="Coming soon"
                                                className="cursor-not-allowed opacity-50"
                                            >
                                                Import...
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                onSelect={(event: Event) => {
                                                    event.preventDefault();
                                                    if (!isTableCategory) return;
                                                    onExportData(bucket.schemaName, item.name);
                                                }}
                                                disabled={!isTableCategory}
                                            >
                                                Export...
                                            </ContextMenuItem>
                                        </ContextMenuSubContent>
                                    </ContextMenuSub>

                                    {supportsTruncate && (
                                        <ContextMenuSub>
                                            <ContextMenuSubTrigger disabled={readOnlyMode}>Truncate</ContextMenuSubTrigger>
                                            <ContextMenuSubContent className="min-w-[200px]">
                                                <ContextMenuItem
                                                    onSelect={(event: Event) => {
                                                        event.preventDefault();
                                                        requestTruncate(item.name, false, false);
                                                    }}
                                                    disabled={readOnlyMode}
                                                >
                                                    Truncate
                                                </ContextMenuItem>
                                                {supportsTruncateCascade && (
                                                    <ContextMenuItem
                                                        onSelect={(event: Event) => {
                                                            event.preventDefault();
                                                            requestTruncate(item.name, true, false);
                                                        }}
                                                        disabled={readOnlyMode}
                                                    >
                                                        Truncate Cascade
                                                    </ContextMenuItem>
                                                )}
                                                {supportsTruncateRestartIdentity && (
                                                    <ContextMenuItem
                                                        onSelect={(event: Event) => {
                                                            event.preventDefault();
                                                            requestTruncate(item.name, false, true);
                                                        }}
                                                        disabled={readOnlyMode}
                                                    >
                                                        Truncate Restart Identity
                                                    </ContextMenuItem>
                                                )}
                                            </ContextMenuSubContent>
                                        </ContextMenuSub>
                                    )}
                                </ContextMenuContent>
                            )}
                        </ContextMenu>
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
    const [explorerUiState, setExplorerUiState] = useSidebarPanelState('primary', 'explorer', EXPLORER_PANEL_STATE_DEFAULT);
    const [selectedObjectKey, setSelectedObjectKey] = useState<string | null>(null);
    const filter = explorerUiState.filter;
    const fuzzyMatch = explorerUiState.fuzzyMatch;
    const activeCategoryKey = explorerUiState.activeCategoryKey;
    const selectedSchema = explorerUiState.selectedSchema;
    const showMoreCategories = explorerUiState.showMoreCategories;
    const filterInputRef = useRef<HTMLInputElement>(null);
    const schemaTreeKey = activeProfile?.name && activeProfile?.db_name ? `${activeProfile.name}:${activeProfile.db_name}` : '';
    const schemas = useSchemaStore((state) => (schemaTreeKey ? state.trees[schemaTreeKey] : undefined));

    const updateExplorerUiState = useCallback((next: Partial<typeof explorerUiState>) => {
        setExplorerUiState((current) => ({
            ...current,
            ...next,
        }));
    }, [setExplorerUiState]);

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
        updateExplorerUiState({ selectedSchema: ALL_SCHEMAS_VALUE });
    }, [schemaTreeKey, updateExplorerUiState]);

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
            updateExplorerUiState({ activeCategoryKey: (tablesCategory || scopedCategories[0]).key });
        }
    }, [activeCategoryKey, scopedCategories, updateExplorerUiState]);
    useEffect(() => {
        if (visibleCategories.length === 0) return;
        const hasVisibleActive = visibleCategories.some((category) => category.key === activeCategoryKey);
        if (!hasVisibleActive) {
            const tablesCategory = visibleCategories.find((category) => category.key === 'tables');
            const viewsCategory = visibleCategories.find((category) => category.key === 'views');
            updateExplorerUiState({ activeCategoryKey: (tablesCategory || viewsCategory || visibleCategories[0]).key });
        }
    }, [activeCategoryKey, updateExplorerUiState, visibleCategories]);

    const handleOpenDefinition = (schemaName: string, objectName: string) => {
        addTab({
            type: 'table',
            name: `${schemaName}.${objectName}`,
            content: `${schemaName}.${objectName}`,
            query: '',
        });
    };

    const handleSelectObject = useCallback((schemaName: string, objectName: string, categoryKey: string) => {
        setSelectedObjectKey(`${categoryKey}:${schemaName}.${objectName}`);
    }, []);

    const handleCreateTable = useCallback((schemaName: string) => {
        const defaultTableName = 'new_table';
        const qualifiedName = schemaName ? `${schemaName}.${defaultTableName}` : defaultTableName;
        addTab({
            type: 'table',
            name: qualifiedName,
            content: buildNewTableDraftTarget(schemaName, defaultTableName),
            query: '',
        });
    }, [addTab]);

    const handleDropObject = async (schema: string, objectName: string, objectType: 'TABLE' | 'VIEW', cascade: boolean) => {
        if (!activeProfile?.name || !activeProfile?.db_name) return;
        const guard = await writeSafetyGuard.guardOperations(['drop'], `Drop ${objectType}`);
        if (!guard.allowed) {
            if (guard.blockedReason) {
                toast.error(guard.blockedReason);
            }
            return;
        }
        try {
            await DropObjectAdvanced(activeProfile.name, schema, objectName, objectType, cascade);
            toast.success(`${objectType} "${objectName}" dropped successfully`);
            await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
        } catch (error) {
            toast.error(`Failed to drop: ${error}`);
        }
    };

    const handleTruncateTable = async (schema: string, tableName: string, cascade: boolean, restartIdentity: boolean) => {
        if (!activeProfile?.name || !activeProfile?.db_name) return;
        const guard = await writeSafetyGuard.guardOperations(['truncate'], 'Truncate Table');
        if (!guard.allowed) {
            if (guard.blockedReason) {
                toast.error(guard.blockedReason);
            }
            return;
        }
        try {
            await TruncateTable(activeProfile.name, schema, tableName, cascade, restartIdentity);
            toast.success(`Table "${tableName}" truncated successfully`);
            await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
        } catch (error) {
            toast.error(`Failed to truncate: ${error}`);
        }
    };

    const handleRefreshSchema = useCallback(async () => {
        if (!activeProfile?.name || !activeProfile?.db_name) return;
        try {
            await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
            toast.success('Schema refreshed');
        } catch (error) {
            toast.error(`Failed to refresh schema: ${error}`);
        }
    }, [activeProfile?.db_name, activeProfile?.name, toast]);

    const handleExportData = useCallback((schema: string, tableName: string) => {
        const qualifiedName = `${schema}.${tableName}`;
        const tableTabId = addTab({
            type: TAB_TYPE.TABLE,
            name: qualifiedName,
            content: qualifiedName,
            query: '',
        });
        emitCommand(DOM_EVENT.OPEN_TABLE_EXPORT, { tableTabId });
    }, [addTab]);

    const emptyMessage = useMemo(() => {
        if (isLoading && !hasLoadedSchemas) return 'Loading schemas...';
        if (!activeCategory) return 'No categories found';
        return isFiltering ? 'No matches in this group' : 'No objects';
    }, [activeCategory, hasLoadedSchemas, isFiltering, isLoading]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1 shrink-0">
                <div className="relative flex-1 min-w-0 outline-none">
                    <Input
                        ref={filterInputRef}
                        type="text"
                        size="sm"
                        variant="ghost"
                        className="w-full pr-8 text-small"
                        placeholder="Filter objects..."
                        value={filter}
                        onChange={(event) => updateExplorerUiState({ filter: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') updateExplorerUiState({ filter: '' });
                        }}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground',
                            fuzzyMatch && 'bg-muted/80 text-accent',
                        )}
                        title={fuzzyMatch ? 'Fuzzy match: On' : 'Fuzzy match: Off'}
                        aria-label="Toggle fuzzy match"
                        aria-pressed={fuzzyMatch}
                        onClick={() => updateExplorerUiState({ fuzzyMatch: !fuzzyMatch })}
                    >
                        <SpellCheck2 size={12} className="opacity-90" />
                    </Button>
                </div>
            </div>
            <div className="px-2 pb-1 shrink-0">
                <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-body text-muted-foreground">Schema</span>
                    <div className="min-w-0">
                        <Select
                            value={selectedSchema}
                            onValueChange={(value) => updateExplorerUiState({ selectedSchema: value })}
                        >
                            <SelectTrigger
                                aria-label="Select schema"
                                title={selectedSchema === ALL_SCHEMAS_VALUE ? 'All schemas' : selectedSchema}
                                className="outline-none flex h-7 w-full min-w-0 rounded-sm border-0 bg-transparent px-2 text-center text-body! text-foreground shadow-none hover:bg-muted/70 focus:ring-0"
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
                                'p-0 text-muted-foreground hover:text-foreground',
                                showMoreCategories && 'text-accent bg-muted/50',
                            )}
                            onClick={() => updateExplorerUiState({ showMoreCategories: !showMoreCategories })}
                            aria-expanded={showMoreCategories}
                            title={showMoreCategories ? 'Show fewer actions' : 'Show more actions'}
                        >
                            <ChevronDown size={12} className={cn('transition-transform', showMoreCategories && 'rotate-180')} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col p-0.5 gap-1.5 overflow-hidden">
                <div className="shrink-0 pb-1">
                    {visibleCategories.map((category) => (
                        <Button
                            key={category.id}
                            variant="ghost"
                            type="button"
                            className={cn(
                                'mb-0.5 h-7 w-full justify-start gap-1.5 rounded-sm bg-transparent text-body! text-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)]',
                                activeCategory?.key === category.key && 'bg-[var(--state-active-bg)] text-foreground',
                            )}
                            onClick={() => updateExplorerUiState({ activeCategoryKey: category.key })}
                        >
                            {renderIcon(category.icon, 12)}
                            <span className="truncate leading-5">{category.label}</span>
                            <span className="ml-auto min-w-4.5 shrink-0 rounded-full bg-muted px-1.5 text-center text-body! tabular-nums text-muted-foreground">
                                {category.totalCount}
                            </span>
                        </Button>
                    ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                    {!activeCategory ? (
                        <div className={cn('flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-body! text-muted-foreground')}>
                            {emptyMessage}
                        </div>
                    ) : activeCategory.schemas.length === 0 ? (
                        <div className={cn('flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-body! text-muted-foreground')}>
                            {emptyMessage}
                        </div>
                    ) : (
                        <div>
                            {activeCategory.schemas.map((bucket) => (
                                <SchemaBucketNodeView
                                    key={bucket.id}
                                    bucket={bucket}
                                    category={activeCategory}
                                    driver={activeProfile.driver || ''}
                                    expanded={isSchemaExpanded(activeCategory.key, bucket.schemaName)}
                                    selectedObjectKey={selectedObjectKey}
                                    readOnlyMode={viewMode}
                                    onToggle={() => toggleSchema(activeCategory.key, bucket.schemaName)}
                                    onCreateTable={handleCreateTable}
                                    onSelectObject={handleSelectObject}
                                    onOpenDefinition={handleOpenDefinition}
                                    onDropObject={handleDropObject}
                                    onTruncateTable={handleTruncateTable}
                                    onRefreshSchema={handleRefreshSchema}
                                    onExportData={handleExportData}
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
