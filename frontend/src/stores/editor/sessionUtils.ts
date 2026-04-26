import { TAB_TYPE } from '../../lib/constants';
import { EditorState, ProjectEditorSession, TabGroup } from './types';

export const DEFAULT_WORKSPACE_ID = '__default__';

export const createEmptySession = (): ProjectEditorSession => ({
    groups: [{ id: 'group-1', tabs: [], activeTabId: null }],
    activeGroupId: 'group-1',
});

export const normalizeSession = (session?: Partial<ProjectEditorSession> | null): ProjectEditorSession => {
    const groups = session?.groups?.length
        ? session.groups.map((group, index) => ({
            id: group.id || `group-${index + 1}`,
            tabs: (group.tabs || []).map((tab) => ({
                ...tab,
                isRunning: false,
                type: tab.type || TAB_TYPE.QUERY,
            })),
            activeTabId: group.activeTabId || group.tabs?.[0]?.id || null,
        }))
        : createEmptySession().groups;

    return {
        groups,
        activeGroupId: session?.activeGroupId && groups.some((group) => group.id === session.activeGroupId)
            ? session.activeGroupId
            : groups[0]?.id || null,
    };
};

export const getSessionProjectId = (projectId?: string | null) => projectId || DEFAULT_WORKSPACE_ID;

function resolveMaxSuffixFromName(rawName: string, baseName: string, numberedPattern: RegExp): number {
    const normalized = rawName.trim();
    if (!normalized) return 0;

    if (normalized.toLowerCase() === baseName.toLowerCase()) {
        return 1;
    }

    const match = normalized.match(numberedPattern);
    if (!match) return 0;

    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const getNextTabName = (groups: TabGroup[], baseName = 'New Query', reservedNames: string[] = []): string => {
    const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numberedPattern = new RegExp(`^${escapedBase}\\s+(\\d+)$`, 'i');

    let maxSuffix = 0;
    for (const group of groups) {
        for (const tab of group.tabs) {
            maxSuffix = Math.max(maxSuffix, resolveMaxSuffixFromName(String(tab.name || ''), baseName, numberedPattern));
        }
    }

    for (const savedName of reservedNames) {
        maxSuffix = Math.max(maxSuffix, resolveMaxSuffixFromName(String(savedName || ''), baseName, numberedPattern));
    }

    if (maxSuffix === 0) {
        return baseName;
    }
    return `${baseName} ${maxSuffix + 1}`;
};

export function getActiveSession(state: Pick<EditorState, 'projectSessions' | 'activeProjectId'>) {
    const projectId = getSessionProjectId(state.activeProjectId);
    return normalizeSession(state.projectSessions[projectId]);
}

export function updateActiveSession(
    state: EditorState,
    updater: (session: ProjectEditorSession) => ProjectEditorSession
) {
    const projectId = getSessionProjectId(state.activeProjectId);
    const nextSession = normalizeSession(updater(getActiveSession(state)));
    return {
        projectSessions: {
            ...state.projectSessions,
            [projectId]: nextSession,
        },
        groups: nextSession.groups,
        activeGroupId: nextSession.activeGroupId,
    };
}
