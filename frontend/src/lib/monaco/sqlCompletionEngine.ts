export {
    analyzeSqlText,
    buildSqlCompletionItems,
    getSchemasForActiveDatabase,
    registerContextAwareSQLCompletion,
    normalizeDriverKey,
    registerSqlDriverFacade,
    resolveSqlDriverFacade,
    formatTableSuggestionDocumentation,
    isTableCompletionItem,
    resolveTableSuggestionItem,
} from './sqlCompletionCore';

export type {
    SqlClause,
    SqlToken,
    SqlColumnLike,
    SqlTemplateLike,
    SqlSourceRef,
    SqlAnalysis,
    SqlCompletionEnv,
    SqlCompletionBuildOptions,
} from './sqlCompletionCore';
