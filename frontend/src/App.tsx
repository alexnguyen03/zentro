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
import { ContextSearchDialog } from './components/layout/ContextSearchDialog';
import { QueryCompareModal } from './components/editor/QueryCompareModal';
import { ProjectHub } from './components/layout/ProjectHub';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { DOM_EVENT } from './lib/constants';
import { emitCommand, onCommand } from './lib/commandBus';
import { Disconnect } from './services/connectionService';
import { useGlobalShortcuts } from './features/shortcuts/useGlobalShortcuts';
import { useAppEventBridge } from './features/app-runtime/useAppEventBridge';
import { useBeforeCloseGuard } from './features/app-runtime/useBeforeCloseGuard';
import { useSidebarResize, useProjectLifecycle } from './features/project/useProjectLifecycle';
import { usePluginCommandBridge } from './features/plugin/usePluginCommandBridge';
import { forceQuitWithAutosave } from './features/app-runtime/forceQuitWithAutosave';
import { useQueryTabAutosave } from './features/editor/useQueryTabAutosave';

function App() {
    const { isConnected } = useConnectionStore();
    const resetRuntime = useConnectionStore((state) => state.resetRuntime);
    const activeProject = useProjectStore((state) => state.activeProject);
    const projects = useProjectStore((state) => state.projects);
    const openProject = useProjectStore((state) => state.openProject);
    const { toast } = useToast();
    const { showSidebar, showRightSidebar, showCommandPalette } = useLayoutStore();

    const [showForceQuitConfirm, setShowForceQuitConfirm] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [showProjectHub, setShowProjectHub] = useState(false);
    const [showContextSearch, setShowContextSearch] = useState(false);

    const { sidebarWidth, startResizing } = useSidebarResize();

    useBeforeCloseGuard(() => setShowForceQuitConfirm(true));
    useProjectLifecycle();
    useAppEventBridge(toast);
    useGlobalShortcuts(toast);
    usePluginCommandBridge();
    useQueryTabAutosave();

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_QUERY_COMPARE, () => setShowCompareModal(true));
        return off;
    }, []);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_PROJECT_HUB, () => setShowProjectHub(true));
        return off;
    }, []);

    useEffect(() => {
        const off = onCommand(DOM_EVENT.OPEN_CONTEXT_SEARCH, () => setShowContextSearch(true));
        return off;
    }, []);

    const handleStartupClose = React.useCallback(async () => {
        const latestProject = [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
        if (!latestProject?.id) return;

        try {
            try { await Disconnect(); } catch { /* ignore */ }
            const project = await openProject(latestProject.id);
            if (!project) {
                resetRuntime();
                return;
            }
            resetRuntime();
        } catch {
            resetRuntime();
        }
    }, [openProject, projects, resetRuntime]);

    if (!activeProject) {
        return (
            <div className="h-full w-full bg-bg-primary">
                <ProjectHub overlay startupMode onClose={() => { void handleStartupClose(); }} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            {showCommandPalette && <CommandPalette />}
            {showContextSearch && <ContextSearchDialog onClose={() => setShowContextSearch(false)} />}
            {showCompareModal && <QueryCompareModal onClose={() => setShowCompareModal(false)} />}
            {showProjectHub && <ProjectHub overlay onClose={() => setShowProjectHub(false)} />}
            <ConfirmationModal
                isOpen={showForceQuitConfirm}
                onClose={() => setShowForceQuitConfirm(false)}
                onConfirm={() => {
                    setShowForceQuitConfirm(false);
                    forceQuitWithAutosave().catch(() => {});
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
