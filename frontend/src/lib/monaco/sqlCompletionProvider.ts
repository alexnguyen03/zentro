import { languages } from 'monaco-editor';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useTemplateStore } from '../../stores/templateStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { analyzeSqlText } from './sqlCompletionAnalysis';
import { buildSqlCompletionItems } from './sqlCompletionBuilder';
import { getSchemasForActiveDatabase } from './sqlCompletionIdentifiers';
import { getOffsetAtPosition } from './sqlCompletionBuilderUtils';
import { resolveTableSuggestionItem } from './sqlSuggestionTableDocs';
import { DisposableLike, SqlCompletionRegisterMonacoApi } from './sqlCompletionTypes';

const REGISTRY_KEY = '__ZENTRO_SQL_COMPLETION_PROVIDER_REGISTRY__';
const REGISTRY_COUNTER_KEY = '__ZENTRO_SQL_COMPLETION_PROVIDER_COUNTER__';
const MONACO_ID_KEY = '__ZENTRO_SQL_COMPLETION_MONACO_ID__';

interface SqlCompletionProviderRegistration {
    active: boolean;
    generation: number;
    refCount: number;
    registration: DisposableLike;
    requestIdsByModel: WeakMap<object, number>;
    fallbackRequestId: number;
}

type SqlCompletionGlobal = typeof globalThis & {
    [REGISTRY_KEY]?: Map<string, SqlCompletionProviderRegistration>;
    [REGISTRY_COUNTER_KEY]?: number;
};

type SqlCompletionMonacoTarget = SqlCompletionRegisterMonacoApi & {
    [MONACO_ID_KEY]?: string;
};

function getSqlCompletionRegistry(): Map<string, SqlCompletionProviderRegistration> {
    const g = globalThis as SqlCompletionGlobal;
    if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new Map<string, SqlCompletionProviderRegistration>();
    return g[REGISTRY_KEY];
}

function getMonacoRegistrationId(monaco: SqlCompletionRegisterMonacoApi): string {
    const target = monaco as SqlCompletionMonacoTarget;
    if (target[MONACO_ID_KEY]) return target[MONACO_ID_KEY]!;
    const g = globalThis as SqlCompletionGlobal;
    const nextId = (g[REGISTRY_COUNTER_KEY] ?? 0) + 1;
    g[REGISTRY_COUNTER_KEY] = nextId;
    target[MONACO_ID_KEY] = `sql-completion-${nextId}`;
    return target[MONACO_ID_KEY]!;
}

function nextRequestIdForModel(
    provider: SqlCompletionProviderRegistration,
    model: unknown,
): number {
    if (model && typeof model === 'object') {
        const key = model as object;
        const nextId = (provider.requestIdsByModel.get(key) ?? 0) + 1;
        provider.requestIdsByModel.set(key, nextId);
        return nextId;
    }
    provider.fallbackRequestId += 1;
    return provider.fallbackRequestId;
}

function getLatestRequestIdForModel(
    provider: SqlCompletionProviderRegistration,
    model: unknown,
): number {
    if (model && typeof model === 'object') {
        return provider.requestIdsByModel.get(model as object) ?? 0;
    }
    return provider.fallbackRequestId;
}

function disposeProviderRegistration(provider: SqlCompletionProviderRegistration): void {
    provider.active = false;
    provider.generation += 1;
    try {
        provider.registration.dispose();
    } catch (error) {
        console.error('Error disposing SQL completion provider:', error);
    }
}

