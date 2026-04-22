import React from 'react';
import { cn } from '../../lib/cn';
import { buildFilterQuery } from '../../lib/queryBuilder';
import { useResultFilterEscapeClear } from '../../features/editor/useResultFilterEscapeClear';
import { useResultFilterTooltip } from '../../features/editor/useResultFilterTooltip';
import { useToast } from '../layout/Toast';
import { Input } from '../ui';
import { FilterQueryTooltip } from './resultFilterBar/FilterQueryTooltip';

interface ResultFilterBarProps {
    value: string;
    onChange: (v: string) => void;
    onRun: () => void;
    onClear: () => void;
    baseQuery?: string;
    onAppendToQuery?: (fullQuery: string) => void;
    onOpenInNewTab?: (fullQuery: string) => void;
    /** Result columns used for in-filter SQL suggestions */
    columns?: string[];
    /** Optional table name for model identity */
    tableName?: string;
    /** Hide SQL filter editor and keep only actions area */
    showFilterInput?: boolean;
    /** Optional actions to render on the right side of the bar */
    children?: React.ReactNode;
}

export const ResultFilterBar: React.FC<ResultFilterBarProps> = ({
    value,
    onChange,
    orderValue = '',
    onOrderChange,
    onRun,
    onClear,
    baseQuery,
    onAppendToQuery,
    onOpenInNewTab,
    columns = [],
    tableName,
    showFilterInput = true,
    children,
}) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { showTooltip, setShowTooltip, onMouseEnter, onMouseLeave } = useResultFilterTooltip();

    useResultFilterEscapeClear(inputRef, onClear);

    const iconButtonClassName = cn(
        'flex items-center justify-center p-1 border border-transparent rounded',
        'text-text-secondary hover:border-border hover:bg-bg-secondary hover:text-text-primary',
        'transition-colors cursor-pointer shrink-0',
    );

    const handleCopyQuery = React.useCallback(() => {
        if (!baseQuery) {
            return;
        }

        navigator.clipboard.writeText(buildFilterQuery(baseQuery, value || '<condition>'));
        toast.success('Query copied to clipboard');
    }, [baseQuery, value, toast]);

    const handleFilterChange = useCallback((nextValue: string) => {
        onChangeRef.current(normalizeFilterInput(nextValue));
    }, [normalizeFilterInput]);

    const handleOrderValueChange = useCallback((nextOrderValue: string) => {
        onOrderChangeRef.current?.(nextOrderValue);
    }, []);

    const commitOrderTerms = useCallback((nextTerms: OrderTerm[]) => {
        const nextExpr = serializeOrderByTerms(nextTerms);
        onOrderChangeRef.current?.(nextExpr);
    }, []);

    const handleAddOrderTerm = useCallback(() => {
        const field = selectedOrderField.trim();
        if (!field) return;
        const nextTerms = [...orderTerms, { field, dir: selectedOrderDir }];
        const nextExpr = serializeOrderByTerms(nextTerms);
        onOrderChangeRef.current?.(nextExpr);
        runNow(valueRef.current, nextExpr);
        setSelectedOrderField('');
        setSelectedOrderDir('ASC');
        setOrderBuilderOpen(false);
    }, [orderTerms, runNow, selectedOrderDir, selectedOrderField]);

    const handleRemoveOrderTerm = useCallback((index: number) => {
        const nextTerms = orderTerms.filter((_, idx) => idx !== index);
        const nextExpr = serializeOrderByTerms(nextTerms);
        onOrderChangeRef.current?.(nextExpr);
        runNow(valueRef.current, nextExpr);
    }, [orderTerms, runNow]);

    const handleOpenEditOrderTerm = useCallback((index: number) => {
        const target = orderTerms[index];
        if (!target) return;
        setSelectedOrderField(target.field);
        setSelectedOrderDir(target.dir);
        setEditingOrderIndex(index);
    }, [orderTerms]);

    const handleSaveOrderTerm = useCallback(() => {
        if (editingOrderIndex === null) return;
        const field = selectedOrderField.trim();
        if (!field) return;
        const nextTerms = [...orderTerms];
        nextTerms[editingOrderIndex] = { field, dir: selectedOrderDir };
        commitOrderTerms(nextTerms);
        setEditingOrderIndex(null);
        setSelectedOrderField('');
        setSelectedOrderDir('ASC');
    }, [commitOrderTerms, editingOrderIndex, orderTerms, selectedOrderDir, selectedOrderField]);

    const toggleOrderInputMode = useCallback(() => {
        if (orderInputMode === 'chips') {
            setOrderInputMode('text');
            return;
        }
        const parsed = parseOrderByTerms(orderValueRef.current, completionColumns);
        if (parsed.isCustom && orderValueRef.current.trim()) {
            toast.error('Cannot switch to chip mode: ORDER BY contains custom expression.');
            return;
        }
        setOrderInputMode('chips');
    }, [completionColumns, orderInputMode, toast]);

    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0 relative">
            <div className="relative flex items-center border-r pr-1" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                <span className="text-[11px] uppercase cursor-pointer font-semibold text-text-muted hover:text-text-primary tracking-wide shrink-0 select-none transition-colors">
                    WHERE
                </span>

                {showTooltip && baseQuery && (
                    <FilterQueryTooltip
                        baseQuery={baseQuery}
                        value={value}
                        iconButtonClassName={iconButtonClassName}
                        onCopy={handleCopyQuery}
                        onAppendToQuery={onAppendToQuery}
                        onOpenInNewTab={onOpenInNewTab}
                        onClose={() => setShowTooltip(false)}
                    />
                )}
            </div>

            <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        onRun();
                    }
                }}
                placeholder="Filter rows... e.g. id > 100 AND name LIKE '%foo%'"
                size="sm"
                variant="ghost"
                className="h-auto flex-1 border-none text-[12px] text-text-primary placeholder:text-text-muted font-mono px-0 py-0"
                spellCheck={false}
            />
        </div>
    );
};
