import React, { useRef, useEffect } from 'react';
import { Play, ExternalLink, X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ResultFilterBarProps {
    value: string;
    onChange: (v: string) => void;
    onRun: () => void;
    /** Clears the filter and re-runs the original query */
    onClear: () => void;
    /** The base query being wrapped */
    baseQuery?: string;
    /** Action to append the generated filter SQL into the active editor */
    onAppendToQuery?: (fullQuery: string) => void;
}

import { Copy, PlusSquare } from 'lucide-react';
import { useToast } from '../layout/Toast';

export const ResultFilterBar: React.FC<ResultFilterBarProps> = ({
    value,
    onChange,
    onRun,
    onClear,
    baseQuery,
    onAppendToQuery,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [showTooltip, setShowTooltip] = React.useState(false);
    let tooltipTimeout = useRef<number>();

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

    const btnClass = cn(
        'flex items-center justify-center gap-1 px-2 py-[3px] border border-transparent rounded text-[11px]',
        'text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary',
        'transition-colors cursor-pointer shrink-0'
    );

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0 relative">
            {/* Label with Hover Tooltip */}
            <div
                className="relative flex items-center"
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
                    <div className="absolute top-full left-0 mt-2 z-50 w-[450px] bg-bg-primary border border-border rounded-md shadow-lg flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                        <div className="px-3 py-2 bg-bg-tertiary flex items-center justify-between border-b border-border">
                            <span className="text-xs font-semibold text-text-primary">Current Query (Filtered)</span>
                            <div className="flex items-center gap-1">
                                <button
                                    className="flex items-center gap-1 px-1.5 py-1 text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded border border-transparent hover:border-border transition-colors cursor-pointer"
                                    onClick={() => {
                                        const queryToCopy = `SELECT * FROM (\n${baseQuery.replace(/;\s*$/, '')}\n) AS _zentro_filter\nWHERE ${value || '<condition>'}`;
                                        navigator.clipboard.writeText(queryToCopy);
                                        toast.success('Query copied to clipboard');
                                    }}
                                >
                                    <Copy size={10} />
                                    <span>Copy</span>
                                </button>
                                {onAppendToQuery && (
                                    <button
                                        className="flex items-center gap-1 px-1.5 py-1 text-[10px] text-success hover:bg-success/10 rounded border border-transparent hover:border-success/30 transition-colors cursor-pointer"
                                        onClick={() => {
                                            const queryToAppend = `SELECT * FROM (\n${baseQuery.replace(/;\s*$/, '')}\n) AS _zentro_filter\nWHERE ${value || '<condition>'}`;
                                            onAppendToQuery(queryToAppend);
                                            setShowTooltip(false);
                                        }}
                                    >
                                        <PlusSquare size={10} />
                                        <span>Append</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto text-text-secondary">
                            <span className="text-pink-600 dark:text-pink-400">SELECT</span> * <span className="text-pink-600 dark:text-pink-400">FROM</span> (<br />
                            <span className="pl-4 inline-block">{baseQuery.replace(/;\s*$/, '')}</span><br />
                            ) <span className="text-pink-600 dark:text-pink-400">AS</span> _zentro_filter<br />
                            <span className="text-success font-semibold">WHERE</span> {value || '<condition>'}
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
                className="flex-1 border-none outline-none text-[12px] text-text-primary placeholder:text-text-muted font-mono"
                spellCheck={false}
            />
        </div>
    );
};
