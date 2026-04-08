import { wailsGateway } from '../platform/app-api/wailsGateway';
import type { models } from '../../wailsjs/go/models';
import type {
    EnvironmentKey,
    Project,
    ProjectAsset,
    ProjectConnection,
    ProjectEnvironment,
} from '../types/project';
import { ENVIRONMENT_KEYS } from '../lib/projects';

import { ENVIRONMENT_KEY } from '../lib/constants';

export const ForceQuit = () => wailsGateway.ForceQuit();
export const ConnectProjectEnvironment = (environmentKey: string) => wailsGateway.ConnectProjectEnvironment(environmentKey);
export const GetDefaultProjectStorageRoot = () => wailsGateway.GetDefaultProjectStorageRoot();
export const PickDirectory = (initialPath = '') => wailsGateway.PickDirectory(initialPath);

function toEnvironmentKey(value: unknown, fallback: EnvironmentKey = ENVIRONMENT_KEY.LOCAL): EnvironmentKey {
    if (typeof value === 'string' && ENVIRONMENT_KEYS.includes(value as EnvironmentKey)) {
        return value as EnvironmentKey;
    }
    return fallback;
}

function normalizeProjectEnvironment(projectId: string, raw: unknown): ProjectEnvironment {
    const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const key = toEnvironmentKey(source.key);

    return {
        id: typeof source.id === 'string' ? source.id : crypto.randomUUID(),
        project_id: typeof source.project_id === 'string' ? source.project_id : projectId,
        key,
        label: typeof source.label === 'string' ? source.label : key.toUpperCase(),
        badge_color: typeof source.badge_color === 'string' ? source.badge_color : key,
        is_protected: source.is_protected === true,
        is_read_only: source.is_read_only === true,
        last_database: typeof source.last_database === 'string' ? source.last_database : undefined,
        last_schema: typeof source.last_schema === 'string' ? source.last_schema : undefined,
        last_catalog: typeof source.last_catalog === 'string' ? source.last_catalog : undefined,
        connection_id: typeof source.connection_id === 'string' ? source.connection_id : undefined,
    };
}

function normalizeProjectConnection(projectId: string, raw: unknown): ProjectConnection {
    const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const environmentKey = toEnvironmentKey(source.environment_key);

    return {
        id: typeof source.id === 'string' ? source.id : crypto.randomUUID(),
        project_id: typeof source.project_id === 'string' ? source.project_id : projectId,
        environment_key: environmentKey,
        name: typeof source.name === 'string' ? source.name : '',
        driver: typeof source.driver === 'string' ? source.driver : '',
        version: typeof source.version === 'string' ? source.version : undefined,
        host: typeof source.host === 'string' ? source.host : undefined,
        port: typeof source.port === 'number' ? source.port : undefined,
        database: typeof source.database === 'string' ? source.database : undefined,
        username: typeof source.username === 'string' ? source.username : undefined,
        password: typeof source.password === 'string' ? source.password : undefined,
        password_policy: typeof source.password_policy === 'string' ? source.password_policy : undefined,
        save_password: source.save_password === true,
        ssl_mode: typeof source.ssl_mode === 'string' ? source.ssl_mode : undefined,
        socket_path: typeof source.socket_path === 'string' ? source.socket_path : undefined,
        use_socket: source.use_socket === true,
        ssh_enabled: source.ssh_enabled === true,
        status_color: typeof source.status_color === 'string' ? source.status_color : undefined,
        advanced_meta: (source.advanced_meta && typeof source.advanced_meta === 'object')
            ? Object.fromEntries(
                Object.entries(source.advanced_meta as Record<string, unknown>)
                    .filter(([, value]) => typeof value === 'string')
                    .map(([key, value]) => [key, value as string]),
            )
            : undefined,
    };
}

function toProject(raw: models.Project): Project {
    const source = raw as models.Project & Record<string, unknown>;
    const defaultEnvironmentKey = toEnvironmentKey(source.default_environment_key);
    const lastActiveEnvironmentKey = toEnvironmentKey(source.last_active_environment_key, defaultEnvironmentKey);

    return {
        id: typeof source.id === 'string' ? source.id : '',
        slug: typeof source.slug === 'string' ? source.slug : '',
        name: typeof source.name === 'string' ? source.name : '',
        description: typeof source.description === 'string' ? source.description : undefined,
        git_repo_path: typeof source.git_repo_path === 'string' ? source.git_repo_path : undefined,
        storage_path: typeof source.storage_path === 'string' ? source.storage_path : undefined,
        tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        created_at: typeof source.created_at === 'string' ? source.created_at : '',
        updated_at: typeof source.updated_at === 'string' ? source.updated_at : '',
        default_environment_key: defaultEnvironmentKey,
        last_active_environment_key: lastActiveEnvironmentKey,
        layout_state: typeof source.layout_state === 'string' ? source.layout_state : undefined,
        environments: Array.isArray(source.environments)
            ? source.environments.map((environment) => normalizeProjectEnvironment(
                typeof source.id === 'string' ? source.id : '',
                environment,
            ))
            : [],
        connections: Array.isArray(source.connections)
            ? source.connections.map((connection) => normalizeProjectConnection(
                typeof source.id === 'string' ? source.id : '',
                connection,
            ))
            : [],
        assets: Array.isArray(source.assets)
            ? source.assets.filter((asset): asset is ProjectAsset => !!asset && typeof asset === 'object')
            : [],
    };
}

function toGatewayProject(project: Project): models.Project {
    return project as models.Project;
}

export async function listProjects(): Promise<Project[]> {
    return (await wailsGateway.ListProjects()).map(toProject);
}

export async function getProject(projectId: string): Promise<Project | null> {
    try {
        return toProject(await wailsGateway.GetProject(projectId));
    } catch {
        return null;
    }
}

export async function createProject(project: Project): Promise<Project> {
    return toProject(await wailsGateway.CreateProject(toGatewayProject(project)));
}

export async function saveProject(project: Project): Promise<Project> {
    return toProject(await wailsGateway.SaveProject(toGatewayProject(project)));
}

export async function deleteProject(projectId: string): Promise<void> {
    await wailsGateway.DeleteProject(projectId);
}

export async function openProject(projectId: string): Promise<Project | null> {
    try {
        return toProject(await wailsGateway.OpenProject(projectId));
    } catch {
        return null;
    }
}

export async function openProjectFromDirectory(directoryPath: string): Promise<Project | null> {
    try {
        return toProject(await wailsGateway.OpenProjectFromDirectory(directoryPath));
    } catch {
        return null;
    }
}

export async function getActiveProject(): Promise<Project | null> {
    try {
        return toProject(await wailsGateway.GetActiveProject());
    } catch {
        return null;
    }
}
