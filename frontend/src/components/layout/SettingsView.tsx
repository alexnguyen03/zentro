import React, { useEffect, useState, useRef } from 'react';
import { Settings as SettingsIcon, Search as SearchIcon, Keyboard } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { utils } from '../../../wailsjs/go/models';
import { cn } from '../../lib/cn';
import { ToastPlacement, useToast } from './Toast';
import {
    applyProfilePackage,
    buildCurrentProfilePackage,
    downloadProfilePackage,
    parseProfilePackage,
} from '../../lib/profilePackage';
import { SettingsAppearance } from './settings/SettingsAppearance';
import { SettingsNotifications } from './settings/SettingsNotifications';
import { SettingsData } from './settings/SettingsData';
import { SettingsRegion } from './settings/SettingsRegion';
import { SettingsProfiles } from './settings/SettingsProfiles';
import { SettingsUpdates } from './settings/SettingsUpdates';
import { buildTelemetryPipelineExportBundle, exportTelemetryPipelineBundle } from '../../features/telemetry/localMetricsStore';
import { getTelemetryConsent, setTelemetryConsent } from '../../features/telemetry/consent';

interface SettingsViewProps {
    tabId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ tabId }) => {
    const { theme, fontSize, defaultLimit, toastPlacement, connectTimeout, queryTimeout, save } = useSettingsStore();
    const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
    const { addTab } = useEditorStore();
    const { toast } = useToast();

    const [formTheme, setFormTheme] = useState(theme);
    const [formFontSize, setFormFontSize] = useState(fontSize);
    const [formLimit, setFormLimit] = useState(defaultLimit);
    const [formConnectTimeout, setFormConnectTimeout] = useState(connectTimeout);
    const [formQueryTimeout, setFormQueryTimeout] = useState(queryTimeout);
    const [formToastPlacement, setFormToastPlacement] = useState(toastPlacement);
    const [profileName, setProfileName] = useState('Zentro Profile');
    const [searchQuery, setSearchQuery] = useState('');
    const [telemetryOptIn, setTelemetryOptIn] = useState(getTelemetryConsent().optedIn);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const profileInputRef = useRef<HTMLInputElement>(null);

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

    const matchesSearch = (title: string, labels: string[]) => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        return title.toLowerCase().includes(query) || labels.some(l => l.toLowerCase().includes(query));
    };

    const handleExportProfile = () => {
        try {
            const profile = buildCurrentProfilePackage(profileName);
            downloadProfilePackage(profile);
            toast.success(`Exported profile: ${profile.metadata.name}`);
        } catch (error) {
            toast.error(`Export failed: ${error}`);
        }
    };

    const handleImportProfile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const raw = await file.text();
            const profile = parseProfilePackage(raw);
            await applyProfilePackage(profile);
            setProfileName(profile.metadata.name || 'Zentro Profile');
            toast.success(`Applied profile: ${profile.metadata.name}`);
        } catch (error) {
            toast.error(`Import failed: ${error}`);
        } finally {
            event.target.value = '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Minimal Flat Header */}
            <div className="z-sticky flex h-16 items-center justify-between border-b border-border/10 bg-bg-primary px-10">
                {/* Logo/Title Section */}
                <div className="flex items-center gap-3 text-text-primary">
                    <div className="p-2 rounded-md bg-accent/5 text-accent">
                        <SettingsIcon size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">System Settings</h1>
                </div>

                {/* Centered Flush Search Bar */}
                <div className="flex-1 flex justify-center max-w-2xl px-8">
                    <div className="relative group w-full max-w-md">
                        <div className="flex items-center bg-bg-tertiary/30 px-4 py-2 rounded-md border border-transparent focus-within:border-accent/30 focus-within:bg-bg-tertiary/50 transition-all h-10">
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
                        className="flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-accent hover:bg-accent/5 rounded-md transition-all font-bold text-[11px] tracking-widest uppercase"
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
                                <SettingsAppearance 
                                    theme={formTheme} 
                                    onThemeChange={setFormTheme} 
                                    fontSize={formFontSize} 
                                    onFontSizeChange={setFormFontSize} 
                                />
                            )}

                            {/* Notifications */}
                            {matchesSearch("Notifications", ["Toast Position"]) && (
                                <SettingsNotifications
                                    toastPlacement={formToastPlacement}
                                    onToastPlacementChange={setFormToastPlacement}
                                />
                            )}

                            {/* Editor & Data */}
                            {matchesSearch("Data & Query", ["Default Row Limit", "Telemetry", "Export Telemetry"]) && (
                                <SettingsData
                                    limit={formLimit}
                                    onLimitChange={setFormLimit}
                                    connectTimeout={formConnectTimeout}
                                    onConnectTimeoutChange={setFormConnectTimeout}
                                    queryTimeout={formQueryTimeout}
                                    onQueryTimeoutChange={setFormQueryTimeout}
                                    telemetryOptIn={telemetryOptIn}
                                    onTelemetryOptInChange={(checked) => {
                                        setTelemetryConsent(checked);
                                        setTelemetryOptIn(checked);
                                        toast.success(checked ? 'Telemetry opt-in enabled.' : 'Telemetry opt-in disabled.');
                                    }}
                                    onExportTelemetry={() => {
                                        const consent = getTelemetryConsent();
                                        const bundle = buildTelemetryPipelineExportBundle(consent);
                                        exportTelemetryPipelineBundle(bundle);
                                        toast.success('Telemetry pipeline bundle exported.');
                                    }}
                                />
                            )}

                            {/* Region */}
                            {matchesSearch("Region", ["Language"]) && (
                                <SettingsRegion />
                            )}

                            {/* Profiles */}
                            {matchesSearch("Profiles", ["Import Profile", "Export Profile", "Theme", "Layout", "Shortcuts"]) && (
                                <SettingsProfiles
                                    profileName={profileName}
                                    onProfileNameChange={setProfileName}
                                    onExportProfile={handleExportProfile}
                                    onImportProfile={handleImportProfile}
                                />
                            )}

                            {/* Updates */}
                            {matchesSearch("Updates", ["Auto-Check For Updates"]) && (
                                <SettingsUpdates
                                    autoCheckUpdates={autoCheckUpdates}
                                    onAutoCheckUpdatesChange={(checked) => {
                                        const { theme, fontSize, defaultLimit, connectTimeout, queryTimeout, save } = useSettingsStore.getState();
                                        save(new utils.Preferences({
                                            theme,
                                            font_size: fontSize,
                                            default_limit: defaultLimit,
                                            connect_timeout: connectTimeout,
                                            query_timeout: queryTimeout,
                                            toast_placement: useSettingsStore.getState().toastPlacement,
                                            auto_check_updates: checked
                                        }));
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};
