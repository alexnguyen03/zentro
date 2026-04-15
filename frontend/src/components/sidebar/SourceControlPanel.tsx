import React from 'react';
import {
    ChevronDown,
    ChevronRight,
    FileCode2,
    GitBranch,
    History,
    Minus,
    Plus,
    RefreshCw,
} from 'lucide-react';
import {
    SCGetStatus,
    SCStageFile,
    SCUnstageFile,
    SCStageAll,
    SCCommit,
    SCGetHistory,
    SCGetFileDiffs,
    SCGetWorkingFileDiff,
    SCInitRepo,
    SCReadGitIgnore,
} from '../../services/sourceControlService';
import type { SCFileStatus, SCCommit as SCCommitType, GitCommitFileDiff } from '../../platform/app-api/types';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { useScriptStore } from '../../stores/scriptStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToast } from '../layout/Toast';
import { cn } from '../../lib/cn';
import { Button, Input } from '../ui';
import { TAB_TYPE } from '../../lib/constants';

function formatDateTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

const STATUS_ICON: Record<string, { label: string; className: string }> = {
    added: { label: 'A', className: 'text-green-500' },
    deleted: { label: 'D', className: 'text-red-500' },
    modified: { label: 'M', className: 'text-yellow-500' },
    untracked: { label: '?', className: 'text-muted-foreground' },
};

function FileStatusBadge({ status }: { status: string }) {
    const meta = STATUS_ICON[status] ?? { label: '?', className: 'text-muted-foreground' };
    return <span className={cn('shrink-0 font-mono text-[10px] font-bold', meta.className)}>{meta.label}</span>;
}

type Tab = 'changes' | 'history';

