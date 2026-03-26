import { useEffect, useRef, useState } from 'react';
import { appLogger } from '../../lib/logger';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useStatusStore } from '../../stores/statusStore';
import { CONNECTION_STATUS } from '../../lib/constants';
import { ConnectProjectEnvironment } from '../../services/projectService';
import { recoverStartupState } from './startupRecovery';

export function useWorkspaceLifecycle() {
    const bootstrapProjects = useProjectStore((state) => state.bootstrap);
    const activeProject = useProjectStore((state) => state.activeProject);
    const bootstrapEnvironment = useEnvironmentStore((state) => state.bootstrap);
    const clearEnvironment = useEnvironmentStore((state) => state.clear);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const activeProfile = useConnectionStore((state) => state.activeProfile);
    const connectionStatus = useConnectionStore((state) => state.connectionStatus);
    const setStatusMessage = useStatusStore((state) => state.setMessage);
    const connectAttemptRef = useRef<string>('');

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
        if (!activeProject) {
            clearEnvironment();
            return;
        }
        bootstrapEnvironment(activeProject);
    }, [activeProject, bootstrapEnvironment, clearEnvironment]);

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
            return;
        }

        if (connectionStatus === CONNECTION_STATUS.CONNECTING && connectAttemptRef.current === targetKey) {
            return;
        }

        connectAttemptRef.current = targetKey;

        const doConnect = async () => {
            if (activeProject?.id !== currentProjectId) return;
            try {
                await ConnectProjectEnvironment(targetEnvironmentKey);
            } catch (error) {
                appLogger.warn('auto reconnect failed', { envKey: targetEnvironmentKey, profileName, error });
            }
        };

        void doConnect();
    }, [activeEnvironmentKey, activeProfile?.db_name, activeProfile?.name, activeProject, connectionStatus]);
}

export function useSidebarResize(initialWidth = 250) {
    const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
    const isResizing = useRef(false);

    const startResizing = () => {
        isResizing.current = true;
    };

    useEffect(() => {
        const resize = (e: MouseEvent) => {
            if (isResizing.current && e.clientX > 150 && e.clientX < 800) {
                setSidebarWidth(e.clientX);
            }
        };
        const stopResizing = () => {
            isResizing.current = false;
        };

        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, []);

    return {
        sidebarWidth,
        startResizing,
    };
}
