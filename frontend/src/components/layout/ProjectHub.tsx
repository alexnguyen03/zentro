import React from 'react';
import {
    ArrowLeft, ArrowRight, BadgeCheck, ChevronDown, ChevronRight,
    FolderPlus, Layers3, Plus, Plug,
} from 'lucide-react';
import { Disconnect, LoadConnections, Connect, SwitchDatabase } from '../../../wailsjs/go/app/App';
import { Button, Input, ModalBackdrop, Spinner } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import { DRIVER } from '../../lib/constants';
import { onConnectionChanged, onSchemaDatabases } from '../../lib/events';
import type { EnvironmentKey } from '../../types/project';
import type { ConnectionProfile } from '../../types/connection';
import { useToast } from './Toast';

type Step = 'pick-project' | 'setup-envs';
type EnvViewMode = 'list' | 'new-connection';

interface ProjectHubProps {
    overlay?: boolean;
    onClose?: () => void;
}

function formatDateLabel(value?: string) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently updated';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Server group helpers ────────────────────────────────────────────────────

interface ServerGroup {
    key: string; // host:port or 'local'
    label: string;
    profiles: ConnectionProfile[];
    isLocal: boolean;
}

function groupByServer(connections: ConnectionProfile[]): ServerGroup[] {
    const map = new Map<string, ServerGroup>();
    for (const conn of connections) {
        const provider = getProvider(conn.driver || DRIVER.POSTGRES);
        const isLocal = !provider.requiresHost;
        const key = isLocal ? `local::${conn.name}` : `${conn.host}:${conn.port}`;
        const label = isLocal ? (conn.name || 'Local') : `${conn.host}:${conn.port}`;
        if (!map.has(key)) {
            map.set(key, { key, label, profiles: [], isLocal });
        }
        map.get(key)!.profiles.push(conn);
    }
    return Array.from(map.values());
}

// ─── Step 2: Env + Connection setup ─────────────────────────────────────────

interface EnvSetupStepProps {
    onEnterApp: () => void;
    onBack: () => void;
}

