import React, { useState, useEffect, useRef } from 'react';
import { Keyboard, Search as SearchIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export const ShortcutsView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

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

    const shortcuts = [
        { command: 'Run Query', binding: ['Ctrl', 'Enter'], when: 'In Editor' },
        { command: 'New Query Tab', binding: ['Ctrl', 'T'], when: 'Global' },
        { command: 'Open Keyboard Shortcuts', binding: ['Ctrl', 'K', 'Ctrl', 'B'], when: 'Global' },
        { command: 'Open Settings', binding: ['Ctrl', ','], when: 'Global' },
        { command: 'Close Current Tab', binding: ['Ctrl', 'W'], when: 'Global' },
        { command: 'Open Workspaces', binding: ['Ctrl', 'Shift', 'P'], when: 'Global' },
        { command: 'Toggle Left Sidebar', binding: ['Ctrl', 'B'], when: 'Global' },
        { command: 'Toggle Right Sidebar', binding: ['Ctrl', 'Alt', 'B'], when: 'Global' },
        { command: 'Toggle Result Panel', binding: ['Ctrl', 'J'], when: 'Global' },
        { command: 'Zoom In/Out', binding: ['Ctrl', 'Wheel'], when: 'In Editor' },
        { command: 'Search in Editor', binding: ['Ctrl', 'F'], when: 'In Editor' },
        { command: 'Focus Search', binding: ['Ctrl', 'F'], when: 'Settings / Shortcuts' },
        { command: 'Clear Search', binding: ['Esc'], when: 'Settings / Shortcuts' },
        { command: 'Find & Replace', binding: ['Ctrl', 'H'], when: 'In Editor' },
        { command: 'Comment Line', binding: ['Ctrl', '/'], when: 'In Editor' },
    ];

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-bg-primary/50 backdrop-blur-sm z-10">
                <div className="flex-1 flex justify-center max-w-2xl mx-auto">
                    <div className="relative group w-full">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-success" />
                        <input
                            type="text"
                            placeholder="Search shortcuts..."
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-bg-secondary/50 border border-border text-[13px] text-text-primary pl-9 pr-3 py-1.5 rounded-lg outline-none transition-all focus:border-success focus:bg-bg-primary"
                        />
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col gap-8">
                        <div className="border border-border rounded-xl overflow-hidden bg-bg-secondary/20 backdrop-blur-sm shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-bg-secondary/40 border-b border-border">
                                        <th className="px-6 py-4 text-[11px] font-bold text-text-secondary uppercase tracking-widest w-1/3">Command</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-text-secondary uppercase tracking-widest">Keybinding</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-text-secondary uppercase tracking-widest">When</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30 text-[12px]">
                                    {shortcuts
                                        .filter(s => 
                                            !searchQuery || 
                                            s.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            s.binding.some(b => b.toLowerCase().includes(searchQuery.toLowerCase()))
                                        )
                                        .map((s, i) => (
                                        <tr key={i} className="hover:bg-bg-secondary/40 transition-colors group">
                                            <td className="px-6 py-4 text-text-primary font-medium group-hover:text-success transition-colors">{s.command}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-1.5 items-center">
                                                    {s.binding.map((key, ki) => (
                                                        <React.Fragment key={ki}>
                                                            <kbd className="px-2 py-1 bg-bg-primary border border-border rounded-md shadow-sm text-[10px] font-mono text-text-primary font-bold min-w-[24px] text-center">
                                                                {key}
                                                            </kbd>
                                                            {ki < s.binding.length - 1 && <span className="text-text-muted text-[10px] font-bold">+</span>}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-text-secondary opacity-70">
                                                <span className="px-2 py-0.5 bg-bg-secondary/50 rounded-full text-[10px]">
                                                    {s.when}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
