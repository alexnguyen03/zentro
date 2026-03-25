import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';
import { cn } from '../../lib/cn';
import { useConnectionStore } from '../../stores/connectionStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getEnvironmentLabel } from '../../lib/projects';
import { DRIVER, CONNECTION_STATUS } from '../../lib/constants';

export const StatusBar: React.FC = () => {
    const {
        connectionLabel,
        status,
        message,
        currentDriver,
        transactionStatus,
        setStatus,
        setConnectionLabel,
        setMessage,
        setCurrentDriver,
    } = useStatusStore();
    const { activeProfile, connectionStatus } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const viewMode = useSettingsStore((state) => state.viewMode);

    useEffect(() => {
        if (connectionStatus === CONNECTION_STATUS.CONNECTED && activeProfile) {
            setStatus(CONNECTION_STATUS.CONNECTED);
            setCurrentDriver(activeProfile.driver || DRIVER.POSTGRES);
            setConnectionLabel(`${activeProfile.name} (${activeProfile.driver})`);
        } else if (connectionStatus === CONNECTION_STATUS.CONNECTING && activeProfile) {
            setStatus(CONNECTION_STATUS.CONNECTING);
            setConnectionLabel(`Connecting to ${activeProfile.name}...`);
            setCurrentDriver(activeProfile.driver || DRIVER.POSTGRES);
        } else if (connectionStatus === CONNECTION_STATUS.ERROR) {
            setStatus(CONNECTION_STATUS.ERROR);
            const name = activeProfile?.name || 'database';
            setConnectionLabel(`Failed to connect: ${name}`);
            if (activeProfile) setCurrentDriver(activeProfile.driver || DRIVER.POSTGRES);
        } else {
            setStatus(CONNECTION_STATUS.DISCONNECTED);
            setConnectionLabel('No Connection');
            setCurrentDriver('');
        }
    }, [activeProfile, connectionStatus, setStatus, setConnectionLabel, setCurrentDriver]);

    useEffect(() => {
        const unsub = onConnectionChanged((data) => {
            if (data.status === CONNECTION_STATUS.CONNECTED && data.profile) {
                setStatus(CONNECTION_STATUS.CONNECTED);
                setConnectionLabel(`${data.profile.name} (${data.profile.driver})`);
                setCurrentDriver(data.profile.driver || DRIVER.POSTGRES);
            } else if (data.status === CONNECTION_STATUS.CONNECTING && data.profile) {
                setStatus(CONNECTION_STATUS.CONNECTING);
                setConnectionLabel(`Connecting to ${data.profile.name}...`);
                setCurrentDriver(data.profile.driver || DRIVER.POSTGRES);
            } else if (data.status === CONNECTION_STATUS.ERROR) {
                setStatus(CONNECTION_STATUS.ERROR);
                const name = data.profile?.name || 'database';
                setConnectionLabel(`Failed to connect: ${name}`);
                if (data.profile) setCurrentDriver(data.profile.driver || DRIVER.POSTGRES);
            } else {
                setStatus(CONNECTION_STATUS.DISCONNECTED);
                setConnectionLabel('No Connection');
                setCurrentDriver('');
            }
        });
        return () => unsub();
    }, [setStatus, setConnectionLabel, setCurrentDriver]);

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [message, setMessage]);

    const barColor = {
        connected: 'bg-success',
        connecting: 'bg-accent-600',
        error: 'bg-red-500',
        disconnected: 'bg-yellow-500',
    }[status] ?? 'bg-bg-tertiary';

    const txLabel = {
        none: 'TX: none',
        active: 'TX: active',
        error: 'TX: error',
    }[transactionStatus];

    const projectLabel = activeProject
        ? `${activeProject.name} / ${getEnvironmentLabel(activeEnvironmentKey || activeProject.default_environment_key)}`
        : 'No Project';

    return (
        <div
            className={cn(
                'relative z-50 overflow-visible flex items-center justify-between px-4 h-6 shrink-0 text-white font-medium transition-colors duration-300',
                viewMode ? 'bg-linear-to-r from-amber-500/70 to-red-500/70' : barColor,
                status === 'connecting' && ''
            )}
        >
            <div className="flex items-center gap-3 font-medium text-[11px] text-white min-w-0">
                <span className="tracking-wide uppercase text-[10px] opacity-90 shrink-0">{projectLabel}</span>
                <span className="opacity-40 shrink-0">|</span>
                <span className="tracking-wide uppercase text-[10px] opacity-90 truncate">{connectionLabel}</span>
                <span className="uppercase text-[10px] opacity-80 shrink-0">{txLabel}</span>
                {message && (
                    <span className="bg-white/10 px-2 py-0.5 rounded animate-in fade-in slide-in-from-left-2 text-[10px] text-white/70 border border-white/5 shrink-0">
                        {message}
                    </span>
                )}
            </div>
            <div className="text-[10px] uppercase opacity-70 shrink-0">
                {currentDriver || 'idle'}
            </div>
        </div>
    );
};
