import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { createProject, getActiveProject, listProjects, openProject, saveProject as persistProject } from '../lib/projectApi';
import type { Project, Workspace } from '../types/project';
import { withStoreLogger } from './logger';

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
    setLastWorkspace: (workspaceId: string) => Promise<Project | null>;
    setActiveProject: (project: Project | null) => void;
    clearActiveProject: () => void;
}

function patchProjects(projects: Project[], project: Project) {
    const nextProjects = projects.some((item) => item.id === project.id)
        ? projects.map((item) => (item.id === project.id ? project : item))
        : [...projects, project];

    return [...nextProjects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
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

                    set({
                        projects,
                        activeProject: active,
                        selectedProjectId: active?.id || selectedProjectId || null,
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
                    set({
                        activeProject: project,
                        selectedProjectId: project?.id || projectId,
                        projects,
                        isLoading: false,
                    });
                    return project;
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

            setLastWorkspace: async (workspaceId: string) => {
                const activeProject = get().activeProject;
                if (!activeProject) return null;

                const matchedWorkspace = activeProject.workspaces?.find((workspace) => workspace.id === workspaceId);
                const workspaces: Workspace[] = (activeProject.workspaces || []).map((workspace) => (
                    workspace.id === workspaceId
                        ? { ...workspace, last_opened_at: new Date().toISOString() }
                        : workspace
                ));

                return get().saveProject({
                    ...activeProject,
                    last_workspace_id: workspaceId,
                    default_environment_key: matchedWorkspace?.environment_key || activeProject.default_environment_key,
                    workspaces,
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
