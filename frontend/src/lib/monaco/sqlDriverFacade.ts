export interface SqlDriverFacade {
    key: string;
    aliases?: string[];
    quoteIdentifier: (identifier: string) => string;
}

const facadeRegistry = new Map<string, SqlDriverFacade>();
const aliasToKey = new Map<string, string>();

function normalizeKey(driver: string): string {
    return (driver || '').trim().toLowerCase();
}

function registerAlias(alias: string, key: string) {
    const normalizedAlias = normalizeKey(alias);
    if (!normalizedAlias) return;
    aliasToKey.set(normalizedAlias, key);
}

function registerDefaults() {
    registerSqlDriverFacade({
        key: 'postgres',
        aliases: ['pgx', 'postgresql'],
        quoteIdentifier: (identifier) => `"${identifier}"`,
    });
    registerSqlDriverFacade({
        key: 'mysql',
        quoteIdentifier: (identifier) => `\`${identifier}\``,
    });
    registerSqlDriverFacade({
        key: 'sqlserver',
        aliases: ['mssql'],
        quoteIdentifier: (identifier) => `[${identifier}]`,
    });
    registerSqlDriverFacade({
        key: 'sqlite',
        quoteIdentifier: (identifier) => `"${identifier}"`,
    });
}

export function registerSqlDriverFacade(facade: SqlDriverFacade): void {
    const key = normalizeKey(facade.key);
    if (!key) return;
    facadeRegistry.set(key, { ...facade, key });
    registerAlias(key, key);
    (facade.aliases || []).forEach((alias) => registerAlias(alias, key));
}

export function resolveSqlDriverFacade(driver: string): SqlDriverFacade | undefined {
    const normalized = normalizeKey(driver);
    if (!normalized) return undefined;
    const resolvedKey = aliasToKey.get(normalized) || normalized;
    return facadeRegistry.get(resolvedKey);
}

export function normalizeDriverKey(driver: string): string {
    const normalized = normalizeKey(driver);
    return aliasToKey.get(normalized) || normalized;
}

registerDefaults();
