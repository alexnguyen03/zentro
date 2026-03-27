export { analyzeSqlText } from './sqlCompletionAnalysis';
export { buildSqlCompletionItems } from './sqlCompletionBuilder';
export { getSchemasForActiveDatabase } from './sqlCompletionIdentifiers';
export { registerContextAwareSQLCompletion } from './sqlCompletionProvider';
export {
    normalizeDriverKey,
    registerSqlDriverFacade,
    resolveSqlDriverFacade,
} from './sqlDriverFacade';
export {
    formatTableSuggestionDocumentation,
    isTableCompletionItem,
    resolveTableSuggestionItem,
} from './sqlSuggestionTableDocs';

export type {
    CompletionKind,
    CompletionKindName,
    DisposableLike,
    SqlClause,
    SqlToken,
    SqlColumnLike,
    SqlTableRelationshipLike,
    SqlTemplateLike,
    SqlSourceRef,
    SqlAnalysis,
    SqlCompletionEnv,
    SqlCompletionBuildOptions,
    SqlCompletionLanguagesApi,
    SqlCompletionMonacoApi,
    SqlCompletionRegisterMonacoApi,
    SuggestionRecord,
} from './sqlCompletionTypes';
