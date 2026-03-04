import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { ConnectionDialog } from './ConnectionDialog';
import { LoadConnections } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';

export const Sidebar: React.FC = () => {
    const { setConnections, connections } = useConnectionStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editProfile, setEditProfile] = useState<models.ConnectionProfile | null>(null);

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
            <div className="sidebar-header">
                <span>Database Explorer</span>
                <button
                    className="sidebar-add-btn"
                    onClick={openNew}
                    title="Add connection (Ctrl+Shift+N)"
                >
                    <Plus size={14} />
                </button>
            </div>

            <div className="sidebar-content">
                {connections.length === 0 ? (
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
