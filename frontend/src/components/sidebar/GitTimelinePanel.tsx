import React from 'react';
import { ChevronDown, ChevronRight, GitCommitHorizontal, RefreshCw, RotateCcw } from 'lucide-react';
import {
    GetCommitFileDiffs,
    ListGitTimeline,
    ManualGitCommit,
    RestoreGitCommit,
} from '../../services/gitTrackingService';
import type { GitTimelineItem } from '../../platform/app-api/types';
import { useProjectStore } from '../../stores/projectStore';
import { useToast } from '../layout/Toast';
import { cn } from '../../lib/cn';
import { Button, ConfirmationModal, Input, Modal } from '../ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { TIMELINE_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';
import { useEditorStore } from '../../stores/editorStore';
import { useScriptStore } from '../../stores/scriptStore';
import { TAB_TYPE } from '../../lib/constants';

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

// scripts/{connectionName}/{scriptId}.sql → resolve script name from store, else return raw filename
function resolveFileName(filePath: string): string {
    const parts = filePath.split('/');
    const rawFile = parts[parts.length - 1] ?? filePath;
    if (parts[0] === 'scripts' && parts.length === 3) {
        const scriptId = rawFile.replace(/\.sql$/i, '');
        const scripts = useScriptStore.getState().scripts;
        const match = scripts.find((s) => s.id === scriptId);
        if (match?.name) return match.name;
    }
    return rawFile;
}

