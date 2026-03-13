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
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-8 h-12 border-b border-border bg-bg-primary/50 backdrop-blur-sm z-10">
                {/* Spacer for left side balance */}
                <div className="w-10" />

                {/* Centered Search Bar */}
                <div className="flex-1 flex justify-center max-w-2xl">
                    <div className="relative group w-full max-w-md">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-success" />
                        <input
                            type="text"
                            placeholder="Find settings..."
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-bg-secondary/50 border border-border text-[13px] text-text-primary pl-9 pr-3 py-1.5 rounded-lg outline-none transition-all focus:border-success focus:bg-bg-primary h-8"
                        />
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => addTab({ type: 'shortcuts', name: 'Keyboard Shortcuts' })}
                        className="p-2 text-text-secondary hover:text-success hover:bg-success/10 rounded-lg transition-all"
                        title="Keyboard Shortcuts"
                    >
                        <Keyboard size={18} />
                    </button>
                    <div className="w-2" />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto px-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col">
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
                    </div>
                </main>
            </div>
        </div>
    );
};
