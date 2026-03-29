import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Search, RotateCcw, Edit3, PanelsTopLeft, Plug, Eye, AppWindow } from 'lucide-react';
import { getCommandRegistry, type CommandId, type CommandCategory } from '../../lib/shortcutRegistry';
import { useShortcutStore } from '../../stores/shortcutStore';
import { AlertModal, Button, PromptModal, SearchField } from '../ui';

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
    const commandRegistry = getCommandRegistry();

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
        if (!q) return commandRegistry;
        return commandRegistry.filter((item) => {
            const currentBinding = bindings[item.id] || item.defaultBinding;
            return (
                item.label.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q) ||
                currentBinding.toLowerCase().includes(q) ||
                item.defaultBinding.toLowerCase().includes(q)
            );
        });
    }, [bindings, commandRegistry, searchQuery]);

    const grouped = useMemo(() => {
        const map = new Map<CommandCategory, typeof commandRegistry>();
        CATEGORY_ORDER.forEach((cat) => {
            const items = filtered.filter((item) => item.category === cat);
            if (items.length) {
                map.set(cat, items);
            }
        });
        return map;
    }, [filtered]);

    const openRebindPrompt = (id: CommandId) => {
        const current = bindings[id] || commandRegistry.find((x) => x.id === id)?.defaultBinding || '';
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
            const conflictLabel = commandRegistry.find((x) => x.id === result.conflictWith)?.label || result.conflictWith;
            setConflictMessage(`Shortcut conflict with "${conflictLabel}".`);
        }
        setEditing(null);
        setRebindTarget(null);
    };

    const sectionClass = 'mt-4 rounded-lg bg-bg-secondary/18 px-5 py-5 first:mt-0';
    const sectionInfoClass = 'flex flex-col gap-1.5';
    const sectionContentClass = 'mt-3 flex flex-col gap-2.5';

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            <div className="z-sticky flex h-16 items-center justify-between border-b border-border/10 bg-bg-primary px-10">
                <div className="flex items-center gap-3 text-text-primary">
                    <div className="p-2 rounded-md bg-accent/5 text-accent">
                        <Keyboard size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">Keyboard Shortcuts</h1>
                </div>

                <div className="flex-1 flex justify-center max-w-2xl px-8">
                    <SearchField
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search shortcuts..."
                        wrapperClassName="max-w-md"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="md"
                        className="gap-2 font-bold text-[11px] tracking-widest uppercase"
                        onClick={() => resetDefaults().catch((err) => console.error('reset shortcuts failed', err))}
                        title="Reset all shortcuts to default"
                    >
                        <RotateCcw size={14} />
                        <span className="hidden xl:inline">Reset All</span>
                    </Button>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto scroll-smooth">
                <div className="max-w-4xl mx-auto px-5 py-6 animate-in fade-in duration-300">
                    {Array.from(grouped.entries()).map(([category, items]) => (
                        <section key={category} className={sectionClass}>
                            <div className={sectionInfoClass}>
                                <div className="flex items-center gap-2.5 text-accent mb-1">
                                    {category === 'Editor' && <Edit3 size={18} strokeWidth={2.5} />}
                                    {category === 'Layout' && <PanelsTopLeft size={18} strokeWidth={2.5} />}
                                    {category === 'Connection' && <Plug size={18} strokeWidth={2.5} />}
                                    {category === 'View' && <Eye size={18} strokeWidth={2.5} />}
                                    {category === 'App' && <AppWindow size={18} strokeWidth={2.5} />}
                                    <h2 className="text-[16px] font-semibold tracking-tight text-text-primary">{category}</h2>
                                </div>
                            </div>

                            <div className={sectionContentClass}>
                                {items.map((item) => {
                                    const currentBinding = bindings[item.id] || item.defaultBinding;
                                    const isCustomized = currentBinding !== item.defaultBinding;

                                    return (
                                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border/20 bg-bg-primary/70 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[12px] font-semibold text-text-primary">{item.label}</div>
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                                                    <span>Default:</span>
                                                    <kbd className="rounded border border-border bg-bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                                                        {item.defaultBinding}
                                                    </kbd>
                                                    {isCustomized && (
                                                        <span className="text-warning font-semibold">Customized</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <kbd className="min-w-[86px] rounded border border-border bg-bg-secondary px-2 py-1 text-center text-[11px] font-mono text-text-primary">
                                                    {currentBinding}
                                                </kbd>
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    className="text-[11px]"
                                                    onClick={() => {
                                                        openRebindPrompt(item.id);
                                                    }}
                                                >
                                                    {editing === item.id ? 'Editing...' : 'Rebind'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="solid"
                                                    className="text-[11px]"
                                                    disabled={!isCustomized}
                                                    onClick={() => restoreBinding(item.id).catch((err) => console.error('restore shortcut failed', err))}
                                                    title={`Restore default: ${item.defaultBinding}`}
                                                >
                                                    Restore
                                                </Button>
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
