import React, { useRef, useEffect } from 'react';
import { Copy, PlusSquare, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buildFilterQuery, getQueryShape } from '../../lib/queryBuilder';
import { useToast } from '../layout/Toast';
import { setClipboardText } from '../../services/clipboardService';

interface ResultFilterBarProps {
    value: string;
    onChange: (v: string) => void;
    onRun: () => void;
    /** Clears the filter and re-runs the original query */
    onClear: () => void;
    /** The base query being wrapped */
    baseQuery?: string;
    /** Appends the generated filter SQL as new lines at the end of the active editor */
    onAppendToQuery?: (fullQuery: string) => void;
    /** Opens the generated filter SQL in a new query tab */
    onOpenInNewTab?: (fullQuery: string) => void;
    /** Optional actions to render on the right side of the bar */
    children?: React.ReactNode;
}

export const ResultFilterBar: React.FC<ResultFilterBarProps> = ({
    value,
    onChange,
    onRun,
    onClear,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    children,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [showTooltip, setShowTooltip] = React.useState(false);
    const tooltipTimeout = useRef<number>();

    // ESC → clear
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClear(); e.stopPropagation(); }
        };
        el.addEventListener('keydown', onKey);
        return () => el.removeEventListener('keydown', onKey);
    }, [onClear]);

    const iconBtn = cn(
        'flex items-center justify-center p-1 border border-transparent rounded-md',
        'text-text-secondary hover:border-border hover:bg-bg-secondary hover:text-text-primary',
        'transition-colors cursor-pointer shrink-0'
    );

    const renderQueryPreview = (q: string) => {
        const shape = getQueryShape(q);
        const cond = value || '<condition>';

        if (shape === 'bare') {
            return <>
                {q} <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter<br />
                <span className="text-success font-semibold">WHERE</span> {cond}
            </>;
        }

        if (shape === 'has-where') {
            const whereIdx = q.search(/\bwhere\b/i);
            const beforeWhere = q.slice(0, whereIdx).trimEnd();
            const existingCond = q.slice(whereIdx + 5).trim();
            return <>
                {beforeWhere} <span className="text-pink-600 dark:text-pink-400">WHERE</span> ({existingCond})<br />
                <span className="pl-4 inline-block text-pink-600 dark:text-pink-400">AND</span> ({cond})
            </>;
        }

        // complex — subquery wrap
        return <>
            <span className="text-pink-600 dark:text-pink-400">SELECT</span> * <span className="text-pink-600 dark:text-pink-400">FROM</span> (<br />
            <span className="pl-4 inline-block">{q}</span><br />
            ) <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter<br />
            <span className="text-success font-semibold">WHERE</span> {cond}
        </>;
    };

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0 relative">
            <div className="flex items-center flex-3 min-w-0">
                {/* WHERE label — hover shows tooltip */}
                <div
                    className="relative flex items-center border-r pr-2 mr-2"
                    onMouseEnter={() => {
                        tooltipTimeout.current && clearTimeout(tooltipTimeout.current);
                        setShowTooltip(true);
                    }}
                    onMouseLeave={() => {
                        tooltipTimeout.current = setTimeout(() => setShowTooltip(false), 200);
                    }}
                >
                    <span className="text-[11px] uppercase cursor-pointer font-semibold text-text-muted hover:text-text-primary tracking-wide shrink-0 select-none transition-colors">
                        WHERE
                    </span>

                    {/* Tooltip Popup */}
                    {showTooltip && baseQuery && (
                        <div className="absolute top-full left-0 z-panel-overlay mt-2 flex w-[480px] flex-col overflow-hidden rounded-md border border-border bg-bg-primary shadow-lg animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-2 bg-bg-tertiary flex items-center justify-between border-b border-border">
                                <span className="text-xs font-semibold text-text-primary">Current Query (Filtered)</span>
                                <div className="flex items-center gap-0.5">
                                    {/* Copy */}
                                    <button
                                        className={iconBtn}
                                        title="Copy query"
                                        onClick={() => {
                                            void setClipboardText(buildFilterQuery(baseQuery, value || '<condition>'))
                                                .then(() => toast.success('Query copied to clipboard'))
                                                .catch(() => toast.error('Failed to copy query'));
                                        }}
                                    >
                                        <Copy size={12} />
                                    </button>

                                    {/* Append to editor */}
                                    {onAppendToQuery && (
                                        <button
                                            className={cn(iconBtn, 'text-success hover:bg-success/10 hover:border-success/30')}
                                            title="Append to current tab (last line)"
                                            onClick={() => {
                                                onAppendToQuery(buildFilterQuery(baseQuery, value || '<condition>'));
                                                setShowTooltip(false);
                                            }}
                                        >
                                            <PlusSquare size={12} />
                                        </button>
                                    )}

                                    {/* Open in new tab */}
                                    {onOpenInNewTab && (
                                        <button
                                            className={cn(iconBtn, 'text-text-secondary hover:text-text-primary')}
                                            title="Open in new tab"
                                            onClick={() => {
                                                onOpenInNewTab(buildFilterQuery(baseQuery, value || '<condition>'));
                                                setShowTooltip(false);
                                            }}
                                        >
                                            <ExternalLink size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto text-text-secondary">
                                {renderQueryPreview(baseQuery.replace(/;\s*$/, '').trim())}
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onRun(); } }}
                    placeholder="Filter rows… e.g. id > 100 AND name LIKE '%foo%'"
                    className="flex-1 w-full bg-transparent border-none outline-none text-[12px] text-text-primary placeholder:text-text-muted font-mono min-w-[50px]"
                    spellCheck={false}
                />
            </div>
            {children && (
                <div className="flex items-center flex-2 justify-end min-w-0 border-l border-border pl-2 gap-1 overflow-x-auto">
                    {children}
                </div>
            )}
        </div>
    );
};
