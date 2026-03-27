import { languages } from 'monaco-editor';
import { SchemaNode } from '../../stores/schemaStore';

export type CompletionKind = number;
export type DisposableLike = { dispose: () => void };
export type CompletionKindName =
    | 'Field'
    | 'Module'
    | 'Class'
    | 'Keyword'
    | 'Function'
    | 'Text'
    | 'Operator'
    | 'Snippet';

export interface SqlCompletionLanguagesApi {
    CompletionItemKind: Record<CompletionKindName, CompletionKind>;
    CompletionItemInsertTextRule: {
        InsertAsSnippet: number;
    };
}

export interface SqlCompletionMonacoApi {
    languages: SqlCompletionLanguagesApi;
}

export interface SqlCompletionRegisterMonacoApi extends SqlCompletionMonacoApi {
    languages: SqlCompletionLanguagesApi & {
        registerCompletionItemProvider: (
            languageSelector: string,
            provider: languages.CompletionItemProvider,
        ) => DisposableLike;
    };
}

export type SqlClause =
    | 'unknown'
    | 'select'
    | 'from'
    | 'join'
    | 'where'
    | 'having'
    | 'groupBy'
    | 'orderBy'
    | 'insert'
    | 'insertColumns'
    | 'values'
    | 'update'
    | 'set'
    | 'delete'
    | 'createTable'
    | 'createView'
    | 'alterTable'
    | 'on'
    | 'with';

export interface SqlToken {
    value: string;
    start: number;
    end: number;
    depth: number;
}

export interface SqlColumnLike {
    Name: string;
    DataType?: string;
    IsPrimaryKey?: boolean;
    IsNullable?: boolean;
    DefaultValue?: string;
}

export interface SqlTemplateLike {
    trigger: string;
    name: string;
    content: string;
}

export interface SqlSourceRef {
    kind: 'table' | 'view' | 'cte' | 'subquery';
    name: string;
    schemaName?: string;
    alias?: string;
    columns?: string[];
}

export interface SqlAnalysis {
    fullText: string;
    statementText: string;
    statementStartOffset: number;
    cursorOffset: number;
    cursorDepth: number;
    clause: SqlClause;
    isInCommentOrString: boolean;
    afterDot: boolean;
    dotIdentifier: string;
    sources: SqlSourceRef[];
    ctes: Map<string, SqlSourceRef>;
}

export interface SqlCompletionEnv {
    monaco: SqlCompletionMonacoApi;
    schemas: SchemaNode[];
    driver: string;
    profileKey?: string;
    dbName?: string;
    fetchColumns: (schemaName: string, tableName: string) => Promise<SqlColumnLike[]>;
    templates: SqlTemplateLike[];
}

export interface SqlCompletionBuildOptions {
    shouldAbort?: () => boolean;
}

export interface SuggestionRecord {
    priority: number;
    item: languages.CompletionItem;
}
