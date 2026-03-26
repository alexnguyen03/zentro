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

export const getNextTabName = (groups: TabGroup[], baseName = 'New Query'): string => {
    let name = baseName;
    let count = 1;
    let checkName = name;

    while (groups.some((group) => group.tabs.some((tab) => tab.name === checkName))) {
        count += 1;
        checkName = `${name} ${count}`;
    }

    return checkName;
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
