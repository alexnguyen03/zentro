import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCode, Trash2, BookMarked } from 'lucide-react';
import { useScriptStore } from '../../stores/scriptStore';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useProjectStore } from '../../stores/projectStore';
import { cn } from '../../lib/cn';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '../ui';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { SCRIPTS_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';
import { highlightMatch, getMatchedLines, getFirstMeaningfulLine } from '../layout/ScriptSearchResults';

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return '';
    }
}

const ScriptPreviewPopover: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
                    {children}
                </div>
            </PopoverTrigger>
            <PopoverContent
                side="right"
                align="start"
                className="w-80 p-0 font-mono"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
            >
                <pre className="max-h-64 overflow-auto p-3 text-label text-foreground whitespace-pre-wrap break-all leading-relaxed">
                    {content}
                </pre>
            </PopoverContent>
        </Popover>
    );
};

export const SavedScriptsPanel: React.FC = () => {
    const { scripts, loadScripts, deleteScript, getContent } = useScriptStore();
    const { activeProfile } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const { addTab, groups, setActiveGroupId, setActiveTabId } = useEditorStore();
    const [pendingDeleteScript, setPendingDeleteScript] = useState<{ id: string; name: string } | null>(null);
    const [scriptsPanelState, setScriptsPanelState] = useSidebarPanelState('primary', 'scripts', SCRIPTS_PANEL_STATE_DEFAULT);
    const search = scriptsPanelState.search;

    const [contentCache, setContentCache] = useState<Map<string, string>>(new Map());

    const projectId = activeProject?.id ?? '';
    const connectionName = activeProfile?.name ?? '';

    useEffect(() => {
        if (projectId && connectionName) {
            loadScripts(projectId, connectionName);
        }
    }, [connectionName, loadScripts, projectId]);

    useEffect(() => {
        if (!projectId || !connectionName || scripts.length === 0) return;
        let cancelled = false;
        Promise.all(
            scripts.map(async (s) => [s.id, await getContent(projectId, connectionName, s.id)] as const),
        )
            .then((entries) => {
                if (!cancelled) setContentCache(new Map(entries));
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [scripts, projectId, connectionName, getContent]);

    const handleOpen = useCallback(
        async (scriptId: string, scriptName: string) => {
            if (!projectId || !connectionName) return;
            const existing = groups.find((group) => group.tabs.some((tab) => tab.type === 'query' && tab.context?.savedScriptId === scriptId));
            if (existing) {
                const existingTab = existing.tabs.find((tab) => tab.type === 'query' && tab.context?.savedScriptId === scriptId);
                if (existingTab) {
                    setActiveGroupId(existing.id);
                    setActiveTabId(existingTab.id, existing.id);
                    return;
                }
            }
            try {
                const content = contentCache.get(scriptId) ?? await getContent(projectId, connectionName, scriptId);
                addTab({
                    name: scriptName,
                    query: content,
                    context: {
                        savedScriptId: scriptId,
                        scriptProjectId: projectId,
                        scriptConnectionName: connectionName,
                    },
                });
            } catch (error) {
                console.error('Failed to load script content', error);
            }
        },
        [addTab, connectionName, contentCache, getContent, groups, projectId, setActiveGroupId, setActiveTabId],
    );

    const handleDelete = useCallback(
        async (scriptId: string) => {
            try {
                if (!projectId || !connectionName) return;
                await deleteScript(projectId, connectionName, scriptId);
            } catch (error) {
                console.error('Failed to delete script', error);
            }
            setPendingDeleteScript(null);
        },
        [connectionName, deleteScript, projectId],
    );

    const filtered = useMemo(() => {
        const kw = search.trim().toLowerCase();
        if (!kw) return scripts;
        return scripts.filter((s) => {
            if (s.name.toLowerCase().includes(kw)) return true;
            return (contentCache.get(s.id) ?? '').toLowerCase().includes(kw);
        });
    }, [scripts, contentCache, search]);

    if (!projectId || !connectionName) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-small text-muted-foreground">
                    <BookMarked size={24} className="opacity-30" />
                    <p className="m-0">No active connection</p>
                    <p className="m-0 text-label opacity-60">Connect to a database to manage saved scripts</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
                <div className="flex-1 min-w-0">
                    <Input
                        size="sm"
                        className="w-full px-2"
                        placeholder="Filter scripts..."
                        value={search}
                        onChange={(event) => setScriptsPanelState((state) => ({ ...state, search: event.target.value }))}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') setScriptsPanelState((state) => ({ ...state, search: '' }));
                        }}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-small text-muted-foreground">
                        <FileCode size={24} className="opacity-30" />
                        <p className="m-0">{search ? 'No matches' : 'No saved scripts'}</p>
                        {!search && (
                            <p className="m-0 text-label opacity-60">
                                Right-click a tab -&gt; &quot;Save Script&quot; to save your query
                            </p>
                        )}
                    </div>
                ) : (
                    filtered.map((script) => {
                        const content = contentCache.get(script.id);
                        const kw = search.trim();
                        const matchedLines = content && kw ? getMatchedLines(content, kw, 3) : [];
                        const preview = content && !matchedLines.length ? getFirstMeaningfulLine(content) : '';

                        return (
                            <div
                                key={script.id}
                                className="group flex cursor-pointer flex-col border-b border-white/5 px-2.5 py-1.5 transition-colors duration-100 hover:bg-muted"
                                onClick={() => void handleOpen(script.id, script.name)}
                                title={`Open "${script.name}" in new tab`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <FileCode size={13} className="shrink-0 text-success opacity-70" />
                                    <div className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
                                        {kw ? highlightMatch(script.name, kw) : script.name}
                                    </div>
                                    <div className="shrink-0 text-label text-muted-foreground">
                                        {formatDate(String(script.updated_at ?? ''))}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            'h-6 w-6 p-[3px] text-muted-foreground transition-all duration-100 hover:bg-destructive/10 hover:text-destructive',
                                            'shrink-0 opacity-0 group-hover:opacity-100',
                                        )}
                                        title="Delete script"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPendingDeleteScript({ id: script.id, name: script.name });
                                        }}
                                    >
                                        <Trash2 size={12} />
                                    </Button>
                                </div>

                                {matchedLines.length > 0 && (
                                    <div className="mt-0.5 flex flex-col gap-px pl-[17px]">
                                        {matchedLines.map((line, i) => (
                                            <div key={i} className="truncate font-mono text-label text-muted-foreground/80">
                                                {highlightMatch(line, kw)}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {preview && (
                                    <ScriptPreviewPopover content={content!}>
                                        <div
                                            className="mt-0.5 truncate pl-[17px] font-mono text-label text-muted-foreground/70"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {preview}
                                        </div>
                                    </ScriptPreviewPopover>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            <ConfirmationModal
                isOpen={Boolean(pendingDeleteScript)}
                onClose={() => setPendingDeleteScript(null)}
                onConfirm={() => {
                    if (!pendingDeleteScript?.id) return;
                    void handleDelete(pendingDeleteScript.id);
                }}
                title="Delete Saved Script"
                message={`Delete "${pendingDeleteScript?.name || 'this script'}"?`}
                description="This action permanently removes the saved SQL script."
                confirmLabel="Delete"
                variant="destructive"
            />
        </div>
    );
};
