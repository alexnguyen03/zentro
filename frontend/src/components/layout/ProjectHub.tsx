import React from 'react';
import {
    BadgeCheck,
    Check,
    FolderPlus,
    Layers3,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { Disconnect } from '../../services/connectionService';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ConnectionForm } from '../connection/ConnectionForm';
import { ProviderPickerToolbar } from '../connection/ProviderPickerToolbar';
import { ProviderGrid } from '../connection/ProviderGrid';
import { Button, Input, ModalBackdrop, ModalFrame, Spinner } from '../ui';
import { DatabaseTreePicker } from '../ui/DatabaseTreePicker';
import { cn } from '../../lib/cn';
import { getProvider } from '../../lib/providers';
import type { EnvironmentKey, Project } from '../../types/project';
import type { ConnectionProfile } from '../../types/connection';
import { useToast } from './Toast';
import {
    PROJECT_ICON_MAP,
    PROJECT_ICON_OPTIONS,
    buildTagsWithProjectIcon,
    formatDateLabel,
    getProjectIconKey,
    isProjectUsable,
    sortProjects,
    type ProjectIconKey,
} from './projectHubMeta';

type Surface = 'entry' | 'wizard';
type WizardStep = 'basics' | 'environment' | 'connection' | 'review';
type ConnectionMode = 'existing' | 'new';

interface ProjectHubProps {
    overlay?: boolean;
    onClose?: () => void;
}

interface WizardDraft {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
    starterEnv: EnvironmentKey;
}

const STEP_ORDER: WizardStep[] = ['basics', 'environment', 'connection', 'review'];

