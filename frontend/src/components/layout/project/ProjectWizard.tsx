import React from 'react';
import {
    DeleteConnection,
    Disconnect,
    ExportConnectionPackage,
    ImportConnectionPackage,
    LoadConnections,
} from '../../../services/connectionService';
import { GetDefaultProjectStorageRoot, PickDirectory } from '../../../services/projectService';
import { useProjectStore } from '../../../stores/projectStore';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { ENVIRONMENT_KEYS, getEnvironmentMeta } from '../../../lib/projects';
import { useConnectionForm } from '../../../hooks/useConnectionForm';
import { ConfirmationModal } from '../../ui';
import { ENVIRONMENT_KEY, type ProjectHubLaunchContext, type ProjectWizardMode } from '../../../lib/constants';
import type { EnvironmentKey, Project } from '../../../types/project';
import type { ConnectionProfile } from '../../../types/connection';
import { useToast } from '../Toast';
import {
    buildTagsWithProjectIcon,
    getProjectIconKey,
    type ProjectIconKey,
} from '../projectHubMeta';
import { ProjectWizardView } from './CreateWizard';

type ConnectionMode = 'existing' | 'new';

interface WizardDraft {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
}

interface DraftEnvironmentBinding {
    profile: ConnectionProfile;
    profileName: string;
    database: string;
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

function normalizePathForCompare(value: string): string {
    return value.trim().replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function resolveDefaultEnvironment(project?: Project): EnvironmentKey {
    return (project?.last_active_environment_key || project?.default_environment_key || ENVIRONMENT_KEY.LOCAL) as EnvironmentKey;
}

function buildBoundProjectDraft(
    project: Project,
    environmentKey: EnvironmentKey,
    profile: ConnectionProfile,
    database: string,
    profileName: string,
): Pick<Project, 'environments' | 'connections'> {
    const existingConnection = (project.connections || []).find((connection) => connection.environment_key === environmentKey);
    const nextConnectionId = existingConnection?.id || crypto.randomUUID();
    const nextConnection = {
        id: nextConnectionId,
        project_id: project.id,
        environment_key: environmentKey,
        name: profileName,
        driver: profile.driver,
        host: profile.host,
        port: profile.port,
        database,
        username: profile.username,
        password: profile.password,
        save_password: profile.save_password,
        ssl_mode: profile.ssl_mode,
        use_socket: false,
        ssh_enabled: false,
        advanced_meta: {
            profile_name: profileName,
            encrypt_password: String(Boolean(profile.encrypt_password)),
            show_all_schemas: String(Boolean(profile.show_all_schemas)),
            trust_server_cert: String(Boolean(profile.trust_server_cert)),
        },
    };

    const nextEnvironments = (project.environments || []).some((environment) => environment.key === environmentKey)
        ? (project.environments || []).map((environment) => (
            environment.key === environmentKey
                ? { ...environment, connection_id: nextConnectionId }
                : environment
        ))
        : [
            ...(project.environments || []),
            {
                id: crypto.randomUUID(),
                project_id: project.id,
                key: environmentKey,
                label: getEnvironmentMeta(environmentKey).label,
                badge_color: environmentKey,
                is_protected: environmentKey === ENVIRONMENT_KEY.STAGING || environmentKey === ENVIRONMENT_KEY.PRODUCTION,
                is_read_only: environmentKey === ENVIRONMENT_KEY.PRODUCTION,
                connection_id: nextConnectionId,
            },
        ];

    const nextConnections = (project.connections || []).some((connection) => connection.environment_key === environmentKey)
        ? (project.connections || []).map((connection) => (
            connection.environment_key === environmentKey ? nextConnection : connection
        ))
        : [...(project.connections || []), nextConnection];

    return {
        environments: nextEnvironments,
        connections: nextConnections,
    };
}

interface ProjectWizardProps {
    mode?: ProjectWizardMode;
    project?: Project;
    initialEnvironmentKey?: EnvironmentKey;
    launchContext?: ProjectHubLaunchContext;
    overlay?: boolean;
    onClose?: () => void;
    onDone: () => void;
}

export const ProjectWizard: React.FC<ProjectWizardProps> = ({
    mode = 'create',
    project,
    initialEnvironmentKey,
    launchContext,
    onClose,
    onDone,
}) => {
    const createProject = useProjectStore((s) => s.createProject);
    const saveProject = useProjectStore((s) => s.saveProject);
    const projects = useProjectStore((s) => s.projects);
    const projectList = Array.isArray(projects) ? projects : [];
    const activeProject = useProjectStore((s) => s.activeProject);
    const setActiveProject = useProjectStore((s) => s.setActiveProject);
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
    const { toast } = useToast();

    const isEditMode = mode === 'edit';

    const [draft, setDraft] = React.useState<WizardDraft>({
        name: '',
        description: '',
        iconKey: 'general',
    });
    const [connectionMode, setConnectionMode] = React.useState<ConnectionMode>('existing');
    const [activeEnvKey, setActiveEnvKey] = React.useState<EnvironmentKey>(ENVIRONMENT_KEY.LOCAL);
    const [editActiveEnvKey, setEditActiveEnvKey] = React.useState<EnvironmentKey>(ENVIRONMENT_KEY.LOCAL);
    const [providerFilter, setProviderFilter] = React.useState('');
    const [isSelectingProvider, setIsSelectingProvider] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [storageParentPath, setStorageParentPath] = React.useState('');
    const [storagePath, setStoragePath] = React.useState('');
    const [loadingStorageRoot, setLoadingStorageRoot] = React.useState(true);
    const [importingConnection, setImportingConnection] = React.useState(false);
    const [importingFormConnection, setImportingFormConnection] = React.useState(false);
    const [exportingConnection, setExportingConnection] = React.useState(false);
    const [treeRefreshKey, setTreeRefreshKey] = React.useState(0);
    const [connections, setConnections] = React.useState<ConnectionProfile[]>([]);
    const [editingProfile, setEditingProfile] = React.useState<ConnectionProfile | null>(null);
    const [pendingDeleteProfile, setPendingDeleteProfile] = React.useState<ConnectionProfile | null>(null);
    const [deletingConnectionName, setDeletingConnectionName] = React.useState<string | null>(null);
    const [draftEnvironmentBindings, setDraftEnvironmentBindings] = React.useState<Partial<Record<EnvironmentKey, DraftEnvironmentBinding>>>({});
    // Per-env selection state in edit mode (profile/db shown per env in side panel)
    const [editEnvSelections, setEditEnvSelections] = React.useState<Partial<Record<EnvironmentKey, { profileName: string | null; database: string }>>>({});
    const editInitKeyRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        setLoadingStorageRoot(true);

        GetDefaultProjectStorageRoot()
            .then((root) => {
                if (!cancelled && root) {
                    setStorageParentPath(root);
                }
            })
            .catch(() => { /* ignore, allow manual input */ })
            .finally(() => {
                if (!cancelled) setLoadingStorageRoot(false);
            });

        return () => { cancelled = true; };
    }, []);

