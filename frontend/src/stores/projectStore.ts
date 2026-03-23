import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { createProject, getActiveProject, listProjects, openProject, saveProject as persistProject } from '../lib/projectApi';
import type { EnvironmentKey, Project, ProjectEnvironment } from '../types/project';
import { getEnvironmentLabel } from '../lib/projects';
import { withStoreLogger } from './logger';
import type { ConnectionProfile } from '../types/connection';

interface ProjectState {
    projects: Project[];
    activeProject: Project | null;
    selectedProjectId: string | null;
    isLoading: boolean;
    error: string | null;

    loadProjects: () => Promise<Project[]>;
    bootstrap: () => Promise<void>;
    openProject: (projectId: string) => Promise<Project | null>;
    createProject: (input: Pick<Project, 'name' | 'description' | 'tags'>) => Promise<Project | null>;
    saveProject: (project: Project) => Promise<Project | null>;
    setProjectEnvironment: (environmentKey: EnvironmentKey) => Promise<Project | null>;
    bindEnvironmentConnection: (environmentKey: EnvironmentKey, profile: ConnectionProfile) => Promise<Project | null>;
    setActiveProject: (project: Project | null) => void;
    clearActiveProject: () => void;
}

function patchProjects(projects: Project[], project: Project) {
    const nextProjects = projects.some((item) => item.id === project.id)
        ? projects.map((item) => (item.id === project.id ? project : item))
        : [...projects, project];

    return [...nextProjects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

function buildProjectEnvironment(projectId: string, key: EnvironmentKey): ProjectEnvironment {
    return {
        id: crypto.randomUUID(),
        project_id: projectId,
        key,
        label: getEnvironmentLabel(key),
        badge_color: key,
        is_protected: key === 'sta' || key === 'pro',
        is_read_only: key === 'pro',
    };
}

function buildProjectConnection(projectId: string, environmentKey: EnvironmentKey, profile: ConnectionProfile, existingId?: string) {
    return {
        id: existingId || crypto.randomUUID(),
        project_id: projectId,
        environment_key: environmentKey,
        name: profile.name,
        driver: profile.driver,
        host: profile.host,
        port: profile.port,
        database: profile.db_name,
        username: profile.username,
        password: profile.password,
        save_password: profile.save_password,
        ssl_mode: profile.ssl_mode,
        use_socket: false,
        ssh_enabled: false,
        advanced_meta: {
            profile_name: profile.name,
            encrypt_password: String(Boolean(profile.encrypt_password)),
            show_all_schemas: String(Boolean(profile.show_all_schemas)),
            trust_server_cert: String(Boolean(profile.trust_server_cert)),
        },
    };
}

export const useProjectStore = create<ProjectState>()(
    persist(
        withStoreLogger('projectStore', (set, get) => ({
            projects: [],
            activeProject: null,
            selectedProjectId: null,
            isLoading: false,
            error: null,

            loadProjects: async () => {
                set({ isLoading: true, error: null });
                try {
                    const projects = await listProjects();
                    set({ projects, isLoading: false });
                    return projects;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    set({ isLoading: false, error: message });
                    return [];
                }
            },

            bootstrap: async () => {
                set({ isLoading: true, error: null });
                try {
                    const projects = await listProjects();
                    const active = await getActiveProject();
                    const selectedProjectId = get().selectedProjectId;
                    const hydratedActive = active ? {
                        ...active,
                        last_active_environment_key: active.last_active_environment_key || active.default_environment_key || 'loc',
                    } : null;

                    set({
                        projects,
                        activeProject: hydratedActive,
                        selectedProjectId: hydratedActive?.id || selectedProjectId || null,
                        isLoading: false,
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    set({ isLoading: false, error: message });
                }
            },

            openProject: async (projectId: string) => {
                set({ isLoading: true, error: null });
                try {
                    const project = await openProject(projectId);
                    const projects = get().projects.length > 0 ? get().projects : await listProjects();
                    const hydratedProject = project ? {
                        ...project,
                        last_active_environment_key: project.last_active_environment_key || project.default_environment_key || 'loc',
                    } : null;
                    set({
                        activeProject: hydratedProject,
                        selectedProjectId: hydratedProject?.id || projectId,
                        projects,
                        isLoading: false,
                    });
                    return hydratedProject;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    set({ isLoading: false, error: message });
                    return null;
                }
            },

            createProject: async (input) => {
                set({ isLoading: true, error: null });
                try {
                    const project = await createProject({
                        id: '',
                        slug: '',
                        name: input.name,
                        description: input.description || '',
                        tags: input.tags || [],
                        created_at: '',
                        updated_at: '',
                        default_environment_key: 'loc',
                        last_active_environment_key: 'loc',
                        last_workspace_id: '',
                        environments: [],
                        connections: [],
                        workspaces: [],
                        assets: [],
                    });
                    const projects = await listProjects();
                    set({
                        projects,
                        activeProject: project,
                        selectedProjectId: project.id,
                        isLoading: false,
                    });
                    return project;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    set({ isLoading: false, error: message });
                    return null;
                }
            },

            saveProject: async (project) => {
                set({ isLoading: true, error: null });
                try {
                    const savedProject = await persistProject(project);
                    set((state) => ({
                        projects: patchProjects(state.projects, savedProject),
                        activeProject: state.activeProject?.id === savedProject.id ? savedProject : state.activeProject,
                        selectedProjectId: state.selectedProjectId || savedProject.id,
                        isLoading: false,
                    }));
                    return savedProject;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    set({ isLoading: false, error: message });
                    return null;
                }
            },

            setProjectEnvironment: async (environmentKey: EnvironmentKey) => {
                const activeProject = get().activeProject;
                if (!activeProject) return null;

                const environments = activeProject.environments?.some((environment) => environment.key === environmentKey)
                    ? activeProject.environments
                    : [...(activeProject.environments || []), buildProjectEnvironment(activeProject.id, environmentKey)];

                return get().saveProject({
                    ...activeProject,
                    default_environment_key: environmentKey,
                    last_active_environment_key: environmentKey,
                    environments,
                });
            },

            bindEnvironmentConnection: async (environmentKey: EnvironmentKey, profile: ConnectionProfile) => {
                const activeProject = get().activeProject;
                if (!activeProject) return null;

                const currentEnvironment = activeProject.environments?.find((environment) => environment.key === environmentKey);
                const existingConnection = activeProject.connections?.find((connection) => connection.environment_key === environmentKey);
                const nextConnection = buildProjectConnection(activeProject.id, environmentKey, profile, existingConnection?.id);

                const environments = activeProject.environments?.some((environment) => environment.key === environmentKey)
                    ? (activeProject.environments || []).map((environment) => (
                        environment.key === environmentKey
                            ? { ...environment, connection_id: nextConnection.id }
                            : environment
                    ))
                    : [
                        ...(activeProject.environments || []),
                        { ...buildProjectEnvironment(activeProject.id, environmentKey), connection_id: nextConnection.id },
                    ];

                const connections = activeProject.connections?.some((connection) => connection.environment_key === environmentKey)
                    ? (activeProject.connections || []).map((connection) => (
                        connection.environment_key === environmentKey ? nextConnection : connection
                    ))
                    : [...(activeProject.connections || []), nextConnection];

                return get().saveProject({
                    ...activeProject,
                    default_environment_key: environmentKey,
                    last_active_environment_key: environmentKey,
                    environments,
                    connections,
                });
            },

            setActiveProject: (project) => set({
                activeProject: project,
                selectedProjectId: project?.id || null,
            }),
            clearActiveProject: () => set({ activeProject: null }),
        })),
        {
            name: STORAGE_KEY.PROJECT_STORE,
            partialize: (state) => ({
                selectedProjectId: state.selectedProjectId,
            }),
        }
    )
);
