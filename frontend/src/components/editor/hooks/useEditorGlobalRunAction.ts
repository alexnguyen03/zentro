import { useEffect, type MutableRefObject } from 'react';

interface UseEditorGlobalRunActionArgs {
    tabId: string;
    isActiveRef: MutableRefObject<boolean | undefined>;
    runQuery: () => void;
}

export function useEditorGlobalRunAction({
    tabId,
    isActiveRef,
    runQuery,
}: UseEditorGlobalRunActionArgs) {
    useEffect(() => {
        const handleGlobalRun = (event: Event) => {
            const customEvent = event as CustomEvent<{ tabId?: string }>;
            if (customEvent.detail?.tabId === tabId && isActiveRef.current) {
                runQuery();
            }
        };

        window.addEventListener('run-query-action', handleGlobalRun);
        return () => window.removeEventListener('run-query-action', handleGlobalRun);
    }, [tabId, isActiveRef, runQuery]);
}