    const loadConnections = React.useCallback(async () => {
        try {
            const loaded = await LoadConnections();
            const next = loaded || [];
            setConnections(next);
            return next;
        } catch (error) {
            toast.error(`Could not load connections: ${error}`);
            setConnections([]);
            return [];
        }
    }, [toast]);

    React.useEffect(() => {
        if (!isEditMode) {
            setConnections([]);
            return;
        }
        void loadConnections();
    }, [isEditMode, loadConnections]);

    React.useEffect(() => {
        if (isEditMode && project) {
            const initKey = `${project.id}:${initialEnvironmentKey || ''}`;
            if (editInitKeyRef.current === initKey) return;
            editInitKeyRef.current = initKey;

            const nextEnv = (initialEnvironmentKey || resolveDefaultEnvironment(project)) as EnvironmentKey;
            setDraft({
                name: project.name || '',
                description: project.description || '',
                iconKey: getProjectIconKey(project),
            });
            setStoragePath(project.storage_path || '');
            setEditActiveEnvKey(nextEnv);
            // Initialize edit selections from project connections
            const selections: Partial<Record<EnvironmentKey, { profileName: string | null; database: string }>> = {};
            (project.connections || []).forEach((conn) => {
                const envKey = conn.environment_key as EnvironmentKey;
                selections[envKey] = {
                    profileName: conn.advanced_meta?.profile_name || conn.name || null,
                    database: conn.database || '',
                };
            });
            setEditEnvSelections(selections);
            setDraftEnvironmentBindings({});

            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
            setEditingProfile(null);
            return;
        } else {
            editInitKeyRef.current = null;
            setDraft({ name: '', description: '', iconKey: 'general' });
            setStoragePath('');
            setDraftEnvironmentBindings({});
            setEditEnvSelections({});
            setActiveEnvKey(ENVIRONMENT_KEY.LOCAL);

            setConnectionMode('new');
            setIsSelectingProvider(true);
            setProviderFilter('');
            setEditingProfile(null);
        }
    }, [initialEnvironmentKey, isEditMode, project]);

