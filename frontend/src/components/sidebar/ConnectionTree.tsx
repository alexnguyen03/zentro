import React, { useState, useEffect } from 'react';
import { Database, Edit, Trash2, Plug, ChevronRight, ChevronDown, Server, Table, Eye, Loader } from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { Connect, DeleteConnection, FetchDatabaseSchema, LoadConnections } from '../../../wailsjs/go/app/App';
import { onSchemaLoaded } from '../../lib/events';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionTreeProps {
    onEdit: (profile: ConnectionProfile) => void;
}

export const ConnectionTree: React.FC<ConnectionTreeProps> = ({ onEdit }) => {
    const { connections, isConnected, activeProfile, databases, setConnections } = useConnectionStore();

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: ConnectionProfile } | null>(null);

    // Close context menu on outside click
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

    const handleDelete = async (profileName: string) => {
        if (!confirm(`Delete connection "${profileName}"?`)) return;
        try {
            await DeleteConnection(profileName);
            // Refresh list in-place — no full reload required
            const data = await LoadConnections();
            setConnections(data || []);
        } catch (err: any) {
            alert(err.toString());
        }
    };

    return (
        <div>
            {connections.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px', fontSize: 13 }}>
                    No connections yet. Click "+" to create one.
                </div>
            ) : (
                connections.map(c => {
                    const isActive = activeProfile?.name === c.name;
                    return (
                        <div key={c.name}>
                            <div
                                className={`tree-node ${isActive ? 'active' : ''}`}
                                onContextMenu={(e) => handleContextMenu(e, c)}
                                onClick={() => handleConnect(c.name!)}
                            >
                                {isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <Database
                                    size={14}
                                    color={isActive && isConnected ? 'var(--success-color)' : 'currentColor'}
                                />
                                <span style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                            </div>

                            {isActive && isConnected && (
                                <div className="tree-children">
                                    {databases.map(db => (
                                        <DatabaseNode
                                            key={db}
                                            dbName={db}
                                            profileName={c.name!}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div
                        className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); handleConnect(contextMenu.profile.name!); setContextMenu(null); }}
                    >
                        <Plug size={12} style={{ marginRight: 6 }} /> Connect
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); onEdit(contextMenu.profile); setContextMenu(null); }}
                    >
                        <Edit size={12} style={{ marginRight: 6 }} /> Edit
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); handleDelete(contextMenu.profile.name!); setContextMenu(null); }}
                        style={{ color: 'var(--error-color)' }}
                    >
                        <Trash2 size={12} style={{ marginRight: 6 }} /> Delete
                    </div>
                </div>
            )}
        </div>
    );
};

// ── DatabaseNode ──────────────────────────────────────────────────────────────
// Lazy-loads schemas when expanded for the first time.
// Subsequent expand/collapse reads from schemaStore cache (no repeat fetch).

interface DatabaseNodeProps {
    dbName: string;
    profileName: string;
}

const DatabaseNode: React.FC<DatabaseNodeProps> = ({ dbName, profileName }) => {
    const [expanded, setExpanded] = useState(false);

    const key = `${profileName}:${dbName}`;
    const schemas = useSchemaStore(s => s.trees[key]);
    const isLoading = useSchemaStore(s => s.loadingKeys.has(key));
    const setTree = useSchemaStore(s => s.setTree);
    const setLoading = useSchemaStore(s => s.setLoading);

    // Subscribe to schema:loaded for this specific db
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
        // Fetch only on first open and only if not already cached / loading
        if (next && !schemas && !isLoading) {
            setLoading(profileName, dbName, true);
            try {
                await FetchDatabaseSchema(profileName, dbName);
                // setTree is called via the onSchemaLoaded event listener above
            } catch (err) {
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
                            Loading schemas...
                        </div>
                    )}
                    {schemas && schemas.length === 0 && (
                        <div className="tree-node" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            No schemas found
                        </div>
                    )}
                    {schemas?.map(schema => (
                        <SchemaNode key={schema.Name} schema={schema} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── SchemaNode ────────────────────────────────────────────────────────────────

interface SchemaNodeProps {
    schema: { Name: string; Tables: string[]; Views: string[] };
}

const SchemaNode: React.FC<SchemaNodeProps> = ({ schema }) => {
    const [expanded, setExpanded] = useState(false);

    const hasItems = schema.Tables.length > 0 || schema.Views.length > 0;

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
                <Server size={13} style={{ opacity: 0.7 }} />
                <span style={{ fontSize: 12 }}>{schema.Name}</span>
            </div>

            {expanded && (
                <div className="tree-children">
                    {schema.Tables.map(t => (
                        <div key={`t:${t}`} className="tree-node" style={{ fontSize: 12 }}>
                            <span style={{ width: 14, display: 'inline-block' }} />
                            <Table size={12} style={{ marginRight: 4, opacity: 0.8 }} />
                            {t}
                        </div>
                    ))}
                    {schema.Views.map(v => (
                        <div key={`v:${v}`} className="tree-node" style={{ fontSize: 12, fontStyle: 'italic' }}>
                            <span style={{ width: 14, display: 'inline-block' }} />
                            <Eye size={12} style={{ marginRight: 4, opacity: 0.8 }} />
                            {v}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
