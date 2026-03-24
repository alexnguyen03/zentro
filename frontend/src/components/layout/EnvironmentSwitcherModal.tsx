import React from 'react';
import { ArrowRight, Check, ChevronDown, ChevronRight, CircleAlert, List, Plus, X } from 'lucide-react';
import { ModalBackdrop, Button, Spinner, Tooltip } from '../ui';
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
                setMode('choose');
            } catch (error) {
                toast.error(`Failed to reload connections: ${error}`);
            } finally {
                setLoadingConnections(false);
            }
        },
        onClose: () => setMode('choose'),
    });

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

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

    const applyDisabled = saving || mode === 'add';

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="flex h-[612px] w-[920px] max-w-[calc(100vw-28px)] flex-col overflow-hidden rounded-lg bg-bg-secondary text-text-primary"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-text-secondary">Project</div>
                        <h3 className="m-0 mt-0.5 truncate text-[30px] font-bold tracking-tight text-text-primary">{activeProject.name}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-primary/30 hover:text-text-primary"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 md:grid-cols-[246px_1fr]">
                    <section className="flex min-h-0 flex-col border-r border-border/20 bg-bg-primary/30 px-4 py-4">
                        <div className="my-auto">
                            <div className="max-h-[620px] pr-1">
                                <div className="space-y-5">
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
                                                    'w-full cursor-pointer rounded-lg border p-4 text-left transition-colors',
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
                                                    {hasBinding ? (
                                                        <Tooltip content="Bound">
                                                            <span className="inline-flex items-center text-accent">
                                                                <Check size={14} />
                                                            </span>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip content="Need binding">
                                                            <span className="inline-flex items-center text-text-secondary">
                                                                <CircleAlert size={14} />
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                         </div>
                    </section>

                    <section className="grid min-h-0 grid-rows-[1fr_auto]">
                        <div className="min-h-0 px-4 py-3">
                            {mode === 'choose' ? (
                                <div className="h-full min-h-0 rounded-lg bg-bg-primary/20">
                                    <div className="border-b border-border/15 px-3 py-2.5 text-[12px] font-semibold text-text-primary">
                                        Saved connections
                                    </div>

                                    <div className="min-h-0 h-[calc(100%-38px)] overflow-y-auto px-3 py-2.5">
                                        {loadingConnections ? (
                                            <div className="flex h-24 items-center justify-center gap-2 text-[12px] text-text-secondary">
                                                <Spinner size={14} /> Loading connections...
                                            </div>
                                        ) : connections.length === 0 ? (
                                            <div className="flex h-28 items-center justify-center rounded-lg bg-bg-primary/20 px-4 text-center text-[12px] text-text-secondary">
                                                No saved connection
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {connections.map((profile) => {
                                                    const selected = profile.name === selectedProfileName;
                                                    const expanded = selected;

                                                    return (
                                                        <div
                                                            key={profile.name}
                                                            className={cn(
                                                                'rounded-lg border transition-colors',
                                                                selected
                                                                    ? 'border-accent/45 bg-accent/8'
                                                                    : 'border-border/25 bg-bg-primary/20 hover:bg-bg-primary/35',
                                                            )}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedProfileName(profile.name || null)}
                                                                className="flex w-full cursor-pointer items-start justify-between gap-3 px-3 py-2.5 text-left"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {expanded ? <ChevronDown size={13} className="shrink-0 text-text-secondary" /> : <ChevronRight size={13} className="shrink-0 text-text-secondary" />}
                                                                        <span className="truncate text-[13px] font-semibold text-text-primary">{profile.name}</span>
                                                                    </div>
                                                                    <div className="mt-0.5 pl-[20px] text-[11px] text-text-secondary">
                                                                        {profile.driver}
                                                                        {profile.host ? ` / ${profile.host}:${profile.port}` : ''}
                                                                    </div>
                                                                </div>
                                                            </button>

                                                            {expanded && (
                                                                <div className="border-t border-border/20 px-3 py-2.5">
                                                                    <div className="pl-[20px]">
                                                                        {loadingDatabases ? (
                                                                            <div className="flex h-[58px] items-center gap-2 text-[12px] text-text-secondary">
                                                                                <Spinner size={12} /> Loading databases...
                                                                            </div>
                                                                        ) : databases.length > 0 ? (
                                                                            <div className="space-y-1">
                                                                                {databases.map((databaseName) => {
                                                                                    const active = selectedDatabase === databaseName;
                                                                                    return (
                                                                                        <button
                                                                                            key={databaseName}
                                                                                            type="button"
                                                                                            onClick={() => setSelectedDatabase(databaseName)}
                                                                                            className={cn(
                                                                                                'flex w-full cursor-pointer items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors',
                                                                                                active
                                                                                                    ? 'border-accent/45 bg-accent/10'
                                                                                                    : 'border-border/25 bg-bg-primary/25 hover:bg-bg-primary/45',
                                                                                            )}
                                                                                        >
                                                                                            <span className="truncate text-[12px] font-medium text-text-primary">{databaseName}</span>
                                                                                            {active && (
                                                                                                <Check size={12} className="text-accent" />
                                                                                            )}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="rounded-md bg-bg-primary/20 px-3 py-2.5 text-[12px] text-text-secondary">
                                                                                {profile.db_name ? `Fallback: ${profile.db_name}` : 'No database loaded'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_200px] overflow-hidden rounded-lg bg-bg-primary/20">
                                    <div className="min-h-0 overflow-y-auto px-4 py-3">
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
                                                    onCancel={() => setMode('choose')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-l border-border/20 bg-bg-primary/20 px-3 py-3">
                                        <div className="pb-2 text-[11px] font-semibold text-text-secondary">Provider</div>
                                        <ProviderGrid
                                            selected={form.selectedProvider}
                                            locked={form.isEditing}
                                            onSelect={form.handleDriverChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-border/20 px-4 py-3">
                            <div className="flex items-center gap-1 rounded-lg bg-bg-primary/25 p-1">
                                <button
                                    type="button"
                                    onClick={() => setMode('choose')}
                                    className={cn(
                                        'cursor-pointer rounded-md p-1.5 transition-colors',
                                        mode === 'choose' ? 'bg-bg-secondary text-text-primary' : 'text-text-secondary hover:text-text-primary',
                                    )}
                                    title="Choose connection, DB"
                                >
                                    <List size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        form.resetForm();
                                        setMode('add');
                                    }}
                                    className={cn(
                                        'cursor-pointer rounded-md p-1.5 transition-colors',
                                        mode === 'add' ? 'bg-bg-secondary text-text-primary' : 'text-text-secondary hover:text-text-primary',
                                    )}
                                    title="Add new connection"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                            <Button
                                variant="primary"
                                onClick={() => void handleApply()}
                                disabled={applyDisabled}
                                className="rounded-lg"
                            >
                                {saving ? (
                                    'Applying...'
                                ) : (
                                    <>
                                        Apply <ArrowRight size={14} />
                                    </>
                                )}
                            </Button>
                        </div>
                    </section>
                </div>
            </div>
        </ModalBackdrop>
    );
};



