import React, { useState, useEffect } from 'react';
import {
    Database, Edit, Trash2, Plug, PlugZap,
    ChevronRight, ChevronDown,
    Table2, Link2, Eye, Layers, Hash,
    Zap, List, Type, Sigma,
    Server, Loader,
} from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { Connect, DeleteConnection, FetchDatabaseSchema, LoadConnections, Disconnect } from '../../../wailsjs/go/app/App';
import { onSchemaLoaded } from '../../lib/events';

type ConnectionProfile = models.ConnectionProfile;

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

interface ConnectionTreeProps {
    onEdit: (profile: ConnectionProfile) => void;
}

// ── ConnectionTree ─────────────────────────────────────────────────────────────

export const ConnectionTree: React.FC<ConnectionTreeProps> = ({ onEdit }) => {
    const { connections, isConnected, activeProfile, databases, setConnections } = useConnectionStore();
    const setIsConnected = useConnectionStore(s => s.setIsConnected);
    const setActiveProfile = useConnectionStore(s => s.setActiveProfile);
    const setDatabases = useConnectionStore(s => s.setDatabases);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: ConnectionProfile } | null>(null);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, profile: ConnectionProfile) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, profile });
    };

    const handleConnect = async (profileName: string) => {
        try {
            await Connect(profileName);
        } catch (err: any) {
            alert(`Connection error: ${err.toString()}`);
        }
    };

    const handleDisconnect = async () => {
        try {
            await Disconnect();
            setIsConnected(false);
            setActiveProfile(null);
            setDatabases([]);
        } catch (err: any) {
            alert(err.toString());
        }
    };

    const handleDelete = async (profileName: string) => {
        if (!confirm(`Delete connection "${profileName}"?`)) return;
        try {
            await DeleteConnection(profileName);
            const data = await LoadConnections();
            setConnections(data || []);
        } catch (err: any) {
            alert(err.toString());
        }
    };

    return (
        <div>
            {connections.map(c => {
                const isActive = activeProfile?.name === c.name;
                const showDatabases = isActive && isConnected && databases.length > 0;
                return (
                    <div key={c.name}>
                        {/* Connection profile row */}
                        <div
                            className={`tree-node ${isActive ? 'active' : ''}`}
                            onContextMenu={(e) => handleContextMenu(e, c)}
                            onClick={() => handleConnect(c.name!)}
                        >
                            {showDatabases ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Database
                                size={14}
                                color={isActive && isConnected ? 'var(--success-color)' : 'currentColor'}
                            />
                            <span style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                            {isActive && isConnected && (
                                <span className="connection-active-dot" title="Connected" />
                            )}
                        </div>

                        {/* Databases group */}
                        {showDatabases && (
                            <div className="tree-children">
                                <div className="tree-group-label"><span>Databases</span></div>
                                {databases.map(db => (
                                    <DatabaseNode key={db} dbName={db} profileName={c.name!} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Context menu */}
            {contextMenu && (
                <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                    <div className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); handleConnect(contextMenu.profile.name!); setContextMenu(null); }}>
                        <Plug size={12} style={{ marginRight: 6 }} /> Connect
                    </div>
                    {activeProfile?.name === contextMenu.profile.name && isConnected && (
                        <div className="context-menu-item"
                            onClick={(e) => { e.stopPropagation(); handleDisconnect(); setContextMenu(null); }}
                            style={{ color: 'var(--accent-color)' }}>
                            <PlugZap size={12} style={{ marginRight: 6 }} /> Disconnect
                        </div>
                    )}
                    <div className="context-menu-separator" />
                    <div className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); onEdit(contextMenu.profile); setContextMenu(null); }}>
                        <Edit size={12} style={{ marginRight: 6 }} /> Edit
                    </div>
                    <div className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); handleDelete(contextMenu.profile.name!); setContextMenu(null); }}
                        style={{ color: 'var(--error-color)' }}>
                        <Trash2 size={12} style={{ marginRight: 6 }} /> Delete
                    </div>
                </div>
            )}
        </div>
    );
};

