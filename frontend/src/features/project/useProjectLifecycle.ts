import { useCallback, useEffect, useRef } from 'react';
import { appLogger } from '../../lib/logger';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useStatusStore } from '../../stores/statusStore';
import { useEditorStore } from '../../stores/editorStore';
import { useResultStore } from '../../stores/resultStore';
import { useScriptStore } from '../../stores/scriptStore';
import { createEmptySession, normalizeSession } from '../../stores/editor/sessionUtils';
import { CONNECTION_STATUS } from '../../lib/constants';
import { ConnectProjectEnvironment } from '../../services/projectService';
import { recoverStartupState } from './startupRecovery';
import {
    isSessionEmpty,
    parseProjectEditorSession,
    serializeProjectEditorSession,
    withProjectLayoutState,
} from './projectSessionCodec';
import { type SidebarSide, useSidebarSideState } from '../../stores/sidebarUiStore';

export function useProjectLifecycle() {
    const bootstrapProjects = useProjectStore((state) => state.bootstrap);
    const activeProject = useProjectStore((state) => state.activeProject);
    const saveProject = useProjectStore((state) => state.saveProject);
    const bootstrapEnvironment = useEnvironmentStore((state) => state.bootstrap);
    const clearEnvironment = useEnvironmentStore((state) => state.clear);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const activeProfile = useConnectionStore((state) => state.activeProfile);
    const connectionStatus = useConnectionStore((state) => state.connectionStatus);
    const setStatusMessage = useStatusStore((state) => state.setMessage);
    const switchEditorProject = useEditorStore((state) => state.switchProject);
    const hydrateProjectSession = useEditorStore((state) => state.hydrateProjectSession);
    const addTab = useEditorStore((state) => state.addTab);
    const groups = useEditorStore((state) => state.groups);
    const activeGroupId = useEditorStore((state) => state.activeGroupId);
    const activeEditorProjectId = useEditorStore((state) => state.activeProjectId);
    const switchResultProject = useResultStore((state) => state.switchProject);
    const loadScripts = useScriptStore((state) => state.loadScripts);
    const clearScriptScope = useScriptStore((state) => state.clearScope);
    const connectAttemptRef = useRef<string>('');
    const failedAutoConnectKeysRef = useRef<Set<string>>(new Set());
    const migratedProjectsRef = useRef<Set<string>>(new Set());
    const pendingSessionSaveRef = useRef<{ projectId: string; serialized: string } | null>(null);
    const sessionSaveTimerRef = useRef<number | null>(null);
    const lastPersistedLayoutRef = useRef<Record<string, string>>({});

    const flushPendingSessionSave = () => {
        if (!pendingSessionSaveRef.current) return;
        const pending = pendingSessionSaveRef.current;
        if (sessionSaveTimerRef.current !== null) {
            window.clearTimeout(sessionSaveTimerRef.current);
            sessionSaveTimerRef.current = null;
        }

        const state = useProjectStore.getState();
        const active = state.activeProject;
        const sourceProject = (active && active.id === pending.projectId)
            ? active
            : state.projects.find((project) => project.id === pending.projectId) || null;
        if (!sourceProject) {
            pendingSessionSaveRef.current = null;
            return;
        }

        const nextProject = withProjectLayoutState(sourceProject, pending.serialized);
        void state.saveProject(nextProject).then((saved) => {
            if (!saved) return;
            lastPersistedLayoutRef.current[pending.projectId] = pending.serialized;
        });
        pendingSessionSaveRef.current = null;
    };

    useEffect(() => {
        const recoveryReport = recoverStartupState();
        if (recoveryReport.warnings.length > 0) {
            recoveryReport.warnings.forEach((warning) => appLogger.warn(warning));
            setStatusMessage('Recovered corrupted local state during startup.');
        }

        useSettingsStore.getState().load();
        bootstrapProjects().catch((error) => {
            appLogger.warn('project bootstrap failed', error);
        });
    }, [bootstrapProjects, setStatusMessage]);

    useEffect(() => {
        flushPendingSessionSave();

        if (!activeProject) {
            clearEnvironment();
            switchEditorProject(null);
            switchResultProject(null);
            clearScriptScope();
            return;
        }

        switchEditorProject(activeProject.id);
        switchResultProject(activeProject.id);
        clearScriptScope();

        const sessionFromProject = parseProjectEditorSession(activeProject.layout_state);
        const editorState = useEditorStore.getState();
        const fallbackSession = normalizeSession(editorState.projectSessions[activeProject.id]);

        if (sessionFromProject) {
            hydrateProjectSession(activeProject.id, sessionFromProject, true);
            lastPersistedLayoutRef.current[activeProject.id] = serializeProjectEditorSession(sessionFromProject);
        } else if (!isSessionEmpty(fallbackSession)) {
            hydrateProjectSession(activeProject.id, fallbackSession, true);
            const serialized = serializeProjectEditorSession(fallbackSession);
            lastPersistedLayoutRef.current[activeProject.id] = serialized;

            if (!migratedProjectsRef.current.has(activeProject.id)) {
                migratedProjectsRef.current.add(activeProject.id);
                void saveProject(withProjectLayoutState(activeProject, serialized));
            }
        } else {
            hydrateProjectSession(activeProject.id, createEmptySession(), true);
            const next = useEditorStore.getState();
            const currentSession = normalizeSession(next.projectSessions[activeProject.id]);
            if (isSessionEmpty(currentSession)) {
                addTab({ name: 'New Query', query: '' });
            }
        }

        bootstrapEnvironment(activeProject);
    }, [activeProject?.id, addTab, bootstrapEnvironment, clearEnvironment, clearScriptScope, hydrateProjectSession, saveProject, switchEditorProject, switchResultProject]);

    useEffect(() => {
        const projectId = activeProject?.id;
        if (!projectId) return;
        if (activeEditorProjectId !== projectId) return;

        const serialized = serializeProjectEditorSession({
            groups,
            activeGroupId,
        });
        if (lastPersistedLayoutRef.current[projectId] === serialized) return;

        pendingSessionSaveRef.current = { projectId, serialized };
        if (sessionSaveTimerRef.current !== null) {
            window.clearTimeout(sessionSaveTimerRef.current);
        }

        sessionSaveTimerRef.current = window.setTimeout(() => {
            flushPendingSessionSave();
        }, 600);

        return () => {
            if (sessionSaveTimerRef.current !== null) {
                window.clearTimeout(sessionSaveTimerRef.current);
                sessionSaveTimerRef.current = null;
            }
        };
    }, [activeEditorProjectId, activeGroupId, activeProject?.id, groups]);

    useEffect(() => () => {
        flushPendingSessionSave();
    }, []);

    useEffect(() => {
        const handleBeforeUnload = () => {
            flushPendingSessionSave();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        const currentProjectId = activeProject?.id;
        const targetEnvironmentKey = activeEnvironmentKey || activeProject?.last_active_environment_key || activeProject?.default_environment_key;
        if (!activeProject || !targetEnvironmentKey) return;

        const connection = activeProject.connections?.find((item) => item.environment_key === targetEnvironmentKey);
        const profileName = connection?.advanced_meta?.profile_name || connection?.name;
        const dbName = connection?.database || connection?.advanced_meta?.db_name;
        const targetDbName = dbName || '';

        if (!profileName) return;

        const targetKey = `${activeProject.id}:${targetEnvironmentKey}:${profileName}:${targetDbName}`;
        const isSameProfile = activeProfile?.name === profileName;
        const isSameDatabase = !targetDbName || (activeProfile?.db_name || '') === targetDbName;

        if (isSameProfile && isSameDatabase && connectionStatus === CONNECTION_STATUS.CONNECTED) {
            connectAttemptRef.current = targetKey;
            failedAutoConnectKeysRef.current.delete(targetKey);
            return;
        }

        if (isSameProfile && isSameDatabase && connectionStatus === CONNECTION_STATUS.ERROR) {
            failedAutoConnectKeysRef.current.add(targetKey);
            return;
        }

        if (isSameProfile && isSameDatabase && connectionStatus === CONNECTION_STATUS.CONNECTING) {
            return;
        }

        if (connectionStatus === CONNECTION_STATUS.CONNECTING && connectAttemptRef.current === targetKey) {
            return;
        }

        if (failedAutoConnectKeysRef.current.has(targetKey)) {
            return;
        }

        connectAttemptRef.current = targetKey;

        const doConnect = async () => {
            if (activeProject?.id !== currentProjectId) return;
            try {
                await ConnectProjectEnvironment(targetEnvironmentKey);
            } catch (error) {
                failedAutoConnectKeysRef.current.add(targetKey);
                appLogger.warn('auto reconnect failed', { envKey: targetEnvironmentKey, profileName, error });
            }
        };

        void doConnect();
    }, [activeEnvironmentKey, activeProfile?.db_name, activeProfile?.name, activeProject, connectionStatus]);

    useEffect(() => {
        const projectId = activeProject?.id;
        const connectionName = activeProfile?.name;
        if (!projectId || !connectionName) return;
        loadScripts(projectId, connectionName).catch((error) => {
            appLogger.warn('preload scripts failed', { projectId, connectionName, error });
        });
    }, [activeProfile?.name, activeProject?.id, loadScripts]);
}

export function useSidebarResize(initialWidth = 250, side: SidebarSide = 'primary') {
    const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarSideState(side, {
        width: initialWidth,
        activePanelId: side === 'primary' ? 'explorer' : 'detail',
    });
    const isResizing = useRef(false);

    const startResizing = useCallback(() => {
        isResizing.current = true;
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
    }, []);

    useEffect(() => {
        const resize = (e: MouseEvent) => {
            if (!isResizing.current) return;
            if (side === 'primary') {
                if (e.clientX > 150 && e.clientX < 800) {
                    setSidebarWidth(e.clientX);
                }
                return;
            }
            const nextWidth = window.innerWidth - e.clientX;
            if (nextWidth > 200 && nextWidth < 1000) {
                setSidebarWidth(nextWidth);
            }
        };

        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [setSidebarWidth, side, stopResizing]);

    return {
        sidebarWidth,
        startResizing,
    };
}
