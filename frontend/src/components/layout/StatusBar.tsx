import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';
import { cn } from '../../lib/cn';

export const StatusBar: React.FC = () => {
    const { connectionLabel, status, message, setStatus, setConnectionLabel, setMessage } = useStatusStore();

    useEffect(() => {
        const unsub = onConnectionChanged((data) => {
            if (data.status === 'connected' && data.profile) {
                setStatus('connected');
                setConnectionLabel(`${data.profile.name} (${data.profile.driver})`);
            } else if (data.status === 'error') {
                setStatus('error');
                setConnectionLabel('Connection error / timed out');
            } else {
                setStatus('disconnected');
                setConnectionLabel('No Connection');
            }
        });
        return () => unsub();
    }, [setStatus, setConnectionLabel]);

    // Clear message after 4s
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [message, setMessage]);

    const barColor = {
        connected: 'bg-success',
        connecting: 'bg-success',
        error: 'bg-red-500',
        disconnected: 'bg-yellow-500',
    }[status] ?? 'bg-bg-tertiary';

    return (
        <div className={cn('flex items-center justify-between px-3 h-5 shrink-0 text-[11px] text-white font-medium', barColor)}>
            <div className="flex items-center gap-2">
                <span>{status === 'connected' ? '●' : status === 'error' ? '⚠' : '○'} {connectionLabel}</span>
                {message && (
                    <span className="opacity-90 ml-4">{message}</span>
                )}
            </div>
            <div>
                <span>Zentro 0.2.0</span>
            </div>
        </div>
    );
};
