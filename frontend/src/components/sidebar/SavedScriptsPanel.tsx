import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FileCode, Search, Trash2, BookMarked } from 'lucide-react';
import { useScriptStore } from '../../stores/scriptStore';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import './SavedScriptsPanel.css';

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
    const { addTab, setActiveTabId } = useEditorStore();
    const [search, setSearch] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const connectionName = activeProfile?.name ?? '';

    // Load scripts whenever active connection changes
    useEffect(() => {
        if (connectionName) {
            loadScripts(connectionName);
        }
    }, [connectionName, loadScripts]);

    const handleOpen = useCallback(async (scriptId: string, scriptName: string) => {
        if (!connectionName) return;
        try {
            const content = await getContent(connectionName, scriptId);
            const id = addTab({ name: scriptName, query: content });
            setActiveTabId(id);
        } catch (e) {
            console.error('Failed to load script content', e);
        }
    }, [connectionName, getContent, addTab, setActiveTabId]);

    const handleDelete = useCallback(async (scriptId: string) => {
        if (confirmDelete !== scriptId) {
            setConfirmDelete(scriptId);
            return;
        }
        try {
            await deleteScript(connectionName, scriptId);
        } catch (e) {
            console.error('Failed to delete script', e);
        }
        setConfirmDelete(null);
    }, [confirmDelete, connectionName, deleteScript]);

    const filtered = scripts.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    if (!connectionName) {
        return (
            <div className="scripts-panel">
                <div className="scripts-empty">
                    <BookMarked size={24} opacity={0.3} />
                    <p>No active connection</p>
                    <p className="scripts-empty-hint">Connect to a database to manage saved scripts</p>
                </div>
            </div>
        );
    }

    return (
        <div className="scripts-panel">
            <div className="scripts-toolbar">
                <div className="scripts-search-wrap">
                    <Search size={11} className="scripts-search-icon" />
                    <input
                        className="scripts-search"
                        placeholder="Filter scripts…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="scripts-list">
                {filtered.length === 0 ? (
                    <div className="scripts-empty">
                        <FileCode size={24} opacity={0.3} />
                        <p>{search ? 'No matches' : 'No saved scripts'}</p>
                        {!search && (
                            <p className="scripts-empty-hint">
                                Right-click a tab → "Save Script" to save your query
                            </p>
                        )}
                    </div>
                ) : (
                    filtered.map(script => (
                        <div
                            key={script.id}
                            className="script-item"
                            onClick={() => handleOpen(script.id, script.name)}
                            title={`Open "${script.name}" in new tab`}
                            onMouseLeave={() => setConfirmDelete(null)}
                        >
                            <FileCode size={13} className="script-item-icon" />
                            <div className="script-item-body">
                                <div className="script-item-name">{script.name}</div>
                                <div className="script-item-date">{formatDate(script.updated_at as any)}</div>
                            </div>
                            <button
                                className="script-item-delete"
                                title={confirmDelete === script.id ? 'Click again to confirm' : 'Delete script'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(script.id);
                                }}
                            >
                                <Trash2 size={12} style={confirmDelete === script.id ? { color: 'var(--error-color)' } : {}} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
