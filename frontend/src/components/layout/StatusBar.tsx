import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';

export const StatusBar: React.FC = () => {
    const { connectionLabel, status, rowCount, duration, setStatus, setConnectionLabel } = useStatusStore();

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

    // Format duration e.g. 1.2s or 500ms
    const durStr = duration > 1000 ? `${(duration / 1000).toFixed(2)}s` : `${duration}ms`;

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
            </div>
            <div className="statusbar-right">
                {rowCount > 0 && <span>{rowCount.toLocaleString()} rows</span>}
                {duration > 0 && <span>{durStr}</span>}
                <span>Zentro 0.2.0</span>
            </div>
        </div>
    );
};
