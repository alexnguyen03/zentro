import type { Project } from '../../types/project';
import type { ProjectEditorSession } from '../../stores/editorStore';
import { normalizeSession } from '../../stores/editor/sessionUtils';

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

export function withProjectLayoutState(project: Project, layoutState: string): Project {
    return {
        ...project,
        layout_state: layoutState,
    };
}
