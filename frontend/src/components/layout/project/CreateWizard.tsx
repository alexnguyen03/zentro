import React from 'react';
import { Download, X } from 'lucide-react';
import { Button, Spinner, Input } from '../../ui';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../../lib/projects';
import { cn } from '../../../lib/cn';
import type { EnvironmentKey } from '../../../types/project';
import type { ConnectionProfile } from '../../../types/connection';
import type { UseConnectionFormReturn } from '../../../hooks/useConnectionForm';
import type { ProjectIconKey } from '../projectHubMeta';
import { ProjectIconPicker } from './ProjectIconPicker';
import { WizardStorageField } from './WizardStorageField';
import { EnvConnectionPanel } from './EnvConnectionPanel';
import type { Project } from '../../../types/project';

interface DraftEnvironmentBinding {
    profile: ConnectionProfile;
    profileName: string;
    database: string;
}

export interface WizardDraftData {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
}

interface WizardProps {
    mode?: 'create' | 'edit';
    // project info
    draft: WizardDraftData;
    onDraftChange: (draft: WizardDraftData) => void;
    // create-mode bindings (staged)
    draftEnvironmentBindings?: Partial<Record<EnvironmentKey, DraftEnvironmentBinding>>;
    onBind: (envKey: EnvironmentKey, profile: ConnectionProfile, database: string) => void;
    onUnbind?: (envKey: EnvironmentKey) => void;
    // edit-mode binding helpers
    getSelectedProfileName?: (envKey: EnvironmentKey) => string | null;
    getSelectedDatabase?: (envKey: EnvironmentKey) => string;
    isBoundInEdit?: (envKey: EnvironmentKey) => boolean;
    // storage
    storageParentPath?: string;
    storagePath?: string;
    storagePathPreview: string;
    loadingStorageRoot: boolean;
    pathConflictProject: Project | null;
    onStorageChange: (value: string) => void;
    onPickFolder: () => void | Promise<void>;
    // navigation
    initialStep?: 1 | 2;
    // submit
    submitting: boolean;
    exportingConnection?: boolean;
    onCancel: () => void;
    onSubmit: () => void | Promise<void>;
    onExport?: () => void | Promise<void>;
    // active env
    activeEnvKey: EnvironmentKey;
    onSetActiveEnvKey: (key: EnvironmentKey) => void;
    // connection panel
    connectionMode: 'existing' | 'new';
    isSelectingProvider: boolean;
    providerFilter: string;
    connections: ConnectionProfile[];
    treeRefreshKey: number;
    importingConnection: boolean;
    importingFormConnection: boolean;
    deletingConnectionName: string | null;
    form: UseConnectionFormReturn;
    onAddNew: () => void;
    onImportConnection: () => void | Promise<void>;
    onEditConnection: (profile: ConnectionProfile) => void;
    onDeleteConnection?: (profile: ConnectionProfile) => void;
    onBack: () => void;
    onShowProviderPicker: () => void;
    onProviderFilterChange: (value: string) => void;
    onClearProviderFilter: () => void;
    onProviderSelect: (key: string) => void;
    onImportConnectionToForm: () => void | Promise<void>;
    onCancelForm: () => void;
}

