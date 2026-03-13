import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import { Connect } from '../../../wailsjs/go/app/App';
import { useLayoutStore } from '../../stores/layoutStore';

import { useConnectionStore } from '../../stores/connectionStore';

export const StatusBar: React.FC = () => {
    const {
        connectionLabel,
        status,
        message,
        currentDriver,
        setStatus,
        setConnectionLabel,
        setMessage,
        setCurrentDriver
    } = useStatusStore();
    const { activeProfile } = useConnectionStore();
    const { showSidebar } = useLayoutStore();

    // Initial sync with activeProfile if connected
    useEffect(() => {
        if (activeProfile && status === 'connected') {
            setCurrentDriver(activeProfile.driver || 'postgres');
            setConnectionLabel(`${activeProfile.name} (${activeProfile.driver})`);
        }
    }, [activeProfile, status]);

    useEffect(() => {
        const unsub = onConnectionChanged((data) => {
            if (data.status === 'connected' && data.profile) {
                setStatus('connected');
                setConnectionLabel(`${data.profile.name} (${data.profile.driver})`);
                setCurrentDriver(data.profile.driver || 'postgres');
            } else if (data.status === 'connecting' && data.profile) {
                setStatus('connecting');
                setConnectionLabel(`Connecting to ${data.profile.name}...`);
                setCurrentDriver(data.profile.driver || 'postgres');
            } else if (data.status === 'error') {
                setStatus('error');
                const name = data.profile?.name || 'database';
                setConnectionLabel(`Failed to connect: ${name}`);
                if (data.profile) setCurrentDriver(data.profile.driver || 'postgres');
            } else {
                setStatus('disconnected');
                setConnectionLabel('No Connection');
                setCurrentDriver('');
            }
        });
        return () => unsub();
    }, [setStatus, setConnectionLabel, setCurrentDriver]);

    // Clear message after 4s
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

    const provider = currentDriver ? getProvider(currentDriver) : null;

    return (
        <div className={cn('relative z-50 overflow-visible flex items-center justify-between px-4 h-6 shrink-0 text-white font-medium transition-colors duration-300', barColor)}>
            <div className="flex items-center gap-1">
                {/* Connection Info Container */}
                <div className="relative flex items-center gap-3">
                    {/* Floating Provider Logo - Half-sunk into the bar */}
                    {showSidebar && provider && (
                        <div
                            className="absolute bottom-3.5 left-0 z-60 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out cursor-pointer group active:scale-95 transition-all"
                            onClick={() => activeProfile && Connect(activeProfile.name)}
                            title="Click to reconnect"
                        >
                            <div
                                className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center relative border transition-all bg-bg-secondary/40 backdrop-blur-md shadow-2xl",
                                    status === 'connected' ? "border-white/20" : status === 'connecting' ? "border-white/50 animate-pulse scale-105" : "border-red-500/40"
                                )}
                                style={{ backgroundColor: `${provider.color}25` }}
                            >
                                <img
                                    src={provider.icon}
                                    alt={provider.label}
                                    className={cn(
                                        "w-7 h-7 object-contain relative z-20 drop-shadow-md transition-transform duration-200 group-hover:scale-110",
                                        status === 'connecting' && "animate-spin duration-1000"
                                    )}
                                />
                                {status === 'connecting' && (
                                    <div className="absolute inset-0 rounded-xl border-2 border-white/30 border-t-white animate-spin" />
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 font-medium text-[11px] text-white/90">
                        <span className="tracking-wide uppercase text-[10px] opacity-90">{connectionLabel}</span>
                        {message && (
                            <span className="bg-white/10 px-2 py-0.5 rounded ml-4 animate-in fade-in slide-in-from-left-2 text-[10px] text-white/70 border border-white/5">
                                {message}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="opacity-40 text-[10px] font-bold tracking-widest uppercase">
                <span>V0.2.0</span>
            </div>
        </div>
    );
};
