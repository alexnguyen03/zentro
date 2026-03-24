import React from 'react';
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    CheckCircle2,
    FolderPlus,
    Layers3,
    Plus,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { Disconnect, LoadConnections } from '../../../wailsjs/go/app/App';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../lib/projects';
import { useConnectionForm } from '../../hooks/useConnectionForm';
import { ProviderGrid } from '../connection/ProviderGrid';
import { ConnectionForm } from '../connection/ConnectionForm';
import { Button, Input, ModalBackdrop, Spinner } from '../ui';
import { DatabaseTreePicker } from '../ui/DatabaseTreePicker';
import { cn } from '../../lib/cn';
import type { EnvironmentKey, Project } from '../../types/project';
import type { ConnectionProfile } from '../../types/connection';
import { useToast } from './Toast';

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
    starterEnv: EnvironmentKey;
}

const STEP_ORDER: WizardStep[] = ['basics', 'environment', 'connection', 'review'];

function formatDateLabel(value?: string) {
    if (!value) return 'Recently updated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently updated';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function isProjectUsable(project: Project | null | undefined) {
    if (!project) return false;
    return Boolean(project.connections?.length);
}

function sortProjects(projects: Project[]) {
    return [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

function WizardRail({
    currentStep,
    draft,
    selectedProfileName,
    selectedDatabase,
}: {
    currentStep: WizardStep;
    draft: WizardDraft;
    selectedProfileName: string | null;
    selectedDatabase: string;
}) {
    return (
        <aside className="flex flex-col border-r border-border/20 bg-bg-primary/35 px-7 py-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-bg-secondary px-3 py-1 text-[11px] font-semibold text-text-secondary">
                <Sparkles size={12} />
                New Project Flow
            </div>

            <div className="mt-6">
                <h2 className="m-0 text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-text-primary">
                    Smooth setup.
                    <br />
                    Query fast.
                </h2>
                <p className="mt-3 max-w-[290px] text-[13px] leading-6 text-text-secondary">
                    Create the project, choose a starter environment, bind a database, and land directly in a ready workspace.
                </p>
            </div>

            <div className="mt-8 space-y-3">
                {STEP_ORDER.map((step, index) => {
                    const done = STEP_ORDER.indexOf(currentStep) > index;
                    const active = currentStep === step;
                    const labels: Record<WizardStep, { title: string; desc: string }> = {
                        basics: { title: 'Project Basics', desc: draft.name || 'Name your project and set context.' },
                        environment: { title: 'Starter Environment', desc: getEnvironmentMeta(draft.starterEnv).label },
                        connection: {
                            title: 'Connect Database',
                            desc: selectedProfileName ? `${selectedProfileName} / ${selectedDatabase || 'Pick a database'}` : 'Choose a connection',
                        },
                        review: { title: 'Review & Enter', desc: 'Confirm the setup and open the workspace.' },
                    };

                    return (
                        <div
                            key={step}
                            className={cn(
                                'rounded-3xl border px-4 py-4 transition-colors',
                                active ? 'border-accent/40 bg-bg-secondary' : 'border-border/25 bg-bg-primary/20',
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={cn(
                                        'flex h-8 w-8 items-center justify-center rounded-2xl border text-[12px] font-bold',
                                        done
                                            ? 'border-success/40 bg-success/10 text-success'
                                            : active
                                                ? 'border-accent/40 bg-accent/10 text-accent'
                                                : 'border-border/30 bg-bg-secondary text-text-secondary',
                                    )}
                                >
                                    {done ? <CheckCircle2 size={14} /> : index + 1}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-text-primary">{labels[step].title}</div>
                                    <div className="mt-0.5 truncate text-[11px] text-text-secondary">{labels[step].desc}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-auto rounded-3xl border border-border/30 bg-bg-secondary px-5 py-4">
                <div className="text-[11px] font-semibold text-text-secondary">Outcome</div>
                <div className="mt-2 text-[15px] font-semibold text-text-primary">
                    Project {'->'} env {'->'} db {'->'} workspace
                </div>
                <p className="mt-2 text-[12px] leading-5 text-text-secondary">
                    We only require one starter environment so the first query path stays fast.
                </p>
            </div>
        </aside>
    );
}

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
        starterEnv: 'loc',
    });
    const [connectionMode, setConnectionMode] = React.useState<ConnectionMode>('existing');
    const [selectedProfileName, setSelectedProfileName] = React.useState<string | null>(null);
    const [selectedDatabase, setSelectedDatabase] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);

    const handleSelectFromTree = React.useCallback((profileName: string, database: string) => {
        setSelectedProfileName(profileName);
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
            setConnectionMode('existing');
        },
        onClose: () => {
            setConnectionMode('existing');
        },
    });

    const canGoNext = React.useMemo(() => {
        if (step === 'basics') return Boolean(draft.name.trim());
        if (step === 'environment') return Boolean(draft.starterEnv);
        if (step === 'connection') return Boolean(selectedProfileName && selectedDatabase.trim());
        return true;
    }, [draft.name, draft.starterEnv, selectedProfileName, selectedDatabase, step]);

    const stepIndex = STEP_ORDER.indexOf(step);

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
        if (!selectedProfileName) return;

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
                tags: [],
            });

            if (!project) {
                toast.error('Could not create project.');
                return;
            }

            setActiveProject(project);

            const dbName = selectedDatabase.trim();
            const boundProject = await bindEnvironmentConnection(draft.starterEnv, {
                name: selectedProfileName,
                db_name: dbName,
            } as ConnectionProfile);

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
        <div className="grid h-full md:grid-cols-[340px_1fr]">
            <WizardRail
                currentStep={step}
                draft={draft}
                selectedProfileName={selectedProfileName}
                selectedDatabase={selectedDatabase}
            />

            <section className="grid min-h-0 grid-rows-[auto_1fr_auto] bg-bg-secondary">
                <div className="flex items-center justify-between border-b border-border/20 px-8 py-6">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                            Step {stepIndex + 1} of {STEP_ORDER.length}
                        </div>
                        <h1 className="m-0 mt-1 text-[24px] font-bold tracking-tight text-text-primary">
                            {step === 'basics' && 'Create the project shell'}
                            {step === 'environment' && 'Pick the starter environment'}
                            {step === 'connection' && 'Bind one database'}
                            {step === 'review' && 'Review and enter workspace'}
                        </h1>
                        <p className="m-0 mt-2 text-[12px] leading-5 text-text-secondary">
                            {step === 'basics' && 'Give the project enough identity so it stays recognizable in the workspace.'}
                            {step === 'environment' && 'Choose the environment that should be ready first when the project opens.'}
                            {step === 'connection' && 'Use an existing connection or add a quick one inline without leaving the flow.'}
                            {step === 'review' && 'This starter setup is enough to enter the app and run your first query immediately.'}
                        </p>
                    </div>
                    {overlay && onClose && (
                        <Button variant="ghost" onClick={onClose} className="rounded-2xl">
                            Close
                        </Button>
                    )}
                </div>

                <div className="min-h-0 overflow-y-auto px-8 py-7">
                    {step === 'basics' && (
                        <div className="mx-auto flex max-w-[720px] flex-col gap-6">
                            <div className="rounded-[28px] border border-border/25 bg-bg-primary/25 p-6">
                                <div className="text-[12px] font-semibold text-text-secondary">Project details</div>
                                <div className="mt-5 grid gap-4">
                                    <div>
                                        <label className="mb-2 block text-[12px] font-semibold text-text-primary">Project name</label>
                                        <Input
                                            value={draft.name}
                                            onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                                            placeholder="Payments Platform"
                                            className="h-11 rounded-2xl bg-bg-secondary"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[12px] font-semibold text-text-primary">Description</label>
                                        <Input
                                            value={draft.description}
                                            onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                                            placeholder="Optional context for the team or future you"
                                            className="h-11 rounded-2xl bg-bg-secondary"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-border/25 bg-bg-primary/20 px-6 py-5">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                                    Preview
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/30 bg-bg-secondary">
                                        <FolderPlus size={18} className="text-text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-[16px] font-semibold text-text-primary">
                                            {draft.name.trim() || 'Untitled Project'}
                                        </div>
                                        <div className="mt-1 truncate text-[12px] text-text-secondary">
                                            {draft.description.trim() || 'Starter project ready for its first environment'}
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
                                            'rounded-[28px] border px-5 py-5 text-left transition-colors',
                                            active
                                                ? 'border-accent/40 bg-accent/8'
                                                : 'border-border/25 bg-bg-primary/20 hover:border-border/50 hover:bg-bg-primary/40',
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
                            <div className="flex min-h-[520px] flex-col rounded-[30px] border border-border/25 bg-bg-primary/20">
                                <div className="flex items-center gap-2 border-b border-border/15 px-5 py-4">
                                    <button
                                        type="button"
                                        onClick={() => setConnectionMode('existing')}
                                        className={cn(
                                            'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                                            connectionMode === 'existing'
                                                ? 'bg-accent text-white'
                                                : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
                                        )}
                                    >
                                        Pick from saved
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            form.resetForm();
                                            setConnectionMode('new');
                                        }}
                                        className={cn(
                                            'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                                            connectionMode === 'new'
                                                ? 'bg-accent text-white'
                                                : 'bg-bg-secondary text-text-secondary hover:text-text-primary',
                                        )}
                                    >
                                        New connection
                                    </button>
                                </div>

                                {connectionMode === 'existing' ? (
                                    <div className="flex-1 overflow-hidden px-5 py-5">
                                        <DatabaseTreePicker
                                            onSelect={handleSelectFromTree}
                                            selectedProfile={selectedProfileName}
                                            selectedDatabase={selectedDatabase}
                                        />
                                    </div>
                                ) : (
                                    <div className="grid min-h-0 flex-1 grid-cols-[168px_1fr] overflow-hidden">
                                        <div className="border-r border-border/15">
                                            <div className="px-4 pt-4 pb-2 text-[11px] font-semibold text-text-secondary">Provider</div>
                                            <ProviderGrid
                                                selected={form.selectedProvider}
                                                locked={form.isEditing}
                                                onSelect={form.handleDriverChange}
                                            />
                                        </div>
                                        <div className="min-h-0 overflow-y-auto">
                                            <div className="px-5 pt-5 text-[12px] font-semibold text-text-primary">Quick connection</div>
                                            <div className="px-5 pb-5 text-[11px] text-text-secondary">
                                                Save a new connection and select its database.
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
                                                onCancel={() => setConnectionMode('existing')}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="mx-auto flex max-w-[760px] flex-col gap-5">
                            <div className="rounded-[30px] border border-border/25 bg-bg-primary/20 px-6 py-6">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                                    Ready to create
                                </div>
                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                    <div className="rounded-[24px] border border-border/25 bg-bg-secondary px-4 py-4">
                                        <div className="text-[11px] font-semibold text-text-secondary">Project</div>
                                        <div className="mt-2 text-[16px] font-semibold text-text-primary">{draft.name.trim()}</div>
                                        <div className="mt-1 text-[12px] text-text-secondary">
                                            {draft.description.trim() || 'No description'}
                                        </div>
                                    </div>
                                    <div className="rounded-[24px] border border-border/25 bg-bg-secondary px-4 py-4">
                                        <div className="text-[11px] font-semibold text-text-secondary">Starter environment</div>
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
                                    <div className="rounded-[24px] border border-border/25 bg-bg-secondary px-4 py-4">
                                        <div className="text-[11px] font-semibold text-text-secondary">Connection</div>
                                        <div className="mt-2 text-[16px] font-semibold text-text-primary">
                                            {selectedProfileName || 'Missing connection'}
                                        </div>
                                        <div className="mt-1 text-[12px] text-text-secondary">
                                            {selectedDatabase || 'Pick a database'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[30px] border border-border/25 bg-bg-primary/18 px-6 py-5">
                                <div className="text-[12px] font-semibold text-text-primary">What happens next</div>
                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-border/20 bg-bg-secondary px-4 py-4 text-[12px] text-text-secondary">
                                        Create the project and set the starter environment as active.
                                    </div>
                                    <div className="rounded-2xl border border-border/20 bg-bg-secondary px-4 py-4 text-[12px] text-text-secondary">
                                        Bind the selected connection and database to that environment.
                                    </div>
                                    <div className="rounded-2xl border border-border/20 bg-bg-secondary px-4 py-4 text-[12px] text-text-secondary">
                                        Connect runtime and land directly in the workspace.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-border/20 px-8 py-5">
                    <div className="flex items-center gap-3">
                        {step !== 'basics' ? (
                            <Button variant="solid" onClick={goBack} className="rounded-2xl">
                                <ArrowLeft size={14} /> Back
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="rounded-2xl"
                                disabled={!onClose}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>

                    {step !== 'review' ? (
                        <Button variant="primary" onClick={goNext} disabled={!canGoNext} className="rounded-2xl px-5">
                            Continue <ArrowRight size={14} />
                        </Button>
                    ) : (
                        <Button
                            variant="success"
                            onClick={() => void handleCreateAndEnter()}
                            disabled={!selectedProfileName || !selectedDatabase || submitting}
                            className="rounded-2xl px-5"
                        >
                            {submitting ? <><Spinner size={12} className="mr-2 text-white" /> Creating...</> : <>Create project and enter <ArrowRight size={14} /></>}
                        </Button>
                    )}
                </div>
            </section>
        </div>
    );
};

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, onClose }) => {
    const { projects, isLoading, error, openProject, deleteProject } = useProjectStore();
    const resetRuntime = useConnectionStore((state) => state.resetRuntime);
    const { toast } = useToast();
    const [surface, setSurface] = React.useState<Surface>('entry');
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);

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

    const content = (
        <div className={cn(
            'overflow-hidden bg-bg-secondary text-text-primary',
            overlay
                ? 'h-[720px] w-[1080px] max-w-[calc(100vw-48px)] rounded-[32px] border border-border/40'
                : 'h-full w-full',
        )}>
            {surface === 'entry' ? (
                <div className="grid h-full md:grid-cols-[0.86fr_1.14fr]">
                    <section className="flex flex-col border-r border-border/20 bg-bg-primary/40 px-8 py-8">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/50 bg-bg-secondary px-3 py-1 text-[11px] font-semibold text-text-secondary">
                            <Layers3 size={12} />
                            Project Entry
                        </div>

                        <div className="mt-7">
                            <h1 className="m-0 max-w-[310px] text-[36px] font-black leading-[1.02] tracking-[-0.05em] text-text-primary">
                                Open work fast.
                                <br />
                                Setup only once.
                            </h1>
                            <p className="mt-3 max-w-[340px] text-[13px] leading-6 text-text-secondary">
                                Existing projects resume immediately. New projects use a guided setup that binds one environment and one database before you land in the workspace.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-3">
                            <div className="rounded-3xl border border-border/40 bg-bg-secondary px-5 py-4">
                                <div className="text-[11px] font-semibold text-text-secondary">Fast path</div>
                                <div className="mt-2 text-[14px] font-semibold text-text-primary">
                                    Project {'->'} resume workspace
                                </div>
                            </div>
                            <div className="rounded-3xl border border-border/40 bg-bg-secondary px-5 py-4">
                                <div className="text-[11px] font-semibold text-text-secondary">New setup</div>
                                <div className="mt-2 text-[14px] font-semibold text-text-primary">
                                    Create {'->'} choose env {'->'} bind db {'->'} enter
                                </div>
                            </div>
                        </div>

                        {recentProject && (
                            <button
                                type="button"
                                onClick={() => void handleOpenProject(recentProject.id)}
                                disabled={openingProjectId !== null}
                                className="mt-auto rounded-3xl border border-border/40 bg-bg-secondary px-5 py-5 text-left transition-colors hover:border-accent/40 hover:bg-bg-primary"
                            >
                                <div className="text-[11px] font-semibold text-text-secondary">Jump back in</div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-[18px] font-bold tracking-tight text-text-primary">{recentProject.name}</div>
                                        <div className="mt-1 flex items-center gap-2 text-[12px] text-text-secondary">
                                            <span>Updated {formatDateLabel(recentProject.updated_at)}</span>
                                            {isProjectUsable(recentProject) && (
                                                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                                                    Ready
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/40 bg-bg-primary text-text-primary">
                                        {openingProjectId === recentProject.id ? <Spinner size={14} /> : <ArrowRight size={16} />}
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
                                    Pick an existing project to resume, or start a guided setup for a new one.
                                </p>
                            </div>
                            {overlay && onClose && (
                                <Button variant="ghost" size="sm" onClick={onClose}>
                                    Close
                                </Button>
                            )}
                        </div>

                        <div className="min-h-0 overflow-y-auto px-6 py-5">
                            {sortedProjects.length === 0 && !isLoading ? (
                                <div className="flex h-full min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-border/50 bg-bg-primary/30 px-6 text-center">
                                    <div className="max-w-[340px]">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-bg-secondary text-text-primary">
                                            <Plus size={18} />
                                        </div>
                                        <div className="mt-4 text-[16px] font-semibold text-text-primary">No projects yet</div>
                                        <p className="mt-2 text-[12px] leading-5 text-text-secondary">
                                            Start the first project with a guided setup. We will only ask for the minimum needed to enter the app ready to query.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sortedProjects.map((project) => {
                                        const envKey = project.last_active_environment_key || project.default_environment_key || 'loc';
                                        const envMeta = getEnvironmentMeta(envKey);
                                        const ready = isProjectUsable(project);
                                        const isDeleting = deletingProjectId === project.id;
                                        const isOpening = openingProjectId === project.id;
                                        return (
                                            <button
                                                key={project.id}
                                                type="button"
                                                onClick={() => !isDeleting && void handleOpenProject(project.id)}
                                                disabled={isOpening || isDeleting}
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
                                                    <div className="shrink-0 flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => void handleDeleteProject(e, project.id)}
                                                            disabled={isDeleting || isOpening}
                                                            className="rounded-lg p-1.5 text-text-secondary opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100 disabled:opacity-50"
                                                            title="Delete project"
                                                        >
                                                            {isDeleting ? <Spinner size={14} /> : <Trash2 size={14} />}
                                                        </button>
                                                        <div className="text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary">
                                                            {isOpening ? <Spinner size={14} /> : <ArrowRight size={16} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {error && (
                                        <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-[12px] text-error">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border/20 bg-bg-primary/20 px-6 py-5">
                            <div className="flex items-center justify-between gap-3 rounded-3xl border border-border/25 bg-bg-secondary px-5 py-4">
                                <div>
                                    <div className="flex items-center gap-2 text-[12px] font-semibold text-text-primary">
                                        <FolderPlus size={13} />
                                        Create a new project
                                    </div>
                                    <div className="mt-1 text-[11px] text-text-secondary">
                                        Guided setup with one starter environment and one bound database.
                                    </div>
                                </div>
                                <Button variant="primary" onClick={() => setSurface('wizard')} className="rounded-2xl px-5">
                                    Start setup
                                </Button>
                            </div>
                        </div>
                    </section>
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
            <ModalBackdrop onClose={onClose}>
                <div onClick={(e) => e.stopPropagation()}>{content}</div>
            </ModalBackdrop>
        );
    }

    return content;
};
