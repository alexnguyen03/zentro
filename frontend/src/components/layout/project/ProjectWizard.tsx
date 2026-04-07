import React from 'react';
import { BadgeCheck, FolderOpen } from 'lucide-react';
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
import { Button, Input, Spinner } from '../../ui';
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

type WizardStep = 'basics' | 'environment' | 'connection' | 'review';
type ConnectionMode = 'existing' | 'new';

const STEP_ORDER: WizardStep[] = ['basics', 'environment', 'connection', 'review'];

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

    const [step, setStep] = React.useState<WizardStep>('basics');
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

    const canGoNext = React.useMemo(() => {
        if (step === 'basics') return Boolean(draft.name.trim());
        if (step === 'environment') return Boolean(draft.starterEnv);
        if (step === 'connection') return Boolean(selectedProfileName && selectedDatabase.trim());
        return true;
    }, [draft.name, draft.starterEnv, selectedProfileName, selectedDatabase, step]);

    const stepIndex = STEP_ORDER.indexOf(step);
    const DraftIcon = PROJECT_ICON_MAP[draft.iconKey].icon;
    const draftIconLabel = PROJECT_ICON_MAP[draft.iconKey].label;
    const storagePathPreview = React.useMemo(() => {
        const slug = slugifyProjectName(draft.name);
        return storageParentPath.trim() ? joinPath(storageParentPath, slug) : '';
    }, [draft.name, storageParentPath]);

    const goNext = React.useCallback(() => {
        if (!canGoNext) return;
        const next = STEP_ORDER[stepIndex + 1];
        if (next) setStep(next);
    }, [canGoNext, stepIndex]);
    const goBack = React.useCallback(() => {
        const prev = STEP_ORDER[stepIndex - 1];
        if (prev) setStep(prev);
    }, [stepIndex]);

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

    const handleWizardKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter') return;
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;

        const tag = target.tagName.toLowerCase();
        if (tag === 'textarea' || tag === 'button') return;
        if (step === 'connection' && connectionMode === 'new') return;

        event.preventDefault();
        event.stopPropagation();

        if (step !== 'review') {
            goNext();
            return;
        }

        if (!submitting && selectedProfile && selectedProfileName && selectedDatabase) {
            void handleCreateAndEnter();
        }
    }, [connectionMode, goNext, selectedDatabase, selectedProfile, selectedProfileName, step, submitting]);

    return (
        <PanelFrame
            title={
                <>
                    {step === 'basics' && 'Create the project shell'}
                    {step === 'environment' && 'Pick the starter environment'}
                    {step === 'connection' && 'Bind one database'}
                    {step === 'review' && 'Review and enter project'}
                </>
            }
            subtitle={`${stepIndex + 1} of ${STEP_ORDER.length}`}
            onClose={overlay && onClose ? onClose : undefined}
            className="h-full"
            headerClassName="px-6 py-4"
            bodyClassName="min-h-0 overflow-y-auto px-6"
            titleClassName="text-[20px]"
            footerClassName="flex items-center justify-between px-6 py-4"
            footer={(
                <>
                    <div className="flex items-center gap-3">
                        {step !== 'basics' ? (
                            <Button variant="secondary" onClick={goBack} className="rounded-md">Back</Button>
                        ) : (
                            <Button variant="ghost" onClick={onClose} className="rounded-md" disabled={!onClose}>Cancel</Button>
                        )}
                    </div>
                    {step !== 'review' ? (
                        <Button variant="default" onClick={goNext} disabled={!canGoNext} className="rounded-md px-5">Continue</Button>
                    ) : (
                        <Button
                            variant="default"
                            onClick={() => void handleCreateAndEnter()}
                            disabled={!selectedProfile || !selectedProfileName || !selectedDatabase || submitting}
                            className="rounded-md px-5"
                        >
                            {submitting ? <><Spinner size={12} className="mr-2 text-white" />Creating...</> : <>Create &amp; enter</>}
                        </Button>
                    )}
                </>
            )}
        >
            <div className="mt-1" onKeyDown={handleWizardKeyDown}>
                {/* Step: basics */}
                {step === 'basics' && (
                    <div className="mx-auto flex max-w-190 flex-col gap-4">
                        <div className="">
                            <div className="grid gap-3">
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-foreground">Project name</label>
                                    <Input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Payments Platform" className="h-11 rounded-md bg-card" autoFocus />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-foreground">Description</label>
                                    <Input value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Optional context for the team or future you" className="h-11 rounded-md bg-card" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-foreground">Icon</label>
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {PROJECT_ICON_OPTIONS.map((option) => {
                                            const OptionIcon = option.icon;
                                            const active = draft.iconKey === option.key;
                                            return (
                                                <Button
                                                    key={option.key} type="button"
                                                    variant="ghost"
                                                    onClick={() => setDraft((c) => ({ ...c, iconKey: option.key }))}
                                                    className={cn('h-auto w-full justify-start gap-2 rounded-md px-3 py-2 text-left text-[12px] transition-colors', active ? 'bg-accent/10 text-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
                                                >
                                                    <OptionIcon size={14} /><span>{option.label}</span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-foreground">Project data location</label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={storageParentPath}
                                            onChange={(e) => setStorageParentPath(e.target.value)}
                                            placeholder={loadingStorageRoot ? 'Loading default storage root...' : 'Choose parent folder...'}
                                            className="h-11 rounded-md bg-card"
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="h-11 rounded-md px-3"
                                            onClick={() => {
                                                void handlePickStorageFolder();
                                            }}
                                            disabled={loadingStorageRoot}
                                            title="Browse folder"
                                        >
                                            <FolderOpen size={14} />
                                        </Button>
                                    </div>
                                    <div className="mt-1 text-[11px] text-muted-foreground truncate" title={storagePathPreview || undefined}>
                                        {storagePathPreview || 'Project folder will use the app default location.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step: environment */}
                {step === 'environment' && (
                    <div className="mx-auto grid max-w-215 gap-4 md:grid-cols-2">
                        {ENVIRONMENT_KEYS.map((envKey) => {
                            const meta = getEnvironmentMeta(envKey);
                            const active = draft.starterEnv === envKey;
                            return (
                                <Button
                                    key={envKey} type="button"
                                    variant="outline"
                                    onClick={() => setDraft((c) => ({ ...c, starterEnv: envKey }))}
                                    className={cn('h-auto w-full justify-start rounded-md px-4 py-4 text-left transition-colors', envKey === ENVIRONMENT_KEY.PRODUCTION && 'md:col-span-2', active ? 'border-accent/40 bg-accent/8' : 'border-border/25 bg-background/20 hover:bg-background/40')}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>{envKey}</span>
                                        {active && <BadgeCheck size={16} className="text-accent" />}
                                    </div>
                                    <div className="mt-4 text-[16px] font-semibold text-foreground">{meta.label}</div>
                                    <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{meta.description}</p>
                                </Button>
                            );
                        })}
                    </div>
                )}

                {/* Step: connection */}
                {step === 'connection' && (
                    <div className=" w-full max-w-245">
                        <div className="flex min-h-130 flex-col rounded-md bg-background/20">
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
                                        <div className="h-full min-h-0 rounded-md bg-background/15 p-2">
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
                    </div>
                )}

                {/* Step: review */}
                {step === 'review' && (
                    <div className="mx-auto flex max-w-190 flex-col gap-4">
                        <div className="rounded-md bg-background/20 p-5">
                            <div className="space-y-3">
                                <div className="rounded-md bg-card px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Project</div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background/30">
                                            <DraftIcon size={14} className="text-foreground" />
                                        </div>
                                        <div className="text-[16px] font-semibold text-foreground">{draft.name.trim()}</div>
                                    </div>
                                    <div className="mt-1 text-[12px] text-muted-foreground">{draft.description.trim() || draftIconLabel}</div>
                                </div>
                                <div className="rounded-md bg-card px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Starter environment</div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', getEnvironmentMeta(draft.starterEnv).colorClass)}>{draft.starterEnv}</span>
                                        <span className="text-[16px] font-semibold text-foreground">{getEnvironmentMeta(draft.starterEnv).label}</span>
                                    </div>
                                    <div className="mt-1 text-[12px] text-muted-foreground">The first project session will open in this context.</div>
                                </div>
                                <div className="rounded-md bg-card px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Connection</div>
                                    <div className="mt-2 text-[16px] font-semibold text-foreground">{selectedProfileName || 'Missing connection'}</div>
                                    <div className="mt-1 text-[12px] text-muted-foreground">{selectedDatabase || 'Pick a database'}</div>
                                </div>
                                <div className="rounded-md bg-card px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Storage</div>
                                    <div className="mt-2 text-[12px] text-foreground break-all">{storagePathPreview || 'App default location'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PanelFrame>
    );
};
