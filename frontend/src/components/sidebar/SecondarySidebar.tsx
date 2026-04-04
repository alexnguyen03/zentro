import React, { useRef, useState, useCallback } from 'react';
import { X, AlignLeft, Bookmark } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useLayoutStore } from '../../stores/layoutStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import { useEditorStore } from '../../stores/editorStore';
import { RowDetailTab } from './RowDetailTab';
import { BookmarkTab } from './BookmarkTab';
import { Button } from '../ui';

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
            <div className="sidebar flex flex-col h-full bg-card border-l border-border shrink-0" style={{ width }}>
                <div className="flex items-center justify-between pr-2 border-b border-border bg-card min-h-[35px]">
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            type="button"
                            className={cn(
                                'h-auto items-center gap-1.5 border-0 border-b-2 px-2.5 py-1.5 text-[11px]',
                                activeTab === 'detail'
                                    ? 'text-foreground border-success'
                                    : 'text-muted-foreground border-transparent hover:text-foreground'
                            )}
                            onClick={() => setActiveTab('detail')}
                            title="Row Detail"
                        >
                            <AlignLeft size={13} className="shrink-0" />
                            <span>Row Detail</span>
                        </Button>
                        <Button
                            variant="ghost"
                            type="button"
                            className={cn(
                                'h-auto items-center gap-1.5 border-0 border-b-2 px-2.5 py-1.5 text-[11px]',
                                activeTab === 'bookmark'
                                    ? 'text-foreground border-success'
                                    : 'text-muted-foreground border-transparent hover:text-foreground'
                            )}
                            onClick={() => setActiveTab('bookmark')}
                            title="Bookmarks"
                        >
                            <Bookmark size={13} className="shrink-0" />
                            <span>Bookmarks ({bookmarkCount})</span>
                        </Button>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                        onClick={() => setShowRightSidebar(false)}
                        title="Close right sidebar"
                    >
                        <X size={14} />
                    </Button>
                </div>

                <div className="flex-1 overflow-hidden p-1">
                    {activeTab === 'detail' ? <RowDetailTab /> : <BookmarkTab />}
                </div>
            </div>
        </>
    );
};
