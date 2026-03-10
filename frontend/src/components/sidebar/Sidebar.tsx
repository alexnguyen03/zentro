import React, { useState, useEffect } from 'react';
import { Plus, Database, Clock, BookMarked } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { ConnectionDialog } from './ConnectionDialog';
import { HistoryPanel } from './HistoryPanel';
import { SavedScriptsPanel } from './SavedScriptsPanel';
import { LoadConnections, Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { useToast } from '../layout/Toast';
import { cn } from '../../lib/cn';

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

    const tabBtn = (tab: SidebarTab) =>
        cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border-b-2 border-transparent cursor-pointer bg-transparent border-t-0 border-l-0 border-r-0 text-text-secondary transition-colors duration-100 flex-shrink-0',
            activeTab === tab
                ? 'text-text-primary border-b-success'
                : 'hover:text-text-primary'
        );

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-bg-secondary border-r border-border">
            {/* Tab switcher */}
            <div className="flex items-center flex-shrink-0 border-b border-border bg-bg-secondary">
                <button className={tabBtn('explorer')} onClick={() => setActiveTab('explorer')} title="Database Explorer">
                    <Database size={13} /><span>Explorer</span>
                </button>
                <button className={tabBtn('history')} onClick={() => setActiveTab('history')} title="Query History">
                    <Clock size={13} /><span>History</span>
                </button>
                <button className={tabBtn('scripts')} onClick={() => setActiveTab('scripts')} title="Saved Scripts">
                    <BookMarked size={13} /><span>Scripts</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'explorer' ? (
                    !isConnected ? (
                        <div className="flex flex-col items-center justify-center gap-2.5 h-full min-h-[200px] p-6 text-center text-text-secondary text-xs">
                            <div className="text-3xl opacity-30">📁</div>
                            <p className="m-0 mb-4">No active database</p>
                            <p className="m-0 text-[11px]">Press <kbd className="bg-bg-tertiary px-1 py-0.5 rounded text-[10px]">Ctrl+Shift+P</kbd> to connect to a workspace.</p>
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