// ── DatabaseNode ───────────────────────────────────────────────────────────────

interface DatabaseNodeProps { dbName: string; profileName: string; }

const DatabaseNode: React.FC<DatabaseNodeProps> = ({ dbName, profileName }) => {
    const [expanded, setExpanded] = useState(false);

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
            <div className="tree-node" onClick={(e) => { e.stopPropagation(); handleExpand(); }}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Server size={14} />
                <span>{dbName}</span>
                {isLoading && <Loader size={12} style={{ marginLeft: 4, animation: 'spin 1s linear infinite' }} />}
            </div>

            {expanded && (
                <div className="tree-children">
                    {isLoading && (
                        <div className="tree-node" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            Loading schemas…
                        </div>
                    )}
                    {schemas && schemas.length === 0 && (
                        <div className="tree-node" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            No schemas found
                        </div>
                    )}
                    {/* Schemas group label */}
                    {schemas && schemas.length > 0 && (
                        <>
                            <div className="tree-group-label"><span>Schemas</span></div>
                            {(schemas as SchemaNodeData[]).map((schema: SchemaNodeData) => (
                                <SchemaNode key={schema.Name} schema={schema} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ── SchemaNode ─────────────────────────────────────────────────────────────────

interface SchemaNodeProps { schema: SchemaNodeData; }

const SchemaNode: React.FC<SchemaNodeProps> = ({ schema }) => {
    const [expanded, setExpanded] = useState(false);

    const categories = buildCategories(schema);
    const hasItems = categories.some(c => c.items.length > 0);

    return (
        <div>
            <div
                className="tree-node"
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
                        <CategoryNode key={cat.label} {...cat} />
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
}

const CategoryNode: React.FC<CategoryDef> = ({ label, icon, items, itemIcon }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div>
            <div className="tree-node" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {icon}
                <span style={{ fontSize: 12 }}>{label}</span>
                <span className="tree-count-badge">{items.length}</span>
            </div>

            {expanded && (
                <div className="tree-children">
                    {items.map(item => (
                        <div key={item} className="tree-node tree-leaf" style={{ fontSize: 12 }}>
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

function buildCategories(s: SchemaNodeData): CategoryDef[] {
    const iconSize = 12;
    const iconStyle = { opacity: 0.75, flexShrink: 0 as const };
    return [
        { label: 'Tables', icon: <Table2 size={iconSize} style={iconStyle} />, itemIcon: <Table2 size={iconSize} style={iconStyle} />, items: s.Tables ?? [] },
        { label: 'Foreign Tables', icon: <Link2 size={iconSize} style={iconStyle} />, itemIcon: <Link2 size={iconSize} style={iconStyle} />, items: s.ForeignTables ?? [] },
        { label: 'Views', icon: <Eye size={iconSize} style={iconStyle} />, itemIcon: <Eye size={iconSize} style={iconStyle} />, items: s.Views ?? [] },
        { label: 'Materialized Views', icon: <Layers size={iconSize} style={iconStyle} />, itemIcon: <Layers size={iconSize} style={iconStyle} />, items: s.MaterializedViews ?? [] },
        { label: 'Indexes', icon: <Hash size={iconSize} style={iconStyle} />, itemIcon: <Hash size={iconSize} style={iconStyle} />, items: s.Indexes ?? [] },
        { label: 'Functions', icon: <Zap size={iconSize} style={iconStyle} />, itemIcon: <Zap size={iconSize} style={iconStyle} />, items: s.Functions ?? [] },
        { label: 'Sequences', icon: <List size={iconSize} style={iconStyle} />, itemIcon: <List size={iconSize} style={iconStyle} />, items: s.Sequences ?? [] },
        { label: 'Data types', icon: <Type size={iconSize} style={iconStyle} />, itemIcon: <Type size={iconSize} style={iconStyle} />, items: s.DataTypes ?? [] },
        { label: 'Aggregate functions', icon: <Sigma size={iconSize} style={iconStyle} />, itemIcon: <Sigma size={iconSize} style={iconStyle} />, items: s.AggregateFunctions ?? [] },
    ];
}
