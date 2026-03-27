import { languages } from 'monaco-editor';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSchemaStore } from '../../stores/schemaStore';
import { useTemplateStore } from '../../stores/templateStore';
import { analyzeSqlText } from './sqlCompletionAnalysis';
import { buildSqlCompletionItems } from './sqlCompletionBuilder';
import { getSchemasForActiveDatabase } from './sqlCompletionIdentifiers';
import { getOffsetAtPosition } from './sqlCompletionBuilderUtils';
import { resolveTableSuggestionItem } from './sqlSuggestionTableDocs';
import { DisposableLike, SqlCompletionRegisterMonacoApi } from './sqlCompletionTypes';

const DISPOSABLES_KEY = '__ZENTRO_SQL_COMPLETION_DISPOSABLES__';
type SqlCompletionWindow = Window & { [DISPOSABLES_KEY]?: DisposableLike[] };

function getSqlCompletionDisposables(): DisposableLike[] {
    const globalWindow = window as SqlCompletionWindow;
    if (!globalWindow[DISPOSABLES_KEY]) globalWindow[DISPOSABLES_KEY] = [];
    return globalWindow[DISPOSABLES_KEY];
}

export function registerContextAwareSQLCompletion(monaco: SqlCompletionRegisterMonacoApi) {
    const disposables = getSqlCompletionDisposables();
    let latestRequestId = 0;
    while (disposables.length > 0) {
        const d = disposables.pop();
        if (d && typeof d.dispose === 'function') {
            try { d.dispose(); } catch (error) { console.error('Error disposing SQL completion provider:', error); }
        }
    }

    const provider: languages.CompletionItemProvider = {
        triggerCharacters: ['.', ' ', ',', '('],
        provideCompletionItems: async (model, position, _context, token) => {
            const requestId = ++latestRequestId;
            const shouldAbort = () => Boolean(token?.isCancellationRequested) || requestId !== latestRequestId;
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
            const schemas = getSchemasForActiveDatabase(useSchemaStore.getState().trees, profileKey, dbName);
            const fetchColumns = async (schemaName: string, tableName: string) => {
                if (shouldAbort()) return [];
                return useSchemaStore.getState().checkAndFetchColumns(profileKey, dbName, schemaName, tableName);
            };
            const templates = useTemplateStore.getState().templates;
            const suggestions = await buildSqlCompletionItems(
                analysis,
                word.word || '',
                range,
                { monaco, schemas, driver: profile?.driver || '', profileKey, dbName, fetchColumns, templates },
                { shouldAbort },
            );
            if (shouldAbort()) return { suggestions: [] };
            return { suggestions };
        },
        resolveCompletionItem: async (item, token) => {
            const shouldAbort = () => Boolean(token?.isCancellationRequested);
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

    const registration = monaco.languages.registerCompletionItemProvider('sql', provider);
    disposables.push(registration);
}
