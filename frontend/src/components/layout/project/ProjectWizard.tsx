import React from 'react';
import { BadgeCheck, ChevronRight, FolderOpen } from 'lucide-react';
import { Disconnect, ImportConnectionPackage } from '../../../services/connectionService';
import { GetDefaultProjectStorageRoot, PickDirectory } from '../../../services/projectService';
import { useProjectStore } from '../../../stores/projectStore';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../../lib/projects';
import { useConnectionForm } from '../../../hooks/useConnectionForm';
import { ConnectionForm } from '../../connection/ConnectionForm';
import { ProviderPickerToolbar } from '../../connection/ProviderPickerToolbar';
import { ProviderGrid } from '../../connection/ProviderGrid';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Spinner, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui';
import { DatabaseTreePicker } from '../../connection/DatabaseTreePicker';
import { ENVIRONMENT_KEY } from '../../../lib/constants';
import { cn } from '../../../lib/cn';
import { getProvider } from '../../../lib/providers';
import type { EnvironmentKey } from '../../../types/project';
import type { ConnectionProfile } from '../../../types/connection';
import { useToast } from '../Toast';
import {
    PROJECT_ICON_MAP,
    PROJECT_ICON_OPTIONS,
    buildTagsWithProjectIcon,
    type ProjectIconKey,
} from '../projectHubMeta';
import { PanelFrame } from '../PanelFrame';

type ConnectionMode = 'existing' | 'new';

interface WizardDraft {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
    starterEnv: EnvironmentKey;
}

function slugifyProjectName(value: string): string {
    const input = value.trim().toLowerCase();
    if (!input) return 'project';

    let result = '';
    let lastDash = false;
    for (const char of input) {
        if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
            result += char;
            lastDash = false;
            continue;
        }
        if (!lastDash) {
            result += '-';
            lastDash = true;
        }
    }

    const trimmed = result.replace(/^-+|-+$/g, '');
    return trimmed || 'project';
}

function joinPath(parent: string, child: string): string {
    const base = parent.trim();
    if (!base) return '';
    const separator = base.includes('\\') ? '\\' : '/';
    const normalized = base.replace(/[\\/]+$/, '');
    return `${normalized}${separator}${child}`;
}

interface ProjectWizardProps {
    overlay?: boolean;
    onClose?: () => void;
    onDone: () => void;
}

