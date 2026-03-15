import React, { useEffect, useState, useRef } from 'react';
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
    const { addTab } = useEditorStore();

    const [formTheme, setFormTheme] = useState(theme);
    const [formFontSize, setFormFontSize] = useState(fontSize);
    const [formLimit, setFormLimit] = useState(defaultLimit);
    const [formConnectTimeout, setFormConnectTimeout] = useState(connectTimeout);
    const [formQueryTimeout, setFormQueryTimeout] = useState(queryTimeout);
    const [formToastPlacement, setFormToastPlacement] = useState(toastPlacement);
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

    const labelClass = "text-[12px] font-bold text-text-primary mb-1 tracking-tight";
    const inputClass = "w-full max-w-sm bg-bg-tertiary/30 border border-border/40 text-[13px] px-3 py-2 rounded-xl outline-none transition-all focus:border-accent/40 focus:bg-bg-tertiary/50 disabled:opacity-50 disabled:cursor-not-allowed text-text-primary placeholder:text-text-muted/50";
    const hintClass = "text-[11px] text-text-muted/60 mt-1.5 leading-relaxed font-medium";
    
    const sectionClass = "grid grid-cols-1 lg:grid-cols-12 gap-8 py-10 first:pt-4 border-b border-border/10 last:border-0 hover:bg-bg-secondary/20 transition-all px-8 -mx-8 rounded-3xl";
    const sectionInfoClass = "lg:col-span-4 flex flex-col gap-2";
    const sectionContentClass = "lg:col-span-8 flex flex-col gap-6 max-w-2xl";

    const matchesSearch = (title: string, labels: string[]) => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return title.toLowerCase().includes(query) || labels.some(l => l.toLowerCase().includes(query));
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Minimal Flat Header */}
            <div className="flex items-center justify-between px-10 h-16 border-b border-border/10 bg-bg-primary z-10">
                {/* Logo/Title Section */}
                <div className="flex items-center gap-3 text-text-primary">
                    <div className="p-2 rounded-xl bg-accent/5 text-accent">
                        <SettingsIcon size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">System Settings</h1>
                </div>

                {/* Centered Flush Search Bar */}
                <div className="flex-1 flex justify-center max-w-2xl px-8">
                    <div className="relative group w-full max-w-md">
                        <div className="flex items-center bg-bg-tertiary/30 px-4 py-2 rounded-2xl border border-transparent focus-within:border-accent/30 focus-within:bg-bg-tertiary/50 transition-all h-10">
                            <SearchIcon size={14} className="text-text-muted/50 group-focus-within:text-accent" />
                            <input
                                type="text"
                                placeholder="Search settings..."
                                ref={searchInputRef}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none text-[13px] text-text-primary pl-3 outline-none placeholder:text-text-muted/40"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => addTab({ type: 'shortcuts', name: 'Keyboard Shortcuts' })}
                        className="flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-accent hover:bg-accent/5 rounded-xl transition-all font-bold text-[11px] tracking-widest uppercase"
                        title="Keyboard Shortcuts"
                    >
                        <Keyboard size={16} />
                        <span className="hidden xl:inline">Shortcuts</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="max-w-5xl mx-auto px-12 py-10 animate-in fade-in duration-700">
                        <div className="flex flex-col">
                            {/* Appearance */}
                            {matchesSearch("Appearance", ["Theme Interface", "Editor Font Size"]) && (
                                <div className={sectionClass}>
                                    <div className={sectionInfoClass}>
                                        <div className="flex items-center gap-2.5 text-accent mb-1">
                                            <Laptop size={18} strokeWidth={2.5} />
                                            <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Appearance</h2>
                                        </div>
                                        <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                                            Customize the visual personality of your workspace.
                                        </p>
                                    </div>
                                    <div className={sectionContentClass}>
                                        <div className="flex flex-col">
                                            <label className={labelClass}>Interface Theme</label>
                                            <select className={inputClass} value={formTheme} onChange={(e) => setFormTheme(e.target.value)}>
                                                <option value="system">System Preference</option>
                                                <option value="light">Light Mode</option>
                                                <option value="dark">Dark Mode</option>
                                            </select>
                                            <span className={hintClass}>Follows your operating system's color scheme.</span>
                                        </div>

                                        <div className="flex flex-col">
                                            <label className={labelClass}>Editor Text Size</label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    className={cn(inputClass, "max-w-[120px]")}
                                                    type="number"
                                                    min={8}
                                                    max={48}
                                                    value={formFontSize}
                                                    onChange={(e) => setFormFontSize(parseInt(e.target.value) || 14)}
                                                />
                                                <span className="text-[13px] font-mono text-text-muted">Pixels</span>
                                            </div>
                                            <span className={hintClass}>Adjust for optimal code readability.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notifications */}
                            {matchesSearch("Notifications", ["Toast Position"]) && (
                                <div className={sectionClass}>
                                    <div className={sectionInfoClass}>
                                        <div className="flex items-center gap-2.5 text-accent mb-1">
                                            <Bell size={18} strokeWidth={2.5} />
                                            <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Notifications</h2>
                                        </div>
                                        <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                                            Configure how and where system alerts appear.
                                        </p>
                                    </div>
                                    <div className={sectionContentClass}>
                                        <div className="flex flex-col">
                                            <label className={labelClass}>Alert Placement</label>
                                            <select className={inputClass} value={formToastPlacement} onChange={(e) => setFormToastPlacement(e.target.value as any)}>
                                                <option value="bottom-left">Bottom Left</option>
                                                <option value="bottom-center">Bottom Center</option>
                                                <option value="bottom-right">Bottom Right</option>
                                                <option value="top-left">Top Left</option>
                                                <option value="top-center">Top Center</option>
                                                <option value="top-right">Top Right</option>
                                            </select>
                                            <span className={hintClass}>Where success and error messages will emerge.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Editor & Data */}
                            {matchesSearch("Data & Query", ["Default Row Limit"]) && (
                                <div className={sectionClass}>
                                    <div className={sectionInfoClass}>
                                        <div className="flex items-center gap-2.5 text-accent mb-1">
                                            <Database size={18} strokeWidth={2.5} />
                                            <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Data & Query</h2>
                                        </div>
                                        <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                                            Manage performance thresholds for your datasets.
                                        </p>
                                    </div>
                                    <div className={sectionContentClass}>
                                        <div className="flex flex-col">
                                            <label className={labelClass}>Fetch Row Limit</label>
                                            <select className={inputClass} value={formLimit} onChange={(e) => setFormLimit(parseInt(e.target.value) || 1000)}>
                                                <option value={100}>100 rows</option>
                                                <option value={500}>500 rows</option>
                                                <option value={1000}>1,000 rows</option>
                                                <option value={5000}>5,000 rows</option>
                                                <option value={10000}>10,000 rows</option>
                                            </select>
                                            <span className={hintClass}>Default row count for the result records.</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6 pt-2">
                                            <div className="flex flex-col">
                                                <label className={labelClass}>Connection Timeout</label>
                                                <input
                                                    className={inputClass}
                                                    type="number"
                                                    min={5}
                                                    max={300}
                                                    value={formConnectTimeout}
                                                    onChange={(e) => setFormConnectTimeout(parseInt(e.target.value) || 10)}
                                                />
                                                <span className={hintClass}>Seconds before aborting login.</span>
                                            </div>

                                            <div className="flex flex-col">
                                                <label className={labelClass}>Execution Timeout</label>
                                                <input
                                                    className={inputClass}
                                                    type="number"
                                                    min={5}
                                                    max={100000}
                                                    value={formQueryTimeout}
                                                    onChange={(e) => setFormQueryTimeout(parseInt(e.target.value) || 60)}
                                                />
                                                <span className={hintClass}>Seconds for long queries.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Region */}
                            {matchesSearch("Region", ["Language"]) && (
                                <div className={sectionClass}>
                                    <div className={sectionInfoClass}>
                                        <div className="flex items-center gap-2.5 text-accent mb-1">
                                            <Globe size={18} strokeWidth={2.5} />
                                            <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Regional Settings</h2>
                                        </div>
                                        <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                                            Locality and language preferences.
                                        </p>
                                    </div>
                                    <div className={sectionContentClass}>
                                        <div className="flex flex-col">
                                            <label className={labelClass}>Preferred Language</label>
                                            <select className={inputClass} disabled>
                                                <option value="en">English (United States)</option>
                                            </select>
                                            <span className={hintClass}>Zentro is currently optimized for English.</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};
