import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronRight, ChevronDown,
    Table2, Link2, Eye, Layers, Hash,
    Zap, List, Type, Sigma,
    Server, Loader, Search, Trash2
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { FetchDatabaseSchema } from '../../../wailsjs/go/app/App';
import { onSchemaLoaded } from '../../lib/events';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../lib/cn';

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
                        className="w-full bg-bg-primary border border-border text-text-primary text-[11px] py-1 pl-[22px] pr-1.5 rounded-[3px] outline-none focus:border-success transition-colors"
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
}

const DatabaseNode: React.FC<DatabaseNodeProps> = ({ dbName, profileName, filter }) => {
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
                className={cn("flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-[3px] transition-colors duration-100 hover:bg-bg-tertiary outline-none")}
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleExpand(); }}
            >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Server size={14} className="text-success" />
                <span className="font-semibold">{dbName}</span>
                {isLoading && <Loader size={12} className="ml-1 animate-spin" />}
            </div>

            {expanded && (
                <div className="pl-4">
                    {isLoading && !schemas && (
                        <div className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[12px] text-text-secondary select-none rounded-[3px] outline-none" tabIndex={0}>
                            Loading schemas…
                        </div>
                    )}
                    {schemas && schemas.length === 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[12px] text-text-secondary select-none rounded-[3px] outline-none" tabIndex={0}>
                            No schemas found
                        </div>
                    )}
                    {schemas && schemas.length > 0 && (
                        <>
                            {(schemas as SchemaNodeData[]).map((schema: SchemaNodeData) => (
                                <SchemaNode key={schema.Name} schema={schema} filter={filter} />
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
}

const SchemaNode: React.FC<SchemaNodeProps> = ({ schema, filter }) => {
    // If filter is active, auto expand, otherwise default to closed (unless it's 'public' or something)
    const [expanded, setExpanded] = useState(schema.Name === 'public' || schema.Name === 'dbo');

    useEffect(() => {
        if (filter) setExpanded(true);
    }, [filter]);

    const categories = buildCategories(schema, filter);
    const hasItems = categories.some(c => c.items.length > 0);

    // If filter is active and schema has no matching items, hide the schema completely
    if (filter && !hasItems) return null;

    return (
        <div>
            <div
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-[3px] transition-colors duration-100 hover:bg-bg-tertiary outline-none"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); if (hasItems) setExpanded(!expanded); }}
            >
                {hasItems
                    ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                    : <span className="w-3.5 inline-block" />
                }
                <Layers size={13} className="opacity-80" />
                <span className="text-xs">{schema.Name}</span>
            </div>

            {expanded && (
                <div className="pl-4">
                    {categories.map(cat => cat.items.length > 0 && (
                        <CategoryNode key={cat.label} {...cat} schemaName={schema.Name} />
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
}

const CategoryNode: React.FC<CategoryDef> = ({ label, icon, items, itemIcon, schemaName }) => {
    const [expanded, setExpanded] = useState(true);
    const { addTab } = useEditorStore();

    const handleItemDoubleClick = (item: string) => {
        if (label === 'Tables' && schemaName) {
            addTab({
                type: 'table',
                name: `${schemaName}.${item}`,
                content: `${schemaName}.${item}`,
                query: ''
            });
        }
    };

    return (
        <div>
            <div
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-[3px] transition-colors duration-100 hover:bg-bg-tertiary outline-none"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {icon}
                <span className="text-xs">{label}</span>
                <span className="ml-auto text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">{items.length}</span>
            </div>

            {expanded && (
                <div className="pl-4">
                    {items.map(item => (
                        <div
                            key={item}
                            className="flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[12px] text-text-primary select-none rounded-[3px] transition-colors duration-100 hover:bg-bg-tertiary outline-none"
                            tabIndex={0}
                            onDoubleClick={() => handleItemDoubleClick(item)}
                        >
                            <span className="w-3.5 inline-block" />
                            {itemIcon}
                            <span>{item}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildCategories(s: SchemaNodeData, filter: string): CategoryDef[] {
    const iconSize = 12;
    const iconClass = "opacity-75 shrink-0";

    const filterFn = (items: string[]) => {
        if (!filter) return items || [];
        return (items || []).filter(item => item.toLowerCase().includes(filter));
    };

    return [
        { label: 'Tables', icon: <Table2 size={iconSize} className={iconClass} />, itemIcon: <Table2 size={iconSize} className={iconClass} />, items: filterFn(s.Tables) },
        { label: 'Foreign Tables', icon: <Link2 size={iconSize} className={iconClass} />, itemIcon: <Link2 size={iconSize} className={iconClass} />, items: filterFn(s.ForeignTables) },
        { label: 'Views', icon: <Eye size={iconSize} className={iconClass} />, itemIcon: <Eye size={iconSize} className={iconClass} />, items: filterFn(s.Views) },
        { label: 'Materialized Views', icon: <Layers size={iconSize} className={iconClass} />, itemIcon: <Layers size={iconSize} className={iconClass} />, items: filterFn(s.MaterializedViews) },
        { label: 'Indexes', icon: <Hash size={iconSize} className={iconClass} />, itemIcon: <Hash size={iconSize} className={iconClass} />, items: filterFn(s.Indexes) },
        { label: 'Functions', icon: <Zap size={iconSize} className={iconClass} />, itemIcon: <Zap size={iconSize} className={iconClass} />, items: filterFn(s.Functions) },
        { label: 'Sequences', icon: <List size={iconSize} className={iconClass} />, itemIcon: <List size={iconSize} className={iconClass} />, items: filterFn(s.Sequences) },
        { label: 'Data types', icon: <Type size={iconSize} className={iconClass} />, itemIcon: <Type size={iconSize} className={iconClass} />, items: filterFn(s.DataTypes) },
        { label: 'Aggregate functions', icon: <Sigma size={iconSize} className={iconClass} />, itemIcon: <Sigma size={iconSize} className={iconClass} />, items: filterFn(s.AggregateFunctions) },
    ];
}
