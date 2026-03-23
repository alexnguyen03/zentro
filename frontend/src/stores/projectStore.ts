import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../lib/constants';
import { getActiveProject, listProjects, openProject } from '../lib/projectApi';
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
    setActiveProject: (project: Project | null) => void;
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

                    let nextActive = active;
                    if (!nextActive && selectedProjectId) {
                        nextActive = await openProject(selectedProjectId);
                    }
                    if (!nextActive && projects.length > 0) {
                        nextActive = await openProject(projects[0].id);
                    }

                    set({
                        projects,
                        activeProject: nextActive,
                        selectedProjectId: nextActive?.id || selectedProjectId || null,
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

            setActiveProject: (project) => set({
                activeProject: project,
                selectedProjectId: project?.id || null,
            }),
        })),
        {
            name: STORAGE_KEY.PROJECT_STORE,
            partialize: (state) => ({
                selectedProjectId: state.selectedProjectId,
            }),
        }
    )
);