    const existingNames = React.useMemo(
        () => connections.map((c) => c.name).filter(Boolean),
        [connections],
    );

    const form = useConnectionForm({
        profile: editingProfile,
        isOpen: connectionMode === 'new',
        existingNames,
        onSaved: async () => {
            const savedName = form.formData.name || '';
            if (isEditMode) {
                const refreshed = await loadConnections();
                const matched = refreshed.find((c) => c.name === savedName) || null;
                const activeEnv = editActiveEnvKey;
                setEditEnvSelections((prev) => ({
                    ...prev,
                    [activeEnv]: {
                        profileName: matched?.name || savedName || null,
                        database: matched?.db_name || form.formData.db_name || '',
                    },
                }));
            } else {
                const savedProfile = form.formData as ConnectionProfile;
                setConnections((current) => {
                    const withoutOld = current.filter((c) => c.name !== savedProfile.name);
                    return [...withoutOld, savedProfile];
                });
                const defaultDb = (savedProfile.db_name || '').trim();
                if (savedName && defaultDb && activeEnvKey) {
                    setDraftEnvironmentBindings((current) => ({
                        ...current,
                        [activeEnvKey]: {
                            profile: savedProfile,
                            profileName: savedName,
                            database: defaultDb,
                        },
                    }));
                }
            }
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
            setEditingProfile(null);
            setTreeRefreshKey((k) => k + 1);
        },
        onClose: () => {
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
            setEditingProfile(null);
        },
    });

    const handleProviderSelect = React.useCallback((key: string) => {
        form.handleDriverChange(key);
        setIsSelectingProvider(false);
        setProviderFilter('');
    }, [form.handleDriverChange]);

    const resolveLatestEditProject = React.useCallback((): Project | null => {
        if (!project?.id) return null;
        return projectList.find((item) => item.id === project.id)
            || (activeProject?.id === project.id ? activeProject : null)
            || project;
    }, [activeProject, project, projectList]);

    const handleAutoBindFromTree = React.useCallback(async (envKey: EnvironmentKey, profile: ConnectionProfile, database: string) => {
        const profileName = (profile.name || '').trim();
        const dbName = database.trim();
        if (!profileName || !dbName || submitting) return;

        const baseProject = resolveLatestEditProject();
        if (!baseProject) return;

        setSubmitting(true);
        try {
            const bindingDraft = buildBoundProjectDraft(baseProject, envKey, profile, dbName, profileName);
            const saved = await saveProject({ ...baseProject, ...bindingDraft });
            if (!saved) {
                toast.error('Could not save environment binding.');
                return;
            }
            setActiveProject(saved);
            setEditEnvSelections((prev) => ({
                ...prev,
                [envKey]: { profileName, database: dbName },
            }));
        } catch (error) {
            toast.error(`Could not save binding: ${error}`);
        } finally {
            setSubmitting(false);
        }
    }, [resolveLatestEditProject, saveProject, setActiveProject, submitting, toast]);

