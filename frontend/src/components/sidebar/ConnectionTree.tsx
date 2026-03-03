import React, { useState, useEffect } from 'react';
import { Database, Edit, Trash2, Plug, ChevronRight, ChevronDown, Server, Table } from 'lucide-react';
import { models } from '../../../wailsjs/go/models';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, DeleteConnection } from '../../../wailsjs/go/app/App';

type ConnectionProfile = models.ConnectionProfile;

interface ConnectionTreeProps {
    onEdit: (profile: ConnectionProfile) => void;
}

export const ConnectionTree: React.FC<ConnectionTreeProps> = ({ onEdit }) => {
    const { connections, isConnected, activeProfile, databases } = useConnectionStore();

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, profile: ConnectionProfile } | null>(null);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, profile: ConnectionProfile) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            profile
        });
    };

    const handleConnect = async (profileName: string) => {
        try {
            await Connect(profileName);
        } catch (err: any) {
            alert(`Connection error: ${err.toString()}`);
        }
    };

    const handleDelete = async (profileName: string) => {
        if (confirm(`Are you sure you want to delete connection "${profileName}"?`)) {
            try {
                await DeleteConnection(profileName);
                // Refresh handled by Sidebar parent or event
            } catch (err: any) {
                alert(err.toString());
            }
        }
    };

    return (
        <div>
            {connections.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px', fontSize: 13 }}>
                    No connections yet. Click "Connect" to create one.
                </div>
            ) : (
                connections.map(c => {
                    const isActive = activeProfile?.name === c.name;

                    return (
                        <div key={c.name}>
                            <div
                                className={`tree-node ${isActive ? 'active' : ''}`}
                                onContextMenu={(e) => handleContextMenu(e, c)}
                                onClick={() => handleConnect(c.name)}
                            >
                                {isActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <Database size={14} color={isActive && isConnected ? "var(--success-color)" : "currentColor"} />
                                <span style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                            </div>

                            {isActive && isConnected && (
                                <div className="tree-children">
                                    {databases.map(db => (
                                        <DatabaseNode key={db} dbName={db} profileName={c.name!} />
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
                    <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleConnect(contextMenu.profile.name!); setContextMenu(null); }}>
                        <Plug size={12} style={{ marginRight: 6 }} /> Connect
                    </div>
                    <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); onEdit(contextMenu.profile); setContextMenu(null); }}>
                        <Edit size={12} style={{ marginRight: 6 }} /> Edit
                    </div>
                    <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleDelete(contextMenu.profile.name!); setContextMenu(null); }} style={{ color: 'var(--error-color)' }}>
                        <Trash2 size={12} style={{ marginRight: 6 }} /> Delete
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for DB Node (handles lazy loading schemas eventually)
const DatabaseNode: React.FC<{ dbName: string, profileName: string }> = ({ dbName, profileName }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div>
            <div className="tree-node" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Server size={14} />
                <span>{dbName}</span>
            </div>
            {expanded && (
                <div className="tree-children">
                    {/* To be populated via schemaStore in phase 3.4 */}
                    <div className="tree-node" style={{ color: 'var(--text-secondary)' }}>
                        <Table size={14} /> <i>Loading schemas...</i>
                    </div>
                </div>
            )}
        </div>
    );
};
