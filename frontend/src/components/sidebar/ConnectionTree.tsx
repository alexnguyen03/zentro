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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="explorer-filter-bar">
                <div className="explorer-search-wrap">
                    <Search size={11} className="explorer-search-icon" />
                    <input
                        ref={filterInputRef}
                        type="text"
                        className="explorer-search"
                        placeholder="Filter objects..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
                    />
                </div>
                {filter && (
                    <button className="explorer-clear-btn" onClick={() => setFilter('')} title="Clear filter">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
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
            <div className="tree-node" tabIndex={0} onClick={(e) => { e.stopPropagation(); handleExpand(); }}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Server size={14} color="var(--success-color)" />
                <span style={{ fontWeight: 600 }}>{dbName}</span>
                {isLoading && <Loader size={12} style={{ marginLeft: 4, animation: 'spin 1s linear infinite' }} />}
            </div>

            {expanded && (
                <div className="tree-children">
                    {isLoading && !schemas && (
                        <div className="tree-node" tabIndex={0} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            Loading schemas…
                        </div>
                    )}
                    {schemas && schemas.length === 0 && (
                        <div className="tree-node" tabIndex={0} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
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
                className="tree-node"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); if (hasItems) setExpanded(!expanded); }}
            >
                {hasItems
                    ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                    : <span style={{ width: 14, display: 'inline-block' }} />
                }
                <Layers size={13} style={{ opacity: 0.8 }} />
                <span style={{ fontSize: 12 }}>{schema.Name}</span>
            </div>

            {expanded && (
                <div className="tree-children">
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
            <div className="tree-node" tabIndex={0} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {icon}
                <span style={{ fontSize: 12 }}>{label}</span>
                <span className="tree-count-badge">{items.length}</span>
            </div>

            {expanded && (
                <div className="tree-children">
                    {items.map(item => (
                        <div
                            key={item}
                            className="tree-node tree-leaf"
                            tabIndex={0}
                            style={{ fontSize: 12 }}
                            onDoubleClick={() => handleItemDoubleClick(item)}
                        >
                            <span style={{ width: 13, display: 'inline-block' }} />
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
    const iconStyle = { opacity: 0.75, flexShrink: 0 as const };

    const filterFn = (items: string[]) => {
        if (!filter) return items || [];
        return (items || []).filter(item => item.toLowerCase().includes(filter));
    };

    return [
        { label: 'Tables', icon: <Table2 size={iconSize} style={iconStyle} />, itemIcon: <Table2 size={iconSize} style={iconStyle} />, items: filterFn(s.Tables) },
        { label: 'Foreign Tables', icon: <Link2 size={iconSize} style={iconStyle} />, itemIcon: <Link2 size={iconSize} style={iconStyle} />, items: filterFn(s.ForeignTables) },
        { label: 'Views', icon: <Eye size={iconSize} style={iconStyle} />, itemIcon: <Eye size={iconSize} style={iconStyle} />, items: filterFn(s.Views) },
        { label: 'Materialized Views', icon: <Layers size={iconSize} style={iconStyle} />, itemIcon: <Layers size={iconSize} style={iconStyle} />, items: filterFn(s.MaterializedViews) },
        { label: 'Indexes', icon: <Hash size={iconSize} style={iconStyle} />, itemIcon: <Hash size={iconSize} style={iconStyle} />, items: filterFn(s.Indexes) },
        { label: 'Functions', icon: <Zap size={iconSize} style={iconStyle} />, itemIcon: <Zap size={iconSize} style={iconStyle} />, items: filterFn(s.Functions) },
        { label: 'Sequences', icon: <List size={iconSize} style={iconStyle} />, itemIcon: <List size={iconSize} style={iconStyle} />, items: filterFn(s.Sequences) },
        { label: 'Data types', icon: <Type size={iconSize} style={iconStyle} />, itemIcon: <Type size={iconSize} style={iconStyle} />, items: filterFn(s.DataTypes) },
        { label: 'Aggregate functions', icon: <Sigma size={iconSize} style={iconStyle} />, itemIcon: <Sigma size={iconSize} style={iconStyle} />, items: filterFn(s.AggregateFunctions) },
    ];
}
