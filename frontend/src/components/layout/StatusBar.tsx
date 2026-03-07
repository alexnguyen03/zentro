import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';

export const StatusBar: React.FC = () => {
    const { connectionLabel, status, message, setStatus, setConnectionLabel, setMessage } = useStatusStore();

    useEffect(() => {
        // StatusBar listens to connection changes independently to update its own label/color.
        // connectionStore state (isConnected, activeProfile) is managed centrally in App.tsx.
        const unsub = onConnectionChanged((data) => {
            if (data.status === 'connected' && data.profile) {
                setStatus('connected');
                setConnectionLabel(`${data.profile.name} (${data.profile.driver})`);
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

    // Status color mapping
    const getStatusColor = () => {
        switch (status) {
            case 'connected': return 'var(--success-color)';
            case 'connecting': return 'var(--accent-color)';
            case 'error': return 'var(--error-color)';
            default: return 'var(--bg-tertiary)';
        }
    };

    return (
        <div className="statusbar" style={{ backgroundColor: getStatusColor() }}>
            <div className="statusbar-left">
                <span>{status === 'connected' ? '●' : '○'} {connectionLabel}</span>
                {message && <span className="statusbar-message" style={{ marginLeft: 16, opacity: 0.9 }}>{message}</span>}
            </div>
            <div className="statusbar-right">
                <span>Zentro 0.2.0</span>
            </div>
        </div>
    );
};
