import React, { useEffect, useRef, useState } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { onConnectionChanged } from '../../lib/events';
import { cn } from '../../lib/cn';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { CONNECTION_STATUS, TRANSACTION_STATUS } from '../../lib/constants';
import { APP_ZOOM_ENABLED, toZoomPercent, useZoomStore } from '../../stores/zoomStore';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export const StatusBar: React.FC = () => {
    const {
        connectionLabel,
        status,
        message,
        transactionStatus,
        queryExecutionState,
        queryFailureCode,
        firstRowLatencyMs,
        setStatus,
        setConnectionLabel,
        setMessage,
    } = useStatusStore();
    const { activeProfile, connectionStatus } = useConnectionStore();
    const viewMode = useSettingsStore((state) => state.viewMode);
    const zoomLevel = useZoomStore((state) => state.zoomLevel);
    const zoomIn = useZoomStore((state) => state.zoomIn);
    const zoomOut = useZoomStore((state) => state.zoomOut);
    const resetZoom = useZoomStore((state) => state.resetZoom);
    const zoomPct = toZoomPercent(zoomLevel);

    useEffect(() => {
        if (connectionStatus === CONNECTION_STATUS.CONNECTED && activeProfile) {
            setStatus(CONNECTION_STATUS.CONNECTED);
            setConnectionLabel(`${activeProfile.name} (${activeProfile.driver})`);
        } else if (connectionStatus === CONNECTION_STATUS.CONNECTING && activeProfile) {
            setStatus(CONNECTION_STATUS.CONNECTING);
            setConnectionLabel(`Connecting to ${activeProfile.name}...`);
        } else if (connectionStatus === CONNECTION_STATUS.ERROR) {
            setStatus(CONNECTION_STATUS.ERROR);
            const name = activeProfile?.name || 'database';
            setConnectionLabel(`Failed to connect: ${name}`);
        } else {
            setStatus(CONNECTION_STATUS.DISCONNECTED);
            setConnectionLabel('No Connection');
        }
    }, [activeProfile, connectionStatus, setStatus, setConnectionLabel]);

    useEffect(() => {
        const unsub = onConnectionChanged((data) => {
            if (data.status === CONNECTION_STATUS.CONNECTED && data.profile) {
                setStatus(CONNECTION_STATUS.CONNECTED);
                setConnectionLabel(`${data.profile.name} (${data.profile.driver})`);
            } else if (data.status === CONNECTION_STATUS.CONNECTING && data.profile) {
                setStatus(CONNECTION_STATUS.CONNECTING);
                setConnectionLabel(`Connecting to ${data.profile.name}...`);
            } else if (data.status === CONNECTION_STATUS.ERROR) {
                setStatus(CONNECTION_STATUS.ERROR);
                const name = data.profile?.name || 'database';
                setConnectionLabel(`Failed to connect: ${name}`);
            } else {
                setStatus(CONNECTION_STATUS.DISCONNECTED);
                setConnectionLabel('No Connection');
            }
        });
        return () => unsub();
    }, [setStatus, setConnectionLabel]);

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [message, setMessage]);

    const barColor = {
        [CONNECTION_STATUS.CONNECTED]: 'bg-success',
        [CONNECTION_STATUS.CONNECTING]: 'bg-accent-700',
        [CONNECTION_STATUS.ERROR]: 'bg-red-500',
        [CONNECTION_STATUS.FAILED]: 'bg-red-500',
        [CONNECTION_STATUS.DISCONNECTED]: 'bg-yellow-500',
    }[status as string] ?? 'bg-muted';

    const txLabel = {
        [TRANSACTION_STATUS.NONE]: 'TX: none',
        [TRANSACTION_STATUS.ACTIVE]: 'TX: active',
        [TRANSACTION_STATUS.ERROR]: 'TX: error',
    }[transactionStatus];

    return (
        <div
            className={cn(
                'relative z-panel-overlay overflow-visible flex items-center justify-between px-4 h-6 shrink-0 text-white font-medium transition-colors duration-500 ease-out',
                viewMode ? 'bg-linear-to-r from-amber-500/70 to-red-500/70' : barColor,
            )}
        >
            {!viewMode && (
                <span
                    aria-hidden
                    className={cn(
                        'pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out',
                        status === CONNECTION_STATUS.CONNECTING
                            ? 'opacity-100 statusbar-connecting-overlay'
                            : 'opacity-0',
                    )}
                />
            )}
            <div className="flex items-center gap-3 font-medium text-[11px] text-white min-w-0">
                <span
                    className="uppercase text-[10px] opacity-80 shrink-0 cursor-help"
                    title="Transaction status (none/active/error)"
                >
                    {txLabel}
                </span>
                <span
                    className="uppercase text-[10px] opacity-80 shrink-0 cursor-help"
                    title="Query execution state (queued/running/streaming/done/cancelled/failed)"
                >
                    Q: {queryExecutionState}
                </span>
                {firstRowLatencyMs !== null && (
                    <span
                        className="uppercase text-[10px] opacity-80 shrink-0 cursor-help"
                        title="First row latency: time from query start to first row received"
                    >
                        FROW: {firstRowLatencyMs}ms
                    </span>
                )}
                {queryFailureCode !== 'none' && (
                    <span
                        className="uppercase text-[10px] opacity-90 shrink-0 text-red-100 cursor-help"
                        title="Latest query failure category"
                    >
                        ERR: {queryFailureCode}
                    </span>
                )}
                {message && (
                    <span
                        className="bg-white/10 px-2 py-0.5 rounded-sm animate-in fade-in slide-in-from-left-2 text-[10px] text-white/70 border border-white/5 shrink-0 cursor-help"
                        title={message}
                    >
                        {message}
                    </span>
                )}
            </div>
            {APP_ZOOM_ENABLED && zoomPct !== 100 && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="h-5 w-5 flex items-center justify-center rounded-sm text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                            aria-label={`Zoom ${zoomPct}%`}
                        >
                            {zoomPct > 100 ? (
                                // zoom-in icon: magnifier with +
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="6.5" cy="6.5" r="4.5" />
                                    <line x1="10.5" y1="10.5" x2="14" y2="14" />
                                    <line x1="6.5" y1="4.5" x2="6.5" y2="8.5" />
                                    <line x1="4.5" y1="6.5" x2="8.5" y2="6.5" />
                                </svg>
                            ) : (
                                // zoom-out icon: magnifier with −
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="6.5" cy="6.5" r="4.5" />
                                    <line x1="10.5" y1="10.5" x2="14" y2="14" />
                                    <line x1="4.5" y1="6.5" x2="8.5" y2="6.5" />
                                </svg>
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        side="top"
                        align="end"
                        sideOffset={6}
                        className="w-auto p-2"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                className="h-6 w-6 flex items-center justify-center rounded-sm text-sm text-foreground hover:bg-muted transition-colors"
                                title="Zoom out (Ctrl+-)"
                                onClick={zoomOut}
                                aria-label="Zoom out"
                            >
                                −
                            </button>
                            <span className="min-w-12 text-center text-[12px] font-medium tabular-nums text-foreground select-none">
                                {zoomPct}%
                            </span>
                            <button
                                type="button"
                                className="h-6 w-6 flex items-center justify-center rounded-sm text-sm text-foreground hover:bg-muted transition-colors"
                                title="Zoom in (Ctrl+=)"
                                onClick={zoomIn}
                                aria-label="Zoom in"
                            >
                                +
                            </button>
                            <div className="w-px h-4 bg-border mx-0.5" />
                            <button
                                type="button"
                                className="h-6 px-2 flex items-center justify-center rounded-sm text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Reset zoom (Ctrl+0)"
                                onClick={resetZoom}
                            >
                                Reset
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
};
