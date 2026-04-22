import React from 'react';
import { FetchTotalRowCount } from '../../../wailsjs/go/app/App';
import { TabResult } from '../../stores/resultStore';

interface UseResultPanelCountParams {
    tabId: string;
    result?: TabResult;
    onQueryStarted?: () => void;
}

export function useResultPanelCount({ tabId, result, onQueryStarted }: UseResultPanelCountParams) {
    const [totalCount, setTotalCount] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(false);
    const prevIsDone = React.useRef(result?.isDone);

    const handleCountTotal = React.useCallback(async () => {
        if (!tabId) {
            return;
        }

        setIsCounting(true);
        try {
            const count = await FetchTotalRowCount(tabId);
            setTotalCount(count);
        } catch (err) {
            console.warn(`Count failed in background: ${err}`);
            setTotalCount(-1);
        } finally {
            setIsCounting(false);
        }
    }, [tabId]);

    React.useEffect(() => {
        if (!result) {
            return;
        }

        if (prevIsDone.current !== result.isDone) {
            if (!result.isDone) {
                setTotalCount(null);
                setIsCounting(false);
                onQueryStarted?.();
                handleCountTotal();
            }
            prevIsDone.current = result.isDone;
        }
    }, [result, onQueryStarted, handleCountTotal]);

    const displayTotalCount = React.useMemo(() => {
        if (!result) {
            return undefined;
        }

        if (totalCount !== null && totalCount >= 0) {
            return totalCount;
        }

        if (result.isDone && !result.hasMore) {
            return result.rows.length;
        }

        return undefined;
    }, [result, totalCount]);

    return {
        totalCount,
        isCounting,
        displayTotalCount,
    };
}
