import type { EnvironmentKey, AssetType } from '../lib/constants';
export type { EnvironmentKey, AssetType };

export interface ProjectEnvironment {
    id: string;
    project_id: string;
    key: EnvironmentKey;
    label: string;
    badge_color?: string;
    is_protected: boolean;
    is_read_only: boolean;
    last_database?: string;
    last_schema?: string;
    last_catalog?: string;
    connection_id?: string;
}

export interface ProjectConnection {
    id: string;
    project_id: string;
    environment_key: EnvironmentKey;
    name: string;
    driver: string;
    version?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    password_policy?: string;
    save_password: boolean;
    ssl_mode?: string;
    socket_path?: string;
    use_socket: boolean;
    ssh_enabled: boolean;
    status_color?: string;
    advanced_meta?: Record<string, string>;
}

export interface ProjectAsset {
    id: string;
    project_id: string;
    type: AssetType;
    name: string;
    description?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: string;
    slug: string;
    name: string;
    description?: string;
    storage_path?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
    default_environment_key: EnvironmentKey;
    last_active_environment_key?: EnvironmentKey;
    layout_state?: string;
    environments?: ProjectEnvironment[];
    connections?: ProjectConnection[];
    assets?: ProjectAsset[];
}

export interface ExecutionContext {
    project_id: string;
    environment_key: string;
    connection_id: string;
    database?: string;
    schema?: string;
    tab_id?: string;
}
