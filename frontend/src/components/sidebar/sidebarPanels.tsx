import React from 'react';
import { AlignLeft, BookMarked, Bookmark, Clock, GitBranch, Hash } from 'lucide-react';
import { BookmarkTab } from './BookmarkTab';
import { HistoryPanel } from './HistoryPanel';
import { SourceControlPanel } from './SourceControlPanel';
import { RowDetailTab } from './RowDetailTab';
import { SavedScriptsPanel } from './SavedScriptsPanel';
import {
    BOOKMARK_PANEL_STATE_DEFAULT,
    EXPLORER_PANEL_STATE_DEFAULT,
    HISTORY_PANEL_STATE_DEFAULT,
    ROW_DETAIL_PANEL_STATE_DEFAULT,
    SCRIPTS_PANEL_STATE_DEFAULT,
    SOURCE_CONTROL_PANEL_STATE_DEFAULT,
} from './sidebarPanelStateDefaults';
import { PrimaryExplorerPanel } from './panels/PrimaryExplorerPanel';
import { registerSidebarPanel } from './sidebarPanelRegistry';

let builtInPanelsRegistered = false;

export function registerBuiltInSidebarPanels(): void {
    if (builtInPanelsRegistered) return;

    registerSidebarPanel({
        id: 'explorer',
        side: 'primary',
        label: 'Explorer',
        icon: Hash,
        order: 10,
        render: () => <PrimaryExplorerPanel />,
        defaultState: EXPLORER_PANEL_STATE_DEFAULT,
    });
    registerSidebarPanel({
        id: 'history',
        side: 'primary',
        label: 'History',
        icon: Clock,
        order: 20,
        render: () => <HistoryPanel />,
        defaultState: HISTORY_PANEL_STATE_DEFAULT,
    });
    registerSidebarPanel({
        id: 'scripts',
        side: 'primary',
        label: 'Scripts',
        icon: BookMarked,
        order: 30,
        render: () => <SavedScriptsPanel />,
        defaultState: SCRIPTS_PANEL_STATE_DEFAULT,
    });
    registerSidebarPanel({
        id: 'source-control',
        side: 'primary',
        label: 'Source Control',
        icon: GitBranch,
        order: 40,
        render: () => <SourceControlPanel />,
        defaultState: SOURCE_CONTROL_PANEL_STATE_DEFAULT,
    });

    registerSidebarPanel({
        id: 'detail',
        side: 'secondary',
        label: 'Row Detail',
        icon: AlignLeft,
        order: 10,
        render: () => <RowDetailTab />,
        defaultState: ROW_DETAIL_PANEL_STATE_DEFAULT,
    });
    registerSidebarPanel({
        id: 'bookmark',
        side: 'secondary',
        label: 'Bookmarks',
        icon: Bookmark,
        order: 20,
        render: () => <BookmarkTab />,
        defaultState: BOOKMARK_PANEL_STATE_DEFAULT,
    });

    builtInPanelsRegistered = true;
}