const EnvSetupStep: React.FC<EnvSetupStepProps> = ({ onEnterApp, onBack }) => {
    const activeProject = useProjectStore((s) => s.activeProject);
    const bindEnvironmentConnection = useProjectStore((s) => s.bindEnvironmentConnection);
    const { connections, setConnections } = useConnectionStore();
    const activeEnvironmentKey = useEnvironmentStore((s) => s.activeEnvironmentKey);
    const { toast } = useToast();

    const [selectedEnvKey, setSelectedEnvKey] = React.useState<EnvironmentKey>('loc');
    const [viewMode, setViewMode] = React.useState<EnvViewMode>('list');

    // Server expand state
    const [expandedServer, setExpandedServer] = React.useState<string | null>(null);
    const [loadingServer, setLoadingServer] = React.useState<string | null>(null);
    // Cache: serverKey → { profileName → string[] }
    const [serverDbs, setServerDbs] = React.useState<Record<string, Record<string, string[]>>>({});

    const [bindingKey, setBindingKey] = React.useState<string | null>(null); // `${profileName}::${dbName}`
    const [isLoadingConns, setIsLoadingConns] = React.useState(false);

    const existingNames = connections.map((c) => c.name!).filter(Boolean);
    const form = useConnectionForm({
        existingNames,
        onSaved: async () => {
            setIsLoadingConns(true);
            try {
                const loaded = await LoadConnections();
                setConnections(loaded || []);
            } finally {
                setIsLoadingConns(false);
            }
            setViewMode('list');
        },
        onClose: () => setViewMode('list'),
    });

    React.useEffect(() => {
        let cancelled = false;
        setIsLoadingConns(true);
        LoadConnections()
            .then((data) => { if (!cancelled) setConnections(data || []); })
            .catch(() => { })
            .finally(() => { if (!cancelled) setIsLoadingConns(false); });
        return () => { cancelled = true; };
    }, [setConnections]);


    if (!activeProject) return null;

    const serverGroups = groupByServer(connections);

    const getBoundInfo = (envKey: EnvironmentKey) => {
        const conn = activeProject.connections?.find((c) => c.environment_key === envKey);
        if (!conn) return null;
        const profileName = conn.advanced_meta?.profile_name || conn.name;
        const dbName = conn.database || conn.advanced_meta?.db_name;
        return { profileName, dbName };
    };

    const fetchDatabasesForProfile = React.useCallback((profile: ConnectionProfile) => (
        new Promise<string[]>((resolve, reject) => {
            let settled = false;
            let timer = 0;

            const cleanup = () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                offSchema();
                offConnection();
            };

            const offSchema = onSchemaDatabases((data) => {
                if (data.profileName !== profile.name) return;
                cleanup();
                resolve(data.databases || []);
            });

            const offConnection = onConnectionChanged((data) => {
                if (data.profile?.name !== profile.name) return;
                if (data.status === 'error' || data.status === 'disconnected') {
                    cleanup();
                    reject(new Error(`connection ${data.status}`));
                }
            });

            timer = window.setTimeout(() => {
                cleanup();
                reject(new Error('timeout'));
            }, 15000);

            Connect(profile.name!).catch((err) => {
                cleanup();
                reject(err);
            });
        })
    ), []);

    const handleExpandServer = async (serverKey: string, group: ServerGroup) => {
        if (expandedServer === serverKey) {
            setExpandedServer(null);
            return;
        }
        setExpandedServer(serverKey);
        if (serverDbs[serverKey]) return; // already cached

        setLoadingServer(serverKey);
        try {
            const profileDbMap: Record<string, string[]> = {};
            for (const p of group.profiles) {
                try {
                    const dbs = await fetchDatabasesForProfile(p);
                    profileDbMap[p.name!] = dbs;
                    console.log(`[ProjectHub] Loaded ${dbs.length} databases for profile "${p.name}":`, dbs);
                } catch {
                    profileDbMap[p.name!] = [];
                }
            }
            setServerDbs((prev) => ({ ...prev, [serverKey]: profileDbMap }));
        } catch {
            // connect failed or timed out — leave expanded but empty
        } finally {
            setLoadingServer(null);
        }
    };

    const handleBind = async (profile: ConnectionProfile, dbName: string) => {
        const key = `${profile.name}::${dbName}`;
        setBindingKey(key);
        const profileWithDb = { ...profile, db_name: dbName };
        const bound = await bindEnvironmentConnection(selectedEnvKey, profileWithDb);
        if (!bound) {
            setBindingKey(null);
            toast.error('Could not bind connection.');
            return;
        }
        try {
            await Connect(profile.name!);
            await SwitchDatabase(dbName);
        } catch {
            // non-fatal
        }
        setBindingKey(null);
        onEnterApp();
    };

    const boundInfo = getBoundInfo(selectedEnvKey);

    return (
        <div className="grid h-full grid-cols-[256px_1fr]">
            {/* Left: env list */}
            <section className="flex flex-col border-r border-border/20 bg-bg-primary/40 px-5 py-6 overflow-y-auto">
                <button
                    type="button"
                    onClick={onBack}
                    className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors"
                >
                    <ArrowLeft size={12} /> Back
                </button>
                <div className="text-[11px] font-semibold text-text-secondary">Environments</div>
                <p className="mt-1 mb-4 text-[12px] leading-5 text-text-secondary">
                    Bind a connection + database to each env. You can skip and do this later.
                </p>
                <div className="space-y-2">
                    {ENVIRONMENT_KEYS.map((envKey) => {
                        const meta = getEnvironmentMeta(envKey);
                        const isSelected = selectedEnvKey === envKey;
                        const isCurrent = (activeEnvironmentKey || activeProject.default_environment_key) === envKey;
                        const info = getBoundInfo(envKey);
                        return (
                            <button
                                key={envKey}
                                type="button"
                                onClick={() => { setSelectedEnvKey(envKey); setViewMode('list'); }}
                                className={cn(
                                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                                    isSelected
                                        ? 'border-accent/40 bg-bg-secondary'
                                        : 'border-border/25 bg-bg-primary/20 hover:border-border/50 hover:bg-bg-primary/40'
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>
                                            {envKey}
                                        </span>
                                        <span className="truncate text-[13px] font-semibold text-text-primary">{meta.label}</span>
                                    </div>
                                    {isCurrent && <BadgeCheck size={14} className="shrink-0 text-accent" />}
                                </div>
                                {info && (
                                    <div className="mt-1 text-[10px] text-text-secondary truncate pl-0.5">
                                        ↳ {info.profileName}{info.dbName ? ` / ${info.dbName}` : ''}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Right: connection + database picker */}
            <section className="flex flex-col overflow-hidden">
                {viewMode === 'list' ? (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 shrink-0 border-b border-border/15">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', getEnvironmentMeta(selectedEnvKey).colorClass)}>
                                        {selectedEnvKey}
                                    </span>
                                    <h3 className="m-0 text-[17px] font-bold tracking-tight text-text-primary">
                                        {getEnvironmentMeta(selectedEnvKey).label}
                                    </h3>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-text-secondary">
                                    <Plug size={11} />
                                    {boundInfo
                                        ? <span>Bound: <span className="font-semibold text-accent">{boundInfo.profileName}{boundInfo.dbName ? ` / ${boundInfo.dbName}` : ''}</span></span>
                                        : 'No connection bound yet.'}
                                </div>
                            </div>
                            <Button variant="primary" onClick={onEnterApp} className="shrink-0 rounded-2xl gap-2">
                                Enter App <ArrowRight size={13} />
                            </Button>
                        </div>

                        {/* Connection list by server */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[11px] font-semibold text-text-secondary">Connections — pick a database to bind</div>
                                <button
                                    type="button"
                                    onClick={() => { form.resetForm(); setViewMode('new-connection'); }}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                                >
                                    <Plus size={11} /> New connection
                                </button>
                            </div>

                            {isLoadingConns ? (
                                <div className="flex items-center justify-center h-32 gap-2 text-text-secondary text-[12px]">
                                    <Spinner size={14} /> Loading...
                                </div>
                            ) : serverGroups.length === 0 ? (
                                <div className="flex h-48 items-center justify-center rounded-3xl border border-dashed border-border/50 bg-bg-primary/20 text-center text-[12px] text-text-secondary">
                                    No saved connections. Create one.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {serverGroups.map((group) => {
                                        const isExpanded = expandedServer === group.key;
                                        const isLoading = loadingServer === group.key;
                                        const cachedDbs = serverDbs[group.key];

                                        return (
                                            <div key={group.key} className="rounded-2xl border border-border/25 bg-bg-primary/20 overflow-hidden">
                                                {/* Server header — click to expand */}
                                                <button
                                                    type="button"
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-primary/40 transition-colors"
                                                    onClick={() => handleExpandServer(group.key, group)}
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown size={14} className="shrink-0 text-text-secondary" />
                                                        : <ChevronRight size={14} className="shrink-0 text-text-secondary" />
                                                    }
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-semibold text-text-primary truncate">
                                                            {group.isLocal ? group.profiles[0]?.name : group.label}
                                                        </div>
                                                        {!group.isLocal && (
                                                            <div className="text-[10px] text-text-secondary mt-0.5">
                                                                {group.profiles.map(p => p.driver).join(', ')} — {group.profiles.length} profile{group.profiles.length > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isLoading && <Spinner size={12} className="shrink-0" />}
                                                </button>

                                                {/* Expanded: databases per profile */}
                                                {isExpanded && (
                                                    <div className="border-t border-border/15">
                                                        {isLoading ? (
                                                            <div className="flex items-center gap-2 px-6 py-4 text-[12px] text-text-secondary">
                                                                <Spinner size={12} /> Connecting...
                                                            </div>
                                                        ) : !cachedDbs || Object.values(cachedDbs).flat().length === 0 ? (
                                                            <div className="px-6 py-4 text-[12px] text-text-secondary italic">
                                                                No databases found or connection failed.
                                                            </div>
                                                        ) : (
                                                            group.profiles.map((profile) => {
                                                                const dbs = cachedDbs[profile.name!] || [];
                                                                return (
                                                                    <div key={profile.name}>
                                                                        {group.profiles.length > 1 && (
                                                                            <div className="px-6 py-1.5 text-[10px] font-semibold text-text-muted bg-bg-primary/30 uppercase tracking-widest">
                                                                                {profile.name} ({profile.username}@{profile.driver})
                                                                            </div>
                                                                        )}
                                                                        {dbs.map((dbName) => {
                                                                            const bindKey = `${profile.name}::${dbName}`;
                                                                            const isBound = boundInfo?.profileName === profile.name && boundInfo?.dbName === dbName;
                                                                            const isBinding = bindingKey === bindKey;
                                                                            return (
                                                                                <div
                                                                                    key={dbName}
                                                                                    className={cn(
                                                                                        'flex items-center gap-3 px-6 py-2.5 border-t border-border/10',
                                                                                        isBound ? 'bg-accent/5' : 'hover:bg-bg-primary/30'
                                                                                    )}
                                                                                >
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <span className={cn(
                                                                                            'text-[13px] font-semibold',
                                                                                            isBound ? 'text-accent' : 'text-text-primary'
                                                                                        )}>
                                                                                            {dbName}
                                                                                        </span>
                                                                                        {group.profiles.length === 1 && (
                                                                                            <span className="ml-2 text-[10px] text-text-secondary">{profile.driver}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    {isBound && (
                                                                                        <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent shrink-0">
                                                                                            Bound
                                                                                        </span>
                                                                                    )}
                                                                                    <Button
                                                                                        variant={isBound ? 'ghost' : 'primary'}
                                                                                        onClick={() => void handleBind(profile, dbName)}
                                                                                        disabled={isBinding}
                                                                                        className="shrink-0 rounded-xl h-7 px-3 text-[11px]"
                                                                                    >
                                                                                        {isBinding ? <Spinner size={11} /> : isBound ? 'Rebind' : 'Bind'}
                                                                                    </Button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* ── New connection inline form ── */
                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex flex-col border-r border-border/20 min-w-[160px] max-w-[160px]">
                            <div className="px-3 pt-4 pb-2 text-[11px] font-semibold text-text-secondary">Provider</div>
                            <ProviderGrid
                                selected={form.selectedProvider}
                                locked={form.isEditing}
                                onSelect={form.handleDriverChange}
                            />
                            <div className="p-3 mt-auto shrink-0">
                                <Button variant="solid" className="w-full text-[11px]" onClick={() => setViewMode('list')}>
                                    <ArrowLeft size={12} /> Back
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden bg-bg-primary/20">
                            <div className="px-4 pt-4 pb-2 text-[13px] font-bold text-text-primary shrink-0">New Connection</div>
                            <div className="flex-1 overflow-y-auto px-2">
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
                                    onCancel={() => setViewMode('list')}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

// ─── Main ProjectHub ─────────────────────────────────────────────────────────

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, onClose }) => {
    const { projects, isLoading, error, openProject, createProject } = useProjectStore();
    const resetRuntime = useConnectionStore((state) => state.resetRuntime);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [step, setStep] = React.useState<Step>('pick-project');

    const sortedProjects = React.useMemo(
        () => [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
        [projects]
    );

    const recentProject = sortedProjects[0] || null;

    const handleOpenProject = async (projectId: string) => {
        try { await Disconnect(); } catch { }
        resetRuntime();
        const project = await openProject(projectId);
        if (project) setStep('setup-envs');
    };

    const handleCreateProject = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const nextName = name.trim();
        const nextDescription = description.trim();
        if (!nextName) return;

        setIsCreating(true);
        const project = await createProject({ name: nextName, description: nextDescription, tags: [] });
        setIsCreating(false);
        if (project) {
            setName('');
            setDescription('');
            setStep('setup-envs');
        }
    };

    const content = (
        <div className={cn(
            'overflow-hidden bg-bg-secondary text-text-primary',
            overlay
                ? 'h-[680px] w-[980px] max-w-[calc(100vw-48px)] rounded-3xl border border-border/40'
                : 'h-full w-full'
        )}>
            {step === 'pick-project' ? (
                <div className="grid h-full md:grid-cols-[0.78fr_1.22fr]">
                    <section className="flex flex-col border-r border-border/20 bg-bg-primary/40 px-8 py-8">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-bg-secondary px-3 py-1 text-[11px] font-semibold text-text-secondary">
                            <Layers3 size={12} />
                            Project Hub
                        </div>
                        <div className="mt-6">
                            <h1 className="m-0 max-w-[280px] text-[34px] font-black leading-[1.02] tracking-[-0.05em] text-text-primary">
                                Open fast. Switch env. Keep context.
                            </h1>
                            <p className="mt-3 max-w-[320px] text-[13px] leading-6 text-text-secondary">
                                One project holds your environments, bound connections, and query session.
                            </p>
                        </div>
                        <div className="mt-8 space-y-3">
                            <div className="rounded-3xl border border-border/40 bg-bg-secondary px-5 py-4">
                                <div className="text-[11px] font-semibold text-text-secondary">Flow</div>
                                <div className="mt-2 text-[14px] font-semibold text-text-primary">
                                    Create project {'→'} bind env to db {'→'} query
                                </div>
                            </div>
                            <div className="rounded-3xl border border-border/40 bg-bg-secondary px-5 py-4">
                                <div className="text-[11px] font-semibold text-text-secondary">Session Restore</div>
                                <div className="mt-2 text-[14px] font-semibold text-text-primary">
                                    Reopen exactly where you left off
                                </div>
                            </div>
                        </div>
                        {recentProject && (
                            <button
                                type="button"
                                onClick={() => void handleOpenProject(recentProject.id)}
                                className="mt-auto rounded-3xl border border-border/40 bg-bg-secondary px-5 py-5 text-left transition-colors hover:border-accent/40 hover:bg-bg-primary"
                            >
                                <div className="text-[11px] font-semibold text-text-secondary">Last Project</div>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-[18px] font-bold tracking-tight text-text-primary">{recentProject.name}</div>
                                        <div className="mt-1 text-[12px] text-text-secondary">Updated {formatDateLabel(recentProject.updated_at)}</div>
                                    </div>
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/40 bg-bg-primary text-text-primary">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                            </button>
                        )}
                    </section>

                    <section className="grid min-h-0 grid-rows-[auto_1fr_auto] bg-bg-secondary">
                        <div className="flex items-center justify-between border-b border-border/20 px-8 py-6">
                            <div>
                                <h2 className="m-0 text-[22px] font-bold tracking-tight text-text-primary">Projects</h2>
                                <p className="m-0 mt-1 text-[12px] text-text-secondary">
                                    {sortedProjects.length > 0 ? 'Pick one and continue working.' : 'Create your first project.'}
                                </p>
                            </div>
                            {overlay && onClose && (
                                <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
                            )}
                        </div>

                        <div className="min-h-0 overflow-y-auto px-6 py-5">
                            {sortedProjects.length === 0 && !isLoading ? (
                                <div className="flex h-full min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-border/50 bg-bg-primary/30 px-6 text-center">
                                    <div className="max-w-[320px]">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-bg-secondary text-text-primary">
                                            <Plus size={18} />
                                        </div>
                                        <div className="mt-4 text-[16px] font-semibold text-text-primary">No projects yet</div>
                                        <p className="mt-2 text-[12px] leading-5 text-text-secondary">
                                            Create a project, then bind each environment to a database.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sortedProjects.map((project) => {
                                        const envKey = project.last_active_environment_key || project.default_environment_key || 'loc';
                                        const envMeta = getEnvironmentMeta(envKey);
                                        const envCount = project.environments?.length ?? 0;
                                        const connectionCount = project.connections?.length ?? 0;
                                        return (
                                            <button
                                                key={project.id}
                                                type="button"
                                                onClick={() => void handleOpenProject(project.id)}
                                                className="group w-full rounded-3xl border border-border/30 bg-bg-primary/35 px-5 py-4 text-left transition-colors hover:border-accent/40 hover:bg-bg-primary/60"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/30 bg-bg-secondary text-text-primary">
                                                        <Layers3 size={16} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="truncate text-[15px] font-semibold text-text-primary">{project.name}</div>
                                                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>
                                                                {envKey}
                                                            </span>
                                                        </div>
                                                        {project.description && (
                                                            <p className="m-0 mt-1 line-clamp-1 text-[12px] text-text-secondary">{project.description}</p>
                                                        )}
                                                        <div className="mt-3 flex items-center gap-3 text-[11px] text-text-secondary">
                                                            <span>{envCount} environments</span>
                                                            <span>{connectionCount} bindings</span>
                                                            <span>{formatDateLabel(project.updated_at)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary">
                                                        <ArrowRight size={16} />
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {error && (
                                        <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-[12px] text-error">{error}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border/20 bg-bg-primary/20 px-6 py-5">
                            <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleCreateProject}>
                                <div className="md:col-span-3 flex items-center gap-2 text-[12px] font-semibold text-text-secondary">
                                    <FolderPlus size={13} /> Create Project
                                </div>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Payments Platform"
                                    autoFocus={!overlay}
                                    className="h-10 rounded-2xl bg-bg-secondary"
                                />
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional description"
                                    className="h-10 rounded-2xl bg-bg-secondary"
                                />
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={isCreating || isLoading || !name.trim()}
                                    className="h-10 rounded-2xl px-5"
                                >
                                    {isCreating ? 'Creating...' : 'Create'}
                                </Button>
                            </form>
                        </div>
                    </section>
                </div>
            ) : (
                <EnvSetupStep
                    onEnterApp={() => onClose?.()}
                    onBack={() => setStep('pick-project')}
                />
            )}
        </div>
    );

    if (overlay) {
        return (
            <ModalBackdrop onClose={onClose}>
                <div onClick={(e) => e.stopPropagation()}>{content}</div>
            </ModalBackdrop>
        );
    }

    return content;
};
