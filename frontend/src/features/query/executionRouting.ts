import { buildFilterQuery } from '../../lib/queryBuilder';

export type QueryExecutionSource = 'editor' | 'filter' | 'other';

type UpdateTabContext = (tabId: string, patch: { resultFilterExpr?: string; resultQuickFilter?: string }) => void;

type ApplyPreExecuteFilterPolicyInput = {
    source: QueryExecutionSource;
    sourceTabId: string;
    resultTabIds: string[];
    clearResultFilterExpr: (tabId: string) => void;
    updateTabContext: UpdateTabContext;
};

type ResolveExecuteQueryInput = {
    source: QueryExecutionSource;
    editorQuery: string;
    filterExpr?: string;
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
    updateTabContext,
}: ApplyPreExecuteFilterPolicyInput) {
    if (source === 'filter') return;

    const relatedResultTabIds = getRelatedResultTabIds(sourceTabId, resultTabIds);
    relatedResultTabIds.forEach((tabId) => {
        clearResultFilterExpr(tabId);
    });

    updateTabContext(sourceTabId, {
        resultFilterExpr: '',
        resultQuickFilter: '',
    });
}

export function resolveExecuteQuery({
    source,
    editorQuery,
    filterExpr,
    filterBaseQuery,
}: ResolveExecuteQueryInput): string {
    if (source !== 'filter') {
        return editorQuery;
    }

    const baseQuery = filterBaseQuery ?? editorQuery;
    const nextFilter = (filterExpr || '').trim();
    if (!nextFilter) {
        return baseQuery;
    }
    return buildFilterQuery(baseQuery, nextFilter);
}

