import React, { useState, useEffect } from 'react';
import { Plus, Database, Clock, BookMarked, Terminal, Zap, Hash } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { HistoryPanel } from './HistoryPanel';
import { SavedScriptsPanel } from './SavedScriptsPanel';
import { LoadConnections, Connect, SwitchDatabase, GetConnectionStatus } from '../../../wailsjs/go/app/App';
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
                const status = await GetConnectionStatus();
                if (status && status.status === 'connected' && status.profile) {
                    store.setActiveProfile(status.profile);
                    store.setIsConnected(true);
                    store.setConnectionStatus('connected');
                    return;
                } else {
                    store.setIsConnected(false);
                }

                if (store.lastProfileName) {
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

    const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
        { id: 'explorer', label: 'Explorer', icon: <Hash size={12} /> },
        { id: 'history', label: 'History', icon: <Clock size={12} /> },
        { id: 'scripts', label: 'Scripts', icon: <BookMarked size={12} /> },
    ];

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-bg-secondary border-r border-border select-none">
            {/* Action Bar / Tab Switcher */}
            <div className="flex items-center p-2 border-b border-border bg-bg-secondary/50">
                <div className="flex flex-1 items-center bg-bg-tertiary/50 p-0.5 rounded-md border border-border/40">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
                                activeTab === tab.id 
                                    ? "bg-bg-primary text-text-primary shadow-sm"
                                    : "text-text-muted hover:text-text-secondary"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {activeTab === 'explorer' ? (
                    !isConnected ? (
                        <div className="flex flex-col h-full p-6 animate-in fade-in duration-700">
                             <div className="mt-8 mb-6 space-y-1">
                                <h3 className="text-[14px] font-bold text-text-primary">Welcome to Zentro</h3>
                                <p className="text-[11px] text-text-muted">Connect to start exploring</p>
                             </div>

                             <div className="space-y-2">
                                <button 
                                    onClick={() => (window as any).dispatchEvent(new KeyboardEvent('keydown', { key: 'C', ctrlKey: true, shiftKey: true }))}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-bg-primary border border-border/60 hover:border-accent/40 hover:bg-bg-tertiary transition-all group cursor-pointer"
                                >
                                    <div className="p-2 rounded-md bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
                                        <Plus size={14} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[12px] font-medium text-text-secondary group-hover:text-text-primary">New Connection</div>
                                        <div className="text-[10px] text-text-muted">Ctrl+Shift+C</div>
                                    </div>
                                </button>

                                <div className="p-4 rounded-lg bg-bg-tertiary/30 border border-dashed border-border/60">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap size={11} className="text-yellow-500" />
                                        <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Quick Start</span>
                                    </div>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-[11px] text-text-secondary opacity-70">
                                            <div className="w-1 h-1 rounded-full bg-border" />
                                            Press <kbd className="bg-bg-primary px-1 rounded border border-border">Ctrl+T</kbd> for new tab
                                        </li>
                                        <li className="flex items-center gap-2 text-[11px] text-text-secondary opacity-70">
                                            <div className="w-1 h-1 rounded-full bg-border" />
                                            Right-click table to explore
                                        </li>
                                    </ul>
                                </div>
                             </div>
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
