import React from 'react';
import { PanelRightClose, X } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSidebarPanels } from './sidebarPanelRegistry';
import { registerBuiltInSidebarPanels } from './sidebarPanels';
import { useSidebarSideState } from '../../stores/sidebarUiStore';
import { useSidebarResize } from '../../features/project/useProjectLifecycle';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';

export const SecondarySidebar: React.FC = () => {
    const setShowRightSidebar = useLayoutStore((state) => state.setShowRightSidebar);
    const panels = useSidebarPanels('secondary');
    const {
        activePanelId,
        setActivePanelId,
    } = useSidebarSideState('secondary', { activePanelId: 'detail', width: 300 });
    const { sidebarWidth, startResizing } = useSidebarResize(300, 'secondary');

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

    if (panels.length === 0) {
        return null;
    }

    return (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar flex h-full shrink-0 flex-col bg-card/10" style={{ width: sidebarWidth }}>
                <Tabs value={activePanelId} onValueChange={setActivePanelId} className="flex h-full flex-col">
                    <div className="flex items-center px-1">
                        <TabsList className="h-9 flex-1 justify-start gap-0 p-0 bg-transparent">
                            {panels.map((panel) => {
                                const Icon = panel.icon;
                                const badge = panel.getBadge?.();
                                return (
                                    <TabsTrigger
                                        key={panel.id}
                                        value={panel.id}
                                        className="relative h-8 rounded-sm cursor-pointer bg-transparent px-2.5 text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
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

                    <div className="min-h-0 flex-1 overflow-hidden bg-card/10">
                        {panels.map((panel) => (
                            <TabsContent key={panel.id} value={panel.id} className="mt-0 h-full outline-none">
                                {panel.render()}
                            </TabsContent>
                        ))}
                    </div>
                </Tabs>
            </div>
        </>
    );
};

