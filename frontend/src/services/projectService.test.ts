import { beforeEach, describe, expect, it, vi } from 'vitest';
import { models } from '../../wailsjs/go/models';
import type { Project } from '../types/project';

const gatewayMock = vi.hoisted(() => ({
    ListProjects: vi.fn(),
    GetProject: vi.fn(),
    CreateProject: vi.fn(),
    SaveProject: vi.fn(),
    DeleteProject: vi.fn(),
    OpenProject: vi.fn(),
    GetActiveProject: vi.fn(),
    ForceQuit: vi.fn(),
    ConnectProjectEnvironment: vi.fn(),
}));

vi.mock('../platform/app-api/wailsGateway', () => ({
    wailsGateway: gatewayMock,
}));

import {
    createProject,
    getActiveProject,
    listProjects,
    openProject,
} from './projectService';

function makeRawProject(overrides: Partial<Record<string, unknown>> = {}): models.Project {
    return models.Project.createFrom({
        id: 'p1',
        slug: 'project-1',
        name: 'Project 1',
        description: '',
        tags: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        default_environment_key: 'dev',
        last_workspace_id: '',
        environments: [],
        connections: [],
        workspaces: [],
        assets: [],
        ...overrides,
    });
}

function makeProjectInput(): Project {
    return {
        id: 'p2',
        slug: 'project-2',
        name: 'Project 2',
        description: '',
        tags: [],
        created_at: '',
        updated_at: '',
        default_environment_key: 'loc',
        last_active_environment_key: 'loc',
        environments: [],
        connections: [],
        workspaces: [],
        assets: [],
    };
}

describe('projectService', () => {
    beforeEach(() => {
        Object.values(gatewayMock).forEach((mockFn) => mockFn.mockReset());
    });

    it('normalizes project keys when listing projects', async () => {
        gatewayMock.ListProjects.mockResolvedValue([
            makeRawProject({
                default_environment_key: 'dev',
                last_active_environment_key: 'invalid-env',
                environments: [{ id: 'e1', project_id: 'p1', key: 'invalid-env' }],
            }),
        ]);

        const projects = await listProjects();

        expect(projects).toHaveLength(1);
        expect(projects[0].default_environment_key).toBe('dev');
        expect(projects[0].last_active_environment_key).toBe('dev');
        expect(projects[0].environments?.[0]?.key).toBe('loc');
    });

    it('returns null when opening or getting active project fails', async () => {
        gatewayMock.OpenProject.mockRejectedValue(new Error('open failed'));
        gatewayMock.GetActiveProject.mockRejectedValue(new Error('no active'));

        await expect(openProject('p1')).resolves.toBeNull();
        await expect(getActiveProject()).resolves.toBeNull();
    });

    it('creates project through gateway and returns normalized result', async () => {
        gatewayMock.CreateProject.mockResolvedValue(
            makeRawProject({ id: 'p2', default_environment_key: 'tes', last_active_environment_key: 'tes' }),
        );

        const result = await createProject(makeProjectInput());

        expect(gatewayMock.CreateProject).toHaveBeenCalledTimes(1);
        expect(result.id).toBe('p2');
        expect(result.default_environment_key).toBe('tes');
        expect(result.last_active_environment_key).toBe('tes');
    });
});
