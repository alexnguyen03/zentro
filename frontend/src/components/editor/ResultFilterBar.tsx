import React, { useRef, useEffect } from 'react';
import { Play, ExternalLink, X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ResultFilterBarProps {
    value: string;
    onChange: (v: string) => void;
    onRun: () => void;
    onOpenInTab: () => void;
    onClear: () => void;
}

export const ResultFilterBar: React.FC<ResultFilterBarProps> = ({
    value,
    onChange,
    onRun,
    onOpenInTab,
    onClear,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

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
        'flex items-center justify-center gap-1 px-2 py-[3px] border border-border rounded text-[11px]',
        'text-text-secondary bg-bg-primary hover:bg-bg-tertiary hover:text-text-primary',
        'transition-colors cursor-pointer shrink-0'
    );

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0">
            {/* Label */}
            <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wide shrink-0 select-none">WHERE</span>

            {/* Input */}
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onRun(); } }}
                placeholder="Filter rows… e.g. id > 100 AND name LIKE '%foo%'"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-text-primary placeholder:text-text-muted font-mono"
                spellCheck={false}
            />

            {/* Clear */}
            {value && (
                <button
                    type="button"
                    className={cn(btnClass, 'border-transparent hover:border-border')}
                    title="Clear filter (Esc)"
                    onClick={onClear}
                >
                    <X size={11} />
                </button>
            )}

            {/* Open filtered query in new tab */}
            <button type="button" className={btnClass} title="Open filtered query in new tab" onClick={onOpenInTab}>
                <ExternalLink size={11} />
            </button>

            {/* Run */}
            <button
                type="button"
                className={cn(btnClass, 'text-success border-success/40 hover:bg-success/10 hover:border-success')}
                title="Run filter (Enter)"
                onClick={onRun}
            >
                <Play size={10} />
                <span>Run</span>
            </button>
        </div>
    );
};
