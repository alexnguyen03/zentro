import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Command, Layout, Edit3, Globe, Zap } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ShortcutItem {
    command: string;
    binding: string[];
    when: string;
    category: 'General' | 'Editor' | 'Navigation' | 'View';
}

export const ShortcutsView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape') {
                if (document.activeElement === searchInputRef.current) {
                    setSearchQuery('');
                    searchInputRef.current?.blur();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const shortcuts: ShortcutItem[] = [
        { command: 'Run Query', binding: ['Ctrl', 'Enter'], when: 'In Editor', category: 'Editor' },
        { command: 'New Query Tab', binding: ['Ctrl', 'T'], when: 'Global', category: 'General' },
        { command: 'Open Keyboard Shortcuts', binding: ['Ctrl', 'K', 'Ctrl', 'B'], when: 'Global', category: 'General' },
        { command: 'Open Settings', binding: ['Ctrl', ','], when: 'Global', category: 'General' },
        { command: 'Reload App', binding: ['Ctrl', 'Shift', 'R'], when: 'Global', category: 'General' },
        { command: 'Close Current Tab', binding: ['Ctrl', 'W'], when: 'Global', category: 'General' },
        { command: 'Open Workspaces', binding: ['Ctrl', 'Shift', 'C'], when: 'Global', category: 'Navigation' },
        { command: 'Toggle Left Sidebar', binding: ['Ctrl', 'B'], when: 'Global', category: 'Navigation' },
        { command: 'Toggle Right Sidebar', binding: ['Ctrl', 'Alt', 'B'], when: 'Global', category: 'Navigation' },
        { command: 'Toggle Result Panel', binding: ['Ctrl', 'J'], when: 'Global', category: 'Navigation' },
        { command: 'Zoom In/Out', binding: ['Ctrl', 'Wheel'], when: 'In Editor', category: 'Editor' },
        { command: 'Search in Editor', binding: ['Ctrl', 'F'], when: 'In Editor', category: 'Editor' },
        { command: 'Focus Search', binding: ['Ctrl', 'F'], when: 'Shortcuts/Settings', category: 'General' },
        { command: 'Find & Replace', binding: ['Ctrl', 'H'], when: 'In Editor', category: 'Editor' },
        { command: 'Comment Line', binding: ['Ctrl', '/'], when: 'In Editor', category: 'Editor' },
        { command: 'Reload View', binding: ['F5'], when: 'In Table View', category: 'View' },
    ];

    const filteredShortcuts = useMemo(() => {
        return shortcuts.filter(s =>
            s.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.binding.some(b => b.toLowerCase().includes(searchQuery.toLowerCase())) ||
            s.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const categories = ['General', 'Editor', 'Navigation', 'View'] as const;

    return (
        <div className="flex flex-col h-full bg-bg-primary select-none overflow-hidden text-[13px]">
            {/* Minimal Flat Header */}
            <div className="flex items-center justify-between px-10 h-16 border-b border-border/10 bg-bg-primary z-10 transition-all">
                <div className="flex items-center gap-3 text-text-primary">
                    <div className="p-2 rounded-xl bg-accent/5 text-accent">
                        <Command size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">Command Center</h1>
                </div>

                {/* Centered Flush Search Bar */}
                <div className="flex-1 flex justify-center max-w-2xl px-8">
                    <div className="relative group w-full max-w-md">
                        <div className="flex items-center bg-bg-tertiary/30 px-4 py-2 rounded-2xl border border-transparent focus-within:border-accent/30 focus-within:bg-bg-tertiary/50 transition-all h-10">
                            <Search size={14} className="text-text-muted/50 group-focus-within:text-accent" />
                            <input
                                type="text"
                                placeholder="Search shortcuts..."
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none text-[13px] text-text-primary pl-3 outline-none placeholder:text-text-muted/40"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Spacer for Balance */}
                <div className="w-10 xl:w-40" />
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto px-12 py-10 scroll-smooth">
                <div className="max-w-5xl mx-auto space-y-14 animate-in fade-in duration-700">

                    {categories.map(cat => {
                        const items = filteredShortcuts.filter(s => s.category === cat);
                        if (items.length === 0) return null;

                        return (
                            <section key={cat} className="space-y-6">
                                <div className="flex items-center gap-3 px-2">
                                    <div className={cn(
                                        "p-1.5 rounded-lg bg-bg-tertiary/40",
                                        cat === 'General' && "text-yellow-500",
                                        cat === 'Editor' && "text-blue-500",
                                        cat === 'Navigation' && "text-purple-500",
                                        cat === 'View' && "text-green-500"
                                    )}>
                                        {cat === 'General' && <Zap size={14} strokeWidth={2.5} />}
                                        {cat === 'Editor' && <Edit3 size={14} strokeWidth={2.5} />}
                                        {cat === 'Navigation' && <Layout size={14} strokeWidth={2.5} />}
                                        {cat === 'View' && <Globe size={14} strokeWidth={2.5} />}
                                    </div>
                                    <h2 className="text-[16px] font-bold tracking-tight text-text-primary">{cat}</h2>
                                    <div className="flex-1 h-px bg-border/5 ml-2" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                                    {items.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between group px-4 py-3 rounded-2xl hover:bg-bg-secondary/40 transition-all border border-transparent hover:border-border/5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[14px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">{s.command}</span>
                                                <span className="text-[11px] text-text-muted/60 font-semibold tracking-tight">{s.when}</span>
                                            </div>

                                            <div className="flex gap-1.5 items-center">
                                                {s.binding.map((key, ki) => (
                                                    <React.Fragment key={ki}>
                                                        <kbd className="inline-flex items-center justify-center min-w-[24px] px-2 h-7 bg-bg-tertiary/40 border border-border/20 rounded-lg text-[11px] font-mono font-bold text-text-primary group-hover:border-accent/20 transition-all">
                                                            {key}
                                                        </kbd>
                                                        {ki < s.binding.length - 1 && <span className="text-text-muted/30 text-[11px] font-bold">/</span>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    {filteredShortcuts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-text-muted/40">
                            <Search size={48} strokeWidth={1} className="mb-6 opacity-20" />
                            <p className="text-[15px] font-medium">No commands match "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