    const handleSelectFromTreeEdit = React.useCallback((envKey: EnvironmentKey, profile: ConnectionProfile, database: string) => {
        void handleAutoBindFromTree(envKey, profile, database);
    }, [handleAutoBindFromTree]);

    const handleSelectFromTreeCreate = React.useCallback((envKey: EnvironmentKey, profile: ConnectionProfile, database: string) => {
        if (!envKey) return;
        setDraftEnvironmentBindings((current) => ({
            ...current,
            [envKey]: { profile, profileName: profile.name || '', database },
        }));
    }, []);

    const handlePickStorageFolder = React.useCallback(async () => {
        try {
            const initialPath = isEditMode ? storagePath : storageParentPath;
            const picked = await PickDirectory(initialPath);
            if (!picked) return;
            if (isEditMode) {
                setStoragePath(picked);
                return;
            }
            setStorageParentPath(picked);
        } catch (error) {
            toast.error(`Could not pick folder: ${error}`);
        }
    }, [isEditMode, storageParentPath, storagePath, toast]);

    const handleImportConnection = React.useCallback(async () => {
        setImportingConnection(true);
        try {
            const imported = await ImportConnectionPackage();
            if (!imported) return;
            const importedProfile = imported as ConnectionProfile;
            let matched = importedProfile;
            if (isEditMode) {
                const refreshed = await loadConnections();
                matched = refreshed.find((c) => c.name === importedProfile.name) || importedProfile;
            } else {
                setConnections((current) => {
                    const withoutOld = current.filter((c) => c.name !== importedProfile.name);
                    return [...withoutOld, importedProfile];
                });
            }
            if (!isEditMode && matched.name && matched.db_name && activeEnvKey) {
                setDraftEnvironmentBindings((current) => ({
                    ...current,
                    [activeEnvKey]: {
                        profile: matched,
                        profileName: matched.name,
                        database: matched.db_name,
                    },
                }));
            }
            setTreeRefreshKey((k) => k + 1);
            toast.success(`Imported connection${matched.name ? ` "${matched.name}"` : ''}.`);
        } catch (error) {
            toast.error(`Could not import connection: ${error}`);
        } finally {
            setImportingConnection(false);
        }
    }, [activeEnvKey, isEditMode, loadConnections, toast]);

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

    const handleEditConnection = React.useCallback((profile: ConnectionProfile) => {
        setEditingProfile(profile);
        setConnectionMode('new');
        setIsSelectingProvider(false);
        setProviderFilter('');
    }, []);

    const handleRequestDeleteConnection = React.useCallback((profile: ConnectionProfile) => {
        setPendingDeleteProfile(profile);
    }, []);

    const handleConfirmDeleteConnection = React.useCallback(async () => {
        const profileName = pendingDeleteProfile?.name;
        if (!profileName) return;

        setDeletingConnectionName(profileName);
        try {
            await DeleteConnection(profileName);
            await loadConnections();

            if (editingProfile?.name === profileName) {
                setEditingProfile(null);
                setConnectionMode('existing');
                setIsSelectingProvider(false);
                setProviderFilter('');
            }

            setTreeRefreshKey((k) => k + 1);
            toast.success(`Deleted connection "${profileName}".`);
        } catch (error) {
            toast.error(`Could not delete connection: ${error}`);
        } finally {
            setDeletingConnectionName(null);
            setPendingDeleteProfile(null);
        }
    }, [editingProfile?.name, loadConnections, pendingDeleteProfile?.name, toast]);

    const handleExportConnection = React.useCallback(async () => {
        setExportingConnection(true);
        try {
            const exportedPath = await ExportConnectionPackage(editActiveEnvKey);
            if (!exportedPath) return;
            toast.success(`Connection exported: ${exportedPath}`);
        } catch (error) {
            toast.error(`Could not export connection: ${error}`);
        } finally {
            setExportingConnection(false);
        }
    }, [editActiveEnvKey, toast]);

