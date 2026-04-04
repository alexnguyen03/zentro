import React from 'react';
import { ArrowRight, Check, CircleAlert, Download } from 'lucide-react';
import { ConfirmationModal, Button, Spinner, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { ENVIRONMENT_KEY } from '../../lib/constants';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import type { ConnectionProfile } from '../../types/connection';
import type { EnvironmentKey } from '../../types/project';
import { useToast } from './Toast';
import { DeleteConnection, ExportConnectionPackage, ImportConnectionPackage, LoadConnections } from '../../services/connectionService';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ConnectionForm } from '../connection/ConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ProviderPickerToolbar } from '../connection/ProviderPickerToolbar';
import { DatabaseTreePicker } from '../connection/DatabaseTreePicker';
import { OverlayDialog } from './OverlayDialog';
import { PanelFrame } from './PanelFrame';

interface EnvironmentSwitcherModalProps {
    onClose: () => void;
}

type Mode = 'choose' | 'add';

export const EnvironmentSwitcherModal: React.FC<EnvironmentSwitcherModalProps> = ({ onClose }) => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const setProjectEnvironment = useProjectStore((state) => state.setProjectEnvironment);
    const bindEnvironmentConnection = useProjectStore((state) => state.bindEnvironmentConnection);
    const setActiveProject = useProjectStore((state) => state.setActiveProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const setActiveEnvironment = useEnvironmentStore((state) => state.setActiveEnvironment);
    const setConnections = useConnectionStore((state) => state.setConnections);
    const { toast } = useToast();

    const [mode, setMode] = React.useState<Mode>('choose');
    const [selectedEnvironmentKey, setSelectedEnvironmentKey] = React.useState<EnvironmentKey>(ENVIRONMENT_KEY.LOCAL);
    const [connections, setLocalConnections] = React.useState<ConnectionProfile[]>([]);
    const [selectedProfileName, setSelectedProfileName] = React.useState<string | null>(null);
    const [selectedDatabase, setSelectedDatabase] = React.useState('');
    const [providerFilter, setProviderFilter] = React.useState('');
    const [isSelectingProvider, setIsSelectingProvider] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [exporting, setExporting] = React.useState(false);
    const [importingFormConnection, setImportingFormConnection] = React.useState(false);
    const [editingProfile, setEditingProfile] = React.useState<ConnectionProfile | null>(null);
    const [pendingDeleteProfile, setPendingDeleteProfile] = React.useState<ConnectionProfile | null>(null);
    const [deletingConnectionName, setDeletingConnectionName] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!activeProject) return;
        setSelectedEnvironmentKey((activeEnvironmentKey || activeProject.last_active_environment_key || activeProject.default_environment_key || ENVIRONMENT_KEY.LOCAL) as EnvironmentKey);
    }, [activeEnvironmentKey, activeProject?.default_environment_key, activeProject?.last_active_environment_key]);

    const selectedProjectConnection = activeProject?.connections?.find(
        (connection) => connection.environment_key === selectedEnvironmentKey,
    );
    const persistedProfileName = selectedProjectConnection?.advanced_meta?.profile_name || selectedProjectConnection?.name || null;
    const persistedDatabaseName = selectedProjectConnection?.database || '';

    React.useEffect(() => {
        let cancelled = false;
        LoadConnections()
            .then((loaded) => {
                if (cancelled) return;
                const next = loaded || [];
                setLocalConnections(next);
                setConnections(next);
                const preferredProfile = persistedProfileName && next.some((profile) => profile.name === persistedProfileName)
                    ? persistedProfileName
                    : null;
                setSelectedProfileName(preferredProfile || next[0]?.name || null);
                setSelectedDatabase(persistedDatabaseName || '');
            })
            .catch((error) => {
                if (!cancelled) {
                    toast.error(`Failed to load connections: ${error}`);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [persistedDatabaseName, persistedProfileName, setConnections, toast]);

    const selectedProfile = React.useMemo(
        () => connections.find((profile) => profile.name === selectedProfileName) || null,
        [connections, selectedProfileName],
    );

    const existingNames = connections.map((c) => c.name!).filter(Boolean);
    const form = useConnectionForm({
        profile: editingProfile,
        isOpen: mode === 'add',
        existingNames,
        onSaved: async () => {
            const savedName = form.formData.name || '';
            try {
                const loaded = await LoadConnections();
                const next = loaded || [];
                setLocalConnections(next);
                setConnections(next);
                setSelectedProfileName(savedName || next[0]?.name || null);
                setMode('choose');
                setIsSelectingProvider(false);
                setProviderFilter('');
                setEditingProfile(null);
            } catch (error) {
                toast.error(`Failed to reload connections: ${error}`);
            }
        },
        onClose: () => {
            setMode('choose');
            setIsSelectingProvider(false);
            setProviderFilter('');
            setEditingProfile(null);
        },
    });
    const selectedProvider = React.useMemo(
        () => (form.selectedProvider ? getProvider(form.selectedProvider) : null),
        [form.selectedProvider],
    );

    const handleProviderSelect = React.useCallback((key: string) => {
        form.handleDriverChange(key);
        setIsSelectingProvider(false);
        setProviderFilter('');
    }, [form.handleDriverChange]);

    const handleSelectFromTree = React.useCallback((profile: ConnectionProfile, database: string) => {
        setSelectedProfileName(profile.name || null);
        setSelectedDatabase(database);
    }, []);

    const handleImportConnectionToForm = React.useCallback(async () => {
        setImportingFormConnection(true);
        try {
            const imported = await ImportConnectionPackage();
            if (!imported) return;

            const importedProfile: ConnectionProfile = { ...(imported as ConnectionProfile) };
            setEditingProfile(null);
            form.setFormFromProfile(importedProfile);
            setIsSelectingProvider(false);
            setProviderFilter('');
            toast.success(`Imported connection${importedProfile.name ? ` "${importedProfile.name}"` : ''}.`);
        } catch (error) {
            toast.error(`Could not import connection: ${error}`);
        } finally {
            setImportingFormConnection(false);
        }
    }, [form, toast]);

    const handleEditConnection = React.useCallback((profile: ConnectionProfile) => {
        setEditingProfile(profile);
        setMode('add');
        setIsSelectingProvider(false);
        setProviderFilter('');
    }, []);

    const handleRequestDeleteConnection = React.useCallback((profile: ConnectionProfile) => {
        setPendingDeleteProfile(profile);
    }, []);

    const handleConfirmDeleteConnection = React.useCallback(async () => {
        const profileName = pendingDeleteProfile?.name;
        if (!profileName) return;

        setDeletingConnectionName(profileName);
        try {
            await DeleteConnection(profileName);
            const loaded = await LoadConnections();
            const next = loaded || [];
            setLocalConnections(next);
            setConnections(next);

            if (selectedProfileName === profileName) {
                const fallback = next[0] || null;
                setSelectedProfileName(fallback?.name || null);
                setSelectedDatabase(fallback?.db_name || '');
            }

            if (editingProfile?.name === profileName) {
                setEditingProfile(null);
                setMode('choose');
                setIsSelectingProvider(false);
                setProviderFilter('');
            }

            toast.success(`Deleted connection "${profileName}".`);
        } catch (error) {
            toast.error(`Could not delete connection: ${error}`);
        } finally {
            setDeletingConnectionName(null);
            setPendingDeleteProfile(null);
        }
    }, [editingProfile?.name, pendingDeleteProfile?.name, selectedProfileName, setConnections, toast]);

    const handleApply = async () => {
        if (!activeProject) return;

        setSaving(true);
        try {
            let nextProject = activeProject;
            const databaseToUse = selectedDatabase || selectedProfile?.db_name || '';

            if (selectedProfile) {
                const bound = await bindEnvironmentConnection(selectedEnvironmentKey, {
                    ...selectedProfile,
                    db_name: databaseToUse,
                });
                if (!bound) {
                    toast.error('Could not bind connection to environment.');
                    return;
                }
                nextProject = bound;
            }

            const updated = await setProjectEnvironment(selectedEnvironmentKey);
            const finalProject = updated || nextProject;
            setActiveProject(finalProject);
            setActiveEnvironment(selectedEnvironmentKey);

            toast.success(`Switched to ${getEnvironmentMeta(selectedEnvironmentKey).label}.`);
            onClose();
        } catch (error) {
            toast.error(`Could not switch environment: ${error}`);
        } finally {
            setSaving(false);
        }
    };

    const handleExportConnection = async () => {
        setExporting(true);
        try {
            const exportedPath = await ExportConnectionPackage(selectedEnvironmentKey);
            if (!exportedPath) return;
            toast.success(`Connection exported: ${exportedPath}`);
        } catch (error) {
            toast.error(`Could not export connection: ${error}`);
        } finally {
            setExporting(false);
        }
    };

    if (!activeProject) return null;

    const applyDisabled = saving || mode === 'add';

    return (
        <OverlayDialog onClose={onClose} contentClassName="flex w-full items-center justify-center p-3">
            <ConfirmationModal
                isOpen={Boolean(pendingDeleteProfile)}
                onClose={() => {
                    if (deletingConnectionName) return;
                    setPendingDeleteProfile(null);
                }}
                onConfirm={() => {
                    void handleConfirmDeleteConnection();
                }}
                title="Delete Connection"
                message={`Delete "${pendingDeleteProfile?.name || ''}"?`}
                description="This action removes the saved connection profile."
                confirmLabel={deletingConnectionName ? 'Deleting...' : 'Delete'}
                variant="destructive"
            />
            <PanelFrame
                title={activeProject.name}
                subtitle="Project"
                onClose={onClose}
                className="h-[588px] w-[900px] max-w-[calc(100vw-24px)] rounded-md"
                titleClassName="text-[20px]"
                bodyClassName="min-h-0 overflow-hidden"
                footerClassName="flex items-center justify-between px-3 py-2.5"
                footer={(
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                void handleExportConnection();
                            }}
                            disabled={exporting || mode === 'add'}
                            className="rounded-md"
                            title="Export selected environment connection"
                        >
                            {exporting ? <Spinner size={13} /> : <Download size={14} />}
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => void handleApply()}
                            disabled={applyDisabled}
                            className="rounded-md"
                        >
                            {saving ? (
                                'Applying...'
                            ) : (
                                <>
                                    Apply <ArrowRight size={14} />
                                </>
                            )}
                        </Button>
                    </>
                )}
            >
                <div className="grid h-full min-h-0 md:grid-cols-[228px_1fr]">
                    <section className="min-h-0 overflow-y-auto border-r border-border/20 bg-bg-primary/30 px-3 py-3">
                        <div className="space-y-3">
                            <TooltipProvider delayDuration={120}>
                                {ENVIRONMENT_KEYS.map((environmentKey) => {
                                    const meta = getEnvironmentMeta(environmentKey);
                                    const isSelected = selectedEnvironmentKey === environmentKey;
                                    const hasBinding = Boolean(
                                        activeProject.connections?.find((connection) => connection.environment_key === environmentKey),
                                    );

                                    return (
                                        <button
                                            key={environmentKey}
                                            type="button"
                                            onClick={() => setSelectedEnvironmentKey(environmentKey)}
                                            className={cn(
                                                'w-full cursor-pointer rounded-md border px-3 py-3 text-left transition-colors',
                                                isSelected
                                                    ? 'border-accent/40 bg-accent/8'
                                                    : 'border-border/25 bg-bg-primary/20 hover:bg-bg-primary/40',
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>
                                                        {environmentKey}
                                                    </span>
                                                    <span className="text-[13px] font-semibold text-text-primary">{meta.label}</span>
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className={cn('inline-flex items-center', hasBinding ? 'text-accent' : 'text-text-secondary')}>
                                                            {hasBinding ? <Check size={14} /> : <CircleAlert size={14} />}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {hasBinding ? 'Bound' : 'Need binding'}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </button>
                                    );
                                })}
                            </TooltipProvider>
                        </div>
                    </section>

                    <section className="min-h-0 px-3 py-2.5">
                        {mode === 'choose' ? (
                            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-md bg-bg-primary/20">
                                <div className="min-h-0 px-2.5 py-2">
                                    <DatabaseTreePicker
                                        onSelect={handleSelectFromTree}
                                        selectedProfile={selectedProfileName}
                                        selectedDatabase={selectedDatabase}
                                        onAddNew={() => {
                                            setEditingProfile(null);
                                            form.resetForm();
                                            setMode('add');
                                            setIsSelectingProvider(true);
                                            setProviderFilter('');
                                        }}
                                        onEditConnection={handleEditConnection}
                                        onDeleteConnection={handleRequestDeleteConnection}
                                        deletingConnectionName={deletingConnectionName}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
                                <ProviderPickerToolbar
                                    isSelectingProvider={isSelectingProvider}
                                    providerFilter={providerFilter}
                                    selectedProvider={selectedProvider}
                                    onBack={() => {
                                        setEditingProfile(null);
                                        setMode('choose');
                                        setIsSelectingProvider(false);
                                        setProviderFilter('');
                                    }}
                                    onShowProviderPicker={() => setIsSelectingProvider(true)}
                                    onProviderFilterChange={setProviderFilter}
                                    onClearProviderFilter={() => setProviderFilter('')}
                                    onImportConnection={handleImportConnectionToForm}
                                    importingConnection={importingFormConnection}
                                />

                                {isSelectingProvider ? (
                                    <div className="h-full min-h-0 rounded-md bg-bg-primary/15 p-2">
                                        <ProviderGrid
                                            selected={form.selectedProvider}
                                            locked={form.isEditing}
                                            filterText={providerFilter}
                                            onSelect={handleProviderSelect}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-full overflow-y-auto">
                                        <div className="mx-auto flex min-h-full w-full max-w-[620px] items-start justify-center">
                                            <div className="w-full">
                                                <ConnectionForm
                                                    formData={form.formData}
                                                    connString={form.connString}
                                                    testing={form.testing}
                                                    saving={form.saving}
                                                    testResult={form.testResult}
                                                    errorMsg={form.errorMsg}
                                                    successMsg={form.successMsg}
                                                    isEditing={form.isEditing}
                                                    showUriField={true}
                                                    onChange={form.handleChange}
                                                    onConnStringChange={form.handleParseConnectionString}
                                                    onTest={form.handleTest}
                                                    onSave={form.handleSave}
                                                    onCancel={() => {
                                                        setEditingProfile(null);
                                                        setMode('choose');
                                                        setIsSelectingProvider(false);
                                                        setProviderFilter('');
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </PanelFrame>
        </OverlayDialog>
    );
};
