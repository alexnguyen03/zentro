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
import { Button, Input, Modal } from '../ui';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { TIMELINE_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';

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
    const [timelinePanelState, setTimelinePanelState] = useSidebarPanelState('primary', 'timeline', TIMELINE_PANEL_STATE_DEFAULT);
    const [selectedDiff, setSelectedDiff] = React.useState('');
    const [pendingFiles, setPendingFiles] = React.useState<string[]>([]);
    const [isManualCommitOpen, setIsManualCommitOpen] = React.useState(false);
    const [manualCommitMessage, setManualCommitMessage] = React.useState('');
    const selectedHash = timelinePanelState.selectedHash || null;

    const updateTimelinePanelState = React.useCallback((next: Partial<typeof timelinePanelState>) => {
        setTimelinePanelState((current) => ({
            ...current,
            ...next,
        }));
    }, [setTimelinePanelState]);

    const applyTimelineFilters = React.useCallback(
        (rows: GitTimelineItem[]): GitTimelineItem[] => {
            const objectToken = timelinePanelState.objectFilter.trim().toLowerCase();
            const schemaToken = timelinePanelState.schemaFilter.trim().toLowerCase();
            const fromAt = timelinePanelState.fromDate ? new Date(`${timelinePanelState.fromDate}T00:00:00`).getTime() : 0;
            const toAt = timelinePanelState.toDate ? new Date(`${timelinePanelState.toDate}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER;

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
        [timelinePanelState.fromDate, timelinePanelState.objectFilter, timelinePanelState.schemaFilter, timelinePanelState.toDate],
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
                ListGitTimeline(150, timelinePanelState.eventTypeFilter.trim()),
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
    }, [activeProject?.id, timelinePanelState.eventTypeFilter, toast]);

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
        updateTimelinePanelState({ selectedHash: hash });
        setSelectedDiff('Loading diff...');
        try {
            const diff = await GetGitCommitDiff(hash);
            setSelectedDiff(diff || 'No diff output.');
        } catch (error) {
            setSelectedDiff(`Failed to load diff: ${error}`);
        }
    }, [updateTimelinePanelState]);

    const handleManualCommit = React.useCallback(async (message: string) => {
        try {
            const result = await ManualGitCommit(message);
            if (result.no_changes) {
                toast.success('No pending changes to commit.');
            } else {
                toast.success(`Committed ${result.files.length} file(s) ${result.hash ? `(${result.hash.slice(0, 8)})` : ''}`.trim());
            }
            setIsManualCommitOpen(false);
            await load();
        } catch (error) {
            toast.error(`Manual commit failed: ${error}`);
        }
    }, [load, toast]);

    if (!activeProject?.id) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center text-muted-foreground text-xs gap-2">
                <GitCommitHorizontal size={24} className="opacity-30" />
                <p className="m-0">Open a project to see Git timeline.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-2 py-1.5 border-b border-border bg-card flex items-center gap-1.5">
                <Input
                    className="h-7 flex-1 border-border bg-background px-2 py-1 text-[11px]"
                    placeholder="Filter by event type (e.g. script.save)"
                    value={timelinePanelState.eventTypeFilter}
                    onChange={(event) => updateTimelinePanelState({ eventTypeFilter: event.target.value })}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') void load();
                    }}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => void load()}
                    title="Refresh"
                >
                    <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
                </Button>
            </div>
            <div className="px-2 py-1 border-b border-border/40 bg-card grid grid-cols-2 gap-1 text-[11px]">
                <Input
                    className="h-7 border-border bg-background px-2 py-1 text-[11px]"
                    placeholder="Object/file contains..."
                    value={timelinePanelState.objectFilter}
                    onChange={(event) => updateTimelinePanelState({ objectFilter: event.target.value })}
                />
                <Input
                    className="h-7 border-border bg-background px-2 py-1 text-[11px]"
                    placeholder="Schema..."
                    value={timelinePanelState.schemaFilter}
                    onChange={(event) => updateTimelinePanelState({ schemaFilter: event.target.value })}
                />
                <Input
                    className="h-7 border-border bg-background px-2 py-1 text-[11px]"
                    type="date"
                    value={timelinePanelState.fromDate}
                    onChange={(event) => updateTimelinePanelState({ fromDate: event.target.value })}
                />
                <Input
                    className="h-7 border-border bg-background px-2 py-1 text-[11px]"
                    type="date"
                    value={timelinePanelState.toDate}
                    onChange={(event) => updateTimelinePanelState({ toDate: event.target.value })}
                />
            </div>

            <div className="px-2 py-1 border-b border-border/40 bg-card flex items-center gap-2 text-[11px]">
                <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2 py-0.5 text-[11px]"
                    onClick={() => void handleToggleTracking()}
                    title={status?.enabled ? 'Disable tracking' : 'Enable tracking'}
                >
                    <span className="inline-flex items-center gap-1">
                        {status?.enabled ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
                        {status?.enabled ? 'Tracking On' : 'Tracking Off'}
                    </span>
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2 py-0.5 text-[11px]"
                    onClick={() => {
                        setManualCommitMessage('');
                        setIsManualCommitOpen(true);
                    }}
                    title="Commit pending SQL changes now"
                >
                    Commit Now
                </Button>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Pending: {status?.pending_count ?? pendingFiles.length}</span>
                {status?.repo_path && (
                    <span className="text-[10px] text-muted-foreground truncate" title={status.repo_path}>
                        {status.repo_path}
                    </span>
                )}
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1">
                {timeline.length === 0 ? (
                    <div className="flex items-center justify-center text-muted-foreground text-xs">No timeline entries.</div>
                ) : (
                    <div className="flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto border-b border-border/40">
                            {timeline.map((item) => (
                                <Button
                                    key={item.hash}
                                    type="button"
                                    variant="ghost"
                                    className={cn(
                                        'h-auto w-full justify-start border-b border-white/5 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
                                        selectedHash === item.hash && 'bg-muted',
                                    )}
                                    onClick={() => void handleOpenDiff(item.hash)}
                                >
                                    <div className="w-full">
                                        <div className="text-[10px] text-accent font-mono">{item.event_type}</div>
                                        <div className="text-[11px] text-foreground truncate" title={item.message}>{item.message}</div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                            <span className="font-mono">{item.hash.slice(0, 8)}</span>
                                            <span>{formatDateTime(item.when)}</span>
                                        </div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                        <div className="h-48 overflow-auto bg-background px-2 py-1.5">
                            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words m-0">{selectedDiff || 'Select a commit to view diff.'}</pre>
                        </div>
                    </div>
                )}
            </div>
            <Modal
                isOpen={isManualCommitOpen}
                onClose={() => setIsManualCommitOpen(false)}
                title="Manual Commit"
                width={520}
                layer="confirm"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setIsManualCommitOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => {
                                void handleManualCommit(manualCommitMessage);
                            }}
                            autoFocus
                        >
                            Commit
                        </Button>
                    </>
                )}
            >
                <div className="space-y-3">
                    <p className="text-[13px] text-foreground">
                        Enter an optional commit message for pending SQL changes.
                    </p>
                    <Input
                        value={manualCommitMessage}
                        placeholder="manual.commit: your message"
                        onChange={(event) => setManualCommitMessage(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleManualCommit(manualCommitMessage);
                            }
                        }}
                    />
                </div>
            </Modal>
        </div>
    );
};
