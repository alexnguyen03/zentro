import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Laptop, Bell, Database, Globe, Search as SearchIcon, Keyboard } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { utils } from '../../../wailsjs/go/models';
import { cn } from '../../lib/cn';

interface SettingsViewProps {
    tabId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ tabId }) => {
    const { theme, fontSize, defaultLimit, toastPlacement, connectTimeout, queryTimeout, save } = useSettingsStore();
    const { removeTab } = useEditorStore();

    const [formTheme, setFormTheme] = useState(theme);
    const [formFontSize, setFormFontSize] = useState(fontSize);
    const [formLimit, setFormLimit] = useState(defaultLimit);
    const [formConnectTimeout, setFormConnectTimeout] = useState(connectTimeout);
    const [formQueryTimeout, setFormQueryTimeout] = useState(queryTimeout);
    const [formToastPlacement, setFormToastPlacement] = useState(toastPlacement);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'general' | 'shortcuts'>('general');

    const shortcuts = [
        { command: 'Run Query', binding: ['Ctrl', 'Enter'], when: 'In Editor' },
        { command: 'New Query Tab', binding: ['Ctrl', 'T'], when: 'Global' },
        { command: 'Close Current Tab', binding: ['Ctrl', 'W'], when: 'Global' },
        { command: 'Open Workspaces', binding: ['Ctrl', 'Shift', 'P'], when: 'Global' },
        { command: 'Toggle Left Sidebar', binding: ['Ctrl', 'B'], when: 'Global' },
        { command: 'Toggle Right Sidebar', binding: ['Ctrl', 'Alt', 'B'], when: 'Global' },
        { command: 'Toggle Result Panel', binding: ['Ctrl', 'J'], when: 'Global' },
        { command: 'Zoom In/Out', binding: ['Ctrl', 'Wheel'], when: 'In Editor' },
        { command: 'Search in Editor', binding: ['Ctrl', 'F'], when: 'In Editor' },
        { command: 'Find & Replace', binding: ['Ctrl', 'H'], when: 'In Editor' },
        { command: 'Comment Line', binding: ['Ctrl', '/'], when: 'In Editor' },
    ];

    useEffect(() => {
        setFormTheme(theme);
        setFormFontSize(fontSize);
        setFormLimit(defaultLimit);
        setFormConnectTimeout(connectTimeout);
        setFormQueryTimeout(queryTimeout);
        setFormToastPlacement(toastPlacement);
    }, [theme, fontSize, defaultLimit, toastPlacement, connectTimeout, queryTimeout]);

    // Auto-save effect
    useEffect(() => {
        // Skip initial mount if values match
        if (
            formTheme === theme &&
            formFontSize === fontSize &&
            formLimit === defaultLimit &&
            formConnectTimeout === connectTimeout &&
            formQueryTimeout === queryTimeout &&
            formToastPlacement === toastPlacement
        ) {
            return;
        }

        const timer = setTimeout(async () => {
            await save(new utils.Preferences({
                theme: formTheme,
                font_size: formFontSize,
                default_limit: formLimit,
                connect_timeout: formConnectTimeout,
                query_timeout: formQueryTimeout,
                toast_placement: formToastPlacement
            }));
        }, 500);

        return () => clearTimeout(timer);
    }, [formTheme, formFontSize, formLimit, formConnectTimeout, formQueryTimeout, formToastPlacement, save, theme, fontSize, defaultLimit, toastPlacement, connectTimeout, queryTimeout]);

    const labelClass = "text-[12px] font-medium text-text-primary mb-0.5";
    const inputClass = "w-full max-w-sm bg-bg-primary border border-border text-[12px] px-3 py-1.5 rounded-md outline-none transition-all focus:border-success focus:ring-1 focus:ring-success/10 disabled:opacity-50 disabled:cursor-not-allowed";
    const hintClass = "text-[11px] text-text-muted mt-1 opacity-60";
    
    const sectionClass = "grid grid-cols-1 lg:grid-cols-3 gap-8 py-8 first:pt-0 border-b border-border/50 last:border-0 hover:bg-bg-secondary/10 transition-colors px-4 -mx-4 rounded-xl";
    const sectionInfoClass = "lg:col-span-1 flex flex-col gap-1.5";
    const sectionContentClass = "lg:col-span-2 flex flex-col gap-5";

    const matchesSearch = (title: string, labels: string[]) => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return title.toLowerCase().includes(query) || labels.some(l => l.toLowerCase().includes(query));
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-bg-primary/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg text-success">
                        <SettingsIcon size={20} />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-text-primary">Settings</h1>
                        <p className="text-[11px] text-text-secondary">Personalize your development environment</p>
                    </div>
                </div>
                
                {/* Search Bar */}
                <div className="relative group w-72">
                    <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-success" />
                    <input
                        type="text"
                        placeholder={activeTab === 'general' ? "Search settings..." : "Search shortcuts..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-bg-secondary/50 border border-border text-[13px] text-text-primary pl-9 pr-3 py-1.5 rounded-lg outline-none transition-all focus:border-success focus:bg-bg-primary"
                    />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <aside className="w-64 border-r border-border bg-bg-secondary/10 flex flex-col overflow-y-auto">
                    <div className="p-4 space-y-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-[12px] font-medium rounded-lg transition-all",
                                activeTab === 'general' 
                                    ? "bg-success/10 text-success shadow-sm" 
                                    : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary/30"
                            )}
                        >
                            <Laptop size={16} />
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-[12px] font-medium rounded-lg transition-all",
                                activeTab === 'shortcuts' 
                                    ? "bg-success/10 text-success shadow-sm" 
                                    : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary/30"
                            )}
                        >
                            <Keyboard size={16} />
                            Keyboard Shortcuts
                        </button>
                    </div>
                </aside>

                {/* Main Scrollable Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto px-10 py-8">
                        {activeTab === 'general' ? (
                            <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                                
                                {/* Appearance */}
                                {matchesSearch("Appearance", ["Theme Interface", "Editor Font Size"]) && (
                                    <div className={sectionClass}>
                                        <div className={sectionInfoClass}>
                                            <div className="flex items-center gap-2 text-text-primary mb-1">
                                                <Laptop size={16} />
                                                <h2 className="text-sm font-semibold uppercase tracking-tight opacity-80">Appearance</h2>
                                            </div>
                                            <p className="text-[12px] text-text-secondary leading-relaxed pr-8">
                                                Customize the visual appearance of your workspace, including themes and font sizes.
                                            </p>
                                        </div>
                                        <div className={sectionContentClass}>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelClass}>Theme Interface</label>
                                                <select className={inputClass} value={formTheme} onChange={(e) => setFormTheme(e.target.value)}>
                                                    <option value="system">System Default</option>
                                                    <option value="light">Light</option>
                                                    <option value="dark">Dark</option>
                                                </select>
                                                <span className={hintClass}>Synchronizes with your operating system theme settings.</span>
                                            </div>

                                            <div className="flex flex-col gap-1.5 pt-2">
                                                <label className={labelClass}>Editor Font Size (px)</label>
                                                <input
                                                    className={inputClass}
                                                    type="number"
                                                    min={8}
                                                    max={48}
                                                    value={formFontSize}
                                                    onChange={(e) => setFormFontSize(parseInt(e.target.value) || 14)}
                                                />
                                                <span className={hintClass}>Set a comfortable reading size for the code editor.</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Notifications */}
                                {matchesSearch("Notifications", ["Toast Position"]) && (
                                    <div className={sectionClass}>
                                        <div className={sectionInfoClass}>
                                            <div className="flex items-center gap-2 text-text-primary mb-1">
                                                <Bell size={16} />
                                                <h2 className="text-sm font-semibold uppercase tracking-tight opacity-80">Notifications</h2>
                                            </div>
                                            <p className="text-[12px] text-text-secondary leading-relaxed pr-8">
                                                Configure how and where system alerts and toasts appear.
                                            </p>
                                        </div>
                                        <div className={sectionContentClass}>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelClass}>Toast Position</label>
                                                <select className={inputClass} value={formToastPlacement} onChange={(e) => setFormToastPlacement(e.target.value as any)}>
                                                    <option value="bottom-left">Bottom Left</option>
                                                    <option value="bottom-center">Bottom Center</option>
                                                    <option value="bottom-right">Bottom Right</option>
                                                    <option value="top-left">Top Left</option>
                                                    <option value="top-center">Top Center</option>
                                                    <option value="top-right">Top Right</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Editor & Data */}
                                {matchesSearch("Data & Query", ["Default Row Limit"]) && (
                                    <div className={sectionClass}>
                                        <div className={sectionInfoClass}>
                                            <div className="flex items-center gap-2 text-text-primary mb-1">
                                                <Database size={16} />
                                                <h2 className="text-sm font-semibold uppercase tracking-tight opacity-80">Data & Query</h2>
                                            </div>
                                            <p className="text-[12px] text-text-secondary leading-relaxed pr-8">
                                                Set thresholds to prevent large result sets from slowing down the UI.
                                            </p>
                                        </div>
                                        <div className={sectionContentClass}>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelClass}>Default Row Limit</label>
                                                <select className={inputClass} value={formLimit} onChange={(e) => setFormLimit(parseInt(e.target.value) || 1000)}>
                                                    <option value={100}>100 rows</option>
                                                    <option value={500}>500 rows</option>
                                                    <option value={1000}>1,000 rows</option>
                                                    <option value={5000}>5,000 rows</option>
                                                    <option value={10000}>10,000 rows</option>
                                                </select>
                                                <span className={hintClass}>Limits the number of rows displayed in the result grid by default.</span>
                                            </div>

                                            <div className="flex flex-col gap-1.5 pt-2">
                                                <label className={labelClass}>Connect Timeout (sec)</label>
                                                <input
                                                    className={inputClass}
                                                    type="number"
                                                    min={5}
                                                    max={300}
                                                    value={formConnectTimeout}
                                                    onChange={(e) => setFormConnectTimeout(parseInt(e.target.value) || 10)}
                                                />
                                                <span className={hintClass}>Maximum time to wait for a database connection to be established.</span>
                                            </div>

                                            <div className="flex flex-col gap-1.5 pt-2">
                                                <label className={labelClass}>Query Timeout (sec)</label>
                                                <input
                                                    className={inputClass}
                                                    type="number"
                                                    min={5}
                                                    max={100000}
                                                    value={formQueryTimeout}
                                                    onChange={(e) => setFormQueryTimeout(parseInt(e.target.value) || 60)}
                                                />
                                                <span className={hintClass}>Abort long-running queries after this amount of time.</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Region */}
                                {matchesSearch("Region", ["Language"]) && (
                                    <div className={sectionClass}>
                                        <div className={sectionInfoClass}>
                                            <div className="flex items-center gap-2 text-text-primary mb-1">
                                                <Globe size={16} />
                                                <h2 className="text-sm font-semibold uppercase tracking-tight opacity-80">Region</h2>
                                            </div>
                                            <p className="text-[12px] text-text-secondary leading-relaxed pr-8">
                                                Manage language preferences and regional formatting.
                                            </p>
                                        </div>
                                        <div className={sectionContentClass}>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelClass}>Language</label>
                                                <select className={inputClass} disabled>
                                                    <option value="en">English (US)</option>
                                                </select>
                                                <span className={hintClass}>Localization for other languages is coming soon.</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
                                    <div className="flex items-center gap-3 text-text-primary">
                                        <div className="p-2 bg-success/10 rounded-lg text-success">
                                            <Keyboard size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold">Keyboard Shortcuts</h2>
                                            <p className="text-[12px] text-text-secondary">Maximize your productivity with these keybindings.</p>
                                        </div>
                                    </div>
                                </div>

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
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};
