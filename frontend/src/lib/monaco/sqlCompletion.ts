export {
    analyzeSqlText,
    buildSqlCompletionItems,
    getSchemasForActiveDatabase,
    registerContextAwareSQLCompletion,
    disposeSqlCompletionProviders,
    normalizeDriverKey,
    registerSqlDriverFacade,
    resolveSqlDriverFacade,
    formatTableSuggestionDocumentation,
    isTableCompletionItem,
    resolveTableSuggestionItem,
} from './sqlCompletionEngine';

export type {
    SqlClause,
    SqlToken,
    SqlColumnLike,
    SqlTemplateLike,
    SqlSourceRef,
    SqlAnalysis,
    SqlCompletionEnv,
    SqlCompletionBuildOptions,
} from './sqlCompletionEngine';
