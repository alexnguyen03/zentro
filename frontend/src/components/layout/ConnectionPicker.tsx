import React, { useEffect, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { cn } from '../../lib/cn';
import { Spinner } from '../ui';

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

    const itemBaseClass = "px-3.5 py-2 text-[13px] cursor-pointer border-b border-white/5 text-text-primary transition-colors duration-100 whitespace-nowrap overflow-hidden text-ellipsis last:border-none hover:bg-bg-tertiary";

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/45 z-[1100] backdrop-blur-[2px]" onClick={onClose} />

            {/* Panel */}
            <div
                className="fixed z-[1101] flex bg-bg-secondary border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden min-w-[520px] max-h-[400px] animate-in fade-in duration-150"
                style={{ top, left, transform: 'translateX(-50%)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Connections column */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <div className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.08em] text-text-secondary bg-black/15 border-b border-border shrink-0">Connection</div>
                    <div className="overflow-y-auto flex-1">
                        {connections.map((conn) => {
                            const isSelected = selectedConn === conn.name;
                            const isActive = activeProfile?.name === conn.name;
                            return (
                                <div
                                    key={conn.name}
                                    className={cn(
                                        itemBaseClass,
                                        isSelected && "bg-white/5",
                                        isActive && "border-l-2 border-l-success bg-[#89d185]/10 text-success font-medium hover:bg-[#89d185]/10"
                                    )}
                                    onClick={() => handleSelectConn(conn.name)}
                                >
                                    {conn.name}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-[1px] bg-border shrink-0" />

                {/* Databases column */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <div className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.08em] text-text-secondary bg-black/15 border-b border-border shrink-0">Database</div>
                    <div className="overflow-y-auto flex-1">
                        {connecting ? (
                            <div className="px-3.5 py-4 text-xs text-text-secondary flex items-center gap-2">
                                <Spinner size={14} className="opacity-60" />
                                Connecting…
                            </div>
                        ) : error ? (
                            <div className="px-3.5 py-3 text-[13px] text-error whitespace-normal leading-[1.4] text-center">
                                {error}
                            </div>
                        ) : pickerDbs.length === 0 ? (
                            <div className="px-3.5 py-4 text-xs text-text-secondary">No databases</div>
                        ) : (
                            pickerDbs.map((db) => {
                                const isActive = activeProfile?.db_name === db;
                                return (
                                    <div
                                        key={db}
                                        className={cn(
                                            itemBaseClass,
                                            isActive && "border-l-2 border-l-success bg-[#89d185]/10 text-success font-medium hover:bg-[#89d185]/10"
                                        )}
                                        onClick={() => handleSelectDb(db)}
                                    >
                                        {db}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
