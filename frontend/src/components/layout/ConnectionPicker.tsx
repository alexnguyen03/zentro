import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';

interface ConnectionPickerProps {
    onClose: () => void;
    anchorRef: React.RefObject<HTMLDivElement | null>;
}

export const ConnectionPicker: React.FC<ConnectionPickerProps> = ({ onClose, anchorRef }) => {
    const { connections, databases, activeProfile } = useConnectionStore();

    // Track which connection is "previewed" in right column
    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Databases to show: only from active profile (the backend owns this list)
    // After Connect(), the store gets updated via event, so we reactively re-render.
    const isSelectedActive = selectedConn === activeProfile?.name;
    const pickerDbs = isSelectedActive ? databases : [];

    const handleSelectConn = async (name: string) => {
        setError(null);
        setSelectedConn(name);
        if (name === activeProfile?.name) return;

        // Auto-connect to this server so databases load on the right
        setConnecting(true);
        try {
            await Connect(name);
            // After connect the store will update activeProfile + databases via event
        } catch (err: any) {
            console.error('ConnectionPicker: connect failed:', err);
            setError(typeof err === 'string' ? err : err?.message || String(err));
        } finally {
            setConnecting(false);
        }
    };

    const handleSelectDb = async (dbName: string) => {
        onClose();
        if (activeProfile?.db_name === dbName) return;
        try {
            await SwitchDatabase(dbName);
        } catch (err) {
            console.error('ConnectionPicker: switch db failed:', err);
        }
    };

    // Sync selected conn when activeProfile changes (after connect resolves)
    useEffect(() => {
        if (activeProfile?.name) setSelectedConn(activeProfile.name);
    }, [activeProfile?.name]);

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Position below the anchor
    const anchorRect = anchorRef.current?.getBoundingClientRect();
    const top = anchorRect ? anchorRect.bottom + 8 : 40;
    const left = anchorRect ? anchorRect.left + anchorRect.width / 2 : '50%';

    return (
        <>
            {/* Overlay */}
            <div className="cp-overlay" onClick={onClose} />

            {/* Panel */}
            <div
                className="cp-panel"
                style={{ top, left, transform: 'translateX(-50%)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Connections column */}
                <div className="cp-col">
                    <div className="cp-col-header">Connection</div>
                    <div className="cp-list">
                        {connections.map((conn) => (
                            <div
                                key={conn.name}
                                className={`cp-item ${selectedConn === conn.name ? 'selected' : ''} ${activeProfile?.name === conn.name ? 'active' : ''}`}
                                onClick={() => handleSelectConn(conn.name)}
                            >
                                {conn.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="cp-divider" />

                {/* Databases column */}
                <div className="cp-col">
                    <div className="cp-col-header">Database</div>
                    <div className="cp-list">
                        {connecting ? (
                            <div className="cp-empty cp-loading">
                                <Loader size={14} className="cp-spinner" />
                                Connecting…
                            </div>
                        ) : error ? (
                            <div className="cp-empty" style={{ color: 'var(--error-color, #ef4444)', whiteSpace: 'normal', padding: '12px', lineHeight: 1.4, textAlign: 'center' }}>
                                {error}
                            </div>
                        ) : pickerDbs.length === 0 ? (
                            <div className="cp-empty">No databases</div>
                        ) : (
                            pickerDbs.map((db) => (
                                <div
                                    key={db}
                                    className={`cp-item ${activeProfile?.db_name === db ? 'active' : ''}`}
                                    onClick={() => handleSelectDb(db)}
                                >
                                    {db}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