export const GitTimelinePanel: React.FC = () => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const addTab = useEditorStore((state) => state.addTab);
    const { toast } = useToast();

    const [timelineRaw, setTimelineRaw] = React.useState<GitTimelineItem[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [timelinePanelState, setTimelinePanelState] = useSidebarPanelState('primary', 'timeline', TIMELINE_PANEL_STATE_DEFAULT);
    const [isManualCommitOpen, setIsManualCommitOpen] = React.useState(false);
    const [manualCommitMessage, setManualCommitMessage] = React.useState('');
    const [restoreTargetHash, setRestoreTargetHash] = React.useState<string | null>(null);
    const [expandedHash, setExpandedHash] = React.useState<string | null>(null);
    const [fileDiffsCache, setFileDiffsCache] = React.useState<Record<string, { path: string; before: string; after: string }[]>>({});
    const [fileDiffsLoading, setFileDiffsLoading] = React.useState<string | null>(null);
    const [selectedFileKey, setSelectedFileKey] = React.useState<string | null>(null);

    const updateTimelinePanelState = React.useCallback((next: Partial<typeof timelinePanelState>) => {
        setTimelinePanelState((current) => ({ ...current, ...next }));
    }, [setTimelinePanelState]);

    const applyTimelineFilters = React.useCallback(
        (rows: GitTimelineItem[]): GitTimelineItem[] => {
            const objectToken = timelinePanelState.objectFilter.trim().toLowerCase();
            const schemaToken = timelinePanelState.schemaFilter.trim().toLowerCase();

            return (rows || []).filter((item) => {
                if (objectToken) {
                    const haystack = `${item.message} ${(item.files || []).join(' ')}`.toLowerCase();
                    if (!haystack.includes(objectToken)) return false;
                }
                if (schemaToken) {
                    const fileHit = (item.files || []).some((f) => f.toLowerCase().includes(`/${schemaToken}/`));
                    const messageHit = item.message.toLowerCase().includes(schemaToken);
                    if (!fileHit && !messageHit) return false;
                }
                return true;
            });
        },
        [timelinePanelState.objectFilter, timelinePanelState.schemaFilter],
    );

    const load = React.useCallback(async () => {
        if (!activeProject?.id) {
            setTimelineRaw([]);
            return;
        }
        setLoading(true);
        try {
            const rows = await ListGitTimeline(150, '');
            setTimelineRaw(rows || []);
        } catch (error) {
            toast.error(`Failed to load git timeline: ${error}`);
        } finally {
            setLoading(false);
        }
    }, [activeProject?.id, toast]);

    const timeline = React.useMemo(() => applyTimelineFilters(timelineRaw), [applyTimelineFilters, timelineRaw]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const handleToggleCommit = React.useCallback(async (item: GitTimelineItem) => {
        if (expandedHash === item.hash) {
            setExpandedHash(null);
            return;
        }
        setExpandedHash(item.hash);
        if (!fileDiffsCache[item.hash]) {
            setFileDiffsLoading(item.hash);
            try {
                const fileDiffs = await GetCommitFileDiffs(item.hash);
                setFileDiffsCache((prev) => ({ ...prev, [item.hash]: fileDiffs }));
            } catch (error) {
                toast.error(`Failed to load changes: ${error}`);
            } finally {
                setFileDiffsLoading(null);
            }
        }
    }, [expandedHash, fileDiffsCache, toast]);

    const handleOpenFileDiff = React.useCallback((hash: string, file: { path: string; before: string; after: string }) => {
        const fileKey = `${hash}:${file.path}`;
        setSelectedFileKey(fileKey);
        const fileName = resolveFileName(file.path);
        addTab({
            id: `git-diff:${hash}:${file.path}`,
            type: TAB_TYPE.GIT_DIFF,
            name: `Changes · ${fileName}`,
            query: '',
            readOnly: true,
            gitDiffBefore: file.before,
            gitDiffAfter: file.after,
        });
    }, [addTab]);

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

    const handleRestoreCommit = React.useCallback(async () => {
        if (!restoreTargetHash) return;
        try {
            await RestoreGitCommit(restoreTargetHash);
            toast.success(`Restored to ${restoreTargetHash.slice(0, 8)}`);
            setRestoreTargetHash(null);
            await load();
        } catch (error) {
            toast.error(`Restore failed: ${error}`);
        }
    }, [restoreTargetHash, load, toast]);

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
            {/* Toolbar */}
            <div className="px-2 py-1.5 border-b border-border flex items-center gap-1.5">
                <Input
                    className="h-7 flex-1 border-border bg-background px-2 py-1 text-[11px]"
                    placeholder="Search object / file..."
                    value={timelinePanelState.objectFilter}
                    onChange={(e) => updateTimelinePanelState({ objectFilter: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Escape') updateTimelinePanelState({ objectFilter: '' }); }}
                />
                <Input
                    className="h-7 w-24 border-border bg-background px-2 py-1 text-[11px]"
                    placeholder="Schema"
                    value={timelinePanelState.schemaFilter}
                    onChange={(e) => updateTimelinePanelState({ schemaFilter: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Escape') updateTimelinePanelState({ schemaFilter: '' }); }}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => { setManualCommitMessage(''); setIsManualCommitOpen(true); }}
                    title="Commit pending changes"
                >
                    <GitCommitHorizontal size={13} />
                </Button>
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

            {/* Timeline */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {timeline.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No timeline entries.</div>
                ) : (
                    <div className="h-full overflow-y-auto">
                        <TooltipProvider>
                            {timeline.map((item) => {
                                const isExpanded = expandedHash === item.hash;
                                const cachedFiles = fileDiffsCache[item.hash];
                                const isLoadingFiles = fileDiffsLoading === item.hash;
                                return (
                                    <div key={item.hash} className="border-b border-white/5">
                                        <div className={cn('group flex items-center hover:bg-muted transition-colors', isExpanded && 'bg-muted')}>
                                            <Tooltip delayDuration={600}>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="flex-1 text-left px-2.5 py-1.5 min-w-0 flex items-center gap-1"
                                                        onClick={() => void handleToggleCommit(item)}
                                                    >
                                                        {isExpanded
                                                            ? <ChevronDown size={10} className="text-accent shrink-0" />
                                                            : <ChevronRight size={10} className="text-muted-foreground shrink-0" />}
                                                        <span className="text-[11px] text-foreground truncate">{item.message}</span>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="flex flex-col gap-0.5 max-w-65">
                                                    <span className="text-accent font-mono text-[10px]">{item.event_type}</span>
                                                    <span className="text-popover-foreground text-[11px] wrap-break-word">{item.message}</span>
                                                    <span className="text-muted-foreground font-mono text-[10px]">{item.hash.slice(0, 8)}</span>
                                                    <span className="text-muted-foreground text-[10px]">{formatDateTime(item.when)}</span>
                                                </TooltipContent>
                                            </Tooltip>
                                            <button
                                                type="button"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-1.5 text-muted-foreground hover:text-foreground shrink-0"
                                                title="Restore to this commit"
                                                onClick={() => setRestoreTargetHash(item.hash)}
                                            >
                                                <RotateCcw size={11} />
                                            </button>
                                        </div>
                                        {isExpanded && (
                                            <div className="bg-background border-t border-border/30">
                                                {isLoadingFiles ? (
                                                    <div className="px-5 py-1.5 text-[10px] text-muted-foreground">Loading...</div>
                                                ) : cachedFiles && cachedFiles.length > 0 ? (
                                                    cachedFiles.map((f) => {
                                                        const fileKey = `${item.hash}:${f.path}`;
                                                        const isSelected = selectedFileKey === fileKey;
                                                        return (
                                                            <button
                                                                key={f.path}
                                                                type="button"
                                                                className={cn(
                                                                    'w-full text-left px-5 py-1 text-[10px] font-mono transition-colors flex items-center gap-1.5 truncate',
                                                                    isSelected
                                                                        ? 'bg-accent/15 text-foreground'
                                                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                                                )}
                                                                title={f.path}
                                                                onClick={() => handleOpenFileDiff(item.hash, f)}
                                                            >
                                                                {!f.before && <span className="text-green-500 shrink-0">A</span>}
                                                                {!f.after && <span className="text-red-500 shrink-0">D</span>}
                                                                {f.before && f.after && <span className="text-yellow-500 shrink-0">M</span>}
                                                                <span className="truncate">{resolveFileName(f.path)}</span>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-5 py-1.5 text-[10px] text-muted-foreground">No file changes.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </TooltipProvider>
                    </div>
                )}
            </div>

            {/* Manual Commit Modal */}
            <Modal
                isOpen={isManualCommitOpen}
                onClose={() => setIsManualCommitOpen(false)}
                title="Commit Changes"
                width={520}
                layer="confirm"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setIsManualCommitOpen(false)}>Cancel</Button>
                        <Button variant="default" onClick={() => void handleManualCommit(manualCommitMessage)} autoFocus>
                            Commit
                        </Button>
                    </>
                )}
            >
                <div className="space-y-3">
                    <p className="text-[13px] text-foreground">Enter an optional commit message for pending changes.</p>
                    <Input
                        value={manualCommitMessage}
                        placeholder="manual.commit: your message"
                        onChange={(e) => setManualCommitMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); void handleManualCommit(manualCommitMessage); }
                        }}
                    />
                </div>
            </Modal>

            {/* Restore Confirmation */}
            <ConfirmationModal
                isOpen={restoreTargetHash !== null}
                onClose={() => setRestoreTargetHash(null)}
                onConfirm={() => void handleRestoreCommit()}
                title="Restore to Commit"
                message={`Restore all tracked files to the state at commit ${restoreTargetHash?.slice(0, 8) ?? ''}?`}
                description="The current working files will be overwritten. A new restore commit will be created in the timeline so you can undo this action."
                variant="destructive"
                confirmLabel="Restore"
            />
        </div>
    );
};
