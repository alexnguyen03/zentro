import React from 'react';
import { BadgeCheck, Plug } from 'lucide-react';
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

interface EnvironmentDraftSelection {
    profileName: string | null;
    databaseName: string;
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
    const [draftSelections, setDraftSelections] = React.useState<Record<EnvironmentKey, EnvironmentDraftSelection>>({
        loc: { profileName: null, databaseName: '' },
        tes: { profileName: null, databaseName: '' },
        dev: { profileName: null, databaseName: '' },
        sta: { profileName: null, databaseName: '' },
        pro: { profileName: null, databaseName: '' },
    });
    const [availableDatabases, setAvailableDatabases] = React.useState<string[]>([]);
    const [isLoadingDatabases, setIsLoadingDatabases] = React.useState(false);

    React.useEffect(() => {
        setSelectedEnvironmentKey((activeEnvironmentKey || activeProject?.last_active_environment_key || activeProject?.default_environment_key || 'loc') as EnvironmentKey);
    }, [activeEnvironmentKey, activeProject?.default_environment_key, activeProject?.last_active_environment_key]);

    React.useEffect(() => {
        if (!activeProject) return;

        const nextSelections: Record<EnvironmentKey, EnvironmentDraftSelection> = {
            loc: { profileName: null, databaseName: '' },
            tes: { profileName: null, databaseName: '' },
            dev: { profileName: null, databaseName: '' },
            sta: { profileName: null, databaseName: '' },
            pro: { profileName: null, databaseName: '' },
        };

        ENVIRONMENT_KEYS.forEach((environmentKey) => {
            const projectConnection = activeProject.connections?.find((connection) => connection.environment_key === environmentKey);
            nextSelections[environmentKey] = {
                profileName: projectConnection?.advanced_meta?.profile_name || projectConnection?.name || null,
                databaseName: projectConnection?.database || '',
            };
        });

        setDraftSelections(nextSelections);
    }, [activeProject]);

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
    const persistedProfileName = selectedProjectConnection?.advanced_meta?.profile_name || selectedProjectConnection?.name || null;
    const persistedDatabaseName = selectedProjectConnection?.database || '';
    const persistedConnectionProfile = connections.find((profile) => profile.name === persistedProfileName) || null;
    const selectedDraft = draftSelections[selectedEnvironmentKey];
    const draftProfileName = selectedDraft?.profileName ?? persistedProfileName;
    const selectedConnectionProfile = connections.find((profile) => profile.name === draftProfileName) || null;
    const selectedDatabaseName = selectedDraft?.databaseName || persistedDatabaseName || selectedConnectionProfile?.db_name || '';

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

    const updateDraftSelection = React.useCallback(
        (environmentKey: EnvironmentKey, updater: (current: EnvironmentDraftSelection) => EnvironmentDraftSelection) => {
            setDraftSelections((current) => ({
                ...current,
                [environmentKey]: updater(current[environmentKey] || { profileName: null, databaseName: '' }),
            }));
        },
        []
    );

    const handleSelectProfile = (profile: ConnectionProfile) => {
        updateDraftSelection(selectedEnvironmentKey, (current) => ({
            ...current,
            profileName: profile.name,
            databaseName: current.profileName === profile.name ? current.databaseName || profile.db_name : profile.db_name,
        }));
    };

    const handleSelectDatabase = (databaseName: string) => {
        if (!selectedConnectionProfile) return;

        updateDraftSelection(selectedEnvironmentKey, (current) => ({
            ...current,
            profileName: current.profileName || selectedConnectionProfile.name,
            databaseName,
        }));
    };

    const handleApply = async () => {
        const currentProject = useProjectStore.getState().activeProject;
        if (!currentProject) {
            toast.error('No active project is available for environment setup.');
            return;
        }

        setIsSaving(true);
        try {
            const profileToBind = selectedConnectionProfile;
            const databaseToUse = selectedDatabaseName || profileToBind?.db_name || '';

            if (profileToBind) {
                const bound = await bindEnvironmentConnection(selectedEnvironmentKey, {
                    ...profileToBind,
                    db_name: databaseToUse,
                });
                if (!bound) {
                    toast.error('Could not bind connection to environment.');
                    return;
                }
            }

            const switched = await setProjectEnvironment(selectedEnvironmentKey);
            if (!switched) {
                toast.error('Could not switch environment.');
                return;
            }

            useProjectStore.getState().setActiveProject(switched);
            setActiveEnvironment(selectedEnvironmentKey);

            if (profileToBind) {
                await Connect(profileToBind.name);
                if (databaseToUse) {
                    await SwitchDatabase(databaseToUse);
                }
            }

            toast.success(`Applied ${getEnvironmentMeta(selectedEnvironmentKey).label}.`);
            onClose();
        } catch (error) {
            toast.error(`Could not apply environment changes: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };

    const isCurrentEnvironment = (activeEnvironmentKey || activeProject?.last_active_environment_key || activeProject?.default_environment_key) === selectedEnvironmentKey;
    const hasDraftProfileChange = draftProfileName !== persistedProfileName;
    const normalizedPersistedDatabaseName = persistedDatabaseName || persistedConnectionProfile?.db_name || '';
    const hasDraftDatabaseChange = selectedDatabaseName !== normalizedPersistedDatabaseName;
    const hasPendingChanges = !isCurrentEnvironment || hasDraftProfileChange || hasDraftDatabaseChange;

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
                            Pick an environment. Changes stay in this modal until you apply them.
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
                                        ? `Draft connection: ${selectedConnectionProfile.name}.`
                                        : 'No connection selected yet.'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="primary"
                                    onClick={() => void handleApply()}
                                    disabled={isSaving || !hasPendingChanges}
                                    className="rounded-2xl"
                                >
                                    {isSaving ? 'Applying...' : hasPendingChanges ? 'Apply' : 'Current'}
                                </Button>
                                <Button variant="ghost" onClick={onClose} className="rounded-2xl">
                                    Close
                                </Button>
                            </div>
                        </div>

                        <div className="mt-5 rounded-3xl border border-border/30 bg-bg-primary/25 px-5 py-4">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
                                <Plug size={12} />
                                Selected Connection
                            </div>
                            {selectedConnectionProfile ? (
                                <div className="mt-3 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-[14px] font-semibold text-text-primary">{selectedConnectionProfile.name}</div>
                                            <div className="mt-1 text-[11px] text-text-secondary">
                                                {selectedConnectionProfile.driver} / {selectedConnectionProfile.host}:{selectedConnectionProfile.port} / {selectedDatabaseName || selectedConnectionProfile.db_name}
                                            </div>
                                        </div>
                                        {(hasDraftProfileChange || hasDraftDatabaseChange) && (
                                            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                                                Pending
                                            </span>
                                        )}
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
                                                    const isCurrentDb = selectedDatabaseName === databaseName;
                                                    return (
                                                        <button
                                                            key={databaseName}
                                                            type="button"
                                                            onClick={() => handleSelectDatabase(databaseName)}
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
                                                                    Selected
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
                                    Choose one saved connection below. It will not affect the app until you apply.
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
                                        const isBound = profile.name === draftProfileName;
                                        const isCurrentProfile = profile.name === activeProfile?.name;

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
                                                                Selected
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-[11px] text-text-secondary">
                                                        {profile.driver} / {profile.host}:{profile.port} / {profile.db_name}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant={isBound ? 'ghost' : 'primary'}
                                                    onClick={() => handleSelectProfile(profile)}
                                                    className="shrink-0 rounded-2xl"
                                                >
                                                    {isBound ? 'Selected' : 'Choose'}
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