export const ProjectWizard: React.FC<ProjectWizardProps> = ({ overlay = false, onClose, onDone }) => {
    const createProject = useProjectStore((s) => s.createProject);
    const bindEnvironmentConnection = useProjectStore((s) => s.bindEnvironmentConnection);
    const setProjectEnvironment = useProjectStore((s) => s.setProjectEnvironment);
    const setActiveProject = useProjectStore((s) => s.setActiveProject);
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
    const { toast } = useToast();

    const [draft, setDraft] = React.useState<WizardDraft>({
        name: '',
        description: '',
        iconKey: 'general',
        starterEnv: ENVIRONMENT_KEY.LOCAL,
    });
    const [connectionMode, setConnectionMode] = React.useState<ConnectionMode>('existing');
    const [selectedProfile, setSelectedProfile] = React.useState<ConnectionProfile | null>(null);
    const [selectedProfileName, setSelectedProfileName] = React.useState<string | null>(null);
    const [selectedDatabase, setSelectedDatabase] = React.useState('');
    const [providerFilter, setProviderFilter] = React.useState('');
    const [isSelectingProvider, setIsSelectingProvider] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [storageParentPath, setStorageParentPath] = React.useState('');
    const [loadingStorageRoot, setLoadingStorageRoot] = React.useState(true);
    const [importingConnection, setImportingConnection] = React.useState(false);
    const [importingFormConnection, setImportingFormConnection] = React.useState(false);
    const [treeRefreshKey, setTreeRefreshKey] = React.useState(0);
    const [showStorage, setShowStorage] = React.useState(false);
    const [showConnection, setShowConnection] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        setLoadingStorageRoot(true);

        GetDefaultProjectStorageRoot()
            .then((root) => {
                if (!cancelled && root) {
                    setStorageParentPath(root);
                }
            })
            .catch(() => {
                // Ignore and allow manual path input.
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingStorageRoot(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const handleSelectFromTree = React.useCallback((profile: ConnectionProfile, database: string) => {
        setSelectedProfile(profile);
        setSelectedProfileName(profile.name || null);
        setSelectedDatabase(database);
    }, []);

    const handlePickStorageFolder = React.useCallback(async () => {
        try {
            const picked = await PickDirectory(storageParentPath);
            if (picked) {
                setStorageParentPath(picked);
            }
        } catch (error) {
            toast.error(`Could not pick folder: ${error}`);
        }
    }, [storageParentPath, toast]);

    const form = useConnectionForm({
        existingNames: [],
        onSaved: async () => {
            const savedName = form.formData.name || '';
            if (savedName) setSelectedProfileName(savedName);
            setSelectedProfile(form.formData as ConnectionProfile);
            if (form.formData.db_name) setSelectedDatabase(form.formData.db_name);
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
        },
        onClose: () => {
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
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

    const handleImportConnection = React.useCallback(async () => {
        setImportingConnection(true);
        try {
            const imported = await ImportConnectionPackage();
            if (!imported) return;
            const importedProfile = imported as ConnectionProfile;
            const profileName = importedProfile.name || null;
            setSelectedProfile(importedProfile);
            setSelectedProfileName(profileName);
            setSelectedDatabase(importedProfile.db_name || '');
            setTreeRefreshKey((key) => key + 1);
            toast.success(`Imported connection${profileName ? ` "${profileName}"` : ''}.`);
        } catch (error) {
            toast.error(`Could not import connection: ${error}`);
        } finally {
            setImportingConnection(false);
        }
    }, [toast]);

    const handleImportConnectionToForm = React.useCallback(async () => {
        setImportingFormConnection(true);
        try {
            const imported = await ImportConnectionPackage();
            if (!imported) return;

            const importedProfile: ConnectionProfile = { ...(imported as ConnectionProfile) };
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

    const canSubmit = React.useMemo(
        () => Boolean(draft.name.trim() && draft.starterEnv && selectedProfileName && selectedDatabase.trim()),
        [draft.name, draft.starterEnv, selectedProfileName, selectedDatabase],
    );

    const storagePathPreview = React.useMemo(() => {
        const slug = slugifyProjectName(draft.name);
        return storageParentPath.trim() ? joinPath(storageParentPath, slug) : '';
    }, [draft.name, storageParentPath]);

    const handleCreateAndEnter = async () => {
        if (!selectedProfileName || !selectedProfile) return;
        setSubmitting(true);
        try {
            try { await Disconnect(); } catch { /* ignore */ }
            resetRuntime();

            const project = await createProject({
                name: draft.name.trim(),
                description: draft.description.trim(),
                tags: buildTagsWithProjectIcon([], draft.iconKey),
                storage_path: storagePathPreview || undefined,
            });
            if (!project) { toast.error('Could not create project.'); return; }

            setActiveProject(project);
            const dbName = selectedDatabase.trim();
            const boundProject = await bindEnvironmentConnection(draft.starterEnv, {
                ...selectedProfile,
                name: selectedProfileName,
                db_name: dbName,
            });
            if (!boundProject) { toast.error('Could not bind starter environment.'); return; }

            const envProject = await setProjectEnvironment(draft.starterEnv);
            setActiveProject(envProject || boundProject);
            setActiveEnvironment(draft.starterEnv);
            onDone();
        } catch (error) {
            toast.error(`Could not finish setup: ${error}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PanelFrame
            title="Create project"
            onClose={overlay && onClose ? onClose : undefined}
            className="h-full"
            headerClassName="px-6 py-4"
            bodyClassName="min-h-0 overflow-y-auto px-6 py-5"
            titleClassName="text-[20px]"
            footerClassName="flex items-center justify-end gap-2 px-6 py-4"
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose} className="rounded-sm" disabled={!onClose}>Cancel</Button>
                    <Button
                        variant="default"
                        onClick={() => void handleCreateAndEnter()}
                        disabled={!canSubmit || submitting}
                        className="rounded-sm px-5"
                    >
                        {submitting ? <><Spinner size={12} className="mr-2 text-white" />Creating...</> : <>Create &amp; enter</>}
                    </Button>
                </>
            )}
        >
            <div className="mx-auto max-w-190 flex flex-col gap-4 pb-4">

                {/* ── Basics ── */}
                <div className="flex gap-3">
                    {/* Icon picker — aligned to top of name input */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="mt-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground outline-none transition hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring"
                                title="Change project icon"
                            >
                                {React.createElement(PROJECT_ICON_MAP[draft.iconKey].icon, { size: 28 })}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="z-topmost w-120 max-w-[calc(100vw-28px)] p-2" align="start" sideOffset={8}>
                            <div className="grid grid-cols-3 gap-1">
                                {PROJECT_ICON_OPTIONS.map((option) => {
                                    const OptionIcon = option.icon;
                                    const active = draft.iconKey === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setDraft((c) => ({ ...c, iconKey: option.key }))}
                                            className={cn(
                                                'flex items-center gap-2 rounded-sm border px-2.5 py-2 text-left text-[11px] transition-colors',
                                                active ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border hover:bg-muted/60',
                                            )}
                                        >
                                            <OptionIcon size={14} />
                                            <span className="truncate">{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Name + description stacked */}
                    <div className="flex flex-1 flex-col gap-2">
                        <div>
                            <label className="mb-1 block text-[11px] font-semibold text-foreground">Project name <span className="text-destructive">*</span></label>
                            <Input
                                value={draft.name}
                                onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
                                placeholder="Payments Platform"
                                inputSize="md"
                                className="bg-card w-full"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[11px] font-semibold text-foreground">Description</label>
                            <Input
                                value={draft.description}
                                onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))}
                                placeholder="Optional context"
                                inputSize="md"
                                className="bg-card w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Environment ── */}
                <div>
                    <div className="mb-2 text-[12px] font-semibold text-foreground">Starter environment</div>
                    <TooltipProvider delayDuration={150}>
                        <div className="flex gap-2">
                            {ENVIRONMENT_KEYS.map((envKey) => {
                                const meta = getEnvironmentMeta(envKey);
                                const active = draft.starterEnv === envKey;
                                return (
                                    <Tooltip key={envKey}>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => setDraft((c) => ({ ...c, starterEnv: envKey }))}
                                                className={cn(
                                                    'flex flex-1 items-center justify-between rounded-sm border px-3 py-2.5 transition-colors',
                                                    active ? 'border-accent/40 bg-accent/8' : 'border-border/25 bg-background/20 hover:bg-background/40',
                                                )}
                                            >
                                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>
                                                    {envKey}
                                                </span>
                                                {active && <BadgeCheck size={13} className="text-accent" />}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-40 text-center">
                                            <span className="font-semibold">{meta.label}</span>
                                            <p className="mt-0.5 text-[11px] font-normal opacity-80">{meta.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </TooltipProvider>
                </div>

                {/* ── Connection ── */}
                <div>
                    <button
                        type="button"
                        onClick={() => setShowConnection((v) => !v)}
                        className="flex w-full items-center gap-1.5 text-[12px] font-semibold text-foreground hover:text-accent"
                    >
                        <ChevronRight size={13} className={cn('transition-transform duration-150', showConnection && 'rotate-90')} />
                        Database connection <span className="text-destructive">*</span>
                        {!showConnection && selectedProfileName && (
                            <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                                {selectedProfileName}{selectedDatabase ? ` / ${selectedDatabase}` : ''}
                            </span>
                        )}
                    </button>
                    {showConnection && (
                        <div className="mt-2 flex min-h-100 flex-col rounded-sm bg-background/20">
                            {connectionMode === 'existing' ? (
                                <div className="flex-1 overflow-hidden">
                                    <DatabaseTreePicker
                                        key={treeRefreshKey}
                                        onSelect={handleSelectFromTree}
                                        selectedProfile={selectedProfileName}
                                        selectedDatabase={selectedDatabase}
                                        onImport={handleImportConnection}
                                        importing={importingConnection}
                                        onAddNew={() => { form.resetForm(); setConnectionMode('new'); setIsSelectingProvider(true); setProviderFilter(''); }}
                                    />
                                </div>
                            ) : (
                                <div className="relative grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] px-4 py-3">
                                    <ProviderPickerToolbar
                                        isSelectingProvider={isSelectingProvider}
                                        providerFilter={providerFilter}
                                        selectedProvider={selectedProvider}
                                        onBack={() => { setConnectionMode('existing'); setIsSelectingProvider(false); setProviderFilter(''); }}
                                        onShowProviderPicker={() => setIsSelectingProvider(true)}
                                        onProviderFilterChange={setProviderFilter}
                                        onClearProviderFilter={() => setProviderFilter('')}
                                        onImportConnection={handleImportConnectionToForm}
                                        importingConnection={importingFormConnection}
                                    />
                                    {isSelectingProvider ? (
                                        <div className="h-full min-h-0 rounded-sm bg-background/15 p-2">
                                            <ProviderGrid selected={form.selectedProvider} locked={form.isEditing} filterText={providerFilter} onSelect={handleProviderSelect} />
                                        </div>
                                    ) : (
                                        <div className="h-full overflow-hidden">
                                            <div className="mx-auto flex min-h-full w-full max-w-155 items-start justify-center">
                                                <div className="w-full">
                                                    <ConnectionForm
                                                        formData={form.formData} connString={form.connString}
                                                        testing={form.testing} saving={form.saving}
                                                        testResult={form.testResult} errorMsg={form.errorMsg}
                                                        successMsg={form.successMsg} isEditing={form.isEditing}
                                                        showUriField={true}
                                                        onChange={form.handleChange}
                                                        onConnStringChange={form.handleParseConnectionString}
                                                        onTest={form.handleTest} onSave={form.handleSave}
                                                        onCancel={() => { setConnectionMode('existing'); setIsSelectingProvider(false); setProviderFilter(''); }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Storage location (optional, collapsible) ── */}
                <div>
                    <button
                        type="button"
                        onClick={() => setShowStorage((v) => !v)}
                        className="flex w-full items-center gap-1.5 text-[12px] font-semibold text-foreground hover:text-accent"
                    >
                        <ChevronRight size={13} className={cn('transition-transform duration-150', showStorage && 'rotate-90')} />
                        Storage location
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">(optional)</span>
                        {!showStorage && storagePathPreview && (
                            <span className="ml-auto truncate text-[11px] font-normal text-muted-foreground" title={storagePathPreview}>
                                {storagePathPreview}
                            </span>
                        )}
                    </button>
                    {showStorage && (
                        <div className="mt-2">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={storageParentPath}
                                    onChange={(e) => setStorageParentPath(e.target.value)}
                                    placeholder={loadingStorageRoot ? 'Loading default storage root...' : 'Choose parent folder...'}
                                    inputSize="xl"
                                    className="bg-card"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-10 rounded-sm px-3"
                                    onClick={() => { void handlePickStorageFolder(); }}
                                    disabled={loadingStorageRoot}
                                    title="Browse folder"
                                >
                                    <FolderOpen size={14} />
                                </Button>
                            </div>
                            <div className="mt-1 truncate text-[11px] text-muted-foreground" title={storagePathPreview || undefined}>
                                {storagePathPreview || 'Project folder will use the app default location.'}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </PanelFrame>
    );
};
