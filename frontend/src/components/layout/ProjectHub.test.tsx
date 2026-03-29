import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectHub } from './ProjectHub';
import { ENVIRONMENT_KEY } from '../../lib/constants';
import type { Project } from '../../types/project';

const mocks = vi.hoisted(() => ({
    openProject: vi.fn(),
    saveProject: vi.fn(),
    deleteProject: vi.fn(),
    getDefaultRoot: vi.fn(),
    pickDirectory: vi.fn(),
    openProjectFromDirectory: vi.fn(),
    resetRuntime: vi.fn(),
    disconnect: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

const projectState = {
    projects: [] as Project[],
    isLoading: false,
    error: null as string | null,
    openProject: mocks.openProject,
    saveProject: mocks.saveProject,
    deleteProject: mocks.deleteProject,
    activeProject: null as Project | null,
};

function makeProject(id: string, name: string): Project {
    return {
        id,
        slug: name.toLowerCase(),
        name,
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
    };
}

vi.mock('../../services/connectionService', () => ({
    Disconnect: mocks.disconnect,
}));

vi.mock('../../services/projectService', () => ({
    GetDefaultProjectStorageRoot: mocks.getDefaultRoot,
    PickDirectory: mocks.pickDirectory,
    openProjectFromDirectory: mocks.openProjectFromDirectory,
}));

vi.mock('../../stores/projectStore', () => ({
    useProjectStore: () => projectState,
}));

vi.mock('../../stores/connectionStore', () => ({
    useConnectionStore: (selector: (state: { resetRuntime: () => void }) => unknown) => selector({ resetRuntime: mocks.resetRuntime }),
}));

vi.mock('./Toast', () => ({
    useToast: () => ({
        toast: {
            error: mocks.toastError,
            success: mocks.toastSuccess,
        },
    }),
}));

describe('ProjectHub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        projectState.projects = [
            makeProject('p1', 'Project One'),
            makeProject('p2', 'Project Two'),
            makeProject('p3', 'Project Three'),
            makeProject('p4', 'Project Four'),
            makeProject('p5', 'Project Five'),
        ];
        projectState.isLoading = false;
        projectState.error = null;
        mocks.openProject.mockResolvedValue(makeProject('p2', 'Project Two'));
        mocks.saveProject.mockResolvedValue(makeProject('p2', 'Project Two'));
        mocks.deleteProject.mockResolvedValue(true);
        mocks.getDefaultRoot.mockResolvedValue('C:/projects');
        mocks.pickDirectory.mockResolvedValue('C:/projects/example');
        mocks.openProjectFromDirectory.mockResolvedValue(makeProject('p2', 'Project Two'));
        mocks.disconnect.mockResolvedValue(undefined);
    });

    it('renders all projects with compact launcher layout and create action', () => {
        render(<ProjectHub />);

        expect(screen.getByAltText('Zentro app icon')).toBeInTheDocument();
        expect(screen.queryByText('Project launcher')).not.toBeInTheDocument();
        expect(screen.queryByText('Recent')).not.toBeInTheDocument();
        expect(screen.getByText('5 projects')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'More...' })).not.toBeInTheDocument();
        expect(screen.getByTestId('recent-project-p5')).toBeInTheDocument();
        expect(screen.getByTestId('recent-project-p4')).toBeInTheDocument();
        expect(screen.getByTestId('recent-project-p1')).toBeInTheDocument();
    });

    it('opens selected recent project and closes overlay', async () => {
        const onClose = vi.fn();
        render(<ProjectHub overlay onClose={onClose} />);

        fireEvent.click(screen.getByText('Project Two'));

        await waitFor(() => {
            expect(mocks.openProject).toHaveBeenCalledWith('p2');
        });
        expect(mocks.resetRuntime).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
