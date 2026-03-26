import React, { useEffect, useState } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { QueryTabs } from './components/editor/QueryTabs';
import { useConnectionStore } from './stores/connectionStore';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import { useToast } from './components/layout/Toast';
import { SecondarySidebar } from './components/sidebar/SecondarySidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { QueryCompareModal } from './components/editor/QueryCompareModal';
import { ProjectHub } from './components/layout/ProjectHub';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { DOM_EVENT } from './lib/constants';
import { emitCommand, onCommand } from './lib/commandBus';
import { ForceQuit } from './services/projectService';
import { useGlobalShortcuts } from './features/shortcuts/useGlobalShortcuts';
import { useAppEventBridge } from './features/app-runtime/useAppEventBridge';
import { useBeforeCloseGuard } from './features/app-runtime/useBeforeCloseGuard';
import { useSidebarResize, useWorkspaceLifecycle } from './features/workspace/useWorkspaceLifecycle';
import { usePluginCommandBridge } from './features/plugin/usePluginCommandBridge';

function App() {
    const { isConnected } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const { toast } = useToast();
    const { showSidebar, showRightSidebar, showCommandPalette } = useLayoutStore();

    const [showForceQuitConfirm, setShowForceQuitConfirm] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [showProjectHub, setShowProjectHub] = useState(false);

    const { sidebarWidth, startResizing } = useSidebarResize();

    useBeforeCloseGuard(() => setShowForceQuitConfirm(true));
    useWorkspaceLifecycle();
    useAppEventBridge(toast);
    useGlobalShortcuts(toast);
    usePluginCommandBridge();

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_QUERY_COMPARE, () => setShowCompareModal(true));
        return off;
    }, []);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_PROJECT_HUB, () => setShowProjectHub(true));
        return off;
    }, []);

    if (!activeProject) {
        return (
            <div className="h-full w-full bg-bg-primary">
                <ProjectHub />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            {showCommandPalette && <CommandPalette />}
            {showCompareModal && <QueryCompareModal onClose={() => setShowCompareModal(false)} />}
            {showProjectHub && <ProjectHub overlay onClose={() => setShowProjectHub(false)} />}
            <ConfirmationModal
                isOpen={showForceQuitConfirm}
                onClose={() => setShowForceQuitConfirm(false)}
                onConfirm={() => {
                    ForceQuit().catch(() => {});
                }}
                title="Force Close Application"
                message="One or more queries are still running."
                description="Close now and stop all active queries?"
                confirmLabel="Force Close"
                variant="danger"
            />
            <Toolbar />
            <div className="flex flex-1 overflow-hidden">
                {showSidebar && (
                    <>
                        <div style={{ width: sidebarWidth, flexShrink: 0 }}>
                            <Sidebar />
                        </div>
                        <div className="resizer" onMouseDown={startResizing} />
                    </>
                )}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
                        {!isConnected && activeProject && (
                            <div className="flex items-center justify-between px-4 py-1.5 bg-bg-tertiary border-b border-border text-[11px] text-text-secondary shrink-0">
                                <span>No active connection - switch environment to connect.</span>
                                <button
                                    onClick={() => emitCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER)}
                                    className="text-accent font-semibold hover:underline"
                                >
                                    Switch env
                                </button>
                            </div>
                        )}
                        <QueryTabs />
                    </div>
                </div>
                {showRightSidebar && <SecondarySidebar />}
            </div>
            <StatusBar />
        </div>
    );
}

export default App;
