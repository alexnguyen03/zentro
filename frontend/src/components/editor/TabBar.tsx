import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { Tab } from '../../stores/editorStore';

interface TabBarProps {
    tabs: Tab[];
    activeTabId: string | null;
    onActivate: (id: string) => void;
    onClose: (id: string) => void;
    onNewTab: () => void;
    onRename: (id: string, newName: string) => void;
}

interface ContextMenu {
    x: number;
    y: number;
    tabId: string;
}

export const TabBar: React.FC<TabBarProps> = ({
    tabs,
    activeTabId,
    onActivate,
    onClose,
    onNewTab,
    onRename,
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus rename input
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenu(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    const startRename = useCallback((tab: Tab) => {
        setRenamingId(tab.id);
        setRenameValue(tab.name);
    }, []);

    const commitRename = useCallback(() => {
        if (renamingId && renameValue.trim()) {
            onRename(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    }, [renamingId, renameValue, onRename]);

    const handleTabKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenamingId(null);
    }, [commitRename]);

    const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    };

    const closeOthers = (tabId: string) => {
        tabs.filter(t => t.id !== tabId).forEach(t => onClose(t.id));
        setContextMenu(null);
    };

    const closeAll = () => {
        tabs.forEach(t => onClose(t.id));
        setContextMenu(null);
    };

    return (
        <div className="tab-bar">
            <div className="tab-bar-tabs">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
                        onClick={() => onActivate(tab.id)}
                        onDoubleClick={() => startRename(tab)}
                        onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                    >
                        {renamingId === tab.id ? (
                            <input
                                ref={renameInputRef}
                                className="tab-rename-input"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={handleTabKeyDown}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="tab-label" title={tab.name}>{tab.name}</span>
                        )}
                        {tab.isRunning && <span className="tab-running-dot" title="Running" />}
                        <button
                            className="tab-close-btn"
                            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                            title="Close tab"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>

            <button className="tab-new-btn" onClick={onNewTab} title="New Tab (Ctrl+T)">
                <Plus size={14} />
            </button>

            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="context-menu-item"
                        onClick={() => { const t = tabs.find(t => t.id === contextMenu.tabId); if (t) startRename(t); setContextMenu(null); }}
                    >
                        Rename
                    </div>
                    <div className="context-menu-item" onClick={() => { onClose(contextMenu.tabId); setContextMenu(null); }}>
                        Close
                    </div>
                    <div className="context-menu-separator" />
                    <div className="context-menu-item" onClick={() => closeOthers(contextMenu.tabId)}>
                        Close Others
                    </div>
                    <div className="context-menu-item" onClick={closeAll}>
                        Close All
                    </div>
                </div>
            )}
        </div>
    );
};
