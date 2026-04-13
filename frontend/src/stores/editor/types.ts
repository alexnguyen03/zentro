import { TabType, TAB_TYPE, GENERATED_KIND } from '../../lib/constants';

export interface TabQueryContext {
    savedScriptId?: string;
    scriptProjectId?: string;
    scriptConnectionName?: string;
    resultFilterExpr?: string;
    resultOrderByExpr?: string;
    resultQuickFilter?: string;
    compareLeftTabId?: string;
    compareRightTabId?: string;
    compareSyncScroll?: boolean;
    compareIgnoreWhitespace?: boolean;
    compareShowUnified?: boolean;
}

export interface Tab {
    id: string;
    name: string;
    query: string;
    isRunning: boolean;
    type?: TabType;
    content?: string;
    readOnly?: boolean;
    sourceTabId?: string;
    generatedKind?: typeof GENERATED_KIND[keyof typeof GENERATED_KIND];
    context?: TabQueryContext;
    gitDiffBefore?: string;
    gitDiffAfter?: string;
}

export interface TabGroup {
    id: string;
    tabs: Tab[];
    activeTabId: string | null;
}

export interface ProjectEditorSession {
    groups: TabGroup[];
    activeGroupId: string | null;
}

export interface EditorState {
    projectSessions: Record<string, ProjectEditorSession>;
    activeProjectId: string | null;
    groups: TabGroup[];
    activeGroupId: string | null;

    switchProject: (projectId: string | null) => void;
    hydrateProjectSession: (projectId: string | null, session: Partial<ProjectEditorSession>, activate?: boolean) => void;
    resetProject: (projectId?: string | null) => void;
    addTab: (tabInit?: Partial<Tab>, targetGroupId?: string) => string;
    removeTab: (id: string, groupId?: string) => void;
    setActiveTabId: (tabId: string, groupId: string) => void;
    setActiveGroupId: (groupId: string) => void;
    updateTabQuery: (id: string, query: string) => void;
    updateTabContext: (id: string, patch: Partial<TabQueryContext>) => void;
    setTabRunning: (id: string, isRunning: boolean) => void;
    renameTab: (id: string, newName: string) => void;
    setTabQuery: (id: string, query: string) => void;
    splitGroup: (sourceGroupId: string, tabId: string) => void;
    splitGroupFromDrag: (sourceGroupId: string, tabId: string, targetGroupId: string, direction: 'left' | 'right') => void;
    closeGroup: (groupId: string) => void;
    moveTab: (tabId: string, sourceGroupId: string, targetGroupId: string, newIndex: number) => void;
}
