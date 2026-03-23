import React from 'react';
import { BadgeCheck, Plug, RefreshCw } from 'lucide-react';
import { ModalBackdrop, Button, Spinner } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { cn } from '../../lib/cn';
import type { ConnectionProfile } from '../../types/connection';
import type { EnvironmentKey } from '../../types/project';
import { useToast } from './Toast';
import { Connect, LoadConnections, LoadDatabasesForProfile, SwitchDatabase } from '../../../wailsjs/go/app/App';

interface EnvironmentSwitcherModalProps {
    onClose: () => void;
}

export const EnvironmentSwitcherModal: React.FC<EnvironmentSwitcherModalProps> = ({ onClose }) => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const setProjectEnvironment = useProjectStore((state) => state.setProjectEnvironment);
    const bindEnvironmentConnection = useProjectStore((state) => state.bindEnvironmentConnection);
    const environments = useEnvironmentStore((state) => state.environments);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const setActiveEnvironment = useEnvironmentStore((state) => state.setActiveEnvironment);
    const { connections, setConnections, activeProfile, databases } = useConnectionStore();
    const { toast } = useToast();

    const [selectedEnvironmentKey, setSelectedEnvironmentKey] = React.useState<EnvironmentKey>(
        (activeEnvironmentKey || activeProject?.last_active_environment_key || activeProject?.default_environment_key || 'loc') as EnvironmentKey
    );
    const [isSaving, setIsSaving] = React.useState(false);
    const [isLoadingConnections, setIsLoadingConnections] = React.useState(false);
    const [bindingProfileName, setBindingProfileName] = React.useState<string | null>(null);
    const [availableDatabases, setAvailableDatabases] = React.useState<string[]>([]);
    const [isLoadingDatabases, setIsLoadingDatabases] = React.useState(false);
    const [selectedDatabaseName, setSelectedDatabaseName] = React.useState('');
    const [isUpdatingDatabase, setIsUpdatingDatabase] = React.useState(false);

    React.useEffect(() => {
        setSelectedEnvironmentKey((activeEnvironmentKey || activeProject?.last_active_environment_key || activeProject?.default_environment_key || 'loc') as EnvironmentKey);
    }, [activeEnvironmentKey, activeProject?.default_environment_key, activeProject?.last_active_environment_key]);

    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoadingConnections(true);
            try {
                const loaded = await LoadConnections();
                if (!cancelled) {
                    setConnections(loaded || []);
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error(`Failed to load connections: ${error}`);
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingConnections(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [setConnections, toast]);

    const enabledEnvironmentMap = React.useMemo(
        () => new Map((environments || []).map((environment) => [environment.key, environment])),
        [environments]
    );

    const selectedProjectConnection = activeProject?.connections?.find(
        (connection) => connection.environment_key === selectedEnvironmentKey
    );
    const boundProfileName = selectedProjectConnection?.advanced_meta?.profile_name || selectedProjectConnection?.name || null;
    const selectedConnectionProfile = connections.find((profile) => profile.name === boundProfileName) || null;
    const boundDatabaseName = selectedProjectConnection?.database || selectedConnectionProfile?.db_name || '';

    React.useEffect(() => {
        setSelectedDatabaseName(boundDatabaseName);
    }, [boundDatabaseName, selectedEnvironmentKey]);

    React.useEffect(() => {
        let cancelled = false;

        if (!selectedConnectionProfile?.name) {
            setAvailableDatabases([]);
            setIsLoadingDatabases(false);
            return;
        }

        if (activeProfile?.name === selectedConnectionProfile.name && databases.length > 0) {
            setAvailableDatabases(databases);
            return;
        }

        setIsLoadingDatabases(true);
        LoadDatabasesForProfile(selectedConnectionProfile.name)
            .then((dbs) => {
                if (!cancelled) {
                    setAvailableDatabases(dbs || []);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setAvailableDatabases([]);
                    toast.error(`Failed to load databases: ${error}`);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingDatabases(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedConnectionProfile?.name, activeProfile?.name, databases, toast]);

    const handleSwitchEnvironment = async (environmentKey: EnvironmentKey) => {
        if (!activeProject) {
            toast.error('No active project is available for environment switching.');
            return;
        }

        setIsSaving(true);
        const saved = await setProjectEnvironment(environmentKey);
        if (!saved) {
            setIsSaving(false);
            toast.error('Could not switch environment.');
            return;
        }

        setActiveEnvironment(environmentKey);

        const connectionToUse = saved.connections?.find((connection) => connection.environment_key === environmentKey);
        const profileName = connectionToUse?.advanced_meta?.profile_name || connectionToUse?.name;

        if (profileName) {
            try {
                await Connect(profileName);
                if (connectionToUse?.database) {
                    await SwitchDatabase(connectionToUse.database);
                }
            } catch (error) {
                toast.error(`Environment switched, but reconnect failed: ${error}`);
                setIsSaving(false);
                onClose();
                return;
            }
        }

        setIsSaving(false);
        toast.success(`Switched to ${getEnvironmentMeta(environmentKey).label}.`);
        onClose();
    };

    const handleBindProfile = async (profile: ConnectionProfile, databaseName?: string) => {
        if (!activeProject) {
            toast.error('No active project is available for environment setup.');
            return;
        }

        setBindingProfileName(profile.name);
        const profileWithDatabase = databaseName ? { ...profile, db_name: databaseName } : profile;
        const bound = await bindEnvironmentConnection(selectedEnvironmentKey, profileWithDatabase);
        if (!bound) {
            setBindingProfileName(null);
            toast.error('Could not bind connection to environment.');
            return;
        }

        const switched = await setProjectEnvironment(selectedEnvironmentKey);
        if (!switched) {
            setBindingProfileName(null);
            toast.error('Connection was bound, but environment switching failed.');
            return;
        }

        setActiveEnvironment(selectedEnvironmentKey);

        try {
            await Connect(profile.name);
            if (databaseName || profile.db_name) {
                await SwitchDatabase(databaseName || profile.db_name);
            }
        } catch (error) {
            setBindingProfileName(null);
            toast.error(`Environment configured, but connect failed: ${error}`);
            onClose();
            return;
        }

        setBindingProfileName(null);
        toast.success(`Bound ${profile.name} to ${getEnvironmentMeta(selectedEnvironmentKey).label}.`);
        onClose();
    };

    const handleChangeDatabase = async (databaseName: string) => {
        if (!selectedConnectionProfile) return;

        setIsUpdatingDatabase(true);
        const bound = await bindEnvironmentConnection(selectedEnvironmentKey, {
            ...selectedConnectionProfile,
            db_name: databaseName,
        });
        if (!bound) {
            setIsUpdatingDatabase(false);
            toast.error('Could not update the bound database.');
            return;
        }

        setSelectedDatabaseName(databaseName);

        const isCurrentEnvironment = (activeEnvironmentKey || activeProject?.default_environment_key) === selectedEnvironmentKey;
        if (isCurrentEnvironment) {
            try {
                if (activeProfile?.name !== selectedConnectionProfile.name) {
                    await Connect(selectedConnectionProfile.name);
                }
                await SwitchDatabase(databaseName);
            } catch (error) {
                setIsUpdatingDatabase(false);
                toast.error(`Database updated, but live switch failed: ${error}`);
                return;
            }
        }

        setIsUpdatingDatabase(false);
        toast.success(`Database updated to ${databaseName}.`);
    };

    if (!activeProject) return null;

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="h-[620px] w-[920px] max-w-[calc(100vw-40px)] overflow-hidden rounded-3xl border border-border/40 bg-bg-secondary text-text-primary"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="grid h-full md:grid-cols-[320px_1fr]">
                    <section className="flex min-h-0 flex-col border-r border-border/20 bg-bg-primary/35 px-6 py-6">
                        <div className="text-[11px] font-semibold text-text-secondary">Project</div>
                        <div className="mt-2 text-[22px] font-bold tracking-tight text-text-primary">{activeProject.name}</div>
                        <p className="mt-2 text-[12px] leading-5 text-text-secondary">
                            Pick an environment. If a connection is already bound, switching will reconnect automatically.
                        </p>

                        <div className="mt-5 rounded-3xl border border-border/30 bg-bg-secondary px-4 py-4">
                            <div className="text-[11px] font-semibold text-text-secondary">Current</div>
                            <div className="mt-2 flex items-center gap-2">
                                <span
                                    className={cn(
                                        'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                        getEnvironmentMeta(activeEnvironmentKey || activeProject.last_active_environment_key || activeProject.default_environment_key).colorClass
                                    )}
                                >
                                    {activeEnvironmentKey || activeProject.last_active_environment_key || activeProject.default_environment_key}
                                </span>
                                {activeProfile && (
                                    <span className="truncate text-[12px] text-text-secondary">{activeProfile.name}</span>
                                )}
                            </div>
                        </div>

                        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
                            <div className="space-y-2">
                                {ENVIRONMENT_KEYS.map((environmentKey) => {
                                    const meta = getEnvironmentMeta(environmentKey);
                                    const isSelected = selectedEnvironmentKey === environmentKey;
                                    const isCurrent = (activeEnvironmentKey || activeProject.last_active_environment_key || activeProject.default_environment_key) === environmentKey;
                                    const isEnabled = enabledEnvironmentMap.has(environmentKey);
                                    const hasBinding = Boolean(
                                        activeProject.connections?.find((connection) => connection.environment_key === environmentKey)
                                    );

                                    return (
                                        <button
                                            key={environmentKey}
                                            type="button"
                                            onClick={() => setSelectedEnvironmentKey(environmentKey)}
                                            className={cn(
                                                'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                                                isSelected
                                                    ? 'border-accent/40 bg-bg-secondary'
                                                    : 'border-border/25 bg-bg-primary/20 hover:border-border/50 hover:bg-bg-primary/40'
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                                                meta.colorClass
                                                            )}
                                                        >
                                                            {environmentKey}
                                                        </span>
                                                        <span className="text-[14px] font-semibold text-text-primary">{meta.label}</span>
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-2 text-[11px] text-text-secondary">
                                                        {isCurrent && <span>Current</span>}
                                                        {isEnabled && <span>Ready</span>}
                                                        {hasBinding && <span>Bound</span>}
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

                    <section className="flex min-h-0 flex-col px-6 py-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                            getEnvironmentMeta(selectedEnvironmentKey).colorClass
                                        )}
                                    >
                                        {selectedEnvironmentKey}
                                    </span>
                                    <h3 className="m-0 text-[20px] font-bold tracking-tight text-text-primary">
                                        {getEnvironmentMeta(selectedEnvironmentKey).label}
                                    </h3>
                                </div>
                                <p className="m-0 mt-2 text-[12px] leading-5 text-text-secondary">
                                    {selectedConnectionProfile
                                        ? `Bound to ${selectedConnectionProfile.name}.`
                                        : 'No connection bound yet.'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="primary"
                                    onClick={() => void handleSwitchEnvironment(selectedEnvironmentKey)}
                                    disabled={isSaving}
                                    className="rounded-2xl"
                                >
                                    {isSaving ? 'Switching...' : 'Switch'}
                                </Button>
                                <Button variant="ghost" onClick={onClose} className="rounded-2xl">
                                    Close
                                </Button>
                            </div>
                        </div>

                        <div className="mt-5 rounded-3xl border border-border/30 bg-bg-primary/25 px-5 py-4">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
                                <Plug size={12} />
                                Bound Connection
                            </div>
                            {selectedConnectionProfile ? (
                                <div className="mt-3 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-[14px] font-semibold text-text-primary">{selectedConnectionProfile.name}</div>
                                            <div className="mt-1 text-[11px] text-text-secondary">
                                                {selectedConnectionProfile.driver} / {selectedConnectionProfile.host}:{selectedConnectionProfile.port} / {boundDatabaseName || selectedConnectionProfile.db_name}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            className="gap-2 rounded-2xl"
                                            onClick={() => selectedConnectionProfile && handleBindProfile(selectedConnectionProfile, selectedDatabaseName || boundDatabaseName || selectedConnectionProfile.db_name)}
                                            disabled={bindingProfileName === selectedConnectionProfile.name}
                                        >
                                            {bindingProfileName === selectedConnectionProfile.name ? <Spinner size={12} /> : <RefreshCw size={13} />}
                                            Rebind
                                        </Button>
                                    </div>

                                    <div>
                                        <div className="text-[11px] font-semibold text-text-secondary">Database</div>
                                        {isLoadingDatabases ? (
                                            <div className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
                                                <Spinner size={12} />
                                                Loading databases...
                                            </div>
                                        ) : availableDatabases.length === 0 ? (
                                            <div className="mt-2 text-[12px] text-text-secondary">
                                                No databases available for this server.
                                            </div>
                                        ) : (
                                            <div className="mt-2 max-h-[140px] space-y-2 overflow-y-auto">
                                                {availableDatabases.map((databaseName) => {
                                                    const isCurrentDb = (selectedDatabaseName || boundDatabaseName) === databaseName;
                                                    return (
                                                        <button
                                                            key={databaseName}
                                                            type="button"
                                                            onClick={() => void handleChangeDatabase(databaseName)}
                                                            disabled={isUpdatingDatabase}
                                                            className={cn(
                                                                'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition-colors',
                                                                isCurrentDb
                                                                    ? 'border-accent/35 bg-accent/8'
                                                                    : 'border-border/25 bg-bg-secondary hover:border-border/50 hover:bg-bg-primary/30'
                                                            )}
                                                        >
                                                            <span className="truncate text-[12px] font-medium text-text-primary">{databaseName}</span>
                                                            {isCurrentDb && (
                                                                <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-3 text-[12px] text-text-secondary">
                                    Choose one saved connection below to make this environment ready.
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-text-secondary">Saved Connections</div>
                            {isLoadingConnections && (
                                <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                                    <Spinner size={12} />
                                    Loading...
                                </div>
                            )}
                        </div>

                        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                            {connections.length === 0 && !isLoadingConnections ? (
                                <div className="flex h-full min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-border/50 bg-bg-primary/20 px-6 text-center text-[12px] text-text-secondary">
                                    No saved connections yet. Create one first, then return here to bind it.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {connections.map((profile) => {
                                        const isBound = profile.name === boundProfileName;
                                        const isCurrentProfile = profile.name === activeProfile?.name;
                                        const isBinding = bindingProfileName === profile.name;

                                        return (
                                            <div
                                                key={profile.name}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-2xl border px-4 py-3',
                                                    isBound ? 'border-accent/35 bg-accent/8' : 'border-border/25 bg-bg-primary/20'
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-[13px] font-semibold text-text-primary">{profile.name}</span>
                                                        {isCurrentProfile && (
                                                            <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                                                                Live
                                                            </span>
                                                        )}
                                                        {isBound && (
                                                            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                                                Bound
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-[11px] text-text-secondary">
                                                        {profile.driver} / {profile.host}:{profile.port} / {profile.db_name}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant={isBound ? 'ghost' : 'primary'}
                                                    onClick={() => void handleBindProfile(profile, profile.db_name)}
                                                    disabled={isBinding}
                                                    className="shrink-0 rounded-2xl"
                                                >
                                                    {isBinding ? 'Binding...' : isBound ? 'Use' : 'Bind'}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </ModalBackdrop>
    );
};
