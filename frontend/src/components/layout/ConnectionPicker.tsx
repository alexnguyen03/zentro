import React, { useEffect, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';

interface ConnectionPickerProps {
    onClose: () => void;
    anchorRef: React.RefObject<HTMLDivElement | null>;
}

export const ConnectionPicker: React.FC<ConnectionPickerProps> = ({ onClose, anchorRef }) => {
    const { connections, databases, activeProfile } = useConnectionStore();
    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');

    // When a connection item is focused, show its DBs if it's the active one
    const pickerDbs = selectedConn === activeProfile?.name ? databases : [];

    const handleSelectConn = (name: string) => {
        setSelectedConn(name);
    };

    const handleSelectDb = async (dbName: string) => {
        if (!selectedConn) return;
        onClose();
        try {
            if (selectedConn !== activeProfile?.name) {
                await Connect(selectedConn);
            }
            await SwitchDatabase(dbName);
        } catch (err) {
            console.error('ConnectionPicker error:', err);
        }
    };

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
                        {pickerDbs.length === 0 ? (
                            <div className="cp-empty">
                                {selectedConn !== activeProfile?.name
                                    ? 'Connect first'
                                    : 'No databases'}
                            </div>
                        ) : (
                            pickerDbs.map((db) => (
                                <div
                                    key={db}
                                    className={`cp-item ${activeProfile?.db_name === db && selectedConn === activeProfile?.name ? 'active' : ''}`}
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
