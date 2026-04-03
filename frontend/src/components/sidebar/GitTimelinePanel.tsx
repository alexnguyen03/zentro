import React from 'react';
import { GitCommitHorizontal, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import {
    DisableGitTracking,
    EnableGitTracking,
    GetGitCommitDiff,
    GetGitPendingChanges,
    GetGitTrackingStatus,
    ListGitTimeline,
    ManualGitCommit,
} from '../../services/gitTrackingService';
import type { GitTimelineItem, GitTrackingStatus } from '../../platform/app-api/types';
import { useProjectStore } from '../../stores/projectStore';
import { useToast } from '../layout/Toast';
import { cn } from '../../lib/cn';

function formatDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return iso;
    }
}

export const GitTimelinePanel: React.FC = () => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const { toast } = useToast();

    const [status, setStatus] = React.useState<GitTrackingStatus | null>(null);
    const [timelineRaw, setTimelineRaw] = React.useState<GitTimelineItem[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [eventTypeFilter, setEventTypeFilter] = React.useState('');
    const [objectFilter, setObjectFilter] = React.useState('');
    const [schemaFilter, setSchemaFilter] = React.useState('');
    const [fromDate, setFromDate] = React.useState('');
    const [toDate, setToDate] = React.useState('');
    const [selectedHash, setSelectedHash] = React.useState<string | null>(null);
    const [selectedDiff, setSelectedDiff] = React.useState('');
    const [pendingFiles, setPendingFiles] = React.useState<string[]>([]);

    const applyTimelineFilters = React.useCallback(
        (rows: GitTimelineItem[]): GitTimelineItem[] => {
            const objectToken = objectFilter.trim().toLowerCase();
            const schemaToken = schemaFilter.trim().toLowerCase();
            const fromAt = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
            const toAt = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER;

            return (rows || []).filter((item) => {
                if (objectToken) {
                    const haystack = `${item.message} ${(item.files || []).join(' ')}`.toLowerCase();
                    if (!haystack.includes(objectToken)) {
                        return false;
                    }
                }

                if (schemaToken) {
                    const fileHit = (item.files || []).some((f) => f.toLowerCase().includes(`/${schemaToken}/`));
                    const messageHit = item.message.toLowerCase().includes(schemaToken);
                    if (!fileHit && !messageHit) {
                        return false;
                    }
                }

                const when = new Date(item.when).getTime();
                if (!Number.isNaN(when) && (when < fromAt || when > toAt)) {
                    return false;
                }

                return true;
            });
        },
        [fromDate, objectFilter, schemaFilter, toDate],
    );

    const load = React.useCallback(async () => {
        if (!activeProject?.id) {
            setStatus(null);
            setTimelineRaw([]);
            setPendingFiles([]);
            return;
        }
        setLoading(true);
        try {
            const [trackingStatus, rows, pending] = await Promise.all([
                GetGitTrackingStatus(),
                ListGitTimeline(150, eventTypeFilter.trim()),
                GetGitPendingChanges(),
            ]);
            setStatus(trackingStatus);
            setTimelineRaw(rows || []);
            setPendingFiles(pending || []);
        } catch (error) {
            toast.error(`Failed to load git timeline: ${error}`);
        } finally {
            setLoading(false);
        }
    }, [activeProject?.id, eventTypeFilter, toast]);

    const timeline = React.useMemo(() => applyTimelineFilters(timelineRaw), [applyTimelineFilters, timelineRaw]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const handleToggleTracking = React.useCallback(async () => {
        if (!status) return;
        try {
            if (status.enabled) {
                await DisableGitTracking();
                toast.success('Git tracking disabled');
            } else {
                await EnableGitTracking();
                toast.success('Git tracking enabled');
            }
            await load();
        } catch (error) {
            toast.error(`Failed to update tracking status: ${error}`);
        }
    }, [load, status, toast]);

    const handleOpenDiff = React.useCallback(async (hash: string) => {
        setSelectedHash(hash);
        setSelectedDiff('Loading diff...');
        try {
            const diff = await GetGitCommitDiff(hash);
            setSelectedDiff(diff || 'No diff output.');
        } catch (error) {
            setSelectedDiff(`Failed to load diff: ${error}`);
        }
    }, []);

    const handleManualCommit = React.useCallback(async () => {
        const raw = window.prompt('Commit message (optional):', '');
        if (raw === null) return;
        try {
            const result = await ManualGitCommit(raw);
            if (result.no_changes) {
                toast.success('No pending changes to commit.');
            } else {
                toast.success(`Committed ${result.files.length} file(s) ${result.hash ? `(${result.hash.slice(0, 8)})` : ''}`.trim());
            }
            await load();
        } catch (error) {
            toast.error(`Manual commit failed: ${error}`);
        }
    }, [load, toast]);

    if (!activeProject?.id) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center text-text-secondary text-xs gap-2">
                <GitCommitHorizontal size={24} className="opacity-30" />
                <p className="m-0">Open a project to see Git timeline.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-2 py-1.5 border-b border-border bg-bg-secondary flex items-center gap-1.5">
                <input
                    className="flex-1 bg-bg-primary border border-border text-text-primary text-[11px] py-1 px-2 rounded-md outline-none focus:border-success"
                    placeholder="Filter by event type (e.g. script.save)"
                    value={eventTypeFilter}
                    onChange={(event) => setEventTypeFilter(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') void load();
                    }}
                />
                <button
                    className="cursor-pointer bg-transparent border-none text-text-secondary hover:text-text-primary p-1 rounded"
                    onClick={() => void load()}
                    title="Refresh"
                >
                    <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
                </button>
            </div>
            <div className="px-2 py-1 border-b border-border/40 bg-bg-secondary grid grid-cols-2 gap-1 text-[11px]">
                <input
                    className="bg-bg-primary border border-border text-text-primary text-[11px] py-1 px-2 rounded-md outline-none focus:border-success"
                    placeholder="Object/file contains..."
                    value={objectFilter}
                    onChange={(event) => setObjectFilter(event.target.value)}
                />
                <input
                    className="bg-bg-primary border border-border text-text-primary text-[11px] py-1 px-2 rounded-md outline-none focus:border-success"
                    placeholder="Schema..."
                    value={schemaFilter}
                    onChange={(event) => setSchemaFilter(event.target.value)}
                />
                <input
                    className="bg-bg-primary border border-border text-text-primary text-[11px] py-1 px-2 rounded-md outline-none focus:border-success"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                />
                <input
                    className="bg-bg-primary border border-border text-text-primary text-[11px] py-1 px-2 rounded-md outline-none focus:border-success"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                />
            </div>

            <div className="px-2 py-1 border-b border-border/40 bg-bg-secondary flex items-center gap-2 text-[11px]">
                <button
                    className="cursor-pointer bg-transparent border border-border rounded px-2 py-0.5 text-text-primary hover:bg-bg-tertiary"
                    onClick={() => void handleToggleTracking()}
                    title={status?.enabled ? 'Disable tracking' : 'Enable tracking'}
                >
                    <span className="inline-flex items-center gap-1">
                        {status?.enabled ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
                        {status?.enabled ? 'Tracking On' : 'Tracking Off'}
                    </span>
                </button>
                <button
                    className="cursor-pointer bg-transparent border border-border rounded px-2 py-0.5 text-text-primary hover:bg-bg-tertiary"
                    onClick={() => void handleManualCommit()}
                    title="Commit pending SQL changes now"
                >
                    Commit Now
                </button>
                <span className="text-[10px] text-text-secondary whitespace-nowrap">Pending: {status?.pending_count ?? pendingFiles.length}</span>
                {status?.repo_path && (
                    <span className="text-[10px] text-text-secondary truncate" title={status.repo_path}>
                        {status.repo_path}
                    </span>
                )}
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1">
                {timeline.length === 0 ? (
                    <div className="flex items-center justify-center text-text-secondary text-xs">No timeline entries.</div>
                ) : (
                    <div className="flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto border-b border-border/40">
                            {timeline.map((item) => (
                                <button
                                    key={item.hash}
                                    className={cn(
                                        'w-full text-left px-2.5 py-1.5 border-b border-white/5 cursor-pointer hover:bg-bg-tertiary transition-colors',
                                        selectedHash === item.hash && 'bg-bg-tertiary',
                                    )}
                                    onClick={() => void handleOpenDiff(item.hash)}
                                >
                                    <div className="text-[10px] text-accent font-mono">{item.event_type}</div>
                                    <div className="text-[11px] text-text-primary truncate" title={item.message}>{item.message}</div>
                                    <div className="text-[10px] text-text-secondary flex items-center gap-2">
                                        <span className="font-mono">{item.hash.slice(0, 8)}</span>
                                        <span>{formatDateTime(item.when)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="h-48 overflow-auto bg-bg-primary px-2 py-1.5">
                            <pre className="text-[11px] text-text-secondary whitespace-pre-wrap break-words m-0">{selectedDiff || 'Select a commit to view diff.'}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
