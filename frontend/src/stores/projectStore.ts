import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { createProject, getActiveProject, listProjects, openProject } from '../lib/projectApi';
import type { Project } from '../types/project';
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
    setActiveProject: (project: Project | null) => void;
    clearActiveProject: () => void;
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
