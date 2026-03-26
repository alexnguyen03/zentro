import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Search, RotateCcw, Edit3, PanelsTopLeft, Plug, Eye, AppWindow } from 'lucide-react';
import { shortcutRegistry, type CommandId, type CommandCategory } from '../../lib/shortcutRegistry';
import { useShortcutStore } from '../../stores/shortcutStore';
import { AlertModal, PromptModal } from '../ui';

const CATEGORY_ORDER: CommandCategory[] = ['Editor', 'Layout', 'Connection', 'View', 'App'];

export const ShortcutsView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [editing, setEditing] = useState<CommandId | null>(null);
    const [rebindTarget, setRebindTarget] = useState<{ id: CommandId; current: string } | null>(null);
    const [conflictMessage, setConflictMessage] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const bindings = useShortcutStore((s) => s.bindings);
    const setBinding = useShortcutStore((s) => s.setBinding);
    const restoreBinding = useShortcutStore((s) => s.restoreBinding);
    const resetDefaults = useShortcutStore((s) => s.resetDefaults);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape') {
                setSearchQuery('');
                searchInputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return shortcutRegistry;
        return shortcutRegistry.filter((item) => {
            const currentBinding = bindings[item.id] || item.defaultBinding;
            return (
                item.label.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q) ||
                currentBinding.toLowerCase().includes(q) ||
                item.defaultBinding.toLowerCase().includes(q)
            );
        });
    }, [bindings, searchQuery]);

    const grouped = useMemo(() => {
        const map = new Map<CommandCategory, typeof shortcutRegistry>();
        CATEGORY_ORDER.forEach((cat) => {
            const items = filtered.filter((item) => item.category === cat);
            if (items.length) {
                map.set(cat, items);
            }
        });
        return map;
    }, [filtered]);

    const openRebindPrompt = (id: CommandId) => {
        const current = bindings[id] || shortcutRegistry.find((x) => x.id === id)?.defaultBinding || '';
        setEditing(id);
        setRebindTarget({ id, current });
    };

    const handleRebindConfirm = async (nextBinding: string) => {
        if (!rebindTarget) return;
        const next = nextBinding.trim();
        if (!next) {
            setEditing(null);
            setRebindTarget(null);
            return;
        }
        const result = await setBinding(rebindTarget.id, next);
        if (!result.ok) {
            const conflictLabel = shortcutRegistry.find((x) => x.id === result.conflictWith)?.label || result.conflictWith;
            setConflictMessage(`Shortcut conflict with "${conflictLabel}".`);
        }
        setEditing(null);
        setRebindTarget(null);
    };

    const sectionClass = 'grid grid-cols-1 lg:grid-cols-12 gap-8 py-10 first:pt-4 border-b border-border/10 last:border-0 hover:bg-bg-secondary/20 transition-all px-8 -mx-8 rounded-3xl';
    const sectionInfoClass = 'lg:col-span-4 flex flex-col gap-2';
    const sectionContentClass = 'lg:col-span-8 flex flex-col gap-3 max-w-3xl';

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            <div className="z-sticky flex h-16 items-center justify-between border-b border-border/10 bg-bg-primary px-10">
                <div className="flex items-center gap-3 text-text-primary">
                    <div className="p-2 rounded-xl bg-accent/5 text-accent">
                        <Keyboard size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">Keyboard Shortcuts</h1>
                </div>

                <div className="flex-1 flex justify-center max-w-2xl px-8">
                    <div className="relative group w-full max-w-md">
                        <div className="flex items-center bg-bg-tertiary/30 px-4 py-2 rounded-2xl border border-transparent focus-within:border-accent/30 focus-within:bg-bg-tertiary/50 transition-all h-10">
                            <Search size={14} className="text-text-muted/50 group-focus-within:text-accent" />
                            <input
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search shortcuts..."
                                className="w-full bg-transparent border-none text-[13px] text-text-primary pl-3 outline-none placeholder:text-text-muted/40"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-accent hover:bg-accent/5 rounded-xl transition-all font-bold text-[11px] tracking-widest uppercase"
                        onClick={() => resetDefaults().catch((err) => console.error('reset shortcuts failed', err))}
                        title="Reset all shortcuts to default"
                    >
                        <RotateCcw size={14} />
                        <span className="hidden xl:inline">Reset All</span>
                    </button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto scroll-smooth">
                <div className="max-w-5xl mx-auto px-12 py-10 animate-in fade-in duration-700">
                    {Array.from(grouped.entries()).map(([category, items]) => (
                        <section key={category} className={sectionClass}>
                            <div className={sectionInfoClass}>
                                <div className="flex items-center gap-2.5 text-accent mb-1">
                                    {category === 'Editor' && <Edit3 size={18} strokeWidth={2.5} />}
                                    {category === 'Layout' && <PanelsTopLeft size={18} strokeWidth={2.5} />}
                                    {category === 'Connection' && <Plug size={18} strokeWidth={2.5} />}
                                    {category === 'View' && <Eye size={18} strokeWidth={2.5} />}
                                    {category === 'App' && <AppWindow size={18} strokeWidth={2.5} />}
                                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">{category}</h2>
                                </div>
                                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                                    {items.length} command{items.length > 1 ? 's' : ''} available.
                                </p>
                            </div>

                            <div className={sectionContentClass}>
                                {items.map((item) => {
                                    const currentBinding = bindings[item.id] || item.defaultBinding;
                                    const isCustomized = currentBinding !== item.defaultBinding;

                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-bg-tertiary/20 border border-border/10">
                                            <div className="flex flex-col gap-1 min-w-0 pr-4">
                                                <div className="text-[13px] font-bold text-text-primary truncate">{item.label}</div>
                                                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                                    <span>Default:</span>
                                                    <kbd className="px-1.5 py-0.5 bg-bg-primary border border-border rounded text-[10px] font-mono text-text-muted">
                                                        {item.defaultBinding}
                                                    </kbd>
                                                    {isCustomized && (
                                                        <span className="text-warning font-semibold">Customized</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <kbd className="px-2 py-1 rounded bg-bg-primary border border-border text-text-primary text-xs font-mono min-w-[86px] text-center">
                                                    {currentBinding}
                                                </kbd>
                                                <button
                                                    className="px-2.5 py-1.5 text-[11px] border border-border rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary font-semibold"
                                                    onClick={() => {
                                                        openRebindPrompt(item.id);
                                                    }}
                                                >
                                                    {editing === item.id ? 'Editing...' : 'Rebind'}
                                                </button>
                                                <button
                                                    className="px-2.5 py-1.5 text-[11px] border border-border rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!isCustomized}
                                                    onClick={() => restoreBinding(item.id).catch((err) => console.error('restore shortcut failed', err))}
                                                    title={`Restore default: ${item.defaultBinding}`}
                                                >
                                                    Restore
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}

                    {filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-text-muted/40">
                            <Search size={48} strokeWidth={1} className="mb-6 opacity-20" />
                            <p className="text-[15px] font-medium">No shortcuts match "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            </main>

            <PromptModal
                isOpen={Boolean(rebindTarget)}
                title="Rebind Shortcut"
                message="Enter shortcut (example: Ctrl+Shift+F or Ctrl+K Ctrl+B)"
                defaultValue={rebindTarget?.current || ''}
                confirmLabel="Apply"
                onCancel={() => {
                    setEditing(null);
                    setRebindTarget(null);
                }}
                onConfirm={(value) => {
                    handleRebindConfirm(value).catch((err) => console.error('rebind failed', err));
                }}
            />

            <AlertModal
                isOpen={Boolean(conflictMessage)}
                title="Shortcut Conflict"
                message={conflictMessage}
                onClose={() => setConflictMessage('')}
            />
        </div>
    );
};
