import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { DOM_EVENT } from '../../lib/constants';

export const BookmarkTab: React.FC = () => {
    const { groups, activeGroupId } = useEditorStore();
    const { activeProfile } = useConnectionStore();
    const { byTab, loadBookmarks } = useBookmarkStore();

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeTabId = activeGroup?.activeTabId || '';
    const bookmarks = byTab[activeTabId] || [];

    React.useEffect(() => {
        if (activeProfile?.name && activeTabId) {
            loadBookmarks(activeProfile.name, activeTabId).catch((err) => console.error('load bookmarks failed', err));
        }
    }, [activeProfile?.name, activeTabId, loadBookmarks]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-end pb-1 border-b border-border/50 mb-1">
                <button
                    className="bg-transparent border-none text-text-muted cursor-pointer px-1.25 py-1 rounded flex items-center justify-center transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
                    title="Refresh bookmarks"
                    onClick={() => {
                        if (activeProfile?.name && activeTabId) {
                            loadBookmarks(activeProfile.name, activeTabId).catch((err) => console.error('load bookmarks failed', err));
                        }
                    }}
                >
                    <RefreshCcw size={13} />
                </button>
            </div>

            <div className="flex-1 overflow-auto px-1 py-1">
                {bookmarks.length === 0 ? (
                    <div className="text-[11px] text-text-muted px-2 py-2">No bookmarks for this tab.</div>
                ) : (
                    bookmarks.map((item) => (
                        <button
                            key={item.id || item.line}
                            className="w-full text-left px-2 py-1.5 text-[11px] rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary border-none bg-transparent cursor-pointer mb-1"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent(DOM_EVENT.JUMP_TO_LINE_ACTION, { detail: { tabId: activeTabId, line: item.line } }));
                            }}
                        >
                            Line {item.line}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