function createProviderRegistration(monaco: SqlCompletionRegisterMonacoApi): SqlCompletionProviderRegistration {
    const provider: Partial<SqlCompletionProviderRegistration> = {
        active: true,
        generation: 0,
        refCount: 0,
        requestIdsByModel: new WeakMap<object, number>(),
        fallbackRequestId: 0,
    };

    const completionProvider: languages.CompletionItemProvider = {
        triggerCharacters: ['.', ',', '('],
        provideCompletionItems: async (model, position, _context, token) => {
            const generation = provider.generation ?? 0;
            const requestId = nextRequestIdForModel(provider as SqlCompletionProviderRegistration, model);
            const shouldAbort = () =>
                !provider.active ||
                Boolean(token?.isCancellationRequested) ||
                (provider.generation ?? 0) !== generation ||
                getLatestRequestIdForModel(provider as SqlCompletionProviderRegistration, model) !== requestId;
            if (shouldAbort()) return { suggestions: [] };
            const fullText = model.getValue();
            const cursorOffset = typeof model.getOffsetAt === 'function' ? model.getOffsetAt(position) : getOffsetAtPosition(fullText, position);
            const analysis = analyzeSqlText(fullText, cursorOffset);
            if (analysis.isInCommentOrString || shouldAbort()) return { suggestions: [] };
            const word = model.getWordUntilPosition(position);
            const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
            const profile = useConnectionStore.getState().activeProfile;
            const profileKey = profile?.name ?? '';
            const dbName = profile?.db_name ?? '';
            const activeProject = useProjectStore.getState().activeProject;
            const activeEnvironmentKey = useEnvironmentStore.getState().activeEnvironmentKey || activeProject?.default_environment_key;
            const currentSchema = activeProject?.environments?.find((environment) => environment.key === activeEnvironmentKey)?.last_schema || '';
            const schemas = getSchemasForActiveDatabase(useSchemaStore.getState().trees, profileKey, dbName);
            const fetchColumns = async (schemaName: string, tableName: string) => {
                if (shouldAbort()) return [];
                return useSchemaStore.getState().checkAndFetchColumns(profileKey, dbName, schemaName, tableName);
            };
            const fetchRelationships = async (schemaName: string, tableName: string) => {
                if (shouldAbort()) return [];
                return useSchemaStore.getState().checkAndFetchRelationships(profileKey, dbName, schemaName, tableName);
            };
            const templates = useTemplateStore.getState().templates;
            const suggestions = await buildSqlCompletionItems(
                analysis,
                word.word || '',
                range,
                { monaco, schemas, driver: profile?.driver || '', profileKey, dbName, currentSchema, fetchColumns, fetchRelationships, templates },
                { shouldAbort },
            );
            if (shouldAbort()) return { suggestions: [] };
            return { suggestions };
        },
        resolveCompletionItem: async (item, token) => {
            const shouldAbort = () => !provider.active || Boolean(token?.isCancellationRequested);
            return resolveTableSuggestionItem(item, {
                shouldAbort,
                fetchColumns: (meta) =>
                    useSchemaStore.getState().checkAndFetchColumns(
                        meta.profileKey,
                        meta.dbName,
                        meta.schemaName,
                        meta.tableName,
                    ),
            });
        },
    };

    provider.registration = monaco.languages.registerCompletionItemProvider('sql', completionProvider);
    return provider as SqlCompletionProviderRegistration;
}

export function registerContextAwareSQLCompletion(monaco: SqlCompletionRegisterMonacoApi): DisposableLike {
    const registry = getSqlCompletionRegistry();
    const monacoId = getMonacoRegistrationId(monaco);
    let provider = registry.get(monacoId);
    if (!provider || !provider.active) {
        provider = createProviderRegistration(monaco);
        registry.set(monacoId, provider);
    }

    provider.refCount += 1;
    let disposed = false;

    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            if (!provider) return;
            provider.refCount = Math.max(0, provider.refCount - 1);
            if (provider.refCount > 0 || !provider.active) return;
            disposeProviderRegistration(provider);
            registry.delete(monacoId);
        },
    };
}

export function disposeSqlCompletionProviders(monaco?: SqlCompletionRegisterMonacoApi): void {
    const registry = getSqlCompletionRegistry();
    if (monaco) {
        const provider = registry.get(getMonacoRegistrationId(monaco));
        if (!provider || !provider.active) return;
        provider.refCount = 0;
        disposeProviderRegistration(provider);
        registry.delete(getMonacoRegistrationId(monaco));
        return;
    }

    registry.forEach((provider, key) => {
        if (!provider.active) return;
        provider.refCount = 0;
        disposeProviderRegistration(provider);
        registry.delete(key);
    });
}