export const ProjectWizardView: React.FC<WizardProps> = ({
    mode = 'create',
    draft,
    onDraftChange,
    draftEnvironmentBindings = {},
    onBind,
    onUnbind,
    getSelectedProfileName,
    getSelectedDatabase,
    isBoundInEdit,
    storageParentPath = '',
    storagePath = '',
    storagePathPreview,
    loadingStorageRoot,
    pathConflictProject,
    onStorageChange,
    onPickFolder,
    initialStep = 1,
    submitting,
    exportingConnection = false,
    onCancel,
    onSubmit,
    onExport,
    activeEnvKey,
    onSetActiveEnvKey,
    connectionMode,
    isSelectingProvider,
    providerFilter,
    connections,
    treeRefreshKey,
    importingConnection,
    importingFormConnection,
    deletingConnectionName,
    form,
    onAddNew,
    onImportConnection,
    onEditConnection,
    onDeleteConnection,
    onBack,
    onShowProviderPicker,
    onProviderFilterChange,
    onClearProviderFilter,
    onProviderSelect,
    onImportConnectionToForm,
    onCancelForm,
}) => {
    const isEdit = mode === 'edit';
    const [step, setStep] = React.useState<1 | 2>(initialStep);

    // Bound env resolution per mode
    const isBound = (envKey: EnvironmentKey): boolean => {
        if (isEdit) return isBoundInEdit?.(envKey) ?? false;
        return Boolean(draftEnvironmentBindings[envKey]);
    };

    const boundEnvKeys = ENVIRONMENT_KEYS.filter(isBound);
    const canProceedStep1 = Boolean(draft.name.trim());
    const canSubmit = isEdit
        ? canProceedStep1 && !submitting
        : canProceedStep1 && boundEnvKeys.length > 0 && !submitting;

    // Selected profile/db for the right panel
    const selectedProfileName = isEdit
        ? (getSelectedProfileName?.(activeEnvKey) ?? null)
        : (draftEnvironmentBindings[activeEnvKey]?.profileName ?? null);
    const selectedDatabase = isEdit
        ? (getSelectedDatabase?.(activeEnvKey) ?? '')
        : (draftEnvironmentBindings[activeEnvKey]?.database ?? '');

    const subtitles = {
        1: isEdit ? 'Update the project name, description, and storage path.' : 'Name your project and choose a storage location.',
        2: isEdit ? 'Bind each environment to a database connection.' : 'Bind at least one environment to a database connection.',
    } as const;

    const StepIndicator = () => (
        <div className="flex items-center gap-1">
            {([1, 2] as const).map((n) => (
                <span
                    key={n}
                    className={cn(
                        'h-1.5 w-1.5 rounded-full transition-colors',
                        step === n ? 'bg-primary' : step > n ? 'bg-primary/40' : 'bg-muted-foreground/25',
                    )}
                />
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">{step} / 2</span>
        </div>
    );

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="shrink-0 border-b border-border/20 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-[14px] font-semibold text-foreground">
                            {isEdit ? 'Edit project' : 'Create project'}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitles[step]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <StepIndicator />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onCancel}
                            disabled={submitting}
                            className="  rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Close"
                        >
                            <X size={16} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className={cn('min-h-0 flex-1', step === 2 ? 'overflow-hidden' : 'flex items-center justify-center overflow-y-auto px-6 py-4')}>
                {/* Step 1 — General + Storage */}
                {step === 1 && (
                    <div className="w-full max-w-sm flex flex-col gap-4">
                        {/* Row 1 — Icon */}
                        <div className="flex justify-center">
                            <ProjectIconPicker
                                value={draft.iconKey}
                                onChange={(key) => onDraftChange({ ...draft, iconKey: key })}
                            />
                        </div>

                        {/* Row 2 — Name + Description */}
                        <div className="flex flex-col gap-2">
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                                    Project name <span className="text-destructive">*</span>
                                </label>
                                <Input
                                    value={draft.name}
                                    onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
                                    placeholder="Payments Platform"
                                    size="sm"
                                    className="bg-card w-full"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Description</label>
                                <Input
                                    value={draft.description}
                                    onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
                                    placeholder="Optional context"
                                    size="sm"
                                    className="bg-card w-full"
                                />
                            </div>
                        </div>

                        {/* Row 3 — Storage */}
                        <div>
                            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                                Storage location
                                <span className="ml-1 text-muted-foreground/60">(optional)</span>
                            </label>
                            <WizardStorageField
                                mode={isEdit ? 'edit' : 'create'}
                                storageParentPath={storageParentPath}
                                storagePath={storagePath}
                                storagePathPreview={storagePathPreview}
                                loadingRoot={loadingStorageRoot}
                                pathConflictProject={pathConflictProject}
                                onChange={onStorageChange}
                                onPickFolder={onPickFolder}
                            />
                        </div>
                    </div>
                )}

                {/* Step 2 — Bind Environments (side-by-side) */}
                {step === 2 && (
                    <div className="flex h-full min-h-0">
                        {/* Left env list */}
                        <div className="w-36 shrink-0 bg-background/50 overflow-y-auto py-1">
                            {ENVIRONMENT_KEYS.map((envKey) => {
                                const meta = getEnvironmentMeta(envKey);
                                const bound = isBound(envKey);
                                const active = activeEnvKey === envKey;
                                return (
                                    <Button
                                        key={envKey}
                                        type="button"
                                        onClick={() => onSetActiveEnvKey(envKey)}
                                        className={cn(
                                            'flex w-full items-center gap-1.5 border-r-2 px-2.5 py-2 text-[11px] transition-colors',
                                            active
                                                ? 'border-primary bg-accent/8 text-foreground'
                                                : 'border-transparent text-muted-foreground hover:bg-muted/40',
                                        )}
                                    >
                                        <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]', meta.colorClass)}>
                                            {envKey}
                                        </span>
                                        <span className="truncate">{meta.label}</span>
                                        <span className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full transition-colors', bound ? 'bg-success' : 'bg-transparent')} />
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Right config panel — remount on env switch */}
                        <div key={activeEnvKey} className="flex min-w-0 flex-1 flex-col min-h-0">
                            {/* Right panel header */}
                            <div className="shrink-0 flex items-center gap-1.5 border-b border-border/15 px-3 py-2">
                                {(() => {
                                    const meta = getEnvironmentMeta(activeEnvKey);
                                    const bound = isBound(activeEnvKey);
                                    return (
                                        <>
                                            <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]', meta.colorClass)}>
                                                {activeEnvKey}
                                            </span>
                                            <span className="text-[11px] font-medium text-foreground">{meta.label}</span>
                                            {bound ? (
                                                <>
                                                    <span className="ml-auto truncate text-[10px] text-muted-foreground/80">
                                                        {selectedProfileName}{selectedDatabase ? ` / ${selectedDatabase}` : ''}
                                                    </span>
                                                    {!isEdit && onUnbind && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onUnbind(activeEnvKey)}
                                                            className="ml-1 shrink-0 rounded px-1 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:bg-destructive/12 hover:text-destructive"
                                                        >
                                                            Unbind
                                                        </Button>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="ml-auto text-[10px] italic text-muted-foreground/40">Not bound</span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                            {/* Connection panel */}
                            <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                                <EnvConnectionPanel
                                    connectionMode={connectionMode}
                                    isSelectingProvider={isSelectingProvider}
                                    providerFilter={providerFilter}
                                    treeRefreshKey={treeRefreshKey}
                                    selectedProfileName={selectedProfileName}
                                    selectedDatabase={selectedDatabase}
                                    connections={connections}
                                    isEditMode={isEdit}
                                    importingConnection={importingConnection}
                                    importingFormConnection={importingFormConnection}
                                    deletingConnectionName={deletingConnectionName}
                                    form={form}
                                    onSelectFromTree={(profile, database) => onBind(activeEnvKey, profile, database)}
                                    onImportConnection={onImportConnection}
                                    onAddNew={onAddNew}
                                    onEditConnection={onEditConnection}
                                    onDeleteConnection={isEdit ? onDeleteConnection : undefined}
                                    onBack={onBack}
                                    onShowProviderPicker={onShowProviderPicker}
                                    onProviderFilterChange={onProviderFilterChange}
                                    onClearProviderFilter={onClearProviderFilter}
                                    onImportConnectionToForm={onImportConnectionToForm}
                                    onProviderSelect={onProviderSelect}
                                    onCancelForm={onCancelForm}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border/20 px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                    {/* Left side: export (edit only) or Cancel */}
                    <div className="flex items-center gap-1.5">
                        {isEdit && onExport ? (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => void onExport()}
                                disabled={exportingConnection || submitting}
                                className="rounded-sm"
                                title="Export selected environment connection"
                            >
                                {exportingConnection ? <Spinner size={12} /> : <Download size={13} />}
                            </Button>
                        ) : (
                            <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting} className="rounded-sm">
                                Cancel
                            </Button>
                        )}
                    </div>
                    {/* Right side: nav + submit */}
                    <div className="flex items-center gap-1.5">
                        {isEdit && step === 1 && (
                            <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting} className="rounded-sm">
                                Cancel
                            </Button>
                        )}
                        {step === 2 && (
                            <Button variant="ghost" size="sm" onClick={() => setStep(1)} disabled={submitting} className="rounded-sm">
                                Back
                            </Button>
                        )}
                        {step === 1 ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStep(2)}
                                    disabled={!canProceedStep1}
                                    className="rounded-sm px-4"
                                >
                                    Next
                                </Button>
                                {isEdit && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => void onSubmit()}
                                        disabled={!canProceedStep1 || submitting}
                                        className="rounded-sm px-4"
                                    >
                                        {submitting
                                            ? <><Spinner size={11} className="mr-1.5" />Saving...</>
                                            : 'Save & Apply'}
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => void onSubmit()}
                                disabled={!canSubmit}
                                className="rounded-sm px-4"
                            >
                                {submitting
                                    ? <><Spinner size={11} className="mr-1.5 text-white" />{isEdit ? 'Saving...' : 'Creating...'}</>
                                    : isEdit ? 'Save & Apply' : 'Create & Enter'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
