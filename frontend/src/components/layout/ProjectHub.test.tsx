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
    loadConnections: vi.fn(),
    importConnectionPackage: vi.fn(),
    exportConnectionPackage: vi.fn(),
    deleteConnection: vi.fn(),
    getDefaultRoot: vi.fn(),
    pickDirectory: vi.fn(),
    openProjectFromDirectory: vi.fn(),
    openDirectoryInExplorer: vi.fn(),
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
        layout_state: '',
        environments: [],
        connections: [],
        assets: [],
        storage_path: `C:/projects/${id}`,
    };
}

vi.mock('../../services/connectionService', () => ({
    Disconnect: mocks.disconnect,
    LoadConnections: mocks.loadConnections,
    ImportConnectionPackage: mocks.importConnectionPackage,
    ExportConnectionPackage: mocks.exportConnectionPackage,
    DeleteConnection: mocks.deleteConnection,
}));

vi.mock('../../services/projectService', () => ({
    GetDefaultProjectStorageRoot: mocks.getDefaultRoot,
    PickDirectory: mocks.pickDirectory,
    openProjectFromDirectory: mocks.openProjectFromDirectory,
    OpenDirectoryInExplorer: mocks.openDirectoryInExplorer,
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
        mocks.openDirectoryInExplorer.mockResolvedValue(undefined);
        mocks.disconnect.mockResolvedValue(undefined);
        mocks.loadConnections.mockResolvedValue([
            {
                name: 'demo-connection',
                driver: 'postgres',
                host: 'localhost',
                port: 5432,
                db_name: 'postgres',
                username: 'postgres',
                password: '',
                save_password: false,
                ssl_mode: 'disable',
            },
        ]);
        mocks.importConnectionPackage.mockResolvedValue(null);
        mocks.exportConnectionPackage.mockResolvedValue(null);
        mocks.deleteConnection.mockResolvedValue(undefined);
    });

    it('renders projects with search and actions in card layout', () => {
        render(<ProjectHub />);

        expect(screen.getByPlaceholderText('Find project by name, description, or tag')).toBeInTheDocument();
        expect(screen.getByText('5 projects')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import project from folder' })).toBeInTheDocument();
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

    it('does not open project when clicking Edit and opens wizard in edit mode', async () => {
        render(<ProjectHub />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Edit project' })[0]);

        expect(mocks.openProject).not.toHaveBeenCalled();
        expect(screen.getByText('Edit project')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save & apply' })).toBeInTheDocument();
    });

    it('disables row while opening a project', async () => {
        mocks.openProject.mockImplementation(() => new Promise(() => {}));
        render(<ProjectHub />);

        const row = screen.getByTestId('recent-project-p2');
        fireEvent.click(screen.getByText('Project Two'));

        await waitFor(() => {
            expect(row).toHaveAttribute('aria-disabled', 'true');
        });
    });

    it('opens project folder in file explorer from card action', async () => {
        render(<ProjectHub />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Open in file explorer' })[0]);

        await waitFor(() => {
            expect(mocks.openDirectoryInExplorer).toHaveBeenCalledWith('C:/projects/p1');
        });
        expect(mocks.openProject).not.toHaveBeenCalled();
    });
});