export const SourceControlPanel: React.FC = () => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const addTab = useEditorStore((state) => state.addTab);
    const scripts = useScriptStore((state) => state.scripts);
    const activeProfile = useConnectionStore((state) => state.activeProfile);
    const { toast } = useToast();

    const [activeTab, setActiveTab] = React.useState<Tab>('changes');
    const [loading, setLoading] = React.useState(false);
    const [staged, setStaged] = React.useState<SCFileStatus[]>([]);
    const [unstaged, setUnstaged] = React.useState<SCFileStatus[]>([]);

    const [history, setHistory] = React.useState<SCCommitType[]>([]);
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [expandedHash, setExpandedHash] = React.useState<string | null>(null);
    const [fileDiffsCache, setFileDiffsCache] = React.useState<Record<string, GitCommitFileDiff[]>>({});
    const [fileDiffsLoading, setFileDiffsLoading] = React.useState<string | null>(null);
    const [selectedFileKey, setSelectedFileKey] = React.useState<string | null>(null);

    const [commitMessage, setCommitMessage] = React.useState('');
    const [isCommitting, setIsCommitting] = React.useState(false);
    const [workingDiffLoadingKey, setWorkingDiffLoadingKey] = React.useState<string | null>(null);

    const [repoNotInitialized, setRepoNotInitialized] = React.useState(false);
    const [initLoading, setInitLoading] = React.useState(false);
    const [gitIgnoreLoading, setGitIgnoreLoading] = React.useState(false);

    const hasRepoPath = Boolean(activeProject?.git_repo_path);
    const scriptNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        (scripts || []).forEach((script) => {
            const id = String(script.id || '').trim();
            const name = String(script.name || '').trim();
            if (id && name) {
                map.set(id, name);
            }
        });
        return map;
    }, [scripts]);

    const getDisplayFileName = React.useCallback((path: string) => {
        const normalized = String(path || '').replace(/\\/g, '/');
        const rawFile = normalized.split('/').pop() || normalized;
        const lower = rawFile.toLowerCase();
        if (!lower.endsWith('.sql')) {
            return rawFile;
        }

        const stem = rawFile.slice(0, -4);
        const scriptName = scriptNameById.get(stem);
        if (!scriptName) {
            return rawFile;
        }
        return scriptName.toLowerCase().endsWith('.sql') ? scriptName : `${scriptName}.sql`;
    }, [scriptNameById]);

    const loadStatus = React.useCallback(async () => {
        if (!activeProject?.git_repo_path) return;
        setLoading(true);
        setRepoNotInitialized(false);
        try {
            const status = await SCGetStatus();
            const files = Array.isArray(status.files) ? status.files : [];
            setStaged(files.filter((f) => f.staged));
            setUnstaged(files.filter((f) => !f.staged));
        } catch (error) {
            const errorMsg = String(error);
            if (errorMsg.includes('cannot open repo') || errorMsg.includes('not a git repository')) {
                setRepoNotInitialized(true);
            } else {
                toast.error(`Source control: ${error}`);
            }
        } finally {
            setLoading(false);
        }
    }, [activeProject?.git_repo_path, toast]);

    const loadHistory = React.useCallback(async () => {
        if (!activeProject?.git_repo_path) return;
        setHistoryLoading(true);
        try {
            const commits = await SCGetHistory(100);
            setHistory(commits || []);
        } catch (error) {
            toast.error(`Source control history: ${error}`);
        } finally {
            setHistoryLoading(false);
        }
    }, [activeProject?.git_repo_path, toast]);

    React.useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    React.useEffect(() => {
        if (activeTab === 'history') {
            void loadHistory();
        }
    }, [activeTab, loadHistory]);

    const handleStage = React.useCallback(async (path: string) => {
        try {
            await SCStageFile(path);
            await loadStatus();
        } catch (error) {
            toast.error(`Stage failed: ${error}`);
        }
    }, [loadStatus, toast]);

    const handleUnstage = React.useCallback(async (path: string) => {
        try {
            await SCUnstageFile(path);
            await loadStatus();
        } catch (error) {
            toast.error(`Unstage failed: ${error}`);
        }
    }, [loadStatus, toast]);

    const handleStageAll = React.useCallback(async () => {
        try {
            await SCStageAll();
            await loadStatus();
        } catch (error) {
            toast.error(`Stage all failed: ${error}`);
        }
    }, [loadStatus, toast]);

    const handleCommit = React.useCallback(async () => {
        if (staged.length === 0 || isCommitting) return;
        setIsCommitting(true);
        try {
            const hash = await SCCommit(commitMessage);
            toast.success(`Committed (${hash.slice(0, 8)})`);
            setCommitMessage('');
            await loadStatus();
            if (activeTab === 'history') await loadHistory();
        } catch (error) {
            toast.error(`Commit failed: ${error}`);
        } finally {
            setIsCommitting(false);
        }
    }, [activeTab, commitMessage, isCommitting, loadHistory, loadStatus, staged.length, toast]);

    const handleInitRepo = React.useCallback(async () => {
        try {
            setInitLoading(true);
            await SCInitRepo();
            toast.success('Repository initialized');
            setRepoNotInitialized(false);
            await loadStatus();
        } catch (error) {
            toast.error(`Init failed: ${error}`);
        } finally {
            setInitLoading(false);
        }
    }, [loadStatus, toast]);

    const handleToggleCommit = React.useCallback(async (hash: string) => {
        if (expandedHash === hash) {
            setExpandedHash(null);
            return;
        }
        setExpandedHash(hash);
        if (!fileDiffsCache[hash]) {
            setFileDiffsLoading(hash);
            try {
                const diffs = await SCGetFileDiffs(hash);
                setFileDiffsCache((prev) => ({ ...prev, [hash]: diffs }));
            } catch (error) {
                toast.error(`Load diffs failed: ${error}`);
            } finally {
                setFileDiffsLoading(null);
            }
        }
    }, [expandedHash, fileDiffsCache, toast]);

    const handleOpenGitIgnoreEditor = React.useCallback(async () => {
        try {
            setGitIgnoreLoading(true);
            const content = await SCReadGitIgnore();
            addTab({
                id: 'source-control:.gitignore',
                type: TAB_TYPE.QUERY,
                name: '.gitignore',
                query: content || '',
                context: {
                    sourceControlFile: 'gitignore',
                    savedScriptId: undefined,
                    scriptProjectId: undefined,
                    scriptConnectionName: undefined,
                },
            });
        } catch (error) {
            toast.error(`Load .gitignore failed: ${error}`);
        } finally {
            setGitIgnoreLoading(false);
        }
    }, [addTab, toast]);

    const handleOpenDiff = React.useCallback((hash: string, file: GitCommitFileDiff) => {
        const fileKey = `sc:${hash}:${file.path}`;
        setSelectedFileKey(fileKey);
        const fileName = getDisplayFileName(file.path);
        addTab({
            id: `git-diff:sc:${hash}:${file.path}`,
            type: TAB_TYPE.GIT_DIFF,
            name: `Changes - ${fileName}`,
            query: '',
            readOnly: true,
            gitDiffBefore: file.before,
            gitDiffAfter: file.after,
        });
    }, [addTab, getDisplayFileName]);

    const handleOpenHistoryFileQuery = React.useCallback((file: GitCommitFileDiff) => {
        const fileName = getDisplayFileName(file.path);
        addTab({
            type: TAB_TYPE.QUERY,
            name: fileName,
            query: file.after || file.before || '',
        });
    }, [addTab, getDisplayFileName]);

    const handleOpenWorkingDiff = React.useCallback(async (file: SCFileStatus, stagedView: boolean) => {
        const fileKey = `wip:${stagedView ? 'staged' : 'unstaged'}:${file.path}`;
        setSelectedFileKey(fileKey);
        setWorkingDiffLoadingKey(fileKey);
        try {
            const diff = await SCGetWorkingFileDiff(file.path, stagedView);
            const fileName = getDisplayFileName(file.path);
            addTab({
                id: `git-diff:sc:wip:${stagedView ? 'staged' : 'unstaged'}:${file.path}`,
                type: TAB_TYPE.GIT_DIFF,
                name: `${stagedView ? 'Staged' : 'Unstaged'} - ${fileName}`,
                query: '',
                readOnly: true,
                gitDiffBefore: diff.before,
                gitDiffAfter: diff.after,
            });
        } catch (error) {
            toast.error(`Load diff failed: ${error}`);
        } finally {
            setWorkingDiffLoadingKey((current) => (current === fileKey ? null : current));
        }
    }, [addTab, getDisplayFileName, toast]);

    const handleOpenFileQuery = React.useCallback(async (file: SCFileStatus, stagedView: boolean) => {
        try {
            const diff = await SCGetWorkingFileDiff(file.path, stagedView);
            const fileName = getDisplayFileName(file.path);
            const rawFile = file.path.split('/').pop() ?? file.path;
            const scriptId = rawFile.toLowerCase().endsWith('.sql') ? rawFile.slice(0, -4) : '';
            const hasSavedScript = Boolean(scriptId && scriptNameById.has(scriptId));

            addTab({
                type: TAB_TYPE.QUERY,
                name: fileName,
                query: diff.after || diff.before || '',
                context: hasSavedScript && activeProject?.id && activeProfile?.name
                    ? {
                        savedScriptId: scriptId,
                        scriptProjectId: activeProject.id,
                        scriptConnectionName: activeProfile.name,
                    }
                    : undefined,
            });
        } catch (error) {
            toast.error(`Open file failed: ${error}`);
        }
    }, [activeProfile?.name, activeProject?.id, addTab, getDisplayFileName, scriptNameById, toast]);

    if (!activeProject?.id) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center text-muted-foreground text-xs gap-2">
                <GitBranch size={24} className="opacity-30" />
                <p className="m-0">Open a project to use Source Control.</p>
            </div>
        );
    }

    if (!hasRepoPath) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center text-muted-foreground text-xs gap-2">
                <GitBranch size={24} className="opacity-30" />
                <p className="m-0">No git repository configured.</p>
                <p className="m-0 text-[10px]">Set a <strong>Git repo path</strong> in Project Settings to enable Source Control.</p>
            </div>
        );
    }

    if (repoNotInitialized) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center text-muted-foreground text-xs gap-3">
                <GitBranch size={24} className="opacity-30" />
                <div>
                    <p className="m-0 text-foreground font-semibold">Initialize Repository</p>
                    <p className="m-0 text-[10px] mt-1">The folder at this path is not yet a git repository.</p>
                </div>
                <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleInitRepo()}
                    disabled={initLoading}
                >
                    {initLoading ? 'Initializing...' : 'Initialize'}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'h-7 w-7',
                        activeTab === 'changes' ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setActiveTab('changes')}
                    title={`Changes (${staged.length + unstaged.length})`}
                >
                    <GitBranch size={13} />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'h-7 w-7',
                        activeTab === 'history' ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setActiveTab('history')}
                    title="History"
                >
                    <History size={13} />
                </Button>
                <div className="flex-1" />
                <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        void handleOpenGitIgnoreEditor();
                    }}
                    title="Edit .gitignore"
                    disabled={gitIgnoreLoading}
                >
                    <FileCode2 size={13} className={cn(gitIgnoreLoading && 'animate-pulse')} />
                </Button>
                <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        void loadStatus();
                    }}
                    title="Refresh"
                >
                    <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
                </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {activeTab === 'changes' && (
                    <div>
                        <div className="px-2.5 py-1 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Staged ({staged.length})
                            </span>
                            {unstaged.length > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                                    title="Stage all"
                                    onClick={() => void handleStageAll()}
                                >
                                    <Plus size={10} /> All
                                </Button>
                            )}
                        </div>
                        {staged.length === 0 ? (
                            <div className="px-3 py-1 text-[10px] text-muted-foreground">No staged changes.</div>
                        ) : staged.map((f) => (
                            <div
                                key={f.path}
                                className={cn(
                                    'group flex w-full items-center gap-1.5 px-3 py-1 transition-colors hover:bg-muted',
                                    selectedFileKey === `wip:staged:${f.path}` && 'bg-accent/15',
                                )}
                                role="button"
                                tabIndex={0}
                                title={f.path}
                                onClick={() => {
                                    void handleOpenWorkingDiff(f, true);
                                }}
                                onDoubleClick={() => {
                                    void handleOpenFileQuery(f, true);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        void handleOpenWorkingDiff(f, true);
                                    }
                                }}
                            >
                                <FileStatusBadge status={f.status} />
                                <span className="flex-1 truncate text-[11px] font-mono text-foreground" title={f.path}>
                                    {getDisplayFileName(f.path)}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title={`Unstage ${f.path}`}
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void handleUnstage(f.path);
                                    }}
                                >
                                    <Minus size={11} />
                                </Button>
                            </div>
                        ))}

                        <div className="border-t border-border/30 mt-1" />

                        <div className="px-2.5 py-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Unstaged ({unstaged.length})
                            </span>
                        </div>
                        {unstaged.length === 0 ? (
                            <div className="px-3 py-1 text-[10px] text-muted-foreground">No unstaged changes.</div>
                        ) : unstaged.map((f) => (
                            <div
                                key={f.path}
                                className={cn(
                                    'group flex w-full items-center gap-1.5 px-3 py-1 transition-colors hover:bg-muted',
                                    selectedFileKey === `wip:unstaged:${f.path}` && 'bg-accent/15',
                                )}
                                role="button"
                                tabIndex={0}
                                title={f.path}
                                onClick={() => {
                                    void handleOpenWorkingDiff(f, false);
                                }}
                                onDoubleClick={() => {
                                    void handleOpenFileQuery(f, false);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        void handleOpenWorkingDiff(f, false);
                                    }
                                }}
                            >
                                <FileStatusBadge status={f.status} />
                                <span className="flex-1 truncate text-[11px] font-mono text-muted-foreground" title={f.path}>
                                    {getDisplayFileName(f.path)}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title={`Stage ${f.path}`}
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void handleStage(f.path);
                                    }}
                                >
                                    <Plus size={11} />
                                </Button>
                            </div>
                        ))}

                        {staged.length === 0 && unstaged.length === 0 && !loading && (
                            <div className="flex justify-center py-4 text-[11px] text-muted-foreground">Working tree clean.</div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    historyLoading ? (
                        <div className="flex justify-center py-4 text-[11px] text-muted-foreground">Loading...</div>
                    ) : history.length === 0 ? (
                        <div className="flex justify-center py-4 text-[11px] text-muted-foreground">No commits yet.</div>
                    ) : (
                        history.map((commit) => {
                            const isExpanded = expandedHash === commit.hash;
                            const cachedFiles = fileDiffsCache[commit.hash];
                            const isLoadingFiles = fileDiffsLoading === commit.hash;
                            return (
                                <div key={commit.hash} className="border-b border-white/5">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className={cn('w-full text-left px-2.5 py-1.5 flex items-center gap-1 hover:bg-muted transition-colors', isExpanded && 'bg-muted')}
                                        onClick={() => void handleToggleCommit(commit.hash)}
                                        title={`${commit.author} - ${formatDateTime(commit.when)}`}
                                    >
                                        {isExpanded
                                            ? <ChevronDown size={10} className="text-accent shrink-0" />
                                            : <ChevronRight size={10} className="text-muted-foreground shrink-0" />}
                                        <span className="flex-1 text-[11px] text-foreground truncate">{commit.message}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{commit.hash.slice(0, 7)}</span>
                                    </Button>
                                    {isExpanded && (
                                        <div className="bg-background border-t border-border/30">
                                            {isLoadingFiles ? (
                                                <div className="px-5 py-1.5 text-[10px] text-muted-foreground">Loading...</div>
                                            ) : cachedFiles && cachedFiles.length > 0 ? (
                                                cachedFiles.map((f) => {
                                                    const fileKey = `sc:${commit.hash}:${f.path}`;
                                                    const isSelected = selectedFileKey === fileKey;
                                                    return (
                                                        <Button
                                                            key={f.path}
                                                            type="button"
                                                            variant="ghost"
                                                            className={cn(
                                                                'w-full text-left px-5 py-1 text-[10px] font-mono transition-colors flex items-center gap-1.5 truncate',
                                                                isSelected
                                                                    ? 'bg-accent/15 text-foreground'
                                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                                            )}
                                                            title={f.path}
                                                            onClick={() => handleOpenDiff(commit.hash, f)}
                                                            onDoubleClick={() => handleOpenHistoryFileQuery(f)}
                                                        >
                                                            {!f.before && <span className="text-green-500 shrink-0">A</span>}
                                                            {!f.after && <span className="text-red-500 shrink-0">D</span>}
                                                            {f.before && f.after && <span className="text-yellow-500 shrink-0">M</span>}
                                                            <span className="truncate">{getDisplayFileName(f.path)}</span>
                                                        </Button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-5 py-1.5 text-[10px] text-muted-foreground">No file changes.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )
                )}
            </div>

            {activeTab === 'changes' && (
                <div className="border-t border-border px-2.5 py-2">
                    <div className="mb-1 text-[10px] text-muted-foreground">
                        {workingDiffLoadingKey
                            ? 'Loading diff preview...'
                            : staged.length === 0
                                ? 'No staged files to commit.'
                                : `Ready to commit ${staged.length} staged file(s).`}
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            value={commitMessage}
                            className="text-label"
                            placeholder="Commit message (optional)"
                            onChange={(e) => setCommitMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleCommit();
                                }
                            }}
                        />
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => void handleCommit()}
                            disabled={staged.length === 0 || isCommitting}
                            title="Commit staged changes"
                        >
                            {isCommitting ? 'Committing...' : 'Commit'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
