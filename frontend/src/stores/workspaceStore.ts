import { create } from 'zustand';
import { withStoreLogger } from './logger';
import type { EnvironmentKey, Project, Workspace } from '../types/project';

interface WorkspaceState {
    workspaces: Workspace[];
    activeWorkspaceId: string | null;

    bootstrap: (project: Project | null) => void;
    setActiveWorkspace: (workspaceId: string | null) => void;
    clear: () => void;
}

function buildFallbackWorkspace(project: Project): Workspace {
    return {
        id: `${project.id}:workspace`,
        project_id: project.id,
        environment_key: project.default_environment_key || 'loc',
        name: 'Workspace',
        type: 'scratch',
        last_opened_at: project.updated_at || project.created_at || new Date().toISOString(),
    };
}

function getPreferredWorkspaceId(project: Project, workspaces: Workspace[]) {
    if (project.last_workspace_id && workspaces.some((workspace) => workspace.id === project.last_workspace_id)) {
        return project.last_workspace_id;
    }

    return workspaces[0]?.id || null;
}

export function getWorkspaceEnvironmentKey(
    workspaces: Workspace[],
    workspaceId: string | null,
    fallbackKey: EnvironmentKey
): EnvironmentKey {
    return workspaces.find((workspace) => workspace.id === workspaceId)?.environment_key || fallbackKey;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    withStoreLogger('workspaceStore', (set) => ({
        workspaces: [],
        activeWorkspaceId: null,

        bootstrap: (project) => {
            if (!project) {
                set({ workspaces: [], activeWorkspaceId: null });
                return;
            }

            const workspaces = project.workspaces?.length
                ? project.workspaces
                : [buildFallbackWorkspace(project)];

            set({
                workspaces,
                activeWorkspaceId: getPreferredWorkspaceId(project, workspaces),
            });
        },

        setActiveWorkspace: (workspaceId) => set((state) => {
            if (!workspaceId) {
                return { activeWorkspaceId: null };
            }

            if (!state.workspaces.some((workspace) => workspace.id === workspaceId)) {
                return state;
            }

            return { activeWorkspaceId: workspaceId };
        }),

        clear: () => set({ workspaces: [], activeWorkspaceId: null }),
    }))
);
