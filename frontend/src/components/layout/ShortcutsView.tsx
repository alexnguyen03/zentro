import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { shortcutRegistry, type CommandId } from '../../lib/shortcutRegistry';
import { useShortcutStore } from '../../stores/shortcutStore';

export const ShortcutsView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<CommandId | null>(null);
    const bindings = useShortcutStore((s) => s.bindings);
    const setBinding = useShortcutStore((s) => s.setBinding);
    const resetDefaults = useShortcutStore((s) => s.resetDefaults);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return shortcutRegistry;
        return shortcutRegistry.filter(item =>
            item.label.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            (bindings[item.id] || item.defaultBinding).toLowerCase().includes(q),
        );
    }, [bindings, query]);

    const handleRebind = async (id: CommandId) => {
        const current = bindings[id] || shortcutRegistry.find((x) => x.id === id)?.defaultBinding || '';
        const next = window.prompt('Enter shortcut (example: Ctrl+Shift+F or Ctrl+K Ctrl+B)', current);
        if (!next || !next.trim()) return;
        const result = await setBinding(id, next.trim());
        if (!result.ok) {
            const conflictLabel = shortcutRegistry.find((x) => x.id === result.conflictWith)?.label || result.conflictWith;
            alert(`Shortcut conflict with "${conflictLabel}".`);
        }
        setEditing(null);
    };

    return (
        <div className="h-full flex flex-col bg-bg-primary">
            <div className="h-14 border-b border-border px-6 flex items-center justify-between">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search shortcuts..."
                    className="w-[320px] bg-bg-tertiary/40 border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                />
                <button
                    className="border border-border bg-bg-secondary text-text-secondary hover:text-text-primary px-3 py-1.5 rounded text-xs flex items-center gap-1"
                    onClick={() => resetDefaults().catch((err) => console.error('reset shortcuts failed', err))}
                >
                    <RotateCcw size={12} />
                    Reset Defaults
                </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-text-secondary border-b border-border">
                            <th className="py-2 pr-2">Command</th>
                            <th className="py-2 pr-2">Category</th>
                            <th className="py-2 pr-2">Shortcut</th>
                            <th className="py-2">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((item) => (
                            <tr key={item.id} className="border-b border-border/40">
                                <td className="py-2 pr-2 text-text-primary">{item.label}</td>
                                <td className="py-2 pr-2 text-text-secondary">{item.category}</td>
                                <td className="py-2 pr-2">
                                    <kbd className="px-2 py-1 rounded bg-bg-tertiary text-text-primary text-xs">
                                        {bindings[item.id] || item.defaultBinding}
                                    </kbd>
                                </td>
                                <td className="py-2">
                                    <button
                                        className="px-2 py-1 text-xs border border-border rounded bg-bg-secondary hover:bg-bg-tertiary"
                                        onClick={() => {
                                            setEditing(item.id);
                                            handleRebind(item.id).catch((err) => console.error('rebind failed', err));
                                        }}
                                    >
                                        {editing === item.id ? 'Editing...' : 'Rebind'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
