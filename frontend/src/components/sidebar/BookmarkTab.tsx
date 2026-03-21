import React from 'react';
import { ChevronDown, ChevronRight, RefreshCcw } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { bookmarkKeyFromTabName, useBookmarkStore } from '../../stores/bookmarkStore';
import { useScriptStore } from '../../stores/scriptStore';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
import { cn } from '../../lib/cn';

type BookmarkItem = {
    bookmarkKey: string;
    tabName: string;
    line: number;
    id?: string;
};

type BookmarkGroup = {
    bookmarkKey: string;
    tabName: string;
    items: BookmarkItem[];
};

export const BookmarkTab: React.FC = () => {
    const { groups, activeGroupId, setActiveTabId, setActiveGroupId, addTab } = useEditorStore();
    const { activeProfile } = useConnectionStore();
    const { byTab, byKey, labelByKey, loadBookmarks, hydrateTabFromKey } = useBookmarkStore();
    const { activeConnection: activeScriptConnection, loadScripts, getContent } = useScriptStore();
    const [scope, setScope] = React.useState<'current' | 'global'>('current');
    const [collapsedKeys, setCollapsedKeys] = React.useState<Record<string, boolean>>({});

    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTabId = activeGroup?.activeTabId || '';
    const bookmarks = byTab[activeTabId] || [];

    const queryTabs = React.useMemo(
        () =>
            groups.flatMap((g) =>
                g.tabs
                    .filter((t) => t.type === TAB_TYPE.QUERY)
                    .map((t) => ({ groupId: g.id, tabId: t.id, tabName: t.name }))
            ),
        [groups]
    );

    const globalBookmarks = React.useMemo(() => {
        const out: BookmarkItem[] = [];
        for (const [bookmarkKey, list] of Object.entries(byKey)) {
            const tabName = labelByKey[bookmarkKey] || bookmarkKey;
            for (const b of list) {
                out.push({ bookmarkKey, tabName, line: b.line, id: b.id });
            }
        }
        return out.sort((a, b) => {
            if (a.tabName !== b.tabName) return a.tabName.localeCompare(b.tabName);
            return a.line - b.line;
        });
    }, [byKey, labelByKey]);

    const groupedGlobalBookmarks = React.useMemo<BookmarkGroup[]>(() => {
        const groupsByKey = new Map<string, BookmarkGroup>();

        for (const item of globalBookmarks) {
            const existing = groupsByKey.get(item.bookmarkKey);
            if (existing) {
                existing.items.push(item);
                continue;
            }
            groupsByKey.set(item.bookmarkKey, {
                bookmarkKey: item.bookmarkKey,
                tabName: item.tabName,
                items: [item],
            });
        }

        return Array.from(groupsByKey.values()).sort((a, b) => a.tabName.localeCompare(b.tabName));
    }, [globalBookmarks]);

    const collapseAllState = React.useMemo(() => {
        if (scope !== 'global' || groupedGlobalBookmarks.length === 0) return 'none';
        const expandedCount = groupedGlobalBookmarks.filter((group) => collapsedKeys[group.bookmarkKey] === false).length;
        if (expandedCount === 0) return 'all';
        if (expandedCount === groupedGlobalBookmarks.length) return 'none';
        return 'mixed';
    }, [collapsedKeys, groupedGlobalBookmarks, scope]);

    const dispatchJumpWithRetry = React.useCallback((tabId: string, line: number) => {
        const targetLine = Math.max(1, line);
        [0, 50, 120, 250].forEach((delay) => {
            window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent(DOM_EVENT.JUMP_TO_LINE_ACTION, { detail: { tabId, line: targetLine } }));
            }, delay);
        });
    }, []);

    const refreshCurrent = React.useCallback(() => {
        if (activeProfile?.name && activeTabId) {
            loadBookmarks(activeProfile.name, activeTabId).catch((err) => console.error('load bookmarks failed', err));
        }
    }, [activeProfile?.name, activeTabId, loadBookmarks]);

    const refreshAll = React.useCallback(() => {
        if (!activeProfile?.name) return;
        queryTabs.forEach((t) => {
            loadBookmarks(activeProfile.name!, t.tabId).catch((err) => console.error('load bookmarks failed', err));
        });
    }, [activeProfile?.name, queryTabs, loadBookmarks]);

    React.useEffect(() => {
        refreshCurrent();
    }, [refreshCurrent]);

    const restoreAndOpen = React.useCallback(
        async (item: BookmarkItem) => {
            const existing = queryTabs.find((tab) => bookmarkKeyFromTabName(tab.tabName) === item.bookmarkKey);
            if (existing) {
                hydrateTabFromKey(existing.tabId, item.bookmarkKey);
                setActiveGroupId(existing.groupId);
                setActiveTabId(existing.tabId, existing.groupId);
                if (activeProfile?.name) {
                    loadBookmarks(activeProfile.name, existing.tabId).catch((err) => {
                        console.error('refresh bookmarks for existing tab failed', err);
                    });
                }
                dispatchJumpWithRetry(existing.tabId, item.line);
                return;
            }

            const connectionName = activeProfile?.name;
            let restoredQuery = '\n'.repeat(Math.max(0, Math.max(1, item.line) - 1));

            if (connectionName) {
                try {
                    if (activeScriptConnection !== connectionName) {
                        await loadScripts(connectionName);
                    }

                    const currentScripts = useScriptStore.getState().scripts;
                    const targetName = item.tabName.trim().toLowerCase();
                    const matchedScript = [...currentScripts]
                        .filter((script) => script.name.trim().toLowerCase() === targetName)
                        .sort((a, b) => {
                            const at = Date.parse((a.updated_at as string) || (a.created_at as string) || '');
                            const bt = Date.parse((b.updated_at as string) || (b.created_at as string) || '');
                            return bt - at;
                        })[0];

                    if (matchedScript?.id) {
                        const savedContent = await getContent(connectionName, matchedScript.id);
                        if (typeof savedContent === 'string' && savedContent.length > 0) {
                            restoredQuery = savedContent;
                        }
                    }
                } catch (err) {
                    console.error('failed to restore query content from script store', err);
                }
            }

            const lineCount = Math.max(1, item.line);
            const currentLineCount = restoredQuery.split('\n').length;
            if (currentLineCount < lineCount) {
                restoredQuery += '\n'.repeat(lineCount - currentLineCount);
            }

            const restoredTabId = addTab({
                name: item.tabName,
                type: TAB_TYPE.QUERY,
                query: restoredQuery || '\n'.repeat(Math.max(0, lineCount - 1)),
            });

            hydrateTabFromKey(restoredTabId, item.bookmarkKey);
            if (connectionName) {
                loadBookmarks(connectionName, restoredTabId).catch((err) => {
                    console.error('load bookmarks for restored tab failed', err);
                });
            }

            const targetGroupId = useEditorStore.getState().activeGroupId;
            if (targetGroupId) {
                setActiveGroupId(targetGroupId);
                setActiveTabId(restoredTabId, targetGroupId);
            }

            dispatchJumpWithRetry(restoredTabId, lineCount);
        },
        [
            activeProfile?.name,
            activeScriptConnection,
            addTab,
            dispatchJumpWithRetry,
            getContent,
            hydrateTabFromKey,
            loadBookmarks,
            loadScripts,
            queryTabs,
            setActiveGroupId,
            setActiveTabId,
        ]
    );

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-1 border-b border-border/50 mb-1">
                <div className="flex items-center gap-1">
                    <button
                        className={cn(
                            'px-2 py-0.5 text-[11px] rounded-md border border-border bg-transparent cursor-pointer transition-colors',
                            scope === 'current' ? 'text-text-primary bg-bg-tertiary' : 'text-text-secondary hover:text-text-primary'
                        )}
                        onClick={() => setScope('current')}
                    >
                        Current ({bookmarks.length})
                    </button>
                    <button
                        className={cn(
                            'px-2 py-0.5 text-[11px] rounded-md border border-border bg-transparent cursor-pointer transition-colors',
                            scope === 'global' ? 'text-text-primary bg-bg-tertiary' : 'text-text-secondary hover:text-text-primary'
                        )}
                        onClick={() => setScope('global')}
                    >
                        Global ({globalBookmarks.length})
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    {scope === 'global' && groupedGlobalBookmarks.length > 0 && (
                        <button
                            className="bg-transparent border-none text-text-muted cursor-pointer px-1.5 py-1 rounded-md flex items-center justify-center transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
                            title={collapseAllState === 'all' ? 'Expand all bookmark groups' : 'Collapse all bookmark groups'}
                            onClick={() => {
                                setCollapsedKeys((prev) => {
                                    const next = { ...prev };
                                    const shouldCollapse = collapseAllState !== 'all';
                                    groupedGlobalBookmarks.forEach((group) => {
                                        next[group.bookmarkKey] = shouldCollapse;
                                    });
                                    return next;
                                });
                            }}
                        >
                            {collapseAllState === 'all' ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        </button>
                    )}

                    <button
                        className="bg-transparent border-none text-text-muted cursor-pointer px-1.5 py-1 rounded-md flex items-center justify-center transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
                        title={scope === 'global' ? 'Refresh global bookmarks' : 'Refresh current tab bookmarks'}
                        onClick={() => {
                            if (scope === 'global') refreshAll();
                            else refreshCurrent();
                        }}
                    >
                        <RefreshCcw size={13} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
                {scope === 'current' ? (
                    bookmarks.length === 0 ? (
                        <div className="text-[12px] text-text-secondary px-2 py-2 rounded-sm">No bookmarks for this tab.</div>
                    ) : (
                        <div className="space-y-0.5">
                            {bookmarks.map((item) => (
                                <button
                                    key={item.id || item.line}
                                    className="flex items-center gap-1.5 w-full text-left px-2 py-1 cursor-pointer text-[12px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden border-none bg-transparent"
                                    onClick={() => {
                                        window.dispatchEvent(
                                            new CustomEvent(DOM_EVENT.JUMP_TO_LINE_ACTION, { detail: { tabId: activeTabId, line: item.line } })
                                        );
                                    }}
                                >
                                    <span className="w-[13px] shrink-0 inline-block" />
                                    <span className="truncate flex-1">Line {item.line}</span>
                                    <span className="ml-auto text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">#saved</span>
                                </button>
                            ))}
                        </div>
                    )
                ) : groupedGlobalBookmarks.length === 0 ? (
                    <div className="text-[12px] text-text-secondary px-2 py-2 rounded-sm">No global bookmarks yet.</div>
                ) : (
                    <div className="space-y-1">
                        {groupedGlobalBookmarks.map((group) => {
                            const isCollapsed = collapsedKeys[group.bookmarkKey] !== false;

                            return (
                                <section key={group.bookmarkKey} className="overflow-hidden">
                                    <div className="flex items-stretch">
                                        <button
                                            className="flex items-center justify-center shrink-0 w-[18px] border-none bg-transparent text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                                            title={isCollapsed ? 'Expand group' : 'Collapse group'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCollapsedKeys((prev) => ({
                                                    ...prev,
                                                    [group.bookmarkKey]: !isCollapsed,
                                                }));
                                            }}
                                        >
                                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                        </button>

                                        <button
                                            className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[13px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden border-none bg-transparent"
                                            onClick={() => {
                                                void restoreAndOpen({
                                                    bookmarkKey: group.bookmarkKey,
                                                    tabName: group.tabName,
                                                    line: group.items[0]?.line ?? 1,
                                                });
                                            }}
                                        >
                                            <span className="truncate flex-1 font-medium">{group.tabName}</span>
                                            <span className="ml-auto text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                                {group.items.length}
                                            </span>
                                        </button>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="pl-4">
                                            <div className="relative pl-4">
                                                <div className="absolute left-[10px] top-0 bottom-1 w-px bg-border/70" />
                                                {group.items.map((item, index) => (
                                                    <button
                                                        key={`${group.bookmarkKey}-${item.id || item.line}`}
                                                        className={cn(
                                                            'group flex items-center gap-1.5 w-full text-left px-2 py-1 cursor-pointer text-[12px] text-text-primary select-none rounded-sm transition-colors duration-100 hover:bg-bg-tertiary outline-none overflow-hidden border-none bg-transparent',
                                                            index === 0 && 'mt-0'
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void restoreAndOpen(item);
                                                        }}
                                                    >
                                                        <span className="flex items-center gap-2 min-w-0">
                                                            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-success/10 text-success text-[10px] shrink-0">
                                                                {item.line}
                                                            </span>
                                                            <span className="truncate flex-1">Line {item.line}</span>
                                                        </span>
                                                        <span className="ml-auto text-[10px] text-text-secondary bg-bg-tertiary rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                                            #saved
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
