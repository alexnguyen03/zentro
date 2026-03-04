import React, { useState, useEffect } from 'react';
import { Plus, Database, Clock } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { ConnectionDialog } from './ConnectionDialog';
import { HistoryPanel } from './HistoryPanel';
import { LoadConnections } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import '../layout/Sidebar.css';

type SidebarTab = 'connections' | 'history';

export const Sidebar: React.FC = () => {
    const { setConnections, connections } = useConnectionStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editProfile, setEditProfile] = useState<models.ConnectionProfile | null>(null);
    const [activeTab, setActiveTab] = useState<SidebarTab>('connections');

    const loadConns = async () => {
        try {
            const data = await LoadConnections();
            setConnections(data || []);
        } catch (e: any) {
            console.error('Failed to load connections:', e);
        }
    };

    useEffect(() => { loadConns(); }, []);

    const openNew = () => { setEditProfile(null); setIsDialogOpen(true); };
    const handleEdit = (profile: models.ConnectionProfile) => { setEditProfile(profile); setIsDialogOpen(true); };

    return (
        <div className="sidebar" style={{ width: '100%' }}>
            {/* Tab switcher */}
            <div className="sidebar-tab-bar">
                <button
                    className={`sidebar-tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
                    onClick={() => setActiveTab('connections')}
                    title="Database Explorer"
                >
                    <Database size={13} />
                    <span>Connections</span>
                </button>
                <button
                    className={`sidebar-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                    title="Query History"
                >
                    <Clock size={13} />
                    <span>History</span>
                </button>

                {activeTab === 'connections' && (
                    <button
                        className="sidebar-add-btn"
                        onClick={openNew}
                        title="Add connection"
                        style={{ marginLeft: 'auto' }}
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            <div className="sidebar-content">
                {activeTab === 'connections' ? (
                    connections.length === 0 ? (
                        <div className="sidebar-empty">
                            <div className="sidebar-empty-icon">⚡</div>
                            <p>No connections yet</p>
                            <button
                                className="btn primary"
                                onClick={openNew}
                                style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                <Plus size={13} /> Add Connection
                            </button>
                        </div>
                    ) : (
                        <ConnectionTree onEdit={handleEdit} />
                    )
                ) : (
                    <HistoryPanel />
                )}
            </div>

            <ConnectionDialog
                isOpen={isDialogOpen}
                profile={editProfile}
                onClose={() => { setIsDialogOpen(false); setEditProfile(null); }}
                onSave={loadConns}
            />
        </div>
    );
};
