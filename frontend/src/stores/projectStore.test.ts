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
        layout_state: '',
        environments: [],
        connections: [],
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
            recentProjectIds: [],
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
        expect(state.recentProjectIds).toEqual(['active-1']);
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

    it('tracks recent projects when opening, keeps max 4, and deduplicates', async () => {
        const projects = [
            makeProject({ id: 'p1', name: 'P1' }),
            makeProject({ id: 'p2', name: 'P2' }),
            makeProject({ id: 'p3', name: 'P3' }),
            makeProject({ id: 'p4', name: 'P4' }),
        ];
        useProjectStore.setState({ projects, recentProjectIds: ['p1', 'p2'] });

        projectServiceMock.openProject.mockResolvedValue(makeProject({ id: 'p3', name: 'P3' }));
        await useProjectStore.getState().openProject('p3');

        projectServiceMock.openProject.mockResolvedValue(makeProject({ id: 'p2', name: 'P2' }));
        await useProjectStore.getState().openProject('p2');

        projectServiceMock.openProject.mockResolvedValue(makeProject({ id: 'p4', name: 'P4' }));
        await useProjectStore.getState().openProject('p4');

        expect(useProjectStore.getState().recentProjectIds).toEqual(['p4', 'p2', 'p3', 'p1']);
    });

    it('removes deleted project id from recent list', async () => {
        useProjectStore.setState({
            projects: [makeProject({ id: 'p1' }), makeProject({ id: 'p2' })],
            recentProjectIds: ['p2', 'p1'],
            activeProject: makeProject({ id: 'p1' }),
            selectedProjectId: 'p1',
        });
        projectServiceMock.deleteProject.mockResolvedValue(undefined);

        const ok = await useProjectStore.getState().deleteProject('p2');

        expect(ok).toBe(true);
        expect(useProjectStore.getState().recentProjectIds).toEqual(['p1']);
    });
});
