import React, { useState, useEffect } from 'react';
import { Plus, Database, Clock, BookMarked } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { ConnectionDialog } from './ConnectionDialog';
import { HistoryPanel } from './HistoryPanel';
import { SavedScriptsPanel } from './SavedScriptsPanel';
import { LoadConnections, Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { models } from '../../../wailsjs/go/models';
import { useToast } from '../layout/Toast';
import '../layout/Sidebar.css';

type SidebarTab = 'explorer' | 'history' | 'scripts';

export const Sidebar: React.FC = () => {
    const { setConnections, connections, isConnected } = useConnectionStore();
    const [activeTab, setActiveTab] = useState<SidebarTab>('explorer');
    const { toast } = useToast();

    const loadConns = async (isInitial = false) => {
        try {
            const data = await LoadConnections();
            setConnections(data || []);

            if (isInitial) {
                const store = useConnectionStore.getState();
                if (store.lastProfileName && !store.isConnected) {
                    const profile = data?.find(p => p.name === store.lastProfileName);
                    if (profile) {
                        try {
                            await Connect(profile.name);
                            if (store.lastDatabaseName && store.lastDatabaseName !== profile.db_name) {
                                await SwitchDatabase(store.lastDatabaseName);
                            }
                        } catch (err) {
                            toast.error(`Auto-connect to ${profile.name} failed: ${err}`);
                            // Xóa lastProfileName nếu connect lỗi để k bị loop lỗi
                            useConnectionStore.setState({ lastProfileName: null, lastDatabaseName: null });
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error('Failed to load connections:', e);
        }
    };

    useEffect(() => { loadConns(true); }, []);

    return (
        <div className="sidebar" style={{ width: '100%' }}>
            {/* Tab switcher */}
            <div className="sidebar-tab-bar">
                <button
                    className={`sidebar-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('explorer')}
                    title="Database Explorer"
                >
                    <Database size={13} />
                    <span>Explorer</span>
                </button>
                <button
                    className={`sidebar-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                    title="Query History"
                >
                    <Clock size={13} />
                    <span>History</span>
                </button>
                <button
                    className={`sidebar-tab-btn ${activeTab === 'scripts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('scripts')}
                    title="Saved Scripts"
                >
                    <BookMarked size={13} />
                    <span>Scripts</span>
                </button>


            </div>

            <div className="sidebar-content">
                {activeTab === 'explorer' ? (
                    !isConnected ? (
                        <div className="sidebar-empty">
                            <div className="sidebar-empty-icon">📁</div>
                            <p style={{ marginBottom: 16 }}>No active database</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Press <kbd>Ctrl+Shift+P</kbd> to connect to a workspace.</p>
                        </div>
                    ) : (
                        <ConnectionTree />
                    )
                ) : activeTab === 'history' ? (
                    <HistoryPanel />
                ) : (
                    <SavedScriptsPanel />
                )}
            </div>

        </div>
    );
};
