import React, { useState, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { ConnectionDialog } from './ConnectionDialog';
import { LoadConnections } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';

export const Sidebar: React.FC = () => {
    const setConnections = useConnectionStore(state => state.setConnections);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editProfile, setEditProfile] = useState<models.ConnectionProfile | null>(null);

    const loadConns = async () => {
        try {
            const data = await LoadConnections();
            setConnections(data || []);
        } catch (e: any) {
            console.error("Failed to load connections:", e);
        }
    };

    useEffect(() => {
        loadConns();
    }, []);

    // Listen to wails custom event globally for connections if needed
    useEffect(() => {
        if (!window.go) return;
        // Listen to custom wails events or you can rely on the store refresh events
    }, []);

    const handleEdit = (profile: models.ConnectionProfile) => {
        setEditProfile(profile);
        setIsDialogOpen(true);
    };

    return (
        <div className="sidebar" style={{ width: '100%' }}>
            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Database Explorer</span>
                <span style={{ cursor: 'pointer' }} onClick={() => { setEditProfile(null); setIsDialogOpen(true); }}>+</span>
            </div>
            <div className="sidebar-content">
                <ConnectionTree onEdit={handleEdit} />
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
