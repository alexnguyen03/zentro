import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, BookMarked, SplitSquareHorizontal } from 'lucide-react';
import { Tab } from '../../stores/editorStore';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

interface TabBarProps {
    groupId: string;
    tabs: Tab[];
    activeTabId: string | null;
    onActivate: (id: string) => void;
    onClose: (id: string) => void;
    onNewTab: () => void;
    onRename: (id: string, newName: string) => void;
    onSaveScript: (tabId: string, scriptName: string) => void;
    onSplit?: (tabId: string) => void;
}

interface ContextMenu {
    x: number;
    y: number;
    tabId: string;
}

// ── Sortable Tab Item ──────────────────────────────────────────────────
interface SortableTabItemProps {
    tab: Tab;
    groupId: string;
    isActive: boolean;
    renamingId: string | null;
    renameValue: string;
    renameInputRef: React.RefObject<HTMLInputElement>;
    onActivate: () => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onRenameChange: (val: string) => void;
    onRenameBlur: () => void;
    onRenameKeyDown: (e: React.KeyboardEvent) => void;
    onClose: () => void;
}

const SortableTabItem: React.FC<SortableTabItemProps> = ({
    tab, groupId, isActive, renamingId, renameValue, renameInputRef,
    onActivate, onDoubleClick, onContextMenu, onRenameChange, onRenameBlur, onRenameKeyDown, onClose
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: tab.id,
        data: {
            type: 'Tab',
            tab,
            groupId,
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 100 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={onActivate}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {renamingId === tab.id ? (
                <input
                    ref={renameInputRef}
                    className="tab-rename-input"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onBlur={onRenameBlur}
                    onKeyDown={onRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            ) : (
                <span className="tab-label" title={tab.name}>{tab.name}</span>
            )}
            {tab.isRunning && <span className="tab-running-dot" title="Running" />}
            <button
                className="tab-close-btn"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                title="Close tab"
            >
                <X size={12} />
            </button>
        </div>
    );
};

// ── Tab Bar ─────────────────────────────────────────────────────────────
export const TabBar: React.FC<TabBarProps> = ({
    groupId,
    tabs,
    activeTabId,
    onActivate,
    onClose,
    onNewTab,
    onRename,
    onSaveScript,
    onSplit,
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [savePrompt, setSavePrompt] = useState<{ tabId: string } | null>(null);
    const [saveNameValue, setSaveNameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const saveInputRef = useRef<HTMLInputElement>(null);

    // Make the empty space droppable for cross-group drags to an empty pane
    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `group-drop-${groupId}`,
        data: {
            type: 'Group',
            groupId,
        }
    });

    // Auto-focus rename input
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    // Auto-focus save prompt input
    useEffect(() => {
        if (savePrompt && saveInputRef.current) {
            saveInputRef.current.focus();
            saveInputRef.current.select();
        }
    }, [savePrompt]);

    // Listen to Ctrl+S custom event from QueryGroup/QueryTabs
    useEffect(() => {
        const handler = (e: Event) => {
            const tabId = (e as CustomEvent<string>).detail;
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                setSaveNameValue(tab.name ?? '');
                setSavePrompt({ tabId });
            }
        };
        window.addEventListener('zentro:save-script', handler);
        return () => window.removeEventListener('zentro:save-script', handler);
    }, [tabs]);

    // Listen to F2 rename custom hook
    useEffect(() => {
        const handler = (e: Event) => {
            const tabId = (e as CustomEvent<string>).detail;
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                setRenamingId(tab.id);
                setRenameValue(tab.name);
            }
        };
        window.addEventListener('zentro:rename-tab', handler);
        return () => window.removeEventListener('zentro:rename-tab', handler);
    }, [tabs]);

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
            <div className="tab-bar-tabs" ref={setDroppableRef}>
                <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                    {tabs.map(tab => (
                        <SortableTabItem
                            key={tab.id}
                            tab={tab}
                            groupId={groupId}
                            isActive={tab.id === activeTabId}
                            renamingId={renamingId}
                            renameValue={renameValue}
                            renameInputRef={renameInputRef}
                            onActivate={() => onActivate(tab.id)}
                            onDoubleClick={() => startRename(tab)}
                            onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                            onRenameChange={setRenameValue}
                            onRenameBlur={commitRename}
                            onRenameKeyDown={handleTabKeyDown}
                            onClose={() => onClose(tab.id)}
                        />
                    ))}
                </SortableContext>
            </div>

            <button className="tab-new-btn" onClick={onNewTab} title="New Tab (Ctrl+T)">
                <Plus size={14} />
            </button>

            {/* Save script prompt */}
            {savePrompt && (
                <div
                    className="tab-save-prompt"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        ref={saveInputRef}
                        className="tab-save-input"
                        placeholder="Script name…"
                        value={saveNameValue}
                        onChange={(e) => setSaveNameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && saveNameValue.trim()) {
                                onSaveScript(savePrompt.tabId, saveNameValue.trim());
                                setSavePrompt(null);
                                setSaveNameValue('');
                            }
                            if (e.key === 'Escape') {
                                setSavePrompt(null);
                                setSaveNameValue('');
                            }
                        }}
                    />
                    <button
                        className="tab-save-confirm"
                        onClick={() => {
                            if (saveNameValue.trim()) {
                                onSaveScript(savePrompt.tabId, saveNameValue.trim());
                                setSavePrompt(null);
                                setSaveNameValue('');
                            }
                        }}
                    >
                        Save
                    </button>
                    <button
                        className="tab-save-cancel"
                        onClick={() => { setSavePrompt(null); setSaveNameValue(''); }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="context-menu-item"
                        onClick={() => { const t = tabs.find(t => t.id === contextMenu!.tabId); if (t) startRename(t); setContextMenu(null); }}
                    >
                        Rename
                    </div>

                    {onSplit && (
                        <div
                            className="context-menu-item"
                            onClick={() => { onSplit(contextMenu!.tabId); setContextMenu(null); }}
                        >
                            <SplitSquareHorizontal size={11} style={{ marginRight: 5 }} />
                            Split Right
                        </div>
                    )}

                    <div
                        className="context-menu-item context-menu-item--save"
                        onClick={() => {
                            const tab = tabs.find(t => t.id === contextMenu!.tabId);
                            setSaveNameValue(tab?.name ?? '');
                            setSavePrompt({ tabId: contextMenu!.tabId });
                            setContextMenu(null);
                        }}
                    >
                        <BookMarked size={11} style={{ marginRight: 5 }} />
                        Save Script
                    </div>

                    <div className="context-menu-separator" />

                    <div className="context-menu-item" onClick={() => { onClose(contextMenu!.tabId); setContextMenu(null); }}>
                        Close
                    </div>
                    <div className="context-menu-item" onClick={() => closeOthers(contextMenu!.tabId)}>
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
