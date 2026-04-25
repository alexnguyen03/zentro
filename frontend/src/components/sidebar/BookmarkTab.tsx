import React from 'react';
import { BookMarked, Bookmark, ChevronDown, ChevronRight, RefreshCcw, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { bookmarkKeyFromTabName, bookmarkLabelFromKey, getBookmarkScopeID, useBookmarkStore } from '../../stores/bookmarkStore';
import { useScriptStore } from '../../stores/scriptStore';
import { useProjectStore } from '../../stores/projectStore';
import { DOM_EVENT, TAB_TYPE } from '../../lib/constants';
import { emitCommand } from '../../lib/commandBus';
import { cn } from '../../lib/cn';
import { DeleteBookmark } from '../../services/bookmarkService';
import { Button } from '../ui';
import { useSidebarPanelState } from '../../stores/sidebarUiStore';
import { BOOKMARK_PANEL_STATE_DEFAULT } from './sidebarPanelStateDefaults';

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
    const activeProject = useProjectStore((state) => state.activeProject);
    const { activeScopeID, byTab, byKey, labelByKey, loadBookmarks, loadAllBookmarksForScope, hydrateTabFromKey, toggleLine } = useBookmarkStore();
    const { activeConnection: activeScriptConnection, activeProjectId: activeScriptProjectId, loadScripts, getContent } = useScriptStore();
    const [bookmarkPanelState, setBookmarkPanelState] = useSidebarPanelState('secondary', 'bookmark', BOOKMARK_PANEL_STATE_DEFAULT);
    const scope = bookmarkPanelState.scope;
    const collapsedKeys = bookmarkPanelState.collapsedKeys;

    const updateBookmarkPanelState = React.useCallback((next: Partial<typeof bookmarkPanelState>) => {
        setBookmarkPanelState((current) => ({
            ...current,
            ...next,
        }));
    }, [setBookmarkPanelState]);

    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeTabId = activeGroup?.activeTabId || '';
    const connectionName = activeProfile?.name || '';
    const currentScopeID = connectionName ? getBookmarkScopeID(connectionName) : null;
    const isScopeAligned = Boolean(currentScopeID && activeScopeID === currentScopeID);
    const scopedByTab = isScopeAligned ? byTab : {};
    const scopedByKey = isScopeAligned ? byKey : {};
    const scopedLabelByKey = isScopeAligned ? labelByKey : {};
    const bookmarks = scopedByTab[activeTabId] || [];

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
        for (const [bookmarkKey, list] of Object.entries(scopedByKey)) {
            const tabName = scopedLabelByKey[bookmarkKey] || bookmarkLabelFromKey(bookmarkKey);
            for (const b of list) {
                out.push({ bookmarkKey, tabName, line: b.line, id: b.id });
            }
        }
        return out.sort((a, b) => {
            if (a.tabName !== b.tabName) return a.tabName.localeCompare(b.tabName);
            return a.line - b.line;
        });
    }, [scopedByKey, scopedLabelByKey]);

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
                emitCommand(DOM_EVENT.JUMP_TO_LINE_ACTION, { tabId, line: targetLine });
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
        loadAllBookmarksForScope(activeProfile.name).catch((err) => console.error('load all bookmarks failed', err));
    }, [activeProfile?.name, loadAllBookmarksForScope]);

    const removeCurrentBookmark = React.useCallback(async (line: number) => {
        if (!activeProfile?.name || !activeTabId) return;
        try {
            await toggleLine(activeProfile.name, activeTabId, line);
        } catch (err) {
            console.error('remove current bookmark failed', err);
        }
    }, [activeProfile?.name, activeTabId, toggleLine]);

    const removeGlobalBookmark = React.useCallback(async (item: BookmarkItem) => {
        if (!activeProfile?.name) return;
        try {
            const scopedConnectionID = getBookmarkScopeID(activeProfile.name);
            await DeleteBookmark(scopedConnectionID, item.bookmarkKey, item.line);
            refreshAll();
            refreshCurrent();
        } catch (err) {
            console.error('remove global bookmark failed', err);
        }
    }, [activeProfile?.name, refreshAll, refreshCurrent]);

    React.useEffect(() => {
        refreshCurrent();
    }, [refreshCurrent]);

    React.useEffect(() => {
        if (!activeProfile?.name) return;
        refreshAll();
    }, [activeProfile?.name, refreshAll]);

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
            const projectId = activeProject?.id;
            let restoredQuery = '\n'.repeat(Math.max(0, Math.max(1, item.line) - 1));

            if (projectId && connectionName) {
                try {
                    if (activeScriptProjectId !== projectId || activeScriptConnection !== connectionName) {
                        await loadScripts(projectId, connectionName);
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
                        const savedContent = await getContent(projectId, connectionName, matchedScript.id);
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
            activeProject?.id,
            activeScriptConnection,
            activeScriptProjectId,
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

    const scopeOptions = React.useMemo(() => ([
        {
            key: 'current' as const,
            label: 'Current',
            count: bookmarks.length,
            icon: Bookmark,
        },
        {
            key: 'global' as const,
            label: 'Global',
            count: globalBookmarks.length,
            icon: BookMarked,
        },
    ]), [bookmarks.length, globalBookmarks.length]);

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-1.5 px-2 py-1 shrink-0">
                <div className="flex items-center gap-1">
                    {scopeOptions.map((scopeOption) => {
                        const ScopeIcon = scopeOption.icon;
                        return (
                            <Button
                                key={scopeOption.key}
                                variant="ghost"
                                type="button"
                                className={cn(
                                    '!text-small text-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)]',
                                    scope === scopeOption.key && 'bg-[var(--state-active-bg)] text-foreground',
                                )}
                                onClick={() => updateBookmarkPanelState({ scope: scopeOption.key })}
                            >
                                <ScopeIcon size={12} className="opacity-80 shrink-0" />
                                <span className="truncate">{scopeOption.label}</span>
                                <span className="text-label text-muted-foreground bg-muted rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                    {scopeOption.count}
                                </span>
                            </Button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-1.5">
                    {scope === 'global' && groupedGlobalBookmarks.length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 text-muted-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)] hover:text-foreground"
                            title={collapseAllState === 'all' ? 'Expand all bookmark groups' : 'Collapse all bookmark groups'}
                            onClick={() => {
                                updateBookmarkPanelState({
                                    collapsedKeys: (() => {
                                        const next = { ...collapsedKeys };
                                        const shouldCollapse = collapseAllState !== 'all';
                                        groupedGlobalBookmarks.forEach((group) => {
                                            next[group.bookmarkKey] = shouldCollapse;
                                        });
                                        return next;
                                    })(),
                                });
                            }}
                        >
                            {collapseAllState === 'all' ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        </Button>
                    )}

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 text-muted-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)] hover:text-foreground"
                        title={scope === 'global' ? 'Refresh global bookmarks' : 'Refresh current tab bookmarks'}
                        onClick={() => {
                            if (scope === 'global') refreshAll();
                            else refreshCurrent();
                        }}
                    >
                        <RefreshCcw size={13} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-0.5">
                {scope === 'current' ? (
                    bookmarks.length === 0 ? (
                        <div className="flex items-center gap-1.5 px-1.5 py-1 text-small text-muted-foreground rounded-sm">
                            No bookmarks for this tab.
                        </div>
                    ) : (
                        <div>
                            {bookmarks.map((item) => (
                                <Button
                                    key={item.id || item.line}
                                    type="button"
                                    variant="ghost"
                                    className="group h-6 w-full justify-start gap-1.5 overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-small text-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)]"
                                    onClick={() => {
                                        emitCommand(DOM_EVENT.JUMP_TO_LINE_ACTION, { tabId: activeTabId, line: item.line });
                                    }}
                                >
                                    <span className="w-[13px] shrink-0 inline-block" />
                                    <Bookmark size={12} className="opacity-80 shrink-0" />
                                    <span className="truncate flex-1">Line {item.line}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                        title={`Remove bookmark at line ${item.line}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void removeCurrentBookmark(item.line);
                                        }}
                                    >
                                        <Trash2 size={12} />
                                    </Button>
                                </Button>
                            ))}
                        </div>
                    )
                ) : groupedGlobalBookmarks.length === 0 ? (
                    <div className="flex items-center gap-1.5 px-1.5 py-1 text-small text-muted-foreground rounded-sm">
                        No global bookmarks yet.
                    </div>
                ) : (
                    <div>
                        {groupedGlobalBookmarks.map((group) => {
                            const isCollapsed = collapsedKeys[group.bookmarkKey] !== false;

                            return (
                                <section key={group.bookmarkKey}>
                                    <div
                                        className="group h-6 flex items-center gap-1 px-1.5 text-small rounded-sm text-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)]"
                                        onClick={() => {
                                            void restoreAndOpen({
                                                bookmarkKey: group.bookmarkKey,
                                                tabName: group.tabName,
                                                line: group.items[0]?.line ?? 1,
                                            });
                                        }}
                                    >
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 p-0 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                                            title={isCollapsed ? 'Expand group' : 'Collapse group'}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                updateBookmarkPanelState({
                                                    collapsedKeys: {
                                                        ...collapsedKeys,
                                                        [group.bookmarkKey]: !isCollapsed,
                                                    },
                                                });
                                            }}
                                        >
                                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                        </Button>
                                        <BookMarked size={12} className="opacity-80 shrink-0" />
                                        <span className="truncate flex-1">{group.tabName}</span>
                                        <span className="text-label text-muted-foreground bg-muted rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                            {group.items.length}
                                        </span>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="pl-3">
                                            {group.items.map((item) => (
                                                <Button
                                                    key={`${group.bookmarkKey}-${item.id || item.line}`}
                                                    type="button"
                                                    variant="ghost"
                                                    className="group h-6 w-full justify-start gap-1.5 overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-small text-foreground transition-colors duration-fast hover:bg-[var(--state-hover-bg)]"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void restoreAndOpen(item);
                                                    }}
                                                >
                                                    <span className="w-[13px] shrink-0 inline-block" />
                                                    <Bookmark size={12} className="opacity-80 shrink-0" />
                                                    <span className="truncate flex-1">Line {item.line}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 p-0 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                                        title={`Remove bookmark at line ${item.line}`}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void removeGlobalBookmark(item);
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </Button>
                                            ))}
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
