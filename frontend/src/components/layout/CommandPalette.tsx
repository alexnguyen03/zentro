import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buildCommands, CommandItem, CommandCategory } from '../../lib/commands';
import { useLayoutStore } from '../../stores/layoutStore';
import { ModalBackdrop } from '../ui';

const CATEGORY_ORDER: CommandCategory[] = ['Editor', 'View', 'Layout', 'Connection', 'App'];

export const CommandPalette: React.FC = () => {
    const setShowCommandPalette = useLayoutStore(s => s.setShowCommandPalette);

    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLButtonElement>(null);

    // Re-build commands on each render so actions get fresh store state
    const allCommands = useMemo(() => buildCommands(), []);

    const filtered = useMemo<CommandItem[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) return allCommands;
        return allCommands.filter(
            c =>
                c.label.toLowerCase().includes(q) ||
                c.category.toLowerCase().includes(q) ||
                (c.keybinding?.toLowerCase().includes(q) ?? false)
        );
    }, [query, allCommands]);

    // Group filtered results by category, preserving CATEGORY_ORDER
    const grouped = useMemo(() => {
        const map = new Map<CommandCategory, CommandItem[]>();
        for (const cat of CATEGORY_ORDER) {
            const items = filtered.filter(c => c.category === cat);
            if (items.length) map.set(cat, items);
        }
        return map;
    }, [filtered]);

    // Flatten for keyboard navigation
    const flat = useMemo(() => filtered.slice().sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.category);
        const bi = CATEGORY_ORDER.indexOf(b.category);
        return ai - bi;
    }), [filtered]);

    const close = useCallback(() => setShowCommandPalette(false), [setShowCommandPalette]);

    const execute = useCallback((cmd: CommandItem) => {
        close();
        // Defer to ensure palette is unmounted before action fires
        setTimeout(() => cmd.action(), 50);
    }, [close]);

    // Reset active index when results change
    useEffect(() => setActiveIndex(0), [query]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Scroll active item into view
    useEffect(() => {
        activeItemRef.current?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(i => Math.min(i + 1, flat.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = flat[activeIndex];
                if (cmd) execute(cmd);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [flat, activeIndex, close, execute]);

    // Compute per-category offset for global index mapping
    const getGlobalIndex = (cat: CommandCategory, localIdx: number) => {
        let offset = 0;
        for (const c of CATEGORY_ORDER) {
            if (c === cat) break;
            offset += (grouped.get(c)?.length ?? 0);
        }
        return offset + localIdx;
    };

    return (
        <ModalBackdrop onClose={close} className="items-start pt-[15vh]">
            <div
                className="w-[560px] max-h-[420px] flex flex-col bg-bg-secondary border border-border rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden animate-in slide-in-from-top-3 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Search input */}
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-bg-secondary shrink-0">
                    <Search size={15} className="text-text-muted shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search commands..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-[13px] text-text-primary placeholder:text-text-muted"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd className="px-1.5 py-0.5 bg-bg-primary border border-border rounded text-[10px] font-mono text-text-muted shrink-0">
                        Esc
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="flex-1 overflow-y-auto py-1">
                    {flat.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[12px] text-text-muted">
                            No commands found for <span className="text-text-secondary font-medium">"{query}"</span>
                        </div>
                    ) : (
                        Array.from(grouped.entries()).map(([cat, items]) => (
                            <div key={cat}>
                                {/* Category header */}
                                <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-muted select-none">
                                    {cat}
                                </div>

                                {items.map((cmd, localIdx) => {
                                    const globalIdx = getGlobalIndex(cat, localIdx);
                                    const isActive = globalIdx === activeIndex;

                                    return (
                                        <button
                                            key={cmd.id}
                                            ref={isActive ? activeItemRef : undefined}
                                            className={cn(
                                                'w-full flex items-center justify-between px-4 py-2 text-left transition-colors duration-75 text-[13px] group cursor-pointer border-none bg-transparent',
                                                isActive
                                                    ? 'bg-success/10 text-text-primary'
                                                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                                            )}
                                            onClick={() => execute(cmd)}
                                            onMouseEnter={() => setActiveIndex(globalIdx)}
                                        >
                                            <span className={cn('font-medium', isActive && 'text-success')}>
                                                {cmd.label}
                                            </span>
                                            {cmd.keybinding && (
                                                <span className="flex items-center gap-0.5 shrink-0 ml-4">
                                                    {cmd.keybinding.split(' ').map((key, ki) => (
                                                        <kbd
                                                            key={ki}
                                                            className="px-1.5 py-px bg-bg-primary border border-border rounded text-[10px] font-mono text-text-muted"
                                                        >
                                                            {key}
                                                        </kbd>
                                                    ))}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2 border-t border-border bg-bg-primary/50 shrink-0 flex items-center gap-4 text-[10px] text-text-muted select-none">
                    <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                    <span><kbd className="font-mono">Enter</kbd> execute</span>
                    <span><kbd className="font-mono">Esc</kbd> close</span>
                </div>
            </div>
        </ModalBackdrop>
    );
};
