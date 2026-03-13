import React, { useEffect, useState } from 'react';
import { User, Laptop, Bell, Database, Globe, Search as SearchIcon } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { utils } from '../../../wailsjs/go/models';
import { cn } from '../../lib/cn';

interface SettingsViewProps {
    tabId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ tabId }) => {
    const { theme, fontSize, defaultLimit, toastPlacement, save } = useSettingsStore();
    const { removeTab } = useEditorStore();

    const [formTheme, setFormTheme] = useState(theme);
    const [formFontSize, setFormFontSize] = useState(fontSize);
    const [formLimit, setFormLimit] = useState(defaultLimit);
    const [formToastPlacement, setFormToastPlacement] = useState(toastPlacement);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setFormTheme(theme);
        setFormFontSize(fontSize);
        setFormLimit(defaultLimit);
        setFormToastPlacement(toastPlacement);
    }, [theme, fontSize, defaultLimit, toastPlacement]);

    // Auto-save effect
    useEffect(() => {
        // Skip initial mount if values match
        if (
            formTheme === theme &&
            formFontSize === fontSize &&
            formLimit === defaultLimit &&
            formToastPlacement === toastPlacement
        ) {
            return;
        }

        const timer = setTimeout(async () => {
            await save(new utils.Preferences({
                theme: formTheme,
                font_size: formFontSize,
                default_limit: formLimit,
                toast_placement: formToastPlacement
            }));
        }, 500);

        return () => clearTimeout(timer);
    }, [formTheme, formFontSize, formLimit, formToastPlacement, save, theme, fontSize, defaultLimit, toastPlacement]);

    const labelClass = "text-[12px] font-medium text-text-primary mb-0.5";
    const inputClass = "w-full max-w-xs bg-bg-secondary border border-border text-[12px] px-3 py-1 rounded outline-none transition-colors focus:border-success disabled:opacity-50 disabled:cursor-not-allowed";
    const hintClass = "text-[11px] text-text-muted mt-0.5 opacity-60";
    
    const sectionClass = "flex flex-col md:flex-row gap-4 p-4 border-b border-border hover:bg-bg-secondary/20 transition-colors";
    const sectionInfoClass = "w-full md:w-1/3 flex flex-col gap-0.5";
    const sectionContentClass = "w-full md:w-2/3 flex flex-col gap-3";

    const matchesSearch = (title: string, labels: string[]) => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return title.toLowerCase().includes(query) || labels.some(l => l.toLowerCase().includes(query));
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary/50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-success/10 rounded-lg text-success">
                            <User size={20} />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-text-primary">Settings</h1>
                            <p className="text-[11px] text-text-secondary">Configure your Zentro experience</p>
                        </div>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative group max-w-xs w-64">
                        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-success" />
                        <input
                            type="text"
                            placeholder="Search settings..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-bg-primary border border-border text-[13px] text-text-primary pl-9 pr-3 py-1.5 rounded-lg outline-none transition-all focus:border-success focus:ring-2 focus:ring-success/10"
                        />
                    </div>
                </div>
                
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                    
                    {/* Appearance */}
                    {matchesSearch("Appearance", ["Theme Interface", "Editor Font Size"]) && (
                        <div className={sectionClass}>
                            <div className={sectionInfoClass}>
                                <div className="flex items-center gap-2 text-text-primary mb-1">
                                    <Laptop size={16} />
                                    <h2 className="text-sm font-semibold">Appearance</h2>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Customize how Zentro looks and feels across your workspace.
                                </p>
                            </div>
                            <div className={sectionContentClass}>
                                <div className="flex flex-col">
                                    <label className={labelClass}>Theme Interface</label>
                                    <select className={inputClass} value={formTheme} onChange={(e) => setFormTheme(e.target.value)}>
                                        <option value="system">System Default</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                    <span className={hintClass}>Changes the overall application theme.</span>
                                </div>

                                <div className="flex flex-col">
                                    <label className={labelClass}>Editor Font Size (px)</label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        min={8}
                                        max={48}
                                        value={formFontSize}
                                        onChange={(e) => setFormFontSize(parseInt(e.target.value) || 14)}
                                    />
                                    <span className={hintClass}>Adjust the readability of your code editor.</span>
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
                                    <h2 className="text-sm font-semibold">Notifications</h2>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Manage how and where system alerts are displayed.
                                </p>
                            </div>
                            <div className={sectionContentClass}>
                                <div className="flex flex-col">
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
                                    <h2 className="text-sm font-semibold">Data & Query</h2>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Control query behavior and data safety thresholds.
                                </p>
                            </div>
                            <div className={sectionContentClass}>
                                <div className="flex flex-col">
                                    <label className={labelClass}>Default Row Limit</label>
                                    <select className={inputClass} value={formLimit} onChange={(e) => setFormLimit(parseInt(e.target.value) || 1000)}>
                                        <option value={100}>100 rows</option>
                                        <option value={500}>500 rows</option>
                                        <option value={1000}>1,000 rows</option>
                                        <option value={5000}>5,000 rows</option>
                                        <option value={10000}>10,000 rows</option>
                                    </select>
                                    <span className={hintClass}>Used for automatic limit when not specified in query.</span>
                                </div>
                            </div>
                        </div>
                    )}

                   {/* Language */}
                   {matchesSearch("Region", ["Language"]) && (
                        <div className={cn(sectionClass, "border-b-0")}>
                            <div className={sectionInfoClass}>
                                <div className="flex items-center gap-2 text-text-primary mb-1">
                                    <Globe size={16} />
                                    <h2 className="text-sm font-semibold">Region</h2>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Language and regional formatting settings.
                                </p>
                            </div>
                            <div className={sectionContentClass}>
                                <div className="flex flex-col">
                                    <label className={labelClass}>Language</label>
                                    <select className={inputClass} disabled>
                                        <option value="en">English (US)</option>
                                    </select>
                                    <span className={hintClass}>Additional languages coming soon.</span>
                                </div>
                            </div>
                        </div>
                   )}

                </div>
            </div>
        </div>
    );
};
