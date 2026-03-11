import { models } from '../../wailsjs/go/models';
import PostgresLogo from '../assets/images/postgresql-logo-svgrepo-com.svg';
import SqlServerLogo from '../assets/images/microsoft-sql-server-logo-svgrepo-com.svg';
import MySqlLogo from '../assets/images/mysql-logo-svgrepo-com.svg';
import SqliteLogo from '../assets/images/sqlite-svgrepo-com.svg';

type ConnectionProfile = models.ConnectionProfile;

// ── Extra field descriptor ────────────────────────────────────────────────────
export interface ExtraField {
    /** Must match a boolean key on ConnectionProfile */
    name: keyof ConnectionProfile;
    label: string;
    type: 'checkbox';
}

// ── Provider contract ─────────────────────────────────────────────────────────
export interface ProviderConfig {
    /** Matches ConnectionProfile.driver */
    key: string;
    label: string;
    defaultPort: number | null;
    defaultSsl: string;
    /** Hex colour used for icon background tinting */
    color: string;
    /** SVG asset imported via Vite */
    icon: string;
    /** Whether host / port fields are meaningful for this provider */
    requiresHost: boolean;
    /** Whether username / password fields are meaningful for this provider */
    requiresAuth: boolean;
    /** Provider-specific additional boolean fields rendered as checkboxes */
    extraFields?: ExtraField[];
}

// ── Registry — add new providers HERE only ───────────────────────────────────
export const PROVIDERS: ProviderConfig[] = [
    {
        key: 'postgres',
        label: 'PostgreSQL',
        defaultPort: 5432,
        defaultSsl: 'disable',
        color: '#336791',
        icon: PostgresLogo,
        requiresHost: true,
        requiresAuth: true,
    },
    {
        key: 'sqlserver',
        label: 'SQL Server',
        defaultPort: 1433,
        defaultSsl: 'disable',
        color: '#CC2927',
        icon: SqlServerLogo,
        requiresHost: true,
        requiresAuth: true,
        extraFields: [
            { name: 'trust_server_cert', label: 'Trust server cert', type: 'checkbox' },
        ],
    },
    {
        key: 'mysql',
        label: 'MySQL',
        defaultPort: 3306,
        defaultSsl: 'disable',
        color: '#F29111',
        icon: MySqlLogo,
        requiresHost: true,
        requiresAuth: true,
    },
    {
        key: 'sqlite',
        label: 'SQLite',
        defaultPort: null,
        defaultSsl: 'disable',
        color: '#44A8D1',
        icon: SqliteLogo,
        requiresHost: false,
        requiresAuth: false,
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
export const getProvider = (key: string): ProviderConfig =>
    PROVIDERS.find(p => p.key === key) ?? PROVIDERS[0];

export const makeDefaultForm = (driver = 'postgres'): Partial<ConnectionProfile> => {
    const p = getProvider(driver);
    return {
        driver,
        host: 'localhost',
        port: p.defaultPort ?? 5432,
        ssl_mode: p.defaultSsl,
        connect_timeout: 30,
        save_password: true,
        name: '',
        username: '',
        password: '',
        db_name: '',
        show_all_schemas: false,
        trust_server_cert: false,
    };
};

/** Parses a connection URI and returns the partial profile updates. */
export const parseConnectionString = (
    uri: string,
    currentName: string | undefined
): Partial<ConnectionProfile> => {
    const toParse = uri.includes('://') ? uri : `postgres://${uri}`;
    try {
        const url = new URL(toParse);
        const updates: Partial<ConnectionProfile> = {};
        if (url.protocol.startsWith('postgres')) updates.driver = 'postgres';
        if (url.protocol.startsWith('sqlserver')) updates.driver = 'sqlserver';
        if (url.hostname) updates.host = url.hostname;
        if (url.port) updates.port = parseInt(url.port, 10);
        const db = url.pathname.replace(/^\//, '');
        if (db) updates.db_name = db;
        if (url.username) updates.username = decodeURIComponent(url.username);
        if (url.password) updates.password = decodeURIComponent(url.password);
        const sslmode = url.searchParams.get('sslmode');
        if (sslmode) updates.ssl_mode = sslmode;
        if (!currentName && updates.host)
            updates.name = `${updates.driver ?? 'pg'}-${updates.host.split('.')[0]}`;
        return updates;
    } catch {
        return {};
    }
};

/** Returns a validation error string, or null if form is valid. */
export const validateConnectionForm = (
    form: Partial<ConnectionProfile>,
    isEditing: boolean,
    existingNames: string[]
): string | null => {
    if (!form.name?.trim()) return 'Profile name is required';
    if (!isEditing && existingNames.includes(form.name.trim()))
        return `"${form.name.trim()}" already exists`;
    const p = getProvider(form.driver ?? 'postgres');
    if (p.requiresHost && !form.host?.trim()) return 'Host is required';
    if (p.requiresAuth && !form.username?.trim()) return 'Username is required';
    if (!form.db_name?.trim()) return 'Database name is required';
    if (p.requiresHost && (!form.port || form.port <= 0)) return 'Port must be a positive number';
    return null;
};
