import { create } from 'zustand';
import { withStoreLogger } from './logger';
import type { EnvironmentKey, Project, ProjectEnvironment } from '../types/project';
import { getEnvironmentLabel } from '../lib/projects';

interface EnvironmentState {
    environments: ProjectEnvironment[];
    activeEnvironmentKey: EnvironmentKey | null;

    bootstrap: (project: Project | null, preferredKey?: EnvironmentKey | null) => void;
    setActiveEnvironment: (key: EnvironmentKey | null) => void;
    clear: () => void;
}

function buildFallbackEnvironment(project: Project): ProjectEnvironment {
    const key = project.default_environment_key || 'loc';
    return {
        id: `${project.id}:${key}`,
        project_id: project.id,
        key,
        label: getEnvironmentLabel(key),
        is_protected: key === 'sta' || key === 'pro',
        is_read_only: key === 'pro',
        connection_id: project.connections?.find((connection) => connection.environment_key === key)?.id,
    };
}

export const useEnvironmentStore = create<EnvironmentState>()(
    withStoreLogger('environmentStore', (set) => ({
        environments: [],
        activeEnvironmentKey: null,

        bootstrap: (project, preferredKey) => {
            if (!project) {
                set({ environments: [], activeEnvironmentKey: null });
                return;
            }

            const environments = project.environments?.length
                ? project.environments
                : [buildFallbackEnvironment(project)];

            const requestedKey = preferredKey || project.default_environment_key || environments[0]?.key || null;
            const activeEnvironmentKey = environments.some((environment) => environment.key === requestedKey)
                ? requestedKey
                : environments[0]?.key || null;

            set({
                environments,
                activeEnvironmentKey,
            });
        },

        setActiveEnvironment: (key) => set((state) => {
            if (!key) {
                return { activeEnvironmentKey: null };
            }

            if (!state.environments.some((environment) => environment.key === key)) {
                return state;
            }

            return { activeEnvironmentKey: key };
        }),

        clear: () => set({ environments: [], activeEnvironmentKey: null }),
    }))
);
