import type { Project } from '../types/project';

type AppApi = {
    ListProjects?: () => Promise<Project[]>;
    GetProject?: (projectId: string) => Promise<Project>;
    CreateProject?: (project: Project) => Promise<Project>;
    SaveProject?: (project: Project) => Promise<Project>;
    DeleteProject?: (projectId: string) => Promise<void>;
    OpenProject?: (projectId: string) => Promise<Project>;
    GetActiveProject?: () => Promise<Project | null>;
};

function getAppApi(): AppApi {
    const appApi = window.go?.app?.App;
    if (!appApi) {
        return {};
    }
    return appApi as AppApi;
}

export async function listProjects(): Promise<Project[]> {
    const api = getAppApi();
    if (!api.ListProjects) return [];
    return (await api.ListProjects()) || [];
}

export async function getProject(projectId: string): Promise<Project | null> {
    const api = getAppApi();
    if (!api.GetProject) return null;
    return await api.GetProject(projectId);
}

export async function createProject(project: Project): Promise<Project> {
    const api = getAppApi();
    if (!api.CreateProject) throw new Error('CreateProject API not available');
    return api.CreateProject(project);
}

export async function saveProject(project: Project): Promise<Project> {
    const api = getAppApi();
    if (!api.SaveProject) throw new Error('SaveProject API not available');
    return api.SaveProject(project);
}

export async function deleteProject(projectId: string): Promise<void> {
    const api = getAppApi();
    if (!api.DeleteProject) throw new Error('DeleteProject API not available');
    await api.DeleteProject(projectId);
}

export async function openProject(projectId: string): Promise<Project | null> {
    const api = getAppApi();
    if (!api.OpenProject) return null;
    return await api.OpenProject(projectId);
}

export async function getActiveProject(): Promise<Project | null> {
    const api = getAppApi();
    if (!api.GetActiveProject) return null;
    return await api.GetActiveProject();
}
