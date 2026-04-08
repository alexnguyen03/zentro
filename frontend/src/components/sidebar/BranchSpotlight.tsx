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
                className="mx-auto mt-2 w-full max-w-[560px] rounded-md border border-border bg-card shadow-elevation-lg"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="p-1.5">
                    <Input
                        ref={inputRef}
                        value={query}
                        className="h-10 text-[12px] font-mono"
                        placeholder="Select a branch to checkout"
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
                <div className="max-h-[320px] overflow-y-auto border-t border-border/30 py-1">
                    {loading ? (
                        <div className="px-3 py-2 text-[12px] text-muted-foreground">Loading branches...</div>
                    ) : (
                        items.map((item, index) => (
                            <Button
                                key={item.type === 'branch' ? `branch:${item.name}` : `action:${item.action}`}
                                type="button"
                                variant="ghost"
                                className={cn(
                                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                                    index === activeIndex ? 'bg-accent/20 text-foreground' : 'text-foreground hover:bg-muted',
                                    item.type === 'action' && item.disabled && 'opacity-50',
                                )}
                                disabled={busy || (item.type === 'action' && item.disabled)}
                                onClick={() => {
                                    setActiveIndex(index);
                                    void handleSubmit(item);
                                }}
                            >
                                {item.type === 'branch' ? (
                                    <>
                                        <GitBranch size={12} className="text-muted-foreground" />
                                        <span className="font-mono">{item.name}</span>
                                        {item.name === currentBranch && <span className="ml-auto text-[10px] text-accent">current</span>}
                                    </>
                                ) : (
                                    <>
                                        {item.action === 'detached'
                                            ? <GitBranch size={12} className="text-muted-foreground" />
                                            : <Plus size={12} className="text-muted-foreground" />}
                                        <span>{item.label}</span>
                                    </>
                                )}
                            </Button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
