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
        <div className="sidebar flex h-full w-full select-none flex-col overflow-hidden bg-card/40">
            <Tabs value={activePanelId} onValueChange={setActivePanelId} className="flex h-full flex-col">
                <div className="shrink-0 px-1">
                    <TabsList className="h-9 w-full justify-start gap-0 p-0 bg-transparent">
                        {panels.map((panel) => {
                            const Icon = panel.icon;
                            const badge = panel.getBadge?.();
                            return (
                                <TabsTrigger
                                    key={panel.id}
                                    value={panel.id}
                                    className="relative h-8 my-1 rounded-sm cursor-pointer px-2.5 text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-[--state-selected-bg] data-[state=active]:text-[--state-selected-text] data-[state=active]:shadow-none"
                                    title={panel.label}
                                    aria-label={panel.label}
                                >
                                    <Icon size={13} className="shrink-0" />
                                    {badge !== undefined && badge !== null && badge !== 0 && (
                                        <span className="absolute right-0 top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-warning px-0.5 text-label font-semibold leading-none text-background">
                                            {badge}
                                        </span>
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
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

