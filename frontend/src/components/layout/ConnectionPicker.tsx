import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Connect, SwitchDatabase } from '../../services/connectionService';
import { cn } from '../../lib/cn';
import { getErrorMessage } from '../../lib/errors';
import { Button, Spinner } from '../ui';

interface ConnectionPickerProps {
    onClose: () => void;
    anchorRef: React.RefObject<HTMLDivElement | null>;
    onEditConnection?: (name: string) => void | Promise<void>;
    onDeleteConnection?: (name: string) => void | Promise<void>;
}

export const ConnectionPicker: React.FC<ConnectionPickerProps> = ({ onClose, anchorRef, onEditConnection, onDeleteConnection }) => {
    const { connections, databases, activeProfile } = useConnectionStore();

    // Track which connection is "previewed" in right column
    const [selectedConn, setSelectedConn] = useState<string>(activeProfile?.name ?? '');
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingConnectionName, setDeletingConnectionName] = useState<string | null>(null);

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
        } catch (err: unknown) {
            console.error('ConnectionPicker: connect failed:', err);
            setError(getErrorMessage(err));
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

    const handleEditConnection = (event: React.MouseEvent, name: string) => {
        event.stopPropagation();
        void onEditConnection?.(name);
    };

    const handleDeleteConnection = async (event: React.MouseEvent, name: string) => {
        event.stopPropagation();
        if (!onDeleteConnection) return;
        setDeletingConnectionName(name);
        try {
            await onDeleteConnection(name);
        } finally {
            setDeletingConnectionName((current) => (current === name ? null : current));
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

    const itemBaseClass = "px-3.5 py-2 text-[13px] cursor-pointer border-b border-white/5 text-foreground transition-colors duration-100 whitespace-nowrap overflow-hidden text-ellipsis last:border-none hover:bg-muted";

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 z-overlay bg-overlay backdrop-blur-[2px]" onClick={onClose} />

            {/* Panel */}
            <div
                className="fixed z-modal flex bg-card border border-border rounded-md shadow-elevation-lg overflow-hidden min-w-[520px] max-h-[400px] animate-in fade-in duration-150"
                style={{ top, left, transform: 'translateX(-50%)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Connections column */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <div className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground bg-black/15 border-b border-border shrink-0">Connection</div>
                    <div className="overflow-y-auto flex-1">
                        {connections.map((conn) => {
                            const isSelected = selectedConn === conn.name;
                            const isActive = activeProfile?.name === conn.name;
                            return (
                                <div
                                    key={conn.name}
                                    className={cn(
                                        itemBaseClass,
                                        "group flex items-center gap-2",
                                        isSelected && "bg-white/5",
                                        isActive && "border-l-2 border-l-success bg-success/10 text-success font-medium hover:bg-success/10"
                                    )}
                                    onClick={() => handleSelectConn(conn.name)}
                                >
                                    <span className="min-w-0 flex-1 truncate">{conn.name}</span>
                                    {(onEditConnection || onDeleteConnection) && (
                                        <span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                                            {onEditConnection && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground hover:bg-background/65 hover:text-foreground"
                                                    onClick={(event) => handleEditConnection(event, conn.name)}
                                                    title={`Edit ${conn.name}`}
                                                >
                                                    <Pencil size={11} />
                                                </Button>
                                            )}
                                            {onDeleteConnection && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                                                    onClick={(event) => {
                                                        void handleDeleteConnection(event, conn.name);
                                                    }}
                                                    title={`Delete ${conn.name}`}
                                                    disabled={deletingConnectionName === conn.name}
                                                >
                                                    {deletingConnectionName === conn.name ? <Spinner size={10} /> : <Trash2 size={11} />}
                                                </Button>
                                            )}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-[1px] bg-border shrink-0" />

                {/* Databases column */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <div className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground bg-black/15 border-b border-border shrink-0">Database</div>
                    <div className="overflow-y-auto flex-1">
                        {connecting ? (
                            <div className="px-3.5 py-4 text-xs text-muted-foreground flex items-center gap-2">
                                <Spinner size={14} className="opacity-60" />
                                Connecting…
                            </div>
                        ) : error ? (
                            <div className="px-3.5 py-3 text-[13px] text-error whitespace-normal leading-[1.4] text-center">
                                {error}
                            </div>
                        ) : pickerDbs.length === 0 ? (
                            <div className="px-3.5 py-4 text-xs text-muted-foreground">No databases</div>
                        ) : (
                            pickerDbs.map((db) => {
                                const isActive = activeProfile?.db_name === db;
                                return (
                                    <div
                                        key={db}
                                        className={cn(
                                            itemBaseClass,
                                            isActive && "border-l-2 border-l-success bg-success/10 text-success font-medium hover:bg-success/10"
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

