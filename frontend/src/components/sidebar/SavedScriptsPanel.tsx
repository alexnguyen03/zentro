import React, { useEffect, useState, useCallback } from 'react';
import { FileCode, Trash2, BookMarked } from 'lucide-react';
import { useScriptStore } from '../../stores/scriptStore';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useProjectStore } from '../../stores/projectStore';
import { cn } from '../../lib/cn';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { Button, Input } from '../ui';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { SCRIPTS_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return '';
    }
}

export const SavedScriptsPanel: React.FC = () => {
    const { scripts, loadScripts, deleteScript, getContent } = useScriptStore();
    const { activeProfile } = useConnectionStore();
    const activeProject = useProjectStore((state) => state.activeProject);
    const { addTab, groups, setActiveGroupId, setActiveTabId } = useEditorStore();
    const [pendingDeleteScript, setPendingDeleteScript] = useState<{ id: string; name: string } | null>(null);
    const [scriptsPanelState, setScriptsPanelState] = useSidebarPanelState('primary', 'scripts', SCRIPTS_PANEL_STATE_DEFAULT);
    const search = scriptsPanelState.search;

    const projectId = activeProject?.id ?? '';
    const connectionName = activeProfile?.name ?? '';

    useEffect(() => {
        if (projectId && connectionName) {
            loadScripts(projectId, connectionName);
        }
    }, [connectionName, loadScripts, projectId]);

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
                const content = await getContent(projectId, connectionName, scriptId);
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
        [addTab, connectionName, getContent, groups, projectId, setActiveGroupId, setActiveTabId],
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

    const filtered = scripts.filter((script) => script.name.toLowerCase().includes(search.toLowerCase()));

    if (!projectId || !connectionName) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-muted-foreground">
                    <BookMarked size={24} className="opacity-30" />
                    <p className="m-0">No active connection</p>
                    <p className="m-0 text-[11px] opacity-60">Connect to a database to manage saved scripts</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
                <div className="flex-1 min-w-0">
                    <Input
                        inputSize="sm"
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
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-muted-foreground">
                        <FileCode size={24} className="opacity-30" />
                        <p className="m-0">{search ? 'No matches' : 'No saved scripts'}</p>
                        {!search && (
                            <p className="m-0 text-[11px] opacity-60">
                                Right-click a tab -&gt; &quot;Save Script&quot; to save your query
                            </p>
                        )}
                    </div>
                ) : (
                    filtered.map((script) => (
                        <div
                            key={script.id}
                            className="group flex items-center gap-1.5 border-b border-white/5 px-2.5 py-1.5 transition-colors duration-100 hover:bg-muted"
                            onClick={() => handleOpen(script.id, script.name)}
                            title={`Open "${script.name}" in new tab`}
                        >
                            <FileCode size={13} className="shrink-0 text-success opacity-70" />
                            <div className="flex-1 overflow-hidden">
                                <div className="text-xs font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{script.name}</div>
                                <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(String(script.updated_at ?? ''))}</div>
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
                    ))
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
