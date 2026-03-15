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
        <div className="flex flex-col h-full bg-bg-primary select-none overflow-hidden">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-border bg-bg-secondary/30">
                <div className="flex items-center gap-2 text-text-primary font-bold tracking-tight">
                    <Command size={18} className="text-accent" />
                    <span>Command Center</span>
                </div>
                
                <div className="relative w-64 group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" />
                    <input
                        type="text"
                        placeholder="Search commands..."
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-bg-primary border border-border/50 text-[12px] text-text-primary pl-9 pr-3 h-8 rounded-md outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-text-muted/50"
                    />
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
                    
                    {categories.map(cat => {
                        const items = filteredShortcuts.filter(s => s.category === cat);
                        if (items.length === 0) return null;

                        return (
                            <section key={cat} className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    {cat === 'General' && <Zap size={14} className="text-yellow-500" />}
                                    {cat === 'Editor' && <Edit3 size={14} className="text-blue-500" />}
                                    {cat === 'Navigation' && <Layout size={14} className="text-purple-500" />}
                                    {cat === 'View' && <Globe size={14} className="text-green-500" />}
                                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{cat}</h2>
                                    <div className="flex-1 h-px bg-border/30 ml-2" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                    {items.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between group px-2 py-1.5 rounded-md hover:bg-bg-tertiary/50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">{s.command}</span>
                                                <span className="text-[10px] text-text-muted/60 font-medium">{s.when}</span>
                                            </div>
                                            
                                            <div className="flex gap-1 items-center">
                                                {s.binding.map((key, ki) => (
                                                    <React.Fragment key={ki}>
                                                        <kbd className="inline-flex items-center justify-center min-w-[20px] px-1.5 h-6 bg-bg-secondary border border-border/60 rounded text-[10px] font-mono font-bold text-text-primary group-hover:border-accent/30 transition-colors">
                                                            {key}
                                                        </kbd>
                                                        {ki < s.binding.length - 1 && <span className="text-text-muted/40 text-[10px]">+</span>}
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
                        <div className="flex flex-col items-center justify-center py-20 text-text-muted opacity-50">
                            <Search size={32} strokeWidth={1} className="mb-4" />
                            <p className="text-[13px]">No commands found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
