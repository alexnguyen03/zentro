import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { Disconnect } from '../../../services/connectionService';
import { useProjectStore } from '../../../stores/projectStore';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../../lib/projects';
import { useConnectionForm } from '../../../hooks/useConnectionForm';
import { ConnectionForm } from '../../connection/ConnectionForm';
import { ProviderPickerToolbar } from '../../connection/ProviderPickerToolbar';
import { ProviderGrid } from '../../connection/ProviderGrid';
import { Button, Input, ModalFrame, Spinner } from '../../ui';
import { DatabaseTreePicker } from '../../ui/DatabaseTreePicker';
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

type WizardStep = 'basics' | 'environment' | 'connection' | 'review';
type ConnectionMode = 'existing' | 'new';

const STEP_ORDER: WizardStep[] = ['basics', 'environment', 'connection', 'review'];

interface WizardDraft {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
    starterEnv: EnvironmentKey;
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

    const handleSelectFromTree = React.useCallback((profile: ConnectionProfile, database: string) => {
        setSelectedProfile(profile);
        setSelectedProfileName(profile.name || null);
        setSelectedDatabase(database);
    }, []);

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

    const canGoNext = React.useMemo(() => {
        if (step === 'basics') return Boolean(draft.name.trim());
        if (step === 'environment') return Boolean(draft.starterEnv);
        if (step === 'connection') return Boolean(selectedProfileName && selectedDatabase.trim());
        return true;
    }, [draft.name, draft.starterEnv, selectedProfileName, selectedDatabase, step]);

    const stepIndex = STEP_ORDER.indexOf(step);
    const DraftIcon = PROJECT_ICON_MAP[draft.iconKey].icon;
    const draftIconLabel = PROJECT_ICON_MAP[draft.iconKey].label;

    const goNext = () => { if (!canGoNext) return; const next = STEP_ORDER[stepIndex + 1]; if (next) setStep(next); };
    const goBack = () => { const prev = STEP_ORDER[stepIndex - 1]; if (prev) setStep(prev); };

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
                            <Button variant="solid" onClick={goBack} className="rounded-md">Back</Button>
                        ) : (
                            <Button variant="ghost" onClick={onClose} className="rounded-md" disabled={!onClose}>Cancel</Button>
                        )}
                    </div>
                    {step !== 'review' ? (
                        <Button variant="primary" onClick={goNext} disabled={!canGoNext} className="rounded-md px-5">Continue</Button>
                    ) : (
                        <Button
                            variant="success"
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
            <div className="py-4">
                {/* Step: basics */}
                {step === 'basics' && (
                    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
                        <div className="rounded-md bg-bg-primary/25 p-5">
                            <div className="text-[12px] font-semibold text-text-secondary">Project details</div>
                            <div className="mt-4 grid gap-3">
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-text-primary">Project name</label>
                                    <Input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Payments Platform" className="h-11 rounded-md bg-bg-secondary" autoFocus />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-text-primary">Description</label>
                                    <Input value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Optional context for the team or future you" className="h-11 rounded-md bg-bg-secondary" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[12px] font-semibold text-text-primary">Icon</label>
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {PROJECT_ICON_OPTIONS.map((option) => {
                                            const OptionIcon = option.icon;
                                            const active = draft.iconKey === option.key;
                                            return (
                                                <button
                                                    key={option.key} type="button"
                                                    onClick={() => setDraft((c) => ({ ...c, iconKey: option.key }))}
                                                    className={cn('cursor-pointer flex items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] transition-colors', active ? 'bg-accent/10 text-text-primary' : 'bg-bg-secondary text-text-secondary hover:text-text-primary')}
                                                >
                                                    <OptionIcon size={14} /><span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step: environment */}
                {step === 'environment' && (
                    <div className="mx-auto grid max-w-[860px] gap-4 md:grid-cols-2">
                        {ENVIRONMENT_KEYS.map((envKey) => {
                            const meta = getEnvironmentMeta(envKey);
                            const active = draft.starterEnv === envKey;
                            return (
                                <button
                                    key={envKey} type="button"
                                    onClick={() => setDraft((c) => ({ ...c, starterEnv: envKey }))}
                                    className={cn('cursor-pointer rounded-md px-4 py-4 text-left transition-colors', envKey === ENVIRONMENT_KEY.PRODUCTION && 'md:col-span-2', active ? 'border-accent/40 bg-accent/8' : 'border-border/25 bg-bg-primary/20 hover:bg-bg-primary/40')}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>{envKey}</span>
                                        {active && <BadgeCheck size={16} className="text-accent" />}
                                    </div>
                                    <div className="mt-4 text-[16px] font-semibold text-text-primary">{meta.label}</div>
                                    <p className="mt-2 text-[12px] leading-5 text-text-secondary">{meta.description}</p>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Step: connection */}
                {step === 'connection' && (
                    <div className="mx-auto w-full max-w-[980px]">
                        <div className="flex min-h-[520px] flex-col rounded-md bg-bg-primary/20">
                            {connectionMode === 'existing' ? (
                                <div className="flex-1 overflow-hidden px-4 py-3">
                                    <DatabaseTreePicker
                                        onSelect={handleSelectFromTree}
                                        selectedProfile={selectedProfileName}
                                        selectedDatabase={selectedDatabase}
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
                                    />
                                    {isSelectingProvider ? (
                                        <div className="h-full min-h-0 rounded-md bg-bg-primary/15 p-2">
                                            <ProviderGrid selected={form.selectedProvider} locked={form.isEditing} filterText={providerFilter} onSelect={handleProviderSelect} />
                                        </div>
                                    ) : (
                                        <div className="h-full overflow-y-auto">
                                            <div className="mx-auto flex min-h-full w-full max-w-[620px] items-start justify-center">
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
                    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
                        <div className="rounded-md bg-bg-primary/20 p-5">
                            <div className="space-y-3">
                                <div className="rounded-md bg-bg-secondary px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Project</div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-primary/30">
                                            <DraftIcon size={14} className="text-text-primary" />
                                        </div>
                                        <div className="text-[16px] font-semibold text-text-primary">{draft.name.trim()}</div>
                                    </div>
                                    <div className="mt-1 text-[12px] text-text-secondary">{draft.description.trim() || draftIconLabel}</div>
                                </div>
                                <div className="rounded-md bg-bg-secondary px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Starter environment</div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', getEnvironmentMeta(draft.starterEnv).colorClass)}>{draft.starterEnv}</span>
                                        <span className="text-[16px] font-semibold text-text-primary">{getEnvironmentMeta(draft.starterEnv).label}</span>
                                    </div>
                                    <div className="mt-1 text-[12px] text-text-secondary">First workspace will open in this context.</div>
                                </div>
                                <div className="rounded-md bg-bg-secondary px-4 py-4">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Connection</div>
                                    <div className="mt-2 text-[16px] font-semibold text-text-primary">{selectedProfileName || 'Missing connection'}</div>
                                    <div className="mt-1 text-[12px] text-text-secondary">{selectedDatabase || 'Pick a database'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ModalFrame>
    );
};
