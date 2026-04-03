import React, { useState, useEffect, useRef } from 'react';
import { Plus, Clock, BookMarked, Zap, Hash } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionTree } from './ConnectionTree';
import { HistoryPanel } from './HistoryPanel';
import { SavedScriptsPanel } from './SavedScriptsPanel';
import { GitTimelinePanel } from './GitTimelinePanel';
import { LoadConnections, GetConnectionStatus } from '../../services/connectionService';
import { useToast } from '../layout/Toast';
import { cn } from '../../lib/cn';
import { useProjectStore } from '../../stores/projectStore';
import { getEnvironmentLabel } from '../../lib/projects';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { emitCommand } from '../../lib/commandBus';
import { DOM_EVENT, CONNECTION_STATUS } from '../../lib/constants';
import { getErrorMessage } from '../../lib/errors';

type SidebarTab = 'explorer' | 'history' | 'scripts' | 'timeline';

export const Sidebar: React.FC = () => {
    const { setConnections, isConnected } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
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
                if (status && status.status === CONNECTION_STATUS.CONNECTED && status.profile) {
                    store.setActiveProfile(status.profile);
                    store.setIsConnected(true);
                    store.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
                    return;
                }
                store.resetRuntime();
            }
        } catch (e: unknown) {
            console.error('Failed to load connections:', e);
            toast.error(`Failed to load connections: ${getErrorMessage(e)}`);
        }
    };

    useEffect(() => { loadConns(true); }, []);

    const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
        { id: 'explorer', label: 'Explorer', icon: <Hash size={14} /> },
        { id: 'history', label: 'History', icon: <Clock size={14} /> },
        { id: 'scripts', label: 'Scripts', icon: <BookMarked size={14} /> },
        { id: 'timeline', label: 'Timeline', icon: <Zap size={14} /> },
    ];
    const lockExplorerScroll = activeTab === 'explorer' && isConnected;

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
            <div
                className={cn(
                    'flex-1 border-t border-border/40',
                    lockExplorerScroll ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
                )}
            >
                {activeTab === 'explorer' ? (
                    !isConnected ? (
                        <div className={cn(
                            "flex flex-col h-full animate-in fade-in duration-700",
                            isCompact ? "p-4 items-center" : "p-8"
                        )}>
                             <div className={cn("mb-8", isCompact && "text-center")}>
                                <h3 className="text-[15px] font-bold text-text-primary tracking-tight">Explorer</h3>
                                {!isCompact && (
                                    <p className="text-[12px] text-text-muted mt-1">
                                        {activeProject
                                            ? `${activeProject.name} / ${getEnvironmentLabel(activeEnvironmentKey || activeProject.default_environment_key)}`
                                            : 'Project foundation loaded'}
                                    </p>
                                )}
                             </div>

                             <div className="space-y-6 w-full">
                                <button 
                                    onClick={() => emitCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER)}
                                    className={cn(
                                        "flex items-center group cursor-pointer",
                                        isCompact ? "justify-center" : "gap-4"
                                    )}
                                    title="New Connection"
                                >
                                    <div className="p-2.5 rounded-md bg-accent text-white group-hover:scale-110 transition-transform">
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
                                                    <div className="text-[12px] text-text-secondary">Bind Environments</div>
                                                    <div className="text-[10px] text-text-muted">Attach saved profiles to each target once</div>
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
                ) : activeTab === 'timeline' ? (
                    <GitTimelinePanel />
                ) : (
                    <SavedScriptsPanel />
                )}
            </div>
        </div>
    );
};

