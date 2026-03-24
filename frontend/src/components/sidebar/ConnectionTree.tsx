import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronRight, ChevronDown,
    Table2, Link2, Eye, Layers, Hash,
    Zap, List, Type, Sigma,
    Server, Loader, Search, Trash2, FileCode2, Plus
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { FetchDatabaseSchema } from '../../../wailsjs/go/app/App';
import { onSchemaLoaded } from '../../lib/events';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../lib/cn';
import { CreateTableModal } from '../layout/CreateTableModal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { DropObject } from '../../../wailsjs/go/app/App';
import { useToast } from '../layout/Toast';

// Extended schema node type matching the Go model
interface SchemaNodeData {
    Name: string;
    Tables: string[];
    ForeignTables: string[];
    Views: string[];
    MaterializedViews: string[];
    Indexes: string[];
    Functions: string[];
    Sequences: string[];
    DataTypes: string[];
    AggregateFunctions: string[];
}

export const ConnectionTree: React.FC = () => {
    const { isConnected, activeProfile } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const [filter, setFilter] = useState('');
    const filterInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKd = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
                const activeEl = document.activeElement;
                if (activeEl?.closest('.sidebar')) {
                    e.preventDefault();
                    filterInputRef.current?.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKd);
        return () => window.removeEventListener('keydown', handleKd);
    }, []);

    if (!isConnected || !activeProfile || !activeProfile.db_name) {
        return null;
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0 bg-bg-secondary">
                <div className="flex-1 relative flex items-center min-w-0">
                    <Search size={11} className="absolute left-1.5 text-text-secondary pointer-events-none" />
                    <input
                        ref={filterInputRef}
                        type="text"
                        className="w-full bg-bg-primary border border-border text-text-primary text-[11px] py-1 pl-[22px] pr-1.5 rounded-sm outline-none focus:border-success transition-colors"
                        placeholder="Filter objects..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
                    />
                </div>
                {filter && (
                    <button className="bg-transparent border-none text-text-secondary cursor-pointer p-1 rounded flex items-center justify-center hover:bg-error/10 hover:text-error shrink-0 transition-colors" onClick={() => setFilter('')} title="Clear filter">
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto p-2">
                <DatabaseNode
                    dbName={activeProfile.db_name}
                    profileName={activeProfile.name!}
                    filter={filter.toLowerCase()}
                    readOnlyMode={viewMode}
                />
            </div>
        </div>
    );
};

// ── DatabaseNode ───────────────────────────────────────────────────────────────

interface DatabaseNodeProps {
    dbName: string;
    profileName: string;
    filter: string;
    readOnlyMode: boolean;
}

const DatabaseNode: React.FC<DatabaseNodeProps> = ({ dbName, profileName, filter, readOnlyMode }) => {
    // Automatically expand the root DB node
    const [expanded, setExpanded] = useState(true);

    const key = `${profileName}:${dbName}`;
    const schemas = useSchemaStore(s => s.trees[key]);
    const isLoading = useSchemaStore(s => s.loadingKeys.has(key));
    const setTree = useSchemaStore(s => s.setTree);
    const setLoading = useSchemaStore(s => s.setLoading);

    useEffect(() => {
        const unsub = onSchemaLoaded((data) => {
            if (data.profileName === profileName && data.dbName === dbName) {
                setTree(profileName, dbName, data.schemas as any);
            }
        });
        return () => unsub();
    }, [profileName, dbName, setTree]);

    // Force load if not loaded yet
    useEffect(() => {
        if (!schemas && !isLoading) {
            setLoading(profileName, dbName, true);
            FetchDatabaseSchema(profileName, dbName).catch(() => {
                setLoading(profileName, dbName, false);
            });
        }
    }, [profileName, dbName, schemas, isLoading, setLoading]);

    const handleExpand = async () => {
        const next = !expanded;
        setExpanded(next);
        if (next && !schemas && !isLoading) {
            setLoading(profileName, dbName, true);
            try {
                await FetchDatabaseSchema(profileName, dbName);
            } catch {
                setLoading(profileName, dbName, false);
            }
        }
    };

    return (
        <div>
            <div
                className={cn("flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden")}
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleExpand(); }}
                title={dbName}
            >
                {expanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                <Server size={14} className="text-success shrink-0" />
                <span className="font-semibold truncate flex-1">{dbName}</span>
                {isLoading && <Loader size={12} className="ml-1 animate-spin shrink-0" />}
            </div>

            {expanded && (
                <div className="pl-4">
                    {isLoading && !schemas && (
                        <div className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[12px] text-text-secondary select-none rounded-sm outline-none" tabIndex={0}>
                            Loading schemas…
                        </div>
                    )}
                    {schemas && schemas.length === 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[12px] text-text-secondary select-none rounded-sm outline-none" tabIndex={0}>
                            No schemas found
                        </div>
                    )}
                    {schemas && schemas.length > 0 && (
                        <>
                            {(schemas as SchemaNodeData[]).map((schema: SchemaNodeData) => (
                                <SchemaNode key={schema.Name} schema={schema} filter={filter} profileName={profileName} readOnlyMode={readOnlyMode} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ── SchemaNode ─────────────────────────────────────────────────────────────────

interface SchemaNodeProps {
    schema: SchemaNodeData;
    filter: string;
    profileName: string;
    readOnlyMode: boolean;
}

const SchemaNode: React.FC<SchemaNodeProps> = ({ schema, filter, profileName, readOnlyMode }) => {
    // If filter is active, auto expand, otherwise default to closed (unless it's 'public' or something)
    const [expanded, setExpanded] = useState(schema.Name === 'public' || schema.Name === 'dbo');
    const [showCreateTable, setShowCreateTable] = useState(false);

    useEffect(() => {
        if (filter) setExpanded(true);
    }, [filter]);

    const categories = buildCategories(schema, filter, profileName);
    const hasItems = categories.some(c => c.items.length > 0);

    // If filter is active and schema has no matching items, hide the schema completely
    if (filter && !hasItems) return null;

    return (
        <div>
            <CreateTableModal
                isOpen={showCreateTable}
                onClose={() => setShowCreateTable(false)}
                schema={schema.Name}
            />
            <div
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); if (hasItems) setExpanded(!expanded); }}
                title={schema.Name}
            >
                <div className="flex items-center justify-center shrink-0 w-[14px]">
                    {hasItems ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                </div>
                <Layers size={13} className="opacity-80 shrink-0" />
                <span className="text-xs truncate flex-1">{schema.Name}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); if (!readOnlyMode) setShowCreateTable(true); }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-bg-tertiary p-0.5 rounded shrink-0"
                    title="New Table"
                    disabled={readOnlyMode}
                >
                    <Plus size={12} />
                </button>
            </div>

            {expanded && (
                <div className="pl-4">
                    {categories.map(cat => cat.items.length > 0 && (
                        <CategoryNode key={`${cat.label}-${schema.Name}`} {...cat} schemaName={schema.Name} profileName={profileName} readOnlyMode={readOnlyMode} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── CategoryNode ────────────────────────────────────────────────────────────────

interface CategoryDef {
    label: string;
    icon: React.ReactNode;
    items: string[];
    itemIcon: React.ReactNode;
    schemaName?: string;
    profileName?: string;
    readOnlyMode?: boolean;
}

const CategoryNode: React.FC<CategoryDef> = ({ label, icon, items, itemIcon, schemaName, profileName, readOnlyMode = false }) => {
    const [expanded, setExpanded] = useState(true);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: string } | null>(null);
    const [dropModal, setDropModal] = useState<{ schema: string; item: string; type: string } | null>(null);
    const { addTab } = useEditorStore();
    const { activeProfile } = useConnectionStore();
    const { toast } = useToast();

    const handleItemDoubleClick = (item: string) => {
        if ((label === 'Tables' || label === 'Views' || label === 'Materialized Views') && schemaName) {
            addTab({
                type: 'table',
                name: `${schemaName}.${item}`,
                content: `${schemaName}.${item}`,
                query: ''
            });
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    const handleDrop = () => {
        if (readOnlyMode) return;
        if (contextMenu) {
            const objectType = label === 'Tables' ? 'TABLE' : label === 'Views' || label === 'Materialized Views' ? 'VIEW' : 'TABLE';
            setDropModal({ schema: schemaName!, item: contextMenu.item, type: objectType });
            setContextMenu(null);
        }
    };

    const confirmDrop = async () => {
        if (dropModal && activeProfile?.name) {
            try {
                await DropObject(activeProfile.name, dropModal.schema, dropModal.item, dropModal.type);
                toast.success(`${dropModal.type} "${dropModal.item}" dropped successfully`);
                if (activeProfile?.name && activeProfile?.db_name) {
                    await FetchDatabaseSchema(activeProfile.name, activeProfile.db_name);
                }
            } catch (err) {
                toast.error(`Failed to drop: ${err}`);
            }
            setDropModal(null);
        }
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const canDrop = !readOnlyMode && (label === 'Tables' || label === 'Views' || label === 'Materialized Views');

    return (
        <div>
            <ConfirmationModal
                isOpen={!!dropModal}
                onClose={() => setDropModal(null)}
                onConfirm={confirmDrop}
                title={`Drop ${dropModal?.type || 'Object'}`}
                message={`Are you sure you want to drop "${dropModal?.item}"?`}
                description="This action cannot be undone."
                confirmLabel="Drop"
                variant="danger"
            />
            <div
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
                {expanded ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
                <div className="shrink-0">{icon}</div>
                <span className="text-xs truncate">{label}</span>
                <span className="ml-auto text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">{items.length}</span>
            </div>

            {expanded && (
                <div className="pl-4 relative">
                    {items.map((item, idx) => (
                        <div
                            key={`${label}-${item}-${idx}`}
                            className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[12px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden"
                            tabIndex={0}
                            onDoubleClick={() => handleItemDoubleClick(item)}
                            onContextMenu={(e) => {
                                if (canDrop) handleContextMenu(e, item);
                            }}
                            title={item}
                        >
                            <span className="w-[13px] shrink-0 inline-block" />
                            {itemIcon}
                            <span className="truncate flex-1">{item}</span>
                        </div>
                    ))}
                    {contextMenu && (
                        <div
                            className="fixed bg-bg-secondary border border-border rounded-md shadow-lg py-1 z-[1000] min-w-[160px]"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {canDrop && (
                                <button
                                    className="w-full px-3 py-1.5 text-left text-[12px] text-error hover:bg-error/10 flex items-center gap-2"
                                    onClick={handleDrop}
                                >
                                    <Trash2 size={14} />
                                    Drop {label === 'Tables' ? 'Table' : 'View'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildCategories(s: SchemaNodeData, filter: string, profileName: string): CategoryDef[] {
    const iconSize = 12;
    const iconClass = "opacity-75 shrink-0";

    const filterFn = (items: string[]) => {
        if (!filter) return items || [];
        return (items || []).filter(item => item.toLowerCase().includes(filter));
    };

    return [
        { label: 'Tables', icon: <Table2 size={iconSize} className={iconClass} />, itemIcon: <Table2 size={iconSize} className={iconClass} />, items: filterFn(s.Tables), profileName },
        { label: 'Foreign Tables', icon: <Link2 size={iconSize} className={iconClass} />, itemIcon: <Link2 size={iconSize} className={iconClass} />, items: filterFn(s.ForeignTables), profileName },
        { label: 'Views', icon: <Eye size={iconSize} className={iconClass} />, itemIcon: <Eye size={iconSize} className={iconClass} />, items: filterFn(s.Views), profileName },
        { label: 'Materialized Views', icon: <Layers size={iconSize} className={iconClass} />, itemIcon: <Layers size={iconSize} className={iconClass} />, items: filterFn(s.MaterializedViews), profileName },
        { label: 'Indexes', icon: <Hash size={iconSize} className={iconClass} />, itemIcon: <Hash size={iconSize} className={iconClass} />, items: filterFn(s.Indexes), profileName },
        { label: 'Functions', icon: <Zap size={iconSize} className={iconClass} />, itemIcon: <Zap size={iconSize} className={iconClass} />, items: filterFn(s.Functions), profileName },
        { label: 'Sequences', icon: <List size={iconSize} className={iconClass} />, itemIcon: <List size={iconSize} className={iconClass} />, items: filterFn(s.Sequences), profileName },
        { label: 'Data types', icon: <Type size={iconSize} className={iconClass} />, itemIcon: <Type size={iconSize} className={iconClass} />, items: filterFn(s.DataTypes), profileName },
        { label: 'Aggregate functions', icon: <Sigma size={iconSize} className={iconClass} />, itemIcon: <Sigma size={iconSize} className={iconClass} />, items: filterFn(s.AggregateFunctions), profileName },
    ];
}
