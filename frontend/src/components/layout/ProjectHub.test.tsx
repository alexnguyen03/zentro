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
    persistProject: vi.fn(),
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

function makeProject(
    id: string,
    name: string,
    options?: {
        tags?: string[];
        updatedAt?: string;
        environmentKeys?: Array<Project['default_environment_key']>;
        driver?: string;
    },
): Project {
    return {
        id,
        slug: name.toLowerCase(),
        name,
        description: '',
        tags: options?.tags || [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: options?.updatedAt || '2026-01-01T00:00:00Z',
        default_environment_key: ENVIRONMENT_KEY.LOCAL,
        last_active_environment_key: ENVIRONMENT_KEY.LOCAL,
        layout_state: '',
        environments: (options?.environmentKeys || []).map((key, index) => ({
            id: `${id}-env-${index}`,
            project_id: id,
            key,
            label: key.toUpperCase(),
            is_protected: false,
            is_read_only: false,
        })),
        connections: options?.driver ? [{
            id: `${id}-conn-1`,
            project_id: id,
            environment_key: options.environmentKeys?.[0] || ENVIRONMENT_KEY.LOCAL,
            name: `${name} connection`,
            driver: options.driver,
            save_password: false,
            use_socket: false,
            ssh_enabled: false,
        }] : [],
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
    saveProject: mocks.persistProject,
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
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        projectState.projects = [
            makeProject('p1', 'Project One', {
                tags: ['pinned'],
                updatedAt: new Date(now).toISOString(),
                environmentKeys: [ENVIRONMENT_KEY.LOCAL],
                driver: 'postgres',
            }),
            makeProject('p2', 'Project Two', {
                updatedAt: new Date(now - dayMs).toISOString(),
                environmentKeys: [ENVIRONMENT_KEY.PRODUCTION, ENVIRONMENT_KEY.STAGING],
                driver: 'mysql',
            }),
            makeProject('p3', 'Project Three', {
                updatedAt: new Date(now - (12 * dayMs)).toISOString(),
                environmentKeys: [ENVIRONMENT_KEY.LOCAL],
                driver: 'sqlite',
            }),
            makeProject('p4', 'Project Four', {
                tags: ['pin:true'],
                updatedAt: new Date(now - (5 * dayMs)).toISOString(),
                environmentKeys: [ENVIRONMENT_KEY.DEVELOPMENT, ENVIRONMENT_KEY.LOCAL],
                driver: 'sqlserver',
            }),
            makeProject('p5', 'Project Five', {
                updatedAt: new Date(now - (30 * dayMs)).toISOString(),
                environmentKeys: [ENVIRONMENT_KEY.TESTING],
            }),
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
        mocks.persistProject.mockImplementation(async (project: Project) => project);
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

    it('renders tabs, search and top actions', () => {
        render(<ProjectHub />);

        expect(screen.getByPlaceholderText(/Find project by name, description, or tag|Search projects\.\.\./i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Pinned/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Production/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Local-only/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /New/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import project from folder' })).toBeInTheDocument();
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

    it('opens edit flow from context menu and does not open project', async () => {
        render(<ProjectHub />);

        fireEvent.contextMenu(screen.getByTestId('recent-project-p1'));
        fireEvent.click(await screen.findByText('Edit project'));

        expect(mocks.openProject).not.toHaveBeenCalled();
        expect(screen.getByText('Edit project')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save & apply/i })).toBeInTheDocument();
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

    it('opens project folder in file explorer from context menu action', async () => {
        render(<ProjectHub />);

        fireEvent.contextMenu(screen.getByTestId('recent-project-p1'));
        fireEvent.click(await screen.findByText('Open in file explorer'));

        await waitFor(() => {
            expect(mocks.openDirectoryInExplorer).toHaveBeenCalledWith('C:/projects/p1');
        });
        expect(mocks.openProject).not.toHaveBeenCalled();
    });

    it('pins project from context menu', async () => {
        render(<ProjectHub />);

        fireEvent.contextMenu(screen.getByTestId('recent-project-p2'));
        fireEvent.click(await screen.findByText('Pin project'));

        await waitFor(() => {
            expect(mocks.persistProject).toHaveBeenCalledWith(expect.objectContaining({
                id: 'p2',
                tags: expect.arrayContaining(['pinned']),
            }));
        });
    });

    it('pins project directly from card pin button', async () => {
        render(<ProjectHub />);

        fireEvent.click(screen.getByTestId('project-pin-toggle-p2'));

        await waitFor(() => {
            expect(mocks.persistProject).toHaveBeenCalledWith(expect.objectContaining({
                id: 'p2',
                tags: expect.arrayContaining(['pinned']),
            }));
        });
        expect(mocks.openProject).not.toHaveBeenCalled();
    });

    it('filters by tabs and search together', async () => {
        render(<ProjectHub />);

        fireEvent.click(screen.getByRole('button', { name: /Pinned/i }));
        expect(screen.getByTestId('recent-project-p1')).toBeInTheDocument();
        expect(screen.getByTestId('recent-project-p4')).toBeInTheDocument();
        expect(screen.queryByTestId('recent-project-p2')).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/Find project by name, description, or tag|Search projects\.\.\./i), {
            target: { value: 'four' },
        });

        await waitFor(() => {
            expect(screen.getByTestId('recent-project-p4')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('recent-project-p1')).not.toBeInTheDocument();
    });

    it('shows no inline action buttons in rows', () => {
        render(<ProjectHub />);
        expect(screen.queryByRole('button', { name: 'Edit project' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open in file explorer' })).not.toBeInTheDocument();
    });
});
