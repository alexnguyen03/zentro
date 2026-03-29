import type { Project, Workspace } from '../../types/project';
import type { ProjectEditorSession } from '../../stores/editorStore';
import { createEmptySession, normalizeSession } from '../../stores/editor/sessionUtils';

export const PROJECT_LAYOUT_SESSION_VERSION = 1;

interface PersistedProjectEditorSession {
    version: number;
    session: ProjectEditorSession;
}

export function parseProjectEditorSession(layoutState?: string): ProjectEditorSession | null {
    if (!layoutState || !layoutState.trim()) return null;

    try {
        const parsed = JSON.parse(layoutState) as PersistedProjectEditorSession | ProjectEditorSession;
        if (typeof parsed === 'object' && parsed !== null && 'session' in parsed) {
            const payload = parsed as PersistedProjectEditorSession;
            return normalizeSession(payload.session);
        }
        return normalizeSession(parsed as ProjectEditorSession);
    } catch {
        return null;
    }
}

export function serializeProjectEditorSession(session: ProjectEditorSession): string {
    const payload: PersistedProjectEditorSession = {
        version: PROJECT_LAYOUT_SESSION_VERSION,
        session: normalizeSession(session),
    };
    return JSON.stringify(payload);
}

export function isSessionEmpty(session?: ProjectEditorSession | null): boolean {
    if (!session) return true;
    return session.groups.every((group) => group.tabs.length === 0);
}

export function pickActiveWorkspace(project: Project): Workspace | null {
    if (!project.workspaces || project.workspaces.length === 0) return null;
    const selected = project.workspaces.find((workspace) => workspace.id === project.last_workspace_id);
    return selected || project.workspaces[0] || null;
}

export function ensureWorkspace(project: Project): Workspace {
    const selected = pickActiveWorkspace(project);
    if (selected) return selected;

    return {
        id: crypto.randomUUID(),
        project_id: project.id,
        environment_key: project.default_environment_key,
        name: 'Workspace',
        type: 'scratch',
        last_opened_at: new Date().toISOString(),
        layout_state: serializeProjectEditorSession(createEmptySession()),
    };
}

export function withWorkspaceLayoutState(project: Project, layoutState: string): Project {
    const workspace = ensureWorkspace(project);
    const nextWorkspaces = project.workspaces && project.workspaces.length > 0
        ? project.workspaces.map((item) => (
            item.id === workspace.id
                ? { ...item, layout_state: layoutState, last_opened_at: new Date().toISOString() }
                : item
        ))
        : [{ ...workspace, layout_state: layoutState }];

    return {
        ...project,
        last_workspace_id: workspace.id,
        workspaces: nextWorkspaces,
    };
}
