import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';
import { cn } from '../../lib/cn';
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
    const { activeProfile, connectionStatus } = useConnectionStore();

    // Initial sync with connectionStore state (handles reloads)
    useEffect(() => {
        if (connectionStatus === 'connected' && activeProfile) {
            setStatus('connected');
            setCurrentDriver(activeProfile.driver || 'postgres');
            setConnectionLabel(`${activeProfile.name} (${activeProfile.driver})`);
        } else if (connectionStatus === 'connecting' && activeProfile) {
            setStatus('connecting');
            setConnectionLabel(`Connecting to ${activeProfile.name}...`);
            setCurrentDriver(activeProfile.driver || 'postgres');
        } else if (connectionStatus === 'error') {
            setStatus('error');
            const name = activeProfile?.name || 'database';
            setConnectionLabel(`Failed to connect: ${name}`);
            if (activeProfile) setCurrentDriver(activeProfile.driver || 'postgres');
        } else {
            setStatus('disconnected');
            setConnectionLabel('No Connection');
            setCurrentDriver('');
        }
    }, [activeProfile, connectionStatus, setStatus, setConnectionLabel, setCurrentDriver]);

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



    return (
        <div className={cn(
            'relative z-50 overflow-visible flex items-center justify-between px-4 h-6 shrink-0 text-white font-medium transition-colors duration-300', 
            barColor,
            status === 'connecting' && 'animate-pulse brightness-110'
        )}>
            <div className="flex items-center gap-1">
                {/* Connection Info Container */}
                <div className="relative flex items-center gap-3">


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