const ProjectWizard: React.FC<{ overlay?: boolean; onClose?: () => void; onDone: () => void }> = ({ overlay = false, onClose, onDone }) => {
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
        starterEnv: 'loc',
    });
    const [connectionMode, setConnectionMode] = React.useState<ConnectionMode>('existing');
    const [selectedProfile, setSelectedProfile] = React.useState<ConnectionProfile | null>(null);
    const [selectedProfileName, setSelectedProfileName] = React.useState<string | null>(null);
    const [selectedDatabase, setSelectedDatabase] = React.useState('');
    const [providerFilter, setProviderFilter] = React.useState('');
    const [isSelectingProvider, setIsSelectingProvider] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);

    const handleSelectFromTree = React.useCallback((profile: ConnectionProfile, database: string) => {
        setSelectedProfile(profile);
        setSelectedProfileName(profile.name || null);
        setSelectedDatabase(database);
    }, []);

    const existingNames = React.useMemo(() => {
        return [];
    }, []);
    const form = useConnectionForm({
        existingNames,
        onSaved: async () => {
            const savedName = form.formData.name || '';
            if (savedName) {
                setSelectedProfileName(savedName);
            }
            setSelectedProfile(form.formData as ConnectionProfile);
            if (form.formData.db_name) {
                setSelectedDatabase(form.formData.db_name);
            }
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

    const canGoNext = React.useMemo(() => {
        if (step === 'basics') return Boolean(draft.name.trim());
        if (step === 'environment') return Boolean(draft.starterEnv);
        if (step === 'connection') return Boolean(selectedProfileName && selectedDatabase.trim());
        return true;
    }, [draft.name, draft.starterEnv, selectedProfileName, selectedDatabase, step]);

    const stepIndex = STEP_ORDER.indexOf(step);
    const DraftIcon = PROJECT_ICON_MAP[draft.iconKey].icon;
    const draftIconLabel = PROJECT_ICON_MAP[draft.iconKey].label;

    const goNext = () => {
        if (!canGoNext) return;
        const next = STEP_ORDER[stepIndex + 1];
        if (next) setStep(next);
    };

    const goBack = () => {
        const prev = STEP_ORDER[stepIndex - 1];
        if (prev) setStep(prev);
    };

    const handleCreateAndEnter = async () => {
        if (!selectedProfileName || !selectedProfile) return;

        setSubmitting(true);
        try {
            try {
                await Disconnect();
            } catch {
                // ignore
            }
            resetRuntime();

            const project = await createProject({
                name: draft.name.trim(),
                description: draft.description.trim(),
                tags: buildTagsWithProjectIcon([], draft.iconKey),
            });

            if (!project) {
                toast.error('Could not create project.');
                return;
            }

            setActiveProject(project);

            const dbName = selectedDatabase.trim();
            const boundProject = await bindEnvironmentConnection(draft.starterEnv, {
                ...selectedProfile,
                name: selectedProfileName,
                db_name: dbName,
            });

            if (!boundProject) {
                toast.error('Could not bind starter environment.');
                return;
            }

            const envProject = await setProjectEnvironment(draft.starterEnv);
            const finalProject = envProject || boundProject;
            setActiveProject(finalProject);
            setActiveEnvironment(draft.starterEnv);

            onDone();
        } catch (error) {
            toast.error(`Could not finish setup: ${error}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalFrame
            title={
                <>
                    {step === 'basics' && 'Create the project shell'}
                    {step === 'environment' && 'Pick the starter environment'}
                    {step === 'connection' && 'Bind one database'}
                    {step === 'review' && 'Review and enter workspace'}
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
                            <Button variant="solid" onClick={goBack} className="rounded-lg">
                                Back
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="rounded-lg"
                                disabled={!onClose}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>

                    {step !== 'review' ? (
                        <Button variant="primary" onClick={goNext} disabled={!canGoNext} className="rounded-lg px-5">
                            Continue
                        </Button>
                    ) : (
                        <Button
                            variant="success"
                            onClick={() => void handleCreateAndEnter()}
                            disabled={!selectedProfile || !selectedProfileName || !selectedDatabase || submitting}
                            className="rounded-lg px-5"
                        >
                            {submitting ? <><Spinner size={12} className="mr-2 text-white" /> Creating...</> : <>Create & enter</>}
                        </Button>
                    )}
                </>
            )}
        >
            <div className="py-4">
                {step === 'basics' && (
                    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
                        <div className="rounded-lg bg-bg-primary/25 p-5">
                            <div className="text-[12px] font-semibold text-text-secondary">Project details</div>
                            <div className="mt-4 grid gap-3">
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-text-primary">Project name</label>
                                    <Input
                                        value={draft.name}
                                        onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                                        placeholder="Payments Platform"
                                        className="h-11 rounded-lg bg-bg-secondary"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-text-primary">Description</label>
                                    <Input
                                        value={draft.description}
                                        onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                                        placeholder="Optional context for the team or future you"
                                        className="h-11 rounded-lg bg-bg-secondary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-text-primary">Icon</label>
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {PROJECT_ICON_OPTIONS.map((option) => {
                                            const OptionIcon = option.icon;
                                            const active = draft.iconKey === option.key;
                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() => setDraft((current) => ({ ...current, iconKey: option.key }))}
                                                    className={cn(
                                                        'cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors',
                                                        active ? 'bg-accent/10 text-text-primary' : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
                                                    )}
                                                >
                                                    <OptionIcon size={14} />
                                                    <span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'environment' && (
                    <div className="mx-auto grid max-w-[860px] gap-4 md:grid-cols-2">
                        {ENVIRONMENT_KEYS.map((envKey) => {
                            const meta = getEnvironmentMeta(envKey);
                            const active = draft.starterEnv === envKey;
                            return (
                                <button
                                    key={envKey}
                                    type="button"
                                    onClick={() => setDraft((current) => ({ ...current, starterEnv: envKey }))}
                                    className={cn(
                                        'cursor-pointer rounded-lg px-4 py-4 text-left transition-colors',
                                        envKey === 'pro' && 'md:col-span-2',
                                        active
                                            ? 'border-accent/40 bg-accent/8'
                                            : 'border-border/25 bg-bg-primary/20 hover:bg-bg-primary/40',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>
                                            {envKey}
                                        </span>
                                        {active && <BadgeCheck size={16} className="text-accent" />}
                                    </div>
                                    <div className="mt-4 text-[16px] font-semibold text-text-primary">{meta.label}</div>
                                    <p className="mt-2 text-[12px] leading-5 text-text-secondary">{meta.description}</p>
                                </button>
                            );
                        })}
                    </div>
                )}

                {step === 'connection' && (
                    <div className="mx-auto w-full max-w-[980px]">
                        <div className="flex min-h-[520px] flex-col rounded-lg bg-bg-primary/20">
                            {connectionMode === 'existing' ? (
                                <div className="flex-1 overflow-hidden px-4 py-3">
                                    <DatabaseTreePicker
                                        onSelect={handleSelectFromTree}
                                        selectedProfile={selectedProfileName}
                                        selectedDatabase={selectedDatabase}
                                        onAddNew={() => {
                                            form.resetForm();
                                            setConnectionMode('new');
                                            setIsSelectingProvider(true);
                                            setProviderFilter('');
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="relative grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] px-4 py-3">
                                    <ProviderPickerToolbar
                                        isSelectingProvider={isSelectingProvider}
                                        providerFilter={providerFilter}
                                        selectedProvider={selectedProvider}
                                        onBack={() => {
                                            setConnectionMode('existing');
                                            setIsSelectingProvider(false);
                                            setProviderFilter('');
                                        }}
                                        onShowProviderPicker={() => setIsSelectingProvider(true)}
                                        onProviderFilterChange={setProviderFilter}
                                        onClearProviderFilter={() => setProviderFilter('')}
                                    />

                                    {isSelectingProvider ? (
                                        <div className="h-full min-h-0 rounded-lg bg-bg-primary/15 p-2">
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
                                                            setConnectionMode('existing');
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
                        </div>
                    </div>
                )}

                {step === 'review' && (
                    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
                        <div className="rounded-lg bg-bg-primary/20 p-5">
                            <div className="space-y-3">
                                <div className="rounded-lg bg-bg-secondary px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Project</div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-primary/30">
                                            <DraftIcon size={14} className="text-text-primary" />
                                        </div>
                                        <div className="text-[16px] font-semibold text-text-primary">{draft.name.trim()}</div>
                                    </div>
                                    <div className="mt-1 text-[12px] text-text-secondary">
                                        {draft.description.trim() || draftIconLabel}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-bg-secondary px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Starter environment</div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', getEnvironmentMeta(draft.starterEnv).colorClass)}>
                                            {draft.starterEnv}
                                        </span>
                                        <span className="text-[16px] font-semibold text-text-primary">
                                            {getEnvironmentMeta(draft.starterEnv).label}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-[12px] text-text-secondary">
                                        First workspace will open in this context.
                                    </div>
                                </div>

                                <div className="rounded-lg bg-bg-secondary px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Connection</div>
                                    <div className="mt-2 text-[16px] font-semibold text-text-primary">
                                        {selectedProfileName || 'Missing connection'}
                                    </div>
                                    <div className="mt-1 text-[12px] text-text-secondary">
                                        {selectedDatabase || 'Pick a database'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ModalFrame>
    );
};

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, onClose }) => {
    const { projects, activeProject, isLoading, error, openProject, deleteProject, saveProject } = useProjectStore();
    const resetRuntime = useConnectionStore((state) => state.resetRuntime);
    const { toast } = useToast();
    const [surface, setSurface] = React.useState<Surface>('entry');
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);
    const [savingProjectId, setSavingProjectId] = React.useState<string | null>(null);
    const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
    const [editDraft, setEditDraft] = React.useState<{
        name: string;
        description: string;
        iconKey: ProjectIconKey;
    }>({
        name: '',
        description: '',
        iconKey: 'general',
    });

    const sortedProjects = React.useMemo(() => sortProjects(projects), [projects]);
    const recentProject = sortedProjects[0] || null;

    const handleOpenProject = async (projectId: string) => {
        setOpeningProjectId(projectId);
        try {
            try {
                await Disconnect();
            } catch {
                // ignore
            }

            const project = await openProject(projectId);
            if (!project) {
                resetRuntime();
                return;
            }

            resetRuntime();
            onClose?.();
        } catch (error) {
            resetRuntime();
            toast.error(`Could not open project: ${error}`);
        } finally {
            setOpeningProjectId(null);
        }
    };

    const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setDeletingProjectId(projectId);
        try {
            const success = await deleteProject(projectId);
            if (success) {
                toast.success('Project deleted');
            } else {
                toast.error('Failed to delete project');
            }
        } catch (error) {
            toast.error(`Could not delete project: ${error}`);
        } finally {
            setDeletingProjectId(null);
        }
    };

    const handleEditProject = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setEditingProjectId(project.id);
        setEditDraft({
            name: project.name,
            description: project.description || '',
            iconKey: getProjectIconKey(project),
        });
    };

    const handleSaveProjectDetails = async (project: Project) => {
        const nextName = editDraft.name.trim();
        if (!nextName) {
            toast.error('Project name is required.');
            return;
        }

        setSavingProjectId(project.id);
        try {
            const saved = await saveProject({
                ...project,
                name: nextName,
                description: editDraft.description.trim(),
                tags: buildTagsWithProjectIcon(project.tags, editDraft.iconKey),
            });

            if (!saved) {
                toast.error('Could not update project.');
                return;
            }

            setEditingProjectId(null);
            toast.success('Project updated');
        } catch (error) {
            toast.error(`Could not update project: ${error}`);
        } finally {
            setSavingProjectId(null);
        }
    };

    const content = (
        <div className={cn(
            'overflow-hidden bg-bg-secondary text-text-primary',
            overlay
                ? 'h-[620px] w-[40%] max-w-[calc(100vw-24px)] rounded-lg'
                : 'h-full w-full',
        )}>
            {surface === 'entry' ? (
                <div className="h-full min-h-0">
                    <ModalFrame
                        title="Projects"
                        onClose={overlay && onClose ? onClose : undefined}
                        className="h-full"
                        headerClassName="px-6 py-4"
                        bodyClassName="min-h-0 overflow-y-auto px-5 py-4"
                        titleClassName="text-[20px]"
                        footerClassName="px-5 py-2.5"
                        footer={(
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold text-text-secondary">Recent project</div>
                                    {recentProject ? (
                                        <button
                                            type="button"
                                            onClick={() => void handleOpenProject(recentProject.id)}
                                            disabled={openingProjectId !== null}
                                            className="mt-1 inline-flex max-w-full cursor-pointer items-center gap-2 truncate text-[13px] font-semibold text-accent transition-colors hover:text-accent-hover hover:underline disabled:opacity-50"
                                        >
                                            <span className="truncate">{recentProject.name}</span>
                                            {openingProjectId === recentProject.id && <Spinner size={12} className="text-accent" />}
                                        </button>
                                    ) : (
                                        <div className="mt-1 text-[12px] text-text-secondary">No recent project</div>
                                    )}
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                    <span className="text-[12px] text-text-secondary">Or create new one</span>
                                    <Button variant="primary" onClick={() => setSurface('wizard')} size="sm" className="rounded-lg px-4">
                                        Create
                                    </Button>
                                </div>
                            </div>
                        )}
                    >
                        {sortedProjects.length === 0 && !isLoading ? (
                            <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border/50 bg-bg-primary/30 px-6 text-center">
                                <div className="max-w-[340px]">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-bg-secondary text-text-primary">
                                        <Plus size={18} />
                                    </div>
                                    <div className="mt-4 text-[15px] font-semibold text-text-primary">No projects yet</div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedProjects.map((project) => {
                                    const envKey = project.last_active_environment_key || project.default_environment_key || 'loc';
                                    const envMeta = getEnvironmentMeta(envKey);
                                    const ready = isProjectUsable(project);
                                    const isCurrentProject = activeProject?.id === project.id;
                                    const isDeleting = deletingProjectId === project.id;
                                    const isOpening = openingProjectId === project.id;
                                    const isSaving = savingProjectId === project.id;
                                    const isEditing = editingProjectId === project.id;
                                    const iconOption = PROJECT_ICON_MAP[getProjectIconKey(project)];
                                    const ProjectIcon = iconOption.icon;

                                    if (isEditing) {
                                        return (
                                            <div key={project.id} className="rounded-lg bg-bg-primary/50 px-5 py-5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary text-text-primary">
                                                            {React.createElement(PROJECT_ICON_MAP[editDraft.iconKey].icon, { size: 16 })}
                                                        </div>
                                                        <div>
                                                            <div className="text-[14px] font-semibold text-text-primary">Edit project details</div>
                                                            <div className="text-[11px] text-text-secondary">Update name, description, and icon</div>
                                                        </div>
                                                    </div>
                                                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>
                                                        {envKey}
                                                    </span>
                                                </div>

                                                <div className="mt-4 grid gap-3">
                                                    <div>
                                                        <label className="mb-1.5 block text-[12px] font-semibold text-text-primary">Project name</label>
                                                        <Input
                                                            value={editDraft.name}
                                                            onChange={(e) => setEditDraft((current) => ({ ...current, name: e.target.value }))}
                                                            className="h-10 rounded-lg bg-bg-secondary"
                                                            placeholder="Project name"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-[12px] font-semibold text-text-primary">Description</label>
                                                        <Input
                                                            value={editDraft.description}
                                                            onChange={(e) => setEditDraft((current) => ({ ...current, description: e.target.value }))}
                                                            className="h-10 rounded-lg bg-bg-secondary"
                                                            placeholder="Short context about this project"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    <div className="text-[12px] font-semibold text-text-primary">Project icon by domain</div>
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                                        {PROJECT_ICON_OPTIONS.map((option) => {
                                                            const OptionIcon = option.icon;
                                                            const active = editDraft.iconKey === option.key;
                                                            return (
                                                                <button
                                                                    key={option.key}
                                                                    type="button"
                                                                    onClick={() => setEditDraft((current) => ({ ...current, iconKey: option.key }))}
                                                                    className={cn(
                                                                        'cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors',
                                                                        active
                                                                            ? 'border-accent/50 bg-accent/10 text-text-primary'
                                                                            : 'border-border/30 bg-bg-secondary text-text-secondary hover:text-text-primary',
                                                                    )}
                                                                >
                                                                    <OptionIcon size={14} />
                                                                    <span>{option.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setEditingProjectId(null)}
                                                        disabled={isSaving}
                                                        className="rounded-lg"
                                                    >
                                                        <X size={14} /> Cancel
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => void handleSaveProjectDetails(project)}
                                                        disabled={isSaving || !editDraft.name.trim()}
                                                        className="rounded-lg"
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <Spinner size={12} className="mr-1 text-white" /> Saving...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Check size={14} /> Save changes
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => !isDeleting && void handleOpenProject(project.id)}
                                            disabled={isOpening || isDeleting}
                                            className={cn(
                                                'group relative w-full cursor-pointer rounded-lg bg-bg-primary/35 px-4 py-3.5 pr-24 text-left transition-colors hover:bg-bg-primary/60',
                                                isCurrentProject && 'border border-accent/45',
                                            )}
                                        >
                                            <div className="absolute top-3 right-3">
                                                <div className="gap-1 flex">
                                                    <span
                                                        className={cn(
                                                            'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                                            ready
                                                                ? 'border-success/30 bg-success/10 text-success'
                                                                : 'border-amber-400/30 bg-amber-400/10 text-amber-300',
                                                        )}
                                                    >
                                                        {ready ? 'Ready' : 'Needs setup'}
                                                    </span>
                                                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>
                                                        {envKey}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-4">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-text-primary">
                                                    <ProjectIcon size={16} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="truncate text-[15px] font-semibold text-text-primary">{project.name}</div>
                                                    </div>
                                                    {project.description && (
                                                        <p className="m-0 mt-1 line-clamp-1 text-[12px] text-text-secondary">{project.description}</p>
                                                    )}
                                                    <div className="mt-3 flex items-center gap-3 text-[11px] text-text-secondary">
                                                        <span>{project.environments?.length ?? 0} environments</span>
                                                        <span>{project.connections?.length ?? 0} bindings</span>
                                                        <span>{formatDateLabel(project.updated_at)}</span>
                                                    </div>
                                                </div>
                                                <div className="absolute right-3 bottom-3 shrink-0 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleEditProject(e, project)}
                                                        disabled={isDeleting || isOpening}
                                                        className="cursor-pointer rounded-lg p-1.5 text-text-secondary opacity-0 transition-all hover:bg-accent/10 hover:text-accent group-hover:opacity-100 disabled:opacity-50"
                                                        title="Edit project"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => void handleDeleteProject(e, project.id)}
                                                        disabled={isDeleting || isOpening}
                                                        className="cursor-pointer rounded-lg p-1.5 text-text-secondary opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100 disabled:opacity-50"
                                                        title="Delete project"
                                                    >
                                                        {isDeleting ? <Spinner size={14} /> : <Trash2 size={14} />}
                                                    </button>
                                                    {isOpening && <Spinner size={14} className="text-text-secondary" />}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                                {error && (
                                    <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-[12px] text-error">
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}
                    </ModalFrame>
                </div>
            ) : (
                <ProjectWizard
                    overlay={overlay}
                    onClose={overlay ? onClose : () => setSurface('entry')}
                    onDone={() => onClose?.()}
                />
            )}
        </div>
    );

    if (overlay) {
        return (
            <ModalBackdrop onClose={onClose} contentClassName="flex w-full items-center justify-center p-3">
                {content}
            </ModalBackdrop>
        );
    }

    return content;
};

