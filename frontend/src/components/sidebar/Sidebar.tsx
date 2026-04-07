import React from 'react';
import { LoadConnections, GetConnectionStatus } from '../../services/connectionService';
import { useConnectionStore } from '../../stores/connectionStore';
import { CONNECTION_STATUS } from '../../lib/constants';
import { getErrorMessage } from '../../lib/errors';
import { useToast } from '../layout/Toast';
import { Tabs, TabsContent, TabsList, TabsTrigger, Separator } from '../ui';
import { registerBuiltInSidebarPanels } from './sidebarPanels';
import { useSidebarPanels } from './sidebarPanelRegistry';
import { useSidebarSideState } from '../../stores/sidebarUiStore';

export const Sidebar: React.FC = () => {
    const { setConnections } = useConnectionStore();
    const { toast } = useToast();
    const panels = useSidebarPanels('primary');
    const {
        activePanelId,
        setActivePanelId,
    } = useSidebarSideState('primary', { activePanelId: 'explorer' });

    React.useEffect(() => {
        registerBuiltInSidebarPanels();
    }, []);

    React.useEffect(() => {
        if (panels.length === 0) return;
        const hasActivePanel = panels.some((panel) => panel.id === activePanelId);
        if (!hasActivePanel) {
            setActivePanelId(panels[0].id);
        }
    }, [activePanelId, panels, setActivePanelId]);

    React.useEffect(() => {
        const loadConns = async () => {
            try {
                const data = await LoadConnections();
                setConnections(data || []);

                const store = useConnectionStore.getState();
                const status = await GetConnectionStatus();
                if (status && status.status === CONNECTION_STATUS.CONNECTED && status.profile) {
                    store.setActiveProfile(status.profile);
                    store.setIsConnected(true);
                    store.setConnectionStatus(CONNECTION_STATUS.CONNECTED);
                    return;
                }
                store.resetRuntime();
            } catch (error: unknown) {
                console.error('Failed to load connections:', error);
                toast.error(`Failed to load connections: ${getErrorMessage(error)}`);
            }
        };

        void loadConns();
    }, [setConnections, toast]);

    if (panels.length === 0) {
        return null;
    }

    return (
        <div className="sidebar flex h-full w-full select-none flex-col overflow-hidden border-r border-border">
            <Tabs value={activePanelId} onValueChange={setActivePanelId} className="flex h-full flex-col">
                <div className="shrink-0 px-2 pt-1">
                    <TabsList
                        className="h-8 w-fit justify-start gap-1 bg-transparent p-0"
                    >
                        {panels.map((panel) => {
                            const Icon = panel.icon;
                            const badge = panel.getBadge?.();
                            return (
                                <TabsTrigger
                                    key={panel.id}
                                    value={panel.id}
                                    className="relative h-8 w-8 cursor-pointer rounded-none bg-transparent p-0 text-muted-foreground opacity-55 transition hover:opacity-80 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:opacity-100 data-[state=active]:shadow-none"
                                    title={panel.label}
                                    aria-label={panel.label}
                                >
                                    <Icon size={14} className="shrink-0" />
                                    {badge !== undefined && badge !== null && badge !== 0 && (
                                        <span className="absolute right-[-2px] top-[-1px] inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold leading-none text-white">
                                            {badge}
                                        </span>
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden bg-background">
                    {panels.map((panel) => (
                        <TabsContent key={panel.id} value={panel.id} className="mt-0 h-full outline-none">
                            {panel.render()}
                        </TabsContent>
                    ))}
                </div>
            </Tabs>
        </div>
    );
};
