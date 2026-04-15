import React from 'react';
import type { TabResult } from '../../../stores/resultStore';

interface PersistedContextLike {
    resultFilterExpr?: string;
    resultOrderByExpr?: string;
    resultQuickFilter?: string;
    resultFilterBaseQuery?: string;
}

interface UseResultPanelFilterSyncOptions {
    tabId: string;
    contextTabId?: string;
    result: TabResult | undefined;
    baseQuery?: string;
    preferBaseQueryForFilter?: boolean;
    persistedContext: PersistedContextLike | undefined;
    updateTabContext: (tabId: string, patch: Record<string, unknown>) => void;
    setFilterExprStore: (tabId: string, value: string) => void;
    setOrderByExprStore: (tabId: string, value: string) => void;
}

export function useResultPanelFilterSync({
    tabId,
    contextTabId,
    result,
    baseQuery,
    preferBaseQueryForFilter = false,
    persistedContext,
    updateTabContext,
    setFilterExprStore,
    setOrderByExprStore,
}: UseResultPanelFilterSyncOptions) {
    const targetTabId = contextTabId || tabId;
    const [quickFilter, setQuickFilter] = React.useState(() => persistedContext?.resultQuickFilter || '');

    const setFilterExpr = React.useCallback((value: string) => {
        setFilterExprStore(tabId, value);
        updateTabContext(targetTabId, { resultFilterExpr: value });
    }, [setFilterExprStore, tabId, targetTabId, updateTabContext]);

    const setOrderByExpr = React.useCallback((value: string) => {
        setOrderByExprStore(tabId, value);
        updateTabContext(targetTabId, { resultOrderByExpr: value });
    }, [setOrderByExprStore, tabId, targetTabId, updateTabContext]);

    const filterExpr = result?.filterExpr || '';
    const orderByExpr = result?.orderByExpr || '';
    const persistedFilterBaseQuery = (persistedContext?.resultFilterBaseQuery || '').trim();
    const providedBaseQuery = (baseQuery || '').trim();
    const sourceQuery = persistedFilterBaseQuery
        || (preferBaseQueryForFilter
            ? (providedBaseQuery || result?.lastExecutedQuery || '')
            : (result?.lastExecutedQuery || providedBaseQuery || ''));

    React.useEffect(() => {
        const nextFilter = persistedContext?.resultQuickFilter || '';
        setQuickFilter(nextFilter);
    }, [persistedContext?.resultQuickFilter]);

    React.useEffect(() => {
        const nextExpr = persistedContext?.resultFilterExpr;
        if (typeof nextExpr !== 'string') return;
        if (nextExpr === (result?.filterExpr || '')) return;
        setFilterExprStore(tabId, nextExpr);
    }, [persistedContext?.resultFilterExpr, result?.filterExpr, setFilterExprStore, tabId]);

    React.useEffect(() => {
        const nextExpr = persistedContext?.resultOrderByExpr;
        if (typeof nextExpr !== 'string') return;
        if (nextExpr === (result?.orderByExpr || '')) return;
        setOrderByExprStore(tabId, nextExpr);
    }, [persistedContext?.resultOrderByExpr, result?.orderByExpr, setOrderByExprStore, tabId]);

    React.useEffect(() => {
        updateTabContext(targetTabId, { resultQuickFilter: quickFilter });
    }, [quickFilter, targetTabId, updateTabContext]);

    return {
        quickFilter,
        setQuickFilter,
        filterExpr,
        orderByExpr,
        setFilterExpr,
        setOrderByExpr,
        sourceQuery,
    };
}
