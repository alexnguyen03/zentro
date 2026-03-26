import { create } from 'zustand';
import { withStoreLogger } from './logger';
import type { EnvironmentKey, Project, ProjectEnvironment } from '../types/project';
import { getEnvironmentLabel } from '../lib/projects';
import { ENVIRONMENT_KEY } from '../lib/constants';

interface EnvironmentState {
    environments: ProjectEnvironment[];
    activeEnvironmentKey: EnvironmentKey | null;

    bootstrap: (project: Project | null) => void;
    setActiveEnvironment: (key: EnvironmentKey | null) => void;
    clear: () => void;
}

function buildFallbackEnvironment(project: Project): ProjectEnvironment {
    const key = project.default_environment_key || ENVIRONMENT_KEY.LOCAL;
    return {
        id: `${project.id}:${key}`,
        project_id: project.id,
        key,
        label: getEnvironmentLabel(key),
        is_protected: key === ENVIRONMENT_KEY.STAGING || key === ENVIRONMENT_KEY.PRODUCTION,
        is_read_only: key === ENVIRONMENT_KEY.PRODUCTION,
        connection_id: project.connections?.find((connection) => connection.environment_key === key)?.id,
    };
}

export const useEnvironmentStore = create<EnvironmentState>()(
    withStoreLogger('environmentStore', (set) => ({
        environments: [],
        activeEnvironmentKey: null,

        bootstrap: (project) => {
            if (!project) {
                set({ environments: [], activeEnvironmentKey: null });
                return;
            }

            const environments = project.environments?.length
                ? project.environments
                : [buildFallbackEnvironment(project)];

            const requestedKey = project.last_active_environment_key || project.default_environment_key || environments[0]?.key || ENVIRONMENT_KEY.LOCAL;
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

            return { activeEnvironmentKey: key };
        }),

        clear: () => set({ environments: [], activeEnvironmentKey: null }),
    }))
);
