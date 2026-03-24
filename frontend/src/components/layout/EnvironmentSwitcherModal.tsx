import React from 'react';
import { ArrowRight, BadgeCheck, Plug, Plus } from 'lucide-react';
import { ModalBackdrop, Button, Spinner } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { cn } from '../../lib/cn';
import type { ConnectionProfile } from '../../types/connection';
import type { EnvironmentKey } from '../../types/project';
import { useToast } from './Toast';
import { LoadConnections, LoadDatabasesForProfile } from '../../../wailsjs/go/app/App';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';

interface EnvironmentSwitcherModalProps {
    onClose: () => void;
}

type Mode = 'switch' | 'new-connection';

export const EnvironmentSwitcherModal: React.FC<EnvironmentSwitcherModalProps> = ({ onClose }) => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const setProjectEnvironment = useProjectStore((state) => state.setProjectEnvironment);
    const bindEnvironmentConnection = useProjectStore((state) => state.bindEnvironmentConnection);
    const setActiveProject = useProjectStore((state) => state.setActiveProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const setActiveEnvironment = useEnvironmentStore((state) => state.setActiveEnvironment);
    const setConnections = useConnectionStore((state) => state.setConnections);
    const { activeProfile } = useConnectionStore();
    const { toast } = useToast();

    const [mode, setMode] = React.useState<Mode>('switch');
    const [selectedEnvironmentKey, setSelectedEnvironmentKey] = React.useState<EnvironmentKey>('loc');
    const [connections, setLocalConnections] = React.useState<ConnectionProfile[]>([]);
    const [selectedProfileName, setSelectedProfileName] = React.useState<string | null>(null);
    const [databases, setDatabases] = React.useState<string[]>([]);
    const [selectedDatabase, setSelectedDatabase] = React.useState('');
    const [loadingConnections, setLoadingConnections] = React.useState(false);
    const [loadingDatabases, setLoadingDatabases] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!activeProject) return;
        setSelectedEnvironmentKey((activeEnvironmentKey || activeProject.last_active_environment_key || activeProject.default_environment_key || 'loc') as EnvironmentKey);
    }, [activeEnvironmentKey, activeProject?.default_environment_key, activeProject?.last_active_environment_key]);

    const selectedProjectConnection = activeProject?.connections?.find(
        (connection) => connection.environment_key === selectedEnvironmentKey,
    );
    const persistedProfileName = selectedProjectConnection?.advanced_meta?.profile_name || selectedProjectConnection?.name || null;
    const persistedDatabaseName = selectedProjectConnection?.database || '';

    React.useEffect(() => {
        let cancelled = false;
        setLoadingConnections(true);
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
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingConnections(false);
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

    React.useEffect(() => {
        if (!selectedProfile?.name) {
            setDatabases([]);
            setSelectedDatabase('');
            return;
        }

        let cancelled = false;
        setLoadingDatabases(true);
        setDatabases([]);
        setSelectedDatabase('');
        LoadDatabasesForProfile(selectedProfile.name)
            .then((loaded) => {
                if (cancelled) return;
                const next = loaded || [];
                setDatabases(next);
                const preferredDatabase = persistedDatabaseName || selectedProfile.db_name || '';
                if (preferredDatabase && next.includes(preferredDatabase)) {
                    setSelectedDatabase(preferredDatabase);
                    return;
                }
                if (preferredDatabase && next.length === 0) {
                    setSelectedDatabase(preferredDatabase);
                    return;
                }
                setSelectedDatabase(next[0] || preferredDatabase);
            })
            .catch((error) => {
                if (!cancelled) {
                    setDatabases([]);
                    setSelectedDatabase(persistedDatabaseName || selectedProfile.db_name || '');
                    toast.error(`Failed to load databases: ${error}`);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingDatabases(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedProfile?.db_name, selectedProfile?.name, persistedDatabaseName]);

    const existingNames = connections.map((c) => c.name!).filter(Boolean);
    const form = useConnectionForm({
        existingNames,
        onSaved: async () => {
            const savedName = form.formData.name || '';
            setLoadingConnections(true);
            try {
                const loaded = await LoadConnections();
                const next = loaded || [];
                setLocalConnections(next);
                setConnections(next);
                setSelectedProfileName(savedName || next[0]?.name || null);
                setMode('switch');
            } catch (error) {
                toast.error(`Failed to reload connections: ${error}`);
            } finally {
                setLoadingConnections(false);
            }
        },
        onClose: () => setMode('switch'),
    });

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

    if (!activeProject) return null;

    const currentEnvKey = (activeEnvironmentKey || activeProject.last_active_environment_key || activeProject.default_environment_key) as EnvironmentKey;
    const currentMeta = getEnvironmentMeta(currentEnvKey);
    const selectedMeta = getEnvironmentMeta(selectedEnvironmentKey);
    const currentBindingLabel = activeProfile ? `${activeProfile.name}${activeProfile.db_name ? ` / ${activeProfile.db_name}` : ''}` : 'No active connection';

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="h-[612px] w-[940px] max-w-[calc(100vw-36px)] overflow-hidden rounded-lg bg-bg-secondary text-text-primary"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="grid h-full md:grid-cols-[280px_1fr]">
                    <section className="flex min-h-0 flex-col border-r border-border/20 bg-bg-primary/35 px-5 py-5">
                        <div className="text-[11px] font-semibold text-text-secondary">Project</div>
                        <div className="mt-1.5 text-[35px] font-bold tracking-tight text-text-primary">{activeProject.name}</div>
                        <p className="mt-1.5 text-[12px] leading-5 text-text-secondary">
                            Switch environments quickly, or recover by rebinding a connection without leaving the current context.
                        </p>

                        <div className="mt-4 rounded-lg bg-bg-secondary px-3.5 py-3.5">
                            <div className="text-[11px] font-semibold text-text-secondary">Current</div>
                            <div className="mt-1.5 flex items-center gap-2">
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', currentMeta.colorClass)}>
                                    {currentEnvKey}
                                </span>
                                <span className="text-[12px] text-text-secondary">{currentBindingLabel}</span>
                            </div>
                        </div>

                        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                            <div className="space-y-1.5">
                                {ENVIRONMENT_KEYS.map((environmentKey) => {
                                    const meta = getEnvironmentMeta(environmentKey);
                                    const isSelected = selectedEnvironmentKey === environmentKey;
                                    const isCurrent = currentEnvKey === environmentKey;
                                    const hasBinding = Boolean(
                                        activeProject.connections?.find((connection) => connection.environment_key === environmentKey),
                                    );

                                    return (
                                        <button
                                            key={environmentKey}
                                            type="button"
                                            onClick={() => setSelectedEnvironmentKey(environmentKey)}
                                            className={cn(
                                                'w-full rounded-lg px-3.5 py-2.5 text-left transition-colors',
                                                isSelected
                                                    ? 'border-accent/40 bg-bg-secondary'
                                                    : 'border-border/25 bg-bg-primary/20 hover:bg-bg-primary/40',
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>
                                                            {environmentKey}
                                                        </span>
                                                        <span className="text-[13px] font-semibold text-text-primary">{meta.label}</span>
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-secondary">
                                                        {isCurrent && <span>Current</span>}
                                                        {hasBinding ? <span>Bound</span> : <span>Needs binding</span>}
                                                    </div>
                                                </div>
                                                {isCurrent && <BadgeCheck size={16} className="shrink-0 text-accent" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section className="grid min-h-0 grid-rows-[auto_1fr]">
                        <div className="flex items-start justify-between gap-4 border-b border-border/20 px-5 py-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', selectedMeta.colorClass)}>
                                        {selectedEnvironmentKey}
                                    </span>
                                    <h3 className="m-0 text-[32px] font-bold tracking-tight text-text-primary">
                                        {selectedMeta.label}
                                    </h3>
                                </div>
                                <p className="m-0 mt-1.5 text-[12px] leading-5 text-text-secondary">
                                    Keep the workspace, switch the environment, and only adjust the binding if this env is not ready.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="primary" onClick={() => void handleApply()} disabled={saving} className="rounded-lg">
                                    {saving ? 'Applying...' : <>Apply <ArrowRight size={14} /></>}
                                </Button>
                                <Button variant="ghost" onClick={onClose} className="rounded-lg">
                                    Close
                                </Button>
                            </div>
                        </div>

                        <div className="grid min-h-0 gap-4 px-5 py-4 lg:grid-cols-[0.92fr_1.08fr]">
                            <div className="flex min-h-0 flex-col rounded-lg bg-bg-primary/20">
                                <div className="flex items-center justify-between border-b border-border/15 px-4 py-3.5">
                                    <div>
                                        <div className="text-[12px] font-semibold text-text-primary">Saved connections</div>
                                        <div className="mt-0.5 text-[11px] text-text-secondary">
                                            Pick one for this environment or add a quick connection inline.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            form.resetForm();
                                            setMode('new-connection');
                                        }}
                                        className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-3 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                                    >
                                        <Plus size={12} />
                                        New
                                    </button>
                                </div>

                                {mode === 'switch' ? (
                                    <div className="min-h-0 overflow-y-auto px-4 py-4">
                                        {loadingConnections ? (
                                            <div className="flex h-28 items-center justify-center gap-2 text-[12px] text-text-secondary">
                                                <Spinner size={14} /> Loading connections...
                                            </div>
                                        ) : connections.length === 0 ? (
                                            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border/35 bg-bg-primary/20 px-5 text-center text-[12px] leading-5 text-text-secondary">
                                                No saved connections yet. Add one inline to recover this environment.
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {connections.map((profile) => {
                                                    const selected = profile.name === selectedProfileName;
                                                    return (
                                                        <button
                                                            key={profile.name}
                                                            type="button"
                                                            onClick={() => setSelectedProfileName(profile.name || null)}
                                                            className={cn(
                                                                'w-full rounded-lg px-3.5 py-3 text-left transition-colors',
                                                                selected
                                                                    ? 'border-accent/40 bg-accent/8'
                                                                    : 'border-border/25 bg-bg-primary/20 hover:bg-bg-primary/40',
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-[14px] font-semibold text-text-primary">{profile.name}</div>
                                                                    <div className="mt-1 text-[11px] text-text-secondary">
                                                                        {profile.driver}
                                                                        {profile.host ? ` / ${profile.host}:${profile.port}` : ''}
                                                                    </div>
                                                                </div>
                                                                {selected && (
                                                                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                                                        Selected
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid min-h-0 flex-1 grid-cols-[168px_1fr] overflow-hidden">
                                        <div className="border-r border-border/15">
                                            <div className="px-4 pt-3.5 pb-2 text-[11px] font-semibold text-text-secondary">Provider</div>
                                            <ProviderGrid
                                                selected={form.selectedProvider}
                                                locked={form.isEditing}
                                                onSelect={form.handleDriverChange}
                                            />
                                        </div>
                                        <div className="min-h-0 overflow-y-auto">
                                            <div className="px-5 pt-4 text-[12px] font-semibold text-text-primary">Quick connection</div>
                                            <div className="px-5 pb-4 text-[11px] text-text-secondary">
                                                Minimal setup only, so recovery stays smooth and local to this modal.
                                            </div>
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
                                                onCancel={() => setMode('switch')}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex min-h-0 flex-col rounded-lg bg-bg-primary/20 px-5 py-4">
                                <div className="flex items-center gap-2 text-[12px] font-semibold text-text-secondary">
                                    <Plug size={13} />
                                    Binding preview
                                </div>

                                <div className="mt-3 rounded-lg bg-bg-secondary px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', selectedMeta.colorClass)}>
                                            {selectedEnvironmentKey}
                                        </span>
                                        <span className="text-[15px] font-semibold text-text-primary">{selectedMeta.label}</span>
                                    </div>

                                    {selectedProfile ? (
                                        <div className="mt-3 space-y-3.5">
                                            <div>
                                                <div className="text-[11px] font-semibold text-text-secondary">Connection</div>
                                                <div className="mt-1 text-[14px] font-semibold text-text-primary">{selectedProfile.name}</div>
                                                <div className="mt-1 text-[11px] text-text-secondary">
                                                    {selectedProfile.driver}
                                                    {selectedProfile.host ? ` / ${selectedProfile.host}:${selectedProfile.port}` : ''}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-[11px] font-semibold text-text-secondary">Database</div>
                                                </div>
                                                {loadingDatabases ? (
                                                    <div className="mt-2 flex h-[86px] items-center justify-center rounded-lg border border-dashed border-border/35 bg-bg-primary/20 text-[12px] text-text-secondary">
                                                        <div className="flex items-center gap-2">
                                                            <Spinner size={12} /> Loading databases...
                                                        </div>
                                                    </div>
                                                ) : databases.length > 0 ? (
                                                    <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto">
                                                        {databases.map((databaseName) => {
                                                            const active = selectedDatabase === databaseName;
                                                            return (
                                                                <button
                                                                    key={databaseName}
                                                                    type="button"
                                                                    onClick={() => setSelectedDatabase(databaseName)}
                                                                    className={cn(
                                                                        'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors',
                                                                        active
                                                                            ? 'border-accent/35 bg-accent/8'
                                                                            : 'border-border/25 bg-bg-primary/25 hover:bg-bg-primary/45',
                                                                    )}
                                                                >
                                                                    <span className="truncate text-[12px] font-medium text-text-primary">{databaseName}</span>
                                                                    {active && (
                                                                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                                                            Selected
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 rounded-lg border border-dashed border-border/35 bg-bg-primary/20 px-4 py-4 text-[12px] text-text-secondary">
                                                        {selectedProfile.db_name
                                                            ? `Fallback database: ${selectedProfile.db_name}`
                                                            : 'No databases loaded for this profile yet.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 rounded-lg border border-dashed border-border/35 bg-bg-primary/20 px-4 py-4 text-[12px] leading-5 text-text-secondary">
                                            Choose a saved connection for this environment, or add a quick connection without leaving the switcher.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </ModalBackdrop>
    );
};



