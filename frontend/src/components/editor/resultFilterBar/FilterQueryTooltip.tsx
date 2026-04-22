import React from 'react';
import { Copy, ExternalLink, PlusSquare } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { buildFilterQuery, getQueryShape } from '../../../lib/queryBuilder';

interface FilterQueryTooltipProps {
    baseQuery: string;
    value: string;
    iconButtonClassName: string;
    onCopy: () => void;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
    onClose: () => void;
}

function renderQueryPreview(query: string, condition: string) {
    const shape = getQueryShape(query);

    if (shape === 'bare') {
        return (
            <>
                {query} <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter
                <br />
                <span className="text-success font-semibold">WHERE</span> {condition}
            </>
        );
    }

    if (shape === 'has-where') {
        const whereIndex = query.search(/\bwhere\b/i);
        const beforeWhere = query.slice(0, whereIndex).trimEnd();
        const existingCondition = query.slice(whereIndex + 5).trim();
        return (
            <>
                {beforeWhere} <span className="text-pink-600 dark:text-pink-400">WHERE</span> ({existingCondition})
                <br />
                <span className="pl-4 inline-block text-pink-600 dark:text-pink-400">AND</span> ({condition})
            </>
        );
    }

    return (
        <>
            <span className="text-pink-600 dark:text-pink-400">SELECT</span> *{' '}
            <span className="text-pink-600 dark:text-pink-400">FROM</span> (
            <br />
            <span className="pl-4 inline-block">{query}</span>
            <br />
            ) <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter
            <br />
            <span className="text-success font-semibold">WHERE</span> {condition}
        </>
    );
}

export const FilterQueryTooltip: React.FC<FilterQueryTooltipProps> = ({
    baseQuery,
    value,
    iconButtonClassName,
    onCopy,
    onAppendToQuery,
    onOpenInNewTab,
    onClose,
}) => {
    const queryWithFilter = buildFilterQuery(baseQuery, value || '<condition>');

    return (
        <div className="absolute top-full left-0 mt-2 z-50 w-[480px] bg-bg-primary border border-border rounded-md shadow-lg flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
            <div className="px-3 py-2 bg-bg-tertiary flex items-center justify-between border-b border-border">
                <span className="text-xs font-semibold text-text-primary">Current Query (Filtered)</span>
                <div className="flex items-center gap-0.5">
                    <button className={iconButtonClassName} title="Copy query" onClick={onCopy}>
                        <Copy size={12} />
                    </button>

                    {onAppendToQuery && (
                        <button
                            className={cn(iconButtonClassName, 'text-success hover:bg-success/10 hover:border-success/30')}
                            title="Append to current tab (last line)"
                            onClick={() => {
                                onAppendToQuery(queryWithFilter);
                                onClose();
                            }}
                        >
                            <PlusSquare size={12} />
                        </button>
                    )}

                    {onOpenInNewTab && (
                        <button
                            className={cn(iconButtonClassName, 'text-text-secondary hover:text-text-primary')}
                            title="Open in new tab"
                            onClick={() => {
                                onOpenInNewTab(queryWithFilter);
                                onClose();
                            }}
                        >
                            <ExternalLink size={12} />
                        </button>
                    )}
                </div>
            </div>
            <div className="p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto text-text-secondary">
                {renderQueryPreview(baseQuery.replace(/;\s*$/, '').trim(), value || '<condition>')}
            </div>
        </div>
    );
};
