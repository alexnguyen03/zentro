import React, { useState, useEffect, useRef } from 'react';
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
    const [isCompact, setIsCompact] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Switch to compact mode if width is less than 160px
                setIsCompact(entry.contentRect.width < 160);
            }
        });

        if (sidebarRef.current) {
            observer.observe(sidebarRef.current);
        }

        return () => observer.disconnect();
    }, []);

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
        { id: 'explorer', label: 'Explorer', icon: <Hash size={14} /> },
        { id: 'history', label: 'History', icon: <Clock size={14} /> },
        { id: 'scripts', label: 'Scripts', icon: <BookMarked size={14} /> },
    ];

    return (
        <div ref={sidebarRef} className="flex flex-col h-full w-full overflow-hidden bg-bg-secondary select-none">
            {/* Ultra-Flat Tab Switcher */}
            <div className={cn(
                "flex items-center h-11 bg-bg-secondary transition-all",
                isCompact ? "px-2 justify-around gap-0" : "px-4 gap-4"
            )}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        title={isCompact ? tab.label : undefined}
                        className={cn(
                            "relative flex items-center gap-1.5 h-full text-[11px] font-bold transition-all duration-200 cursor-pointer",
                            activeTab === tab.id 
                                ? "text-text-primary"
                                : "text-text-muted hover:text-text-secondary"
                        )}
                    >
                        <span className={cn(activeTab === tab.id ? "text-accent" : "")}>{tab.icon}</span>
                        {!isCompact && <span>{tab.label}</span>}
                        
                        {/* Active Indicator Line - subtle and flat */}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-t-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area - Flush with top */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden border-t border-border/40">
                {activeTab === 'explorer' ? (
                    !isConnected ? (
                        <div className={cn(
                            "flex flex-col h-full animate-in fade-in duration-700",
                            isCompact ? "p-4 items-center" : "p-8"
                        )}>
                             <div className={cn("mb-8", isCompact && "text-center")}>
                                <h3 className="text-[15px] font-bold text-text-primary tracking-tight">Explorer</h3>
                                {!isCompact && <p className="text-[12px] text-text-muted mt-1">Connect to a workspace</p>}
                             </div>

                             <div className="space-y-6 w-full">
                                <button 
                                    onClick={() => (window as any).dispatchEvent(new KeyboardEvent('keydown', { key: 'C', ctrlKey: true, shiftKey: true }))}
                                    className={cn(
                                        "flex items-center group cursor-pointer",
                                        isCompact ? "justify-center" : "gap-4"
                                    )}
                                    title="New Connection"
                                >
                                    <div className="p-2.5 rounded-lg bg-accent text-white shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform">
                                        <Plus size={16} />
                                    </div>
                                    {!isCompact && (
                                        <div className="text-left">
                                            <div className="text-[12px] font-bold text-text-primary">New Connection</div>
                                            <div className="text-[10px] text-text-muted mt-0.5">Ctrl+Shift+C</div>
                                        </div>
                                    )}
                                </button>

                                {!isCompact && (
                                    <div className="pt-6 border-t border-border/40">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Zap size={12} className="text-accent" />
                                            <span className="text-[10px] font-bold uppercase text-text-muted tracking-widest">Workflow</span>
                                        </div>
                                        <ul className="space-y-4">
                                            <li className="flex items-start gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5" />
                                                <div>
                                                    <div className="text-[12px] text-text-secondary">Open Workspaces</div>
                                                    <div className="text-[10px] text-text-muted">Manage your saved profiles</div>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                )}
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
