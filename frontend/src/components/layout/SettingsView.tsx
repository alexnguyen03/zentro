import React, { useEffect, useState, useRef } from 'react';
import { Search, Settings as SettingsIcon, Keyboard } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { utils } from '../../../wailsjs/go/models';
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
import { SettingsSourceControl } from './settings/SettingsSourceControl';
import { buildTelemetryPipelineExportBundle, exportTelemetryPipelineBundle } from '../../features/telemetry/localMetricsStore';
import { getTelemetryConsent, setTelemetryConsent } from '../../features/telemetry/consent';
import { Button, Input } from '../ui';
import { ENVIRONMENT_KEY } from '../../lib/constants';
import { getEnvironmentMeta } from '../../lib/projects';
import type { EnvironmentKey } from '../../types/project';
import {
    type SafetyLevel,
    resolveEnvironmentSafetyLevel,
    resolveStrongConfirmFromEnvironment,
    setStrongConfirmFromEnvironment,
    setEnvironmentSafetyLevel,
} from '../../features/query/policyProfiles';

interface SettingsViewProps {
    tabId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ tabId }) => {
    const { theme, fontSize, defaultLimit, toastPlacement, connectTimeout, queryTimeout, save } = useSettingsStore();
    const autoCheckUpdates = useSettingsStore((state) => state.autoCheckUpdates);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const activeProject = useProjectStore((state) => state.activeProject);
    const saveProject = useProjectStore((state) => state.saveProject);
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
    const [autoCommitOnExit, setAutoCommitOnExit] = useState<boolean>(Boolean(activeProject?.auto_commit_on_exit));
    const [autoCommitSaving, setAutoCommitSaving] = useState(false);
    const safetyEnvironment: EnvironmentKey = activeEnvironmentKey || ENVIRONMENT_KEY.LOCAL;
    const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>(() => (
        resolveEnvironmentSafetyLevel(activeEnvironmentKey || ENVIRONMENT_KEY.LOCAL)
    ));
    const [strongConfirmFromEnvironment, setStrongConfirmFromEnvironmentState] = useState<EnvironmentKey>(
        () => resolveStrongConfirmFromEnvironment(),
    );
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

    useEffect(() => {
        setSafetyLevel(resolveEnvironmentSafetyLevel(safetyEnvironment));
    }, [safetyEnvironment]);

    useEffect(() => {
        setAutoCommitOnExit(Boolean(activeProject?.auto_commit_on_exit));
    }, [activeProject?.id, activeProject?.auto_commit_on_exit]);

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

    const handleImportProfile = async (file: File) => {
        try {
            const raw = await file.text();
            const profile = parseProfilePackage(raw);
            await applyProfilePackage(profile);
            setProfileName(profile.metadata.name || 'Zentro Profile');
            toast.success(`Applied profile: ${profile.metadata.name}`);
        } catch (error) {
            toast.error(`Import failed: ${error}`);
        }
    };

    const handleSafetyLevelChange = (level: SafetyLevel) => {
        const currentLevel = resolveEnvironmentSafetyLevel(safetyEnvironment);
        if (currentLevel === level) {
            setSafetyLevel(level);
            return;
        }

        setEnvironmentSafetyLevel(safetyEnvironment, level);
        setSafetyLevel(resolveEnvironmentSafetyLevel(safetyEnvironment));
        toast.success(`Write safety for ${getEnvironmentMeta(safetyEnvironment).label} set to ${level}.`);
    };

    const handleStrongConfirmFromEnvironmentChange = (environment: EnvironmentKey) => {
        if (environment === strongConfirmFromEnvironment) return;
        setStrongConfirmFromEnvironment(environment);
        setStrongConfirmFromEnvironmentState(environment);
    };

    const sourceControlEnabled = Boolean(activeProject?.id && activeProject?.git_repo_path);

    const handleAutoCommitOnExitChange = async (checked: boolean) => {
        if (!activeProject || !activeProject.git_repo_path) return;
        setAutoCommitOnExit(checked);
        setAutoCommitSaving(true);
        try {
            const saved = await saveProject({
                ...activeProject,
                auto_commit_on_exit: checked,
            });
            if (!saved) {
                setAutoCommitOnExit(Boolean(activeProject.auto_commit_on_exit));
                toast.error('Failed to save Source Control settings.');
                return;
            }
        } finally {
            setAutoCommitSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Minimal Flat Header */}
            <div className="z-sticky flex h-16 items-center justify-between border-b border-border/10 bg-background px-10">
                {/* Logo/Title Section */}
                <div className="flex items-center gap-3 text-foreground">
                    <div className="p-2 rounded-md bg-accent/5 text-accent">
                        <SettingsIcon size={18} />
                    </div>
                    <h1 className="text-[15px] font-bold tracking-tight">System Settings</h1>
                </div>

                {/* Centered Flush Search Bar */}
                <div className="flex-1 flex justify-center max-w-2xl px-8">
                    <div className="relative w-full max-w-md">
                        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search settings..."
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 border-input/70 bg-muted/40 pl-8 focus:bg-background"
                        />
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => addTab({ type: 'shortcuts', name: 'Keyboard Shortcuts' })}
                        variant="ghost"
                        size="default"
                        className="gap-2 font-bold text-[11px] tracking-widest uppercase"
                        title="Keyboard Shortcuts"
                    >
                        <Keyboard size={16} />
                        <span className="hidden xl:inline">Shortcuts</span>
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="max-w-4xl mx-auto px-5 py-6 animate-in fade-in duration-300">
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
                                    onTestNotification={(variant) => {
                                        if (variant === 'success') {
                                            toast.success('This is a success notification preview.');
                                            return;
                                        }
                                        if (variant === 'error') {
                                            toast.error('This is an error notification preview.');
                                            return;
                                        }
                                        toast.info('This is an info notification preview.');
                                    }}
                                />
                            )}

                            {/* Editor & Data */}
                            {matchesSearch("Data & Query", ["Default Row Limit", "Telemetry", "Export Telemetry", "Write Safety", "Strong Confirm"]) && (
                                <SettingsData
                                    limit={formLimit}
                                    onLimitChange={setFormLimit}
                                    connectTimeout={formConnectTimeout}
                                    onConnectTimeoutChange={setFormConnectTimeout}
                                    queryTimeout={formQueryTimeout}
                                    onQueryTimeoutChange={setFormQueryTimeout}
                                    activeSafetyEnvironment={safetyEnvironment}
                                    safetyLevel={safetyLevel}
                                    onSafetyLevelChange={handleSafetyLevelChange}
                                    strongConfirmFromEnvironment={strongConfirmFromEnvironment}
                                    onStrongConfirmFromEnvironmentChange={handleStrongConfirmFromEnvironmentChange}
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

                            {/* Source Control */}
                            {matchesSearch("Source Control", ["Auto commit on app exit", "Git repo path"]) && (
                                <SettingsSourceControl
                                    enabled={sourceControlEnabled}
                                    checked={autoCommitOnExit}
                                    saving={autoCommitSaving}
                                    repoPath={activeProject?.git_repo_path}
                                    onToggle={(checked) => {
                                        void handleAutoCommitOnExitChange(checked);
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
