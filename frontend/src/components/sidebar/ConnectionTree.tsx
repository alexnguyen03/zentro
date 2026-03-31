import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Eye,
    Hash,
    Layers,
    Link2,
    List,
    Loader,
    Plus,
    RefreshCw,
    Search,
    Server,
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
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../lib/cn';
import { CreateTableModal } from '../layout/CreateTableModal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { DropObject } from '../../services/schemaService';
import { useToast } from '../layout/Toast';
import { useConnectionTreeModel } from './useConnectionTreeModel';
import type { CategoryGroupNode, ConnectionTreeIcon, SchemaBucketNode } from './connectionTreeTypes';
import { Reconnect } from '../../services/connectionService';
import { CONNECTION_STATUS } from '../../lib/constants';
import { Button } from '../ui';
import { useWriteSafetyGuard } from '../../features/query/useWriteSafetyGuard';

const iconClass = 'opacity-80 shrink-0';

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
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: string } | null>(null);
    const [dropModal, setDropModal] = useState<{ schema: string; item: string; type: 'TABLE' | 'VIEW' } | null>(null);

    useEffect(() => {
        const close = () => setContextMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    const canDrop = Boolean(category.dropObjectType) && !readOnlyMode;

    const handleContextMenu = (event: React.MouseEvent, itemName: string) => {
        if (!canDrop) return;
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, item: itemName });
    };

    const requestDrop = () => {
        if (!contextMenu || !category.dropObjectType) return;
        setDropModal({
            schema: bucket.schemaName,
            item: contextMenu.item,
            type: category.dropObjectType,
        });
        setContextMenu(null);
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
                variant="danger"
            />

            <div
                className={cn(
                    'group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-text-primary transition-colors duration-100 hover:bg-bg-tertiary/80',
                    expanded && 'sticky top-0 z-[2] -mx-0.5 rounded-none px-2 bg-bg-secondary',
                )}
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
            >
                {expanded ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
                {renderIcon('schema')}
                <span className="truncate flex-1">{bucket.schemaName}</span>
                <span className="text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                    {bucket.totalCount}
                </span>
                {category.allowCreateTable && (
                    <button
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!readOnlyMode) setShowCreateTable(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:bg-bg-tertiary p-0.5 rounded-md shrink-0 transition-opacity"
                        title="New Table"
                        disabled={readOnlyMode}
                    >
                        <Plus size={12} />
                    </button>
                )}
            </div>

            {expanded && (
                <div className="pl-3 relative">
                    {bucket.items.map((item, index) => (
                        <div
                            key={`${item.id}:${index}`}
                            className="flex items-center gap-1.5 px-1.5 py-0.5 text-[12px] text-text-primary rounded-md transition-colors duration-100 hover:bg-bg-tertiary/80 overflow-hidden"
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
                        </div>
                    ))}
                    {contextMenu && canDrop && (
                        <div
                            className="fixed z-popover min-w-[160px] rounded-md border border-border bg-bg-secondary py-1 shadow-lg"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <button
                                className="w-full px-3 py-1.5 text-left text-[12px] text-error hover:bg-error/10 flex items-center gap-2"
                                onClick={requestDrop}
                            >
                                <Trash2 size={14} />
                                Drop {category.dropObjectType === 'TABLE' ? 'Table' : 'View'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const ConnectionTree: React.FC = () => {
    const { isConnected, activeProfile, connectionStatus } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const addTab = useEditorStore((state) => state.addTab);
    const { toast } = useToast();
    const writeSafetyGuard = useWriteSafetyGuard(activeEnvironmentKey);
    const [filter, setFilter] = useState('');
    const [fuzzyMatch, setFuzzyMatch] = useState(false);
    const [activeCategoryKey, setActiveCategoryKey] = useState<string>('tables');
    const filterInputRef = useRef<HTMLInputElement>(null);

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

    const filterLower = filter.trim().toLowerCase();
    const isFiltering = filterLower.length > 0;
    const activeCategory = useMemo(
        () => categories.find((category) => category.key === activeCategoryKey) || categories[0] || null,
        [activeCategoryKey, categories],
    );

    useEffect(() => {
        if (categories.length === 0) return;
        const hasActive = categories.some((category) => category.key === activeCategoryKey);
        if (!hasActive) {
            const tablesCategory = categories.find((category) => category.key === 'tables');
            setActiveCategoryKey((tablesCategory || categories[0]).key);
        }
    }, [activeCategoryKey, categories]);

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
    const handleReconnect = async () => {
        if (!activeProfile || connectionStatus === CONNECTION_STATUS.CONNECTING) return;
        try {
            await Reconnect();
        } catch {
            // Keep silent to match previous toolbar behavior.
        }
    };

    const emptyMessage = useMemo(() => {
        if (isLoading && !hasLoadedSchemas) return 'Loading schemas...';
        if (!activeCategory) return 'No categories found';
        return isFiltering ? 'No matches in this group' : 'No objects';
    }, [activeCategory, hasLoadedSchemas, isFiltering, isLoading]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-bg-secondary/80">
            <div className="flex items-center justify-between gap-2 px-2 py-1 shrink-0 bg-bg-secondary">
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <Server size={13} className="text-success shrink-0" />
                    <span className="text-[12px] font-semibold text-text-primary truncate" title={activeProfile.db_name}>
                        {activeProfile.db_name}
                    </span>
                    {isLoading && <Loader size={12} className="animate-spin text-text-secondary shrink-0" />}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 text-text-secondary hover:text-text-primary"
                    title="Reload Connection"
                    onClick={() => {
                        void handleReconnect();
                    }}
                    disabled={connectionStatus === CONNECTION_STATUS.CONNECTING}
                >
                    <span className="inline-flex items-center justify-center">
                        <RefreshCw size={12} className={cn(connectionStatus === CONNECTION_STATUS.CONNECTING && 'animate-spin')} />
                    </span>
                </Button>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 bg-bg-secondary/70">
                <div className="flex-1 relative flex items-center min-w-0">
                    <Search size={11} className="absolute left-1.5 text-text-secondary pointer-events-none" />
                    <input
                        ref={filterInputRef}
                        type="text"
                        className="w-full bg-bg-primary/90 border border-border/70 text-text-primary text-[11px] py-[5px] pl-[22px] pr-1.5 rounded-md outline-none focus:border-success transition-colors"
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
                        'p-0 text-text-secondary hover:text-text-primary',
                        fuzzyMatch && 'bg-bg-tertiary/80 text-accent',
                    )}
                    title={fuzzyMatch ? 'Fuzzy match: On' : 'Fuzzy match: Off'}
                    aria-label="Toggle fuzzy match"
                    aria-pressed={fuzzyMatch}
                    onClick={() => setFuzzyMatch((value) => !value)}
                >
                    <SpellCheck2 size={12} className="opacity-90" />
                </Button>
                {filter && (
                    <button
                        className="bg-transparent border-none text-text-secondary cursor-pointer p-1 rounded-md flex items-center justify-center hover:bg-error/10 hover:text-error shrink-0 transition-colors"
                        onClick={() => setFilter('')}
                        title="Clear filter"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col p-1.5 gap-1.5 overflow-hidden">
                <div className="shrink-0 pb-1 border-b border-border/70 ">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            className={cn(
                                'w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[13px] text-text-primary transition-colors duration-100 hover:bg-bg-tertiary/80',
                                activeCategory?.key === category.key && 'bg-bg-tertiary/90 text-text-primary'
                            )}
                            onClick={() => setActiveCategoryKey(category.key)}
                        >
                            {renderIcon(category.icon, 12)}
                            <span className="text-xs truncate">{category.label}</span>
                            <span className="ml-auto text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                {category.totalCount}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md bg-bg-secondary/45 p-0">
                    {!activeCategory ? (
                        <div className={cn('flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-text-secondary rounded-md')}>
                            {emptyMessage}
                        </div>
                    ) : activeCategory.schemas.length === 0 ? (
                        <div className={cn('flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-text-secondary rounded-md')}>
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
