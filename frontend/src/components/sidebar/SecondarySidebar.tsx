import React, { useRef, useState, useCallback } from 'react';
import { X, AlignLeft, Bookmark } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useLayoutStore } from '../../stores/layoutStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { useEditorStore } from '../../stores/editorStore';
import { RowDetailTab } from './RowDetailTab';
import { BookmarkTab } from './BookmarkTab';

type SidebarTab = 'detail' | 'bookmark';

export const SecondarySidebar: React.FC = () => {
    const { setShowRightSidebar } = useLayoutStore();
    const { groups, activeGroupId } = useEditorStore();
    const { byTab } = useBookmarkStore();

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeTabId = activeGroup?.activeTabId || '';
    const bookmarkCount = (byTab[activeTabId] || []).length;

    const [width, setWidth] = useState(300);
    const isResizing = useRef(false);
    const [activeTab, setActiveTab] = useState<SidebarTab>('detail');

    const startResizing = useCallback(() => { isResizing.current = true; }, []);
    const stopResizing = useCallback(() => { isResizing.current = false; }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 200 && newWidth < 1000) {
            setWidth(newWidth);
        }
    }, []);

    React.useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <>
            <div className="resizer right-resizer" onMouseDown={startResizing} style={{ cursor: 'e-resize' }} />
            <div className="sidebar flex flex-col h-full bg-bg-secondary border-l border-border shrink-0" style={{ width }}>
                <div className="flex items-center justify-between pr-2 border-b border-border bg-bg-secondary min-h-[35px]">
                    <div className="flex items-center">
                        <button
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-transparent border-0 border-b-2 cursor-pointer',
                                activeTab === 'detail'
                                    ? 'text-text-primary border-success'
                                    : 'text-text-secondary border-transparent hover:text-text-primary'
                            )}
                            onClick={() => setActiveTab('detail')}
                            title="Row Detail"
                        >
                            <AlignLeft size={13} className="shrink-0" />
                            <span>Row Detail</span>
                        </button>
                        <button
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-transparent border-0 border-b-2 cursor-pointer',
                                activeTab === 'bookmark'
                                    ? 'text-text-primary border-success'
                                    : 'text-text-secondary border-transparent hover:text-text-primary'
                            )}
                            onClick={() => setActiveTab('bookmark')}
                            title="Bookmarks"
                        >
                            <Bookmark size={13} className="shrink-0" />
                            <span>Bookmarks ({bookmarkCount})</span>
                        </button>
                    </div>

                    <button
                        className="bg-transparent border-none text-text-muted cursor-pointer px-1.25 py-1 rounded flex items-center justify-center transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
                        onClick={() => setShowRightSidebar(false)}
                        title="Close right sidebar"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden p-1">
                    {activeTab === 'detail' ? <RowDetailTab /> : <BookmarkTab />}
                </div>
            </div>
        </>
    );
};
