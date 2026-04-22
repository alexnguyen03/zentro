import React from 'react';
import { GitBranch, Plus } from 'lucide-react';
import { Button, Input } from '../ui';
import { cn } from '../../lib/cn';

interface BranchSpotlightProps {
    open: boolean;
    branches: string[];
    currentBranch: string;
    loading?: boolean;
    busy?: boolean;
    onClose: () => void;
    onCheckout: (branchName: string) => Promise<void> | void;
    onCreateBranch: (branchName: string) => Promise<void> | void;
    onCreateBranchFrom: (branchName: string, fromRef: string) => Promise<void> | void;
    onCheckoutDetached: (ref: string) => Promise<void> | void;
}

export const BranchSpotlight: React.FC<BranchSpotlightProps> = ({
    open,
    branches,
    currentBranch,
    loading = false,
    busy = false,
    onClose,
    onCheckout,
    onCreateBranch,
    onCreateBranchFrom,
    onCheckoutDetached,
}) => {
    const [query, setQuery] = React.useState('');
    const [activeIndex, setActiveIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        if (!open) return;
        setQuery('');
        setActiveIndex(0);
        const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [open]);

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = React.useMemo(
        () => branches.filter((name) => name.toLowerCase().includes(normalizedQuery)),
        [branches, normalizedQuery],
    );

    React.useEffect(() => {
        if (!open) return;
        setActiveIndex(0);
    }, [open, query, filtered.length]);

    type SpotlightItem =
        | { type: 'action'; action: 'create' | 'create_from' | 'detached'; label: string; disabled: boolean }
        | { type: 'branch'; name: string };

    const firstCandidateBranch = filtered[0] || currentBranch;
    const queryValue = query.trim();
    const items = React.useMemo<SpotlightItem[]>(() => ([
        {
            type: 'action',
            action: 'create',
            label: 'Create new branch...',
            disabled: queryValue.length === 0,
        },
        {
            type: 'action',
            action: 'create_from',
            label: `Create new branch from...${firstCandidateBranch ? ` (${firstCandidateBranch})` : ''}`,
            disabled: queryValue.length === 0 || !firstCandidateBranch,
        },
        {
            type: 'action',
            action: 'detached',
            label: 'Checkout detached...',
            disabled: queryValue.length === 0 && !firstCandidateBranch,
        },
        ...filtered.map((name) => ({ type: 'branch', name } as SpotlightItem)),
    ]), [filtered, firstCandidateBranch, queryValue.length]);

    const handleSubmit = React.useCallback(async (selectedItem?: SpotlightItem) => {
        const selected = selectedItem || items[activeIndex] || items[0];
        if (!selected) return;
        if (selected.type === 'branch') {
            await onCheckout(selected.name);
            return;
        }
        if (selected.disabled) return;
        if (selected.action === 'create') {
            await onCreateBranch(queryValue);
            return;
        }
        if (selected.action === 'create_from') {
            await onCreateBranchFrom(queryValue, firstCandidateBranch);
            return;
        }
        await onCheckoutDetached(queryValue || firstCandidateBranch);
    }, [activeIndex, firstCandidateBranch, items, onCheckout, onCheckoutDetached, onCreateBranch, onCreateBranchFrom, queryValue]);

    if (!open) return null;

    return (
        <div className="absolute inset-0 z-modal p-2" onMouseDown={onClose}>
            <div
                className="mx-auto mt-1 w-full max-w-[620px] overflow-hidden rounded-sm border border-border/90 bg-card shadow-elevation-lg"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="border-b border-border/70 bg-muted/35 p-1.5">
                    <Input
                        ref={inputRef}
                        value={query}
                        size="md"
                        className="border-border/80 bg-background/95 font-mono"
                        placeholder="Select a branch or tag to checkout"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                onClose();
                                return;
                            }
                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                if (items.length === 0) return;
                                setActiveIndex((current) => (current + 1) % items.length);
                                return;
                            }
                            if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                if (items.length === 0) return;
                                setActiveIndex((current) => (current - 1 + items.length) % items.length);
                                return;
                            }
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleSubmit();
                            }
                        }}
                    />
                </div>
                <div className="max-h-[360px] overflow-y-auto py-1">
                    {loading ? (
                        <div className="px-3 py-2 text-small text-muted-foreground">Loading branches...</div>
                    ) : items.length === 0 ? (
                        <div className="px-3 py-2 text-small text-muted-foreground">No branch matches your search.</div>
                    ) : (
                        <>
                            {items.map((item, index) => {
                                const isActive = index === activeIndex;
                                const isBranch = item.type === 'branch';
                                const isAction = item.type === 'action';
                                const isDisabled = busy || (isAction && item.disabled);
                                const key = isBranch ? `branch:${item.name}` : `action:${item.action}`;

                                return (
                                    <React.Fragment key={key}>
                                        {index === 3 && (
                                            <div className="mx-2 my-1.5 flex items-center justify-between border-t border-border/70 pt-1.5">
                                                <span className="text-label font-semibold uppercase tracking-wider text-muted-foreground">Branches</span>
                                                <span className="text-label text-muted-foreground">{filtered.length}</span>
                                            </div>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className={cn(
                                                'h-auto w-full justify-start rounded-none border-0 px-3 py-1.5 text-left transition-colors',
                                                isActive ? 'bg-accent/25 text-foreground' : 'text-foreground hover:bg-muted/70',
                                                isAction && item.disabled && 'opacity-45',
                                            )}
                                            disabled={isDisabled}
                                            onClick={() => {
                                                setActiveIndex(index);
                                                void handleSubmit(item);
                                            }}
                                        >
                                            {isBranch ? (
                                                <div className="flex min-w-0 w-full items-center gap-2">
                                                    <GitBranch size={12} className="shrink-0 text-muted-foreground" />
                                                    <span className="truncate font-mono text-small">{item.name}</span>
                                                    {item.name === currentBranch && (
                                                        <span className="ml-auto text-label font-semibold text-[#3b82f6]">current</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex min-w-0 w-full items-center gap-2">
                                                    {item.action === 'detached'
                                                        ? <GitBranch size={12} className="shrink-0 text-muted-foreground" />
                                                        : <Plus size={12} className="shrink-0 text-muted-foreground" />}
                                                    <span className="truncate text-small">{item.label}</span>
                                                </div>
                                            )}
                                        </Button>
                                    </React.Fragment>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
