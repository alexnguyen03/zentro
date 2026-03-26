import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../types/project';
import { ENVIRONMENT_KEY } from '../lib/constants';

const projectServiceMock = vi.hoisted(() => ({
    listProjects: vi.fn(),
    getActiveProject: vi.fn(),
    openProject: vi.fn(),
    createProject: vi.fn(),
    saveProject: vi.fn(),
    deleteProject: vi.fn(),
}));

vi.mock('../services/projectService', () => ({
    ForceQuit: vi.fn(),
    ConnectProjectEnvironment: vi.fn(),
    ...projectServiceMock,
}));

import { useProjectStore } from './projectStore';

function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        id: 'p1',
        slug: 'project-1',
        name: 'Project 1',
        description: '',
        tags: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        default_environment_key: ENVIRONMENT_KEY.LOCAL,
        last_active_environment_key: ENVIRONMENT_KEY.LOCAL,
        environments: [],
        connections: [],
        workspaces: [],
        assets: [],
        ...overrides,
    };
}

describe('projectStore', () => {
    beforeEach(() => {
        Object.values(projectServiceMock).forEach((mockFn) => mockFn.mockReset());
        useProjectStore.setState({
            projects: [],
            activeProject: null,
            selectedProjectId: null,
            isLoading: false,
            error: null,
        });
    });

    it('bootstraps projects and hydrates active project', async () => {
        const active = makeProject({ id: 'active-1', default_environment_key: ENVIRONMENT_KEY.DEVELOPMENT });
        projectServiceMock.listProjects.mockResolvedValue([active]);
        projectServiceMock.getActiveProject.mockResolvedValue(active);

        await useProjectStore.getState().bootstrap();

        const state = useProjectStore.getState();
        expect(state.projects).toHaveLength(1);
        expect(state.activeProject?.id).toBe('active-1');
        expect(state.selectedProjectId).toBe('active-1');
        expect(state.error).toBeNull();
    });

    it('updates environment and persists through saveProject flow', async () => {
        const current = makeProject({ id: 'p-env', default_environment_key: ENVIRONMENT_KEY.LOCAL, environments: [] });
        useProjectStore.setState({ activeProject: current, projects: [current], selectedProjectId: current.id });

        const saved = makeProject({
            ...current,
            default_environment_key: ENVIRONMENT_KEY.DEVELOPMENT,
            last_active_environment_key: ENVIRONMENT_KEY.DEVELOPMENT,
            environments: [
                {
                    id: 'env-dev',
                    project_id: current.id,
                    key: ENVIRONMENT_KEY.DEVELOPMENT,
                    label: 'Development',
                    is_protected: false,
                    is_read_only: false,
                },
            ],
        });
        projectServiceMock.saveProject.mockResolvedValue(saved);

        const result = await useProjectStore.getState().setProjectEnvironment(ENVIRONMENT_KEY.DEVELOPMENT);

        expect(projectServiceMock.saveProject).toHaveBeenCalledTimes(1);
        expect(result?.default_environment_key).toBe(ENVIRONMENT_KEY.DEVELOPMENT);
        expect(result?.environments?.some((environment) => environment.key === ENVIRONMENT_KEY.DEVELOPMENT)).toBe(true);
    });
});