    const storagePathPreview = React.useMemo(() => {
        if (isEditMode) return storagePath.trim();
        const slug = slugifyProjectName(draft.name);
        return storageParentPath.trim() ? joinPath(storageParentPath, slug) : '';
    }, [draft.name, isEditMode, storageParentPath, storagePath]);

    const pathConflictProject = React.useMemo(() => {
        const preview = storagePathPreview.trim();
        if (!preview) return null;
        const normalizedPreview = normalizePathForCompare(preview);
        return projectList.find((item) => (
            item.id !== project?.id
            && item.storage_path
            && normalizePathForCompare(item.storage_path) === normalizedPreview
        )) || null;
    }, [project?.id, projectList, storagePathPreview]);

    const handleCreateAndEnter = async () => {
        const bindingEntries = ENVIRONMENT_KEYS
            .map((envKey) => [envKey, draftEnvironmentBindings[envKey]] as const)
            .filter(([, binding]) => Boolean(binding?.profileName && binding?.database.trim() && binding.profile));

        if (bindingEntries.length === 0) {
            toast.error('Please bind at least one environment database.');
            return;
        }

        const defaultEnvKey = bindingEntries[0][0];

        setSubmitting(true);
        try {
            try { await Disconnect(); } catch { /* ignore */ }
            resetRuntime();

            const createdProject = await createProject({
                name: draft.name.trim(),
                description: draft.description.trim(),
                tags: buildTagsWithProjectIcon([], draft.iconKey),
                storage_path: storagePathPreview || undefined,
            });
            if (!createdProject) {
                toast.error('Could not create project.');
                return;
            }

            let projectWithBindings = createdProject;
            bindingEntries.forEach(([envKey, binding]) => {
                if (!binding) return;
                projectWithBindings = {
                    ...projectWithBindings,
                    ...buildBoundProjectDraft(
                        projectWithBindings,
                        envKey,
                        binding.profile,
                        binding.database.trim(),
                        binding.profileName.trim(),
                    ),
                };
            });
            const createdWithBinding = await saveProject({
                ...projectWithBindings,
                git_repo_path: storagePathPreview || undefined,
                default_environment_key: defaultEnvKey,
                last_active_environment_key: defaultEnvKey,
            });
            if (!createdWithBinding) {
                toast.error('Could not bind starter environment.');
                return;
            }

            setActiveProject(createdWithBinding);
            setActiveEnvironment(defaultEnvKey);
            onDone();
        } catch (error) {
            toast.error(`Could not finish setup: ${error}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveEdit = async () => {
        const baseProject = resolveLatestEditProject();
        if (!baseProject) {
            toast.error('Project was not found for editing.');
            return;
        }

        setSubmitting(true);
        try {
            const metadataSaved = await saveProject({
                ...baseProject,
                name: draft.name.trim(),
                description: draft.description.trim(),
                tags: buildTagsWithProjectIcon(baseProject.tags, draft.iconKey),
                git_repo_path: storagePathPreview || undefined,
                storage_path: storagePathPreview || undefined,
                default_environment_key: editActiveEnvKey,
                last_active_environment_key: editActiveEnvKey,
            });
            if (!metadataSaved) {
                toast.error('Could not save project changes.');
                return;
            }
            setActiveProject(metadataSaved);
            setActiveEnvironment(editActiveEnvKey);
            onDone();
        } catch (error) {
            toast.error(`Could not finish setup: ${error}`);
        } finally {
            setSubmitting(false);
        }
    };

    const getSelectedProfileName = React.useCallback((envKey: EnvironmentKey): string | null => {
        return editEnvSelections[envKey]?.profileName ?? null;
    }, [editEnvSelections]);

    const getSelectedDatabase = React.useCallback((envKey: EnvironmentKey): string => {
        return editEnvSelections[envKey]?.database ?? '';
    }, [editEnvSelections]);

    const handleAddNew = React.useCallback(() => {
        form.resetForm();
        setEditingProfile(null);
        setConnectionMode('new');
        setIsSelectingProvider(true);
        setProviderFilter('');
    }, [form]);

    const handleBack = React.useCallback(() => {
        setConnectionMode('existing');
        setIsSelectingProvider(false);
        setProviderFilter('');
        setEditingProfile(null);
    }, []);

    const handleCancelForm = React.useCallback(() => {
        setConnectionMode('existing');
        setIsSelectingProvider(false);
        setProviderFilter('');
        setEditingProfile(null);
    }, []);

    const handleUnbind = React.useCallback((envKey: EnvironmentKey) => {
        setDraftEnvironmentBindings((current) => {
            const next = { ...current };
            delete next[envKey];
            return next;
        });
    }, []);

    const handleSetActiveEnvKey = React.useCallback((key: EnvironmentKey) => {
        setActiveEnvKey(key);
        if (key !== activeEnvKey) {
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
        }
    }, [activeEnvKey]);

    const isBoundInEdit = React.useCallback((envKey: EnvironmentKey): boolean => {
        return Boolean(editEnvSelections[envKey]?.profileName);
    }, [editEnvSelections]);

    return (
        <>
            <ConfirmationModal
                isOpen={Boolean(pendingDeleteProfile)}
                onClose={() => {
                    if (deletingConnectionName) return;
                    setPendingDeleteProfile(null);
                }}
                onConfirm={() => { void handleConfirmDeleteConnection(); }}
                title="Delete Connection"
                message={`Delete "${pendingDeleteProfile?.name || ''}"?`}
                description="This action removes the saved connection profile."
                confirmLabel={deletingConnectionName ? 'Deleting...' : 'Delete'}
                variant="destructive"
            />

            <ProjectWizardView
                mode={isEditMode ? 'edit' : 'create'}
                initialStep={launchContext === 'env-config' ? 2 : 1}
                draft={draft}
                onDraftChange={setDraft}
                draftEnvironmentBindings={draftEnvironmentBindings}
                onBind={isEditMode ? handleSelectFromTreeEdit : handleSelectFromTreeCreate}
                onUnbind={handleUnbind}
                getSelectedProfileName={getSelectedProfileName}
                getSelectedDatabase={getSelectedDatabase}
                isBoundInEdit={isBoundInEdit}
                storageParentPath={storageParentPath}
                storagePath={storagePath}
                storagePathPreview={storagePathPreview}
                loadingStorageRoot={loadingStorageRoot}
                pathConflictProject={pathConflictProject}
                onStorageChange={isEditMode ? setStoragePath : setStorageParentPath}
                onPickFolder={handlePickStorageFolder}
                submitting={submitting}
                exportingConnection={exportingConnection}
                onCancel={onClose ?? (() => onDone())}
                onSubmit={isEditMode ? handleSaveEdit : handleCreateAndEnter}
                onExport={isEditMode ? handleExportConnection : undefined}
                activeEnvKey={isEditMode ? editActiveEnvKey : activeEnvKey}
                onSetActiveEnvKey={isEditMode ? (key: EnvironmentKey) => setEditActiveEnvKey(key) : handleSetActiveEnvKey}
                connectionMode={connectionMode}
                isSelectingProvider={isSelectingProvider}
                providerFilter={providerFilter}
                connections={connections}
                treeRefreshKey={treeRefreshKey}
                importingConnection={importingConnection}
                importingFormConnection={importingFormConnection}
                deletingConnectionName={deletingConnectionName}
                form={form}
                onAddNew={handleAddNew}
                onImportConnection={handleImportConnection}
                onEditConnection={handleEditConnection}
                onDeleteConnection={isEditMode ? handleRequestDeleteConnection : undefined}
                onBack={handleBack}
                onShowProviderPicker={() => setIsSelectingProvider(true)}
                onProviderFilterChange={setProviderFilter}
                onClearProviderFilter={() => setProviderFilter('')}
                onProviderSelect={handleProviderSelect}
                onImportConnectionToForm={handleImportConnectionToForm}
                onCancelForm={handleCancelForm}
            />
        </>
    );
};
