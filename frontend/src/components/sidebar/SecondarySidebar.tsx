import React from 'react';
import { X } from 'lucide-react';
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
                    <div className="flex items-center gap-2 px-2 py-1 bg-card/10">
                        <TabsList
                            className="h-8 w-full justify-start gap-1 p-0 bg-transparent"
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

                    <div className="min-h-0 flex-1 overflow-hidden bg-card/10 p-1.5">
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
