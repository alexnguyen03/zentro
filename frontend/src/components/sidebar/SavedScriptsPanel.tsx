import React, { useEffect, useState, useCallback } from 'react';
import { FileCode, Search, Trash2, BookMarked } from 'lucide-react';
import { useScriptStore } from '../../stores/scriptStore';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useProjectStore } from '../../stores/projectStore';
import { cn } from '../../lib/cn';
import { ConfirmationModal } from '../ui/ConfirmationModal';

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
    const [search, setSearch] = useState('');
    const [pendingDeleteScript, setPendingDeleteScript] = useState<{ id: string; name: string } | null>(null);

    const projectId = activeProject?.id ?? '';
    const connectionName = activeProfile?.name ?? '';

    // Load scripts whenever active connection changes
    useEffect(() => {
        if (projectId && connectionName) {
            loadScripts(projectId, connectionName);
        }
    }, [connectionName, loadScripts, projectId]);

    const handleOpen = useCallback(async (scriptId: string, scriptName: string) => {
        if (!projectId || !connectionName) return;
        const existing = groups.find((group) =>
            group.tabs.some((tab) => tab.type === 'query' && tab.context?.savedScriptId === scriptId)
        );
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
        } catch (e) {
            console.error('Failed to load script content', e);
        }
    }, [addTab, connectionName, getContent, groups, projectId, setActiveGroupId, setActiveTabId]);

    const handleDelete = useCallback(async (scriptId: string) => {
        try {
            if (!projectId || !connectionName) return;
            await deleteScript(projectId, connectionName, scriptId);
        } catch (e) {
            console.error('Failed to delete script', e);
        }
        setPendingDeleteScript(null);
    }, [connectionName, deleteScript, projectId]);

    const filtered = scripts.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    if (!projectId || !connectionName) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-text-secondary text-xs text-center">
                    <BookMarked size={24} className="opacity-30" />
                    <p className="m-0">No active connection</p>
                    <p className="m-0 text-[11px] opacity-60">Connect to a database to manage saved scripts</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0 bg-bg-secondary">
                <div className="flex-1 relative flex items-center min-w-0">
                    <Search size={11} className="absolute left-1.5 text-text-secondary pointer-events-none" />
                    <input
                        className="w-full bg-bg-primary border border-border text-text-primary text-[11px] py-1 pl-[22px] pr-1.5 rounded-md outline-none focus:border-success transition-colors"
                        placeholder="Filter scripts…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-text-secondary text-xs text-center">
                        <FileCode size={24} className="opacity-30" />
                        <p className="m-0">{search ? 'No matches' : 'No saved scripts'}</p>
                        {!search && (
                            <p className="m-0 text-[11px] opacity-60">
                                Right-click a tab → "Save Script" to save your query
                            </p>
                        )}
                    </div>
                ) : (
                    filtered.map(script => (
                        <div
                            key={script.id}
                            className="group flex items-center px-2.5 py-1.5 border-b border-white/5 cursor-pointer transition-colors duration-100 gap-1.5 hover:bg-bg-tertiary"
                            onClick={() => handleOpen(script.id, script.name)}
                            title={`Open "${script.name}" in new tab`}
                        >
                            <FileCode size={13} className="text-success shrink-0 opacity-70" />
                            <div className="flex-1 overflow-hidden">
                                <div className="text-xs text-text-primary whitespace-nowrap overflow-hidden text-ellipsis font-medium">{script.name}</div>
                                <div className="text-[10px] text-text-secondary mt-0.5">{formatDate(String(script.updated_at ?? ''))}</div>
                            </div>
                            <button
                                className={cn(
                                    "bg-transparent border-none text-text-secondary cursor-pointer p-[3px] rounded-md flex items-center shrink-0 transition-all duration-100 hover:text-error hover:bg-[#f48771]/10",
                                    "opacity-0 group-hover:opacity-100"
                                )}
                                title='Delete script'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingDeleteScript({ id: script.id, name: script.name });
                                }}
                            >
                                <Trash2 size={12} />
                            </button>
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
                variant="danger"
            />
        </div>
    );
};
