import { buildFilterOrderQuery } from '../../lib/queryBuilder';

export type QueryExecutionSource = 'editor' | 'filter' | 'other';

type UpdateTabContext = (tabId: string, patch: {
    resultFilterExpr?: string;
    resultOrderByExpr?: string;
    resultQuickFilter?: string;
    resultFilterBaseQuery?: string;
}) => void;

type ApplyPreExecuteFilterPolicyInput = {
    source: QueryExecutionSource;
    sourceTabId: string;
    resultTabIds: string[];
    clearResultFilterExpr: (tabId: string) => void;
    clearResultOrderByExpr: (tabId: string) => void;
    updateTabContext: UpdateTabContext;
};

type ResolveExecuteQueryInput = {
    source: QueryExecutionSource;
    editorQuery: string;
    filterExpr?: string;
    orderByExpr?: string;
    filterBaseQuery?: string;
};

export function getRelatedResultTabIds(sourceTabId: string, resultTabIds: string[]): string[] {
    return resultTabIds.filter((tabId) => (
        tabId === sourceTabId
        || tabId.startsWith(`${sourceTabId}::result:`)
        || tabId.startsWith(`${sourceTabId}::explain:`)
    ));
}

export function applyPreExecuteFilterPolicy({
    source,
    sourceTabId,
    resultTabIds,
    clearResultFilterExpr,
    clearResultOrderByExpr,
    updateTabContext,
}: ApplyPreExecuteFilterPolicyInput) {
    if (source === 'filter') return;

    const relatedResultTabIds = getRelatedResultTabIds(sourceTabId, resultTabIds);
    relatedResultTabIds.forEach((tabId) => {
        clearResultFilterExpr(tabId);
        clearResultOrderByExpr(tabId);
    });

    updateTabContext(sourceTabId, {
        resultFilterExpr: '',
        resultOrderByExpr: '',
        resultQuickFilter: '',
        resultFilterBaseQuery: '',
    });
}

export function resolveExecuteQuery({
    source,
    editorQuery,
    filterExpr,
    orderByExpr,
    filterBaseQuery,
}: ResolveExecuteQueryInput): string {
    if (source !== 'filter') {
        return editorQuery;
    }

    const baseQuery = filterBaseQuery ?? editorQuery;
    const nextFilter = (filterExpr || '').trim();
    const nextOrderBy = (orderByExpr || '').trim();
    if (!nextFilter && !nextOrderBy) {
        return baseQuery;
    }
    return buildFilterOrderQuery(baseQuery, nextFilter, nextOrderBy);
}

