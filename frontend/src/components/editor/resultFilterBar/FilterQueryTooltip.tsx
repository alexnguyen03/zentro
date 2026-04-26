import React from 'react';
import { Copy, ExternalLink, PlusSquare } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { buildFilterQuery, getQueryShape } from '../../../lib/queryBuilder';
import { Button } from '../../ui';

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

    if (shape === 'no-where') {
        return (
            <>
                {query} <span className="text-accent">AS</span> _zentro_filter
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
                {beforeWhere} <span className="text-accent">WHERE</span> ({existingCondition})
                <br />
                <span className="pl-4 inline-block text-accent">AND</span> ({condition})
            </>
        );
    }

    return (
        <>
            <span className="text-accent">SELECT</span> *{' '}
            <span className="text-accent">FROM</span> (
            <br />
            <span className="pl-4 inline-block">{query}</span>
            <br />
            ) <span className="text-accent">AS</span> _zentro_filter
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
                <span className="text-small font-semibold text-text-primary">Current Query (Filtered)</span>
                <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" className={iconButtonClassName} title="Copy query" onClick={onCopy}>
                        <Copy size={12} />
                    </Button>

                    {onAppendToQuery && (
                        <Button
                            className={cn(iconButtonClassName, 'text-success hover:bg-success/10 hover:border-success/30')}
                            title="Append to current tab (last line)"
                            onClick={() => {
                                onAppendToQuery(queryWithFilter);
                                onClose();
                            }}
                        >
                            <PlusSquare size={12} />
                        </Button>
                    )}

                    {onOpenInNewTab && (
                        <Button
                            className={cn(iconButtonClassName, 'text-text-secondary hover:text-text-primary')}
                            title="Open in new tab"
                            onClick={() => {
                                onOpenInNewTab(queryWithFilter);
                                onClose();
                            }}
                        >
                            <ExternalLink size={12} />
                        </Button>
                    )}
                </div>
            </div>
            <div className="p-3 text-label font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto text-text-secondary">
                {renderQueryPreview(baseQuery.replace(/;\s*$/, '').trim(), value || '<condition>')}
            </div>
        </div>
    );
};
