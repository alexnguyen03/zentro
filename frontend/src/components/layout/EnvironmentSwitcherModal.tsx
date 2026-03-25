import React from 'react';
import { ArrowRight, Check, CircleAlert, List, Plus, X } from 'lucide-react';
import { ModalBackdrop, Button, Tooltip } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { cn } from '../../lib/cn';
import type { ConnectionProfile } from '../../types/connection';
import type { EnvironmentKey } from '../../types/project';
import { useToast } from './Toast';
import { LoadConnections } from '../../../wailsjs/go/app/App';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ConnectionEditorPanel } from '../connection/ConnectionEditorPanel';
import { DatabaseTreePicker } from '../ui/DatabaseTreePicker';

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
    const [selectedDatabase, setSelectedDatabase] = React.useState('');
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
            } catch (error) {
                toast.error(`Failed to reload connections: ${error}`);
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

    const handleSelectFromTree = React.useCallback((profile: ConnectionProfile, database: string) => {
        setSelectedProfileName(profile.name || null);
        setSelectedDatabase(database);
    }, []);

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
                className="flex h-[588px] w-[900px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg bg-bg-secondary text-text-primary"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2 border-b border-border/20 px-3.5 py-2.5">
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-text-secondary">Project</div>
                        <h3 className="m-0 mt-0.5 truncate text-[28px] font-bold tracking-tight text-text-primary">{activeProject.name}</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-xl text-text-secondary hover:bg-bg-primary/30 hover:text-text-primary"
                    >
                        <X size={16} />
                    </Button>
                </div>

                <div className="grid min-h-0 flex-1 md:grid-cols-[228px_1fr]">
                    <section className="flex min-h-0 flex-col border-r border-border/20 bg-bg-primary/30 px-3 py-3">
                        <div className="my-auto">
                            <div className="max-h-[620px] pr-1">
                                <div className="space-y-3">
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
                                                    'w-full cursor-pointer rounded-lg border px-3 py-3 text-left transition-colors',
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
                        <div className="min-h-0 px-3 py-2.5">
                            {mode === 'choose' ? (
                                <div className="h-full min-h-0 rounded-lg bg-bg-primary/20">
                                    <div className="border-b border-border/15 px-2.5 py-2 text-[12px] font-semibold text-text-primary">
                                        Saved connections
                                    </div>
                                    <div className="h-[calc(100%-34px)] min-h-0 px-2.5 py-2">
                                        <DatabaseTreePicker
                                            onSelect={handleSelectFromTree}
                                            selectedProfile={selectedProfileName}
                                            selectedDatabase={selectedDatabase}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <ConnectionEditorPanel
                                    form={form}
                                    onCancel={() => setMode('choose')}
                                />
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-border/20 px-3 py-2.5">
                            <div className="flex items-center gap-1 rounded-lg bg-bg-primary/25 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setMode('choose')}
                                    className={cn(
                                        'cursor-pointer rounded-md p-1 transition-colors',
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
                                        'cursor-pointer rounded-md p-1 transition-colors',
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
