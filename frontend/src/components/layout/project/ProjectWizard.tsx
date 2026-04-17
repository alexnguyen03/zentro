import React from 'react';
import { AlertTriangle, ChevronRight, CircleHelp, Download, FolderOpen } from 'lucide-react';
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
import { ConnectionForm } from '../../connection/ConnectionForm';
import { ProviderPickerToolbar } from '../../connection/ProviderPickerToolbar';
import { ProviderGrid } from '../../connection/ProviderGrid';
import {
    Button,
    ConfirmationModal,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Spinner,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../../ui';
import { DatabaseTreePicker } from '../../connection/DatabaseTreePicker';
import { ENVIRONMENT_KEY, type ProjectHubLaunchContext, type ProjectWizardMode } from '../../../lib/constants';
import { cn } from '../../../lib/cn';
import { getProvider } from '../../../lib/providers';
import type { EnvironmentKey, Project } from '../../../types/project';
import type { ConnectionProfile } from '../../../types/connection';
import { useToast } from '../Toast';
import {
    PROJECT_ICON_MAP,
    PROJECT_ICON_OPTIONS,
    buildTagsWithProjectIcon,
    getProjectIconKey,
    type ProjectIconKey,
} from '../projectHubMeta';
import { PanelFrame } from '../PanelFrame';

type ConnectionMode = 'existing' | 'new';
type SubmitIntent = 'apply' | 'save';

interface WizardDraft {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
    starterEnv: EnvironmentKey;
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
    launchContext = 'default',
    overlay = false,
    onClose,
    onDone,
}) => {
    const createProject = useProjectStore((s) => s.createProject);
    const saveProject = useProjectStore((s) => s.saveProject);
    const projects = useProjectStore((s) => s.projects);
    const setActiveProject = useProjectStore((s) => s.setActiveProject);
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
    const { toast } = useToast();

    const isEditMode = mode === 'edit';

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
    const [storagePath, setStoragePath] = React.useState('');
    const [loadingStorageRoot, setLoadingStorageRoot] = React.useState(true);
    const [importingConnection, setImportingConnection] = React.useState(false);
    const [importingFormConnection, setImportingFormConnection] = React.useState(false);
    const [exportingConnection, setExportingConnection] = React.useState(false);
    const [treeRefreshKey, setTreeRefreshKey] = React.useState(0);
    const [showStorage, setShowStorage] = React.useState(false);
    const [showConnection, setShowConnection] = React.useState(true);
    const [connections, setConnections] = React.useState<ConnectionProfile[]>([]);
    const [editingProfile, setEditingProfile] = React.useState<ConnectionProfile | null>(null);
    const [pendingDeleteProfile, setPendingDeleteProfile] = React.useState<ConnectionProfile | null>(null);
    const [deletingConnectionName, setDeletingConnectionName] = React.useState<string | null>(null);
    const [submitIntent, setSubmitIntent] = React.useState<SubmitIntent | null>(null);
    const [draftEnvironmentBindings, setDraftEnvironmentBindings] = React.useState<Partial<Record<EnvironmentKey, DraftEnvironmentBinding>>>({});

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
            const nextEnv = (initialEnvironmentKey || resolveDefaultEnvironment(project)) as EnvironmentKey;
            const boundConnection = (project.connections || []).find((connection) => connection.environment_key === nextEnv);
            setDraft({
                name: project.name || '',
                description: project.description || '',
                iconKey: getProjectIconKey(project),
                starterEnv: nextEnv,
            });
            setStoragePath(project.storage_path || '');
            setSelectedProfileName(boundConnection?.advanced_meta?.profile_name || boundConnection?.name || null);
            setSelectedDatabase(boundConnection?.database || '');
            setDraftEnvironmentBindings({});
        } else {
            setDraft({
                name: '',
                description: '',
                iconKey: 'general',
                starterEnv: initialEnvironmentKey || ENVIRONMENT_KEY.LOCAL,
            });
            setStoragePath('');
            setSelectedProfileName(null);
            setSelectedDatabase('');
            setSelectedProfile(null);
            setDraftEnvironmentBindings({});
        }

        setConnectionMode(isEditMode ? 'existing' : 'new');
        setIsSelectingProvider(!isEditMode);
        setProviderFilter('');
        setEditingProfile(null);
    }, [initialEnvironmentKey, isEditMode, project]);

    React.useEffect(() => {
        if (isEditMode) {
            if (!project) return;
            const boundConnection = (project.connections || []).find((connection) => connection.environment_key === draft.starterEnv);
            setSelectedProfileName(boundConnection?.advanced_meta?.profile_name || boundConnection?.name || null);
            setSelectedDatabase(boundConnection?.database || '');
            return;
        }
        const binding = draftEnvironmentBindings[draft.starterEnv];
        setSelectedProfile(binding?.profile || null);
        setSelectedProfileName(binding?.profileName || null);
        setSelectedDatabase(binding?.database || '');
    }, [draft.starterEnv, draftEnvironmentBindings, isEditMode, project]);

    React.useEffect(() => {
        if (!selectedProfileName) {
            setSelectedProfile(null);
            return;
        }
        const matched = connections.find((connection) => connection.name === selectedProfileName) || null;
        if (matched) {
            setSelectedProfile(matched);
            return;
        }
        setSelectedProfile((current) => (current?.name === selectedProfileName ? current : null));
    }, [connections, selectedProfileName]);

    const existingNames = React.useMemo(
        () => connections.map((connection) => connection.name).filter(Boolean),
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
                const matched = refreshed.find((connection) => connection.name === savedName) || null;
                setSelectedProfile(matched || (form.formData as ConnectionProfile));
                setSelectedProfileName(savedName || null);
            } else {
                const savedProfile = form.formData as ConnectionProfile;
                setConnections((current) => {
                    const withoutOld = current.filter((connection) => connection.name !== savedProfile.name);
                    return [...withoutOld, savedProfile];
                });
                setSelectedProfile(savedProfile);
                setSelectedProfileName(savedName || null);
                const defaultDb = (savedProfile.db_name || '').trim();
                if (savedName && defaultDb) {
                    setDraftEnvironmentBindings((current) => ({
                        ...current,
                        [draft.starterEnv]: {
                            profile: savedProfile,
                            profileName: savedName,
                            database: defaultDb,
                        },
                    }));
                }
            }
            if (form.formData.db_name) {
                setSelectedDatabase(form.formData.db_name);
            }
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
            setEditingProfile(null);
            setTreeRefreshKey((key) => key + 1);
        },
        onClose: () => {
            setConnectionMode('existing');
            setIsSelectingProvider(false);
            setProviderFilter('');
            setEditingProfile(null);
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

    const handleAutoBindFromTree = React.useCallback(async (profile: ConnectionProfile, database: string) => {
        const profileName = (profile.name || '').trim();
        const dbName = database.trim();
        if (!isEditMode || !project || !profileName || !dbName || submitting) {
            return;
        }

        setSubmitIntent('apply');
        setSubmitting(true);
        try {
            const bindingDraft = buildBoundProjectDraft(
                project,
                draft.starterEnv,
                profile,
                dbName,
                profileName,
            );
            const bindingOnlySaved = await saveProject({
                ...project,
                ...bindingDraft,
            });
            if (!bindingOnlySaved) {
                toast.error('Could not save environment binding.');
                return;
            }
            setActiveProject(bindingOnlySaved);
        } catch (error) {
            toast.error(`Could not save binding: ${error}`);
        } finally {
            setSubmitting(false);
            setSubmitIntent(null);
        }
    }, [draft.starterEnv, isEditMode, project, saveProject, setActiveProject, submitting, toast]);

    const handleSelectFromTree = React.useCallback((profile: ConnectionProfile, database: string) => {
        setSelectedProfile(profile);
        setSelectedProfileName(profile.name || null);
        setSelectedDatabase(database);
        if (!isEditMode && profile.name) {
            setDraftEnvironmentBindings((current) => ({
                ...current,
                [draft.starterEnv]: {
                    profile,
                    profileName: profile.name || '',
                    database,
                },
            }));
        }
        void handleAutoBindFromTree(profile, database);
    }, [draft.starterEnv, handleAutoBindFromTree, isEditMode]);

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
                matched = refreshed.find((connection) => connection.name === importedProfile.name) || importedProfile;
            } else {
                setConnections((current) => {
                    const withoutOld = current.filter((connection) => connection.name !== importedProfile.name);
                    return [...withoutOld, importedProfile];
                });
            }
            setSelectedProfile(matched);
            setSelectedProfileName(matched.name || null);
            setSelectedDatabase(matched.db_name || '');
            if (!isEditMode && matched.name && matched.db_name) {
                setDraftEnvironmentBindings((current) => ({
                    ...current,
                    [draft.starterEnv]: {
                        profile: matched,
                        profileName: matched.name,
                        database: matched.db_name,
                    },
                }));
            }
            setTreeRefreshKey((key) => key + 1);
            toast.success(`Imported connection${matched.name ? ` "${matched.name}"` : ''}.`);
        } catch (error) {
            toast.error(`Could not import connection: ${error}`);
        } finally {
            setImportingConnection(false);
        }
    }, [draft.starterEnv, isEditMode, loadConnections, toast]);

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

    const handleUnbindEnvironment = React.useCallback((envKey: EnvironmentKey) => {
        if (isEditMode) {
            return;
        }

        setDraftEnvironmentBindings((current) => {
            const next = { ...current };
            delete next[envKey];
            return next;
        });
        if (draft.starterEnv === envKey) {
            setSelectedProfile(null);
            setSelectedProfileName(null);
            setSelectedDatabase('');
        }
    }, [draft.starterEnv, isEditMode]);

    const handleRequestDeleteConnection = React.useCallback((profile: ConnectionProfile) => {
        setPendingDeleteProfile(profile);
    }, []);

    const handleConfirmDeleteConnection = React.useCallback(async () => {
        const profileName = pendingDeleteProfile?.name;
        if (!profileName) return;

        setDeletingConnectionName(profileName);
        try {
            await DeleteConnection(profileName);
            const refreshed = await loadConnections();

            if (selectedProfileName === profileName) {
                const fallback = refreshed[0] || null;
                setSelectedProfile(fallback);
                setSelectedProfileName(fallback?.name || null);
                setSelectedDatabase(fallback?.db_name || '');
            }

            if (editingProfile?.name === profileName) {
                setEditingProfile(null);
                setConnectionMode('existing');
                setIsSelectingProvider(false);
                setProviderFilter('');
            }

            setTreeRefreshKey((key) => key + 1);
            toast.success(`Deleted connection "${profileName}".`);
        } catch (error) {
            toast.error(`Could not delete connection: ${error}`);
        } finally {
            setDeletingConnectionName(null);
            setPendingDeleteProfile(null);
        }
    }, [editingProfile?.name, loadConnections, pendingDeleteProfile?.name, selectedProfileName, toast]);

    const handleExportConnection = React.useCallback(async () => {
        setExportingConnection(true);
        try {
            const exportedPath = await ExportConnectionPackage(draft.starterEnv);
            if (!exportedPath) return;
            toast.success(`Connection exported: ${exportedPath}`);
        } catch (error) {
            toast.error(`Could not export connection: ${error}`);
        } finally {
            setExportingConnection(false);
        }
    }, [draft.starterEnv, toast]);

    const storagePathPreview = React.useMemo(() => {
        if (isEditMode) {
            return storagePath.trim();
        }
        const slug = slugifyProjectName(draft.name);
        return storageParentPath.trim() ? joinPath(storageParentPath, slug) : '';
    }, [draft.name, isEditMode, storageParentPath, storagePath]);

    const pathConflictProject = React.useMemo(() => {
        const preview = storagePathPreview.trim();
        if (!preview) return null;
        const normalizedPreview = normalizePathForCompare(preview);
        return projects.find((item) => (
            item.id !== project?.id
            && item.storage_path
            && normalizePathForCompare(item.storage_path) === normalizedPreview
        )) || null;
    }, [project?.id, projects, storagePathPreview]);

    const environmentBindings = React.useMemo(() => {
        const bindings = new Map<EnvironmentKey, { profileName: string; database: string }>();
        if (isEditMode) {
            (project?.connections || []).forEach((connection) => {
                const envKey = connection.environment_key as EnvironmentKey;
                bindings.set(envKey, {
                    profileName: (connection.advanced_meta?.profile_name || connection.name || '').trim(),
                    database: (connection.database || '').trim(),
                });
            });
        }
        ENVIRONMENT_KEYS.forEach((envKey) => {
            const binding = draftEnvironmentBindings[envKey];
            if (!binding) return;
            bindings.set(envKey, {
                profileName: binding.profileName.trim(),
                database: binding.database.trim(),
            });
        });
        return bindings;
    }, [draftEnvironmentBindings, isEditMode, project]);

    const canSave = React.useMemo(() => {
        if (!draft.name.trim() || !draft.starterEnv) return false;
        if (isEditMode) {
            return Boolean(selectedProfileName && selectedDatabase.trim());
        }
        const starterBinding = draftEnvironmentBindings[draft.starterEnv];
        return Boolean(starterBinding?.profileName && starterBinding.database.trim());
    }, [draft.name, draft.starterEnv, draftEnvironmentBindings, isEditMode, selectedDatabase, selectedProfileName]);

    const canApplyBinding = React.useMemo(
        () => Boolean(draft.starterEnv && selectedProfileName && selectedDatabase.trim()),
        [draft.starterEnv, selectedProfileName, selectedDatabase],
    );

    const resolveSelectedProfile = React.useCallback(async () => {
        if (selectedProfile?.name === selectedProfileName) {
            return selectedProfile;
        }
        if (selectedProfileName) {
            const fromCache = connections.find((connection) => connection.name === selectedProfileName);
            if (fromCache) {
                setSelectedProfile(fromCache);
                return fromCache;
            }
            const refreshed = await loadConnections();
            const fromRefreshed = refreshed.find((connection) => connection.name === selectedProfileName) || null;
            setSelectedProfile(fromRefreshed);
            return fromRefreshed;
        }
        return null;
    }, [connections, loadConnections, selectedProfile, selectedProfileName]);

    const handleCreateAndEnter = async (closeOnSuccess = true) => {
        if (!draft.starterEnv) {
            toast.error('Please choose a starter environment.');
            return;
        }

        setSubmitIntent(isEditMode && !closeOnSuccess ? 'apply' : 'save');
        setSubmitting(true);
        try {
            if (!isEditMode) {
                const bindingEntries = ENVIRONMENT_KEYS
                    .map((envKey) => [envKey, draftEnvironmentBindings[envKey]] as const)
                    .filter(([, binding]) => Boolean(binding?.profileName && binding?.database.trim() && binding.profile));
                const starterBinding = draftEnvironmentBindings[draft.starterEnv];
                if (!starterBinding?.profileName || !starterBinding.database.trim() || !starterBinding.profile) {
                    toast.error('Please bind a database for the starter environment.');
                    return;
                }
                if (bindingEntries.length === 0) {
                    toast.error('Please bind at least one environment database.');
                    return;
                }

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
                    default_environment_key: draft.starterEnv,
                    last_active_environment_key: draft.starterEnv,
                });
                if (!createdWithBinding) {
                    toast.error('Could not bind starter environment.');
                    return;
                }

                setActiveProject(createdWithBinding);
                setActiveEnvironment(draft.starterEnv);
                onDone();
                return;
            }

            if (!project) {
                toast.error('Project was not found for editing.');
                return;
            }
            const resolvedProfile = await resolveSelectedProfile();
            if (!selectedProfileName || !resolvedProfile) {
                toast.error('Please choose a connection profile.');
                return;
            }

            const dbName = selectedDatabase.trim();
            const bindingDraft = buildBoundProjectDraft(
                project,
                draft.starterEnv,
                resolvedProfile,
                dbName,
                selectedProfileName,
            );

            if (!closeOnSuccess) {
                const bindingOnlySaved = await saveProject({
                    ...project,
                    ...bindingDraft,
                });
                if (!bindingOnlySaved) {
                    toast.error('Could not save environment binding.');
                    return;
                }
                setActiveProject(bindingOnlySaved);
                return;
            }

            const metadataSaved = await saveProject({
                ...project,
                name: draft.name.trim(),
                description: draft.description.trim(),
                tags: buildTagsWithProjectIcon(project.tags, draft.iconKey),
                git_repo_path: storagePathPreview || undefined,
                storage_path: storagePathPreview || undefined,
                default_environment_key: draft.starterEnv,
                last_active_environment_key: draft.starterEnv,
                ...bindingDraft,
            });
            if (!metadataSaved) {
                toast.error('Could not save project changes.');
                return;
            }

            setActiveProject(metadataSaved);
            setActiveEnvironment(draft.starterEnv);
            onDone();
        } catch (error) {
            toast.error(`Could not finish setup: ${error}`);
        } finally {
            setSubmitting(false);
            setSubmitIntent(null);
        }
    };

    const title = isEditMode ? 'Edit project' : 'Create project';
    const submitLabel = isEditMode ? 'Save & apply' : 'Create & enter';

    return (
        <>
            <ConfirmationModal
                isOpen={Boolean(pendingDeleteProfile)}
                onClose={() => {
                    if (deletingConnectionName) return;
                    setPendingDeleteProfile(null);
                }}
                onConfirm={() => {
                    void handleConfirmDeleteConnection();
                }}
                title="Delete Connection"
                message={`Delete "${pendingDeleteProfile?.name || ''}"?`}
                description="This action removes the saved connection profile."
                confirmLabel={deletingConnectionName ? 'Deleting...' : 'Delete'}
                variant="destructive"
            />
            <PanelFrame
                title={title}
                subtitle={launchContext === 'env-config' ? 'Configure environment' : undefined}
                onClose={overlay && onClose ? onClose : undefined}
                className="h-full"
                headerClassName="px-6 py-4"
                bodyClassName="min-h-0 overflow-y-auto px-6 py-5"
                titleClassName="text-[20px]"
                footerClassName="flex items-center justify-between gap-2 px-6 py-4"
                footer={(
                    <>
                        <div>
                            {isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        void handleExportConnection();
                                    }}
                                    disabled={exportingConnection || submitting}
                                    className="rounded-sm"
                                    title="Export selected environment connection"
                                >
                                    {exportingConnection ? <Spinner size={13} /> : <Download size={14} />}
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" onClick={onClose} className="rounded-sm" disabled={!onClose || submitting}>Cancel</Button>
                            {isEditMode && (
                                <Button
                                    variant="secondary"
                                    onClick={() => void handleCreateAndEnter(false)}
                                    disabled={!canApplyBinding || submitting}
                                    className="rounded-sm px-5"
                                >
                                    {submitting && submitIntent === 'apply' ? <><Spinner size={12} className="mr-2" />Applying...</> : <>Apply</>}
                                </Button>
                            )}
                            <Button
                                variant="default"
                                onClick={() => void handleCreateAndEnter(true)}
                                disabled={!canSave || submitting}
                                className="rounded-sm px-5"
                            >
                                {submitting
                                    ? <><Spinner size={12} className="mr-2 text-white" />{isEditMode ? 'Saving...' : 'Creating...'}</>
                                    : <>{submitLabel}</>}
                            </Button>
                        </div>
                    </>
                )}
            >
                <div className="mx-auto max-w-190 flex flex-col gap-4 pb-4">
                    <div className="flex gap-3">
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
                                                onClick={() => setDraft((current) => ({ ...current, iconKey: option.key }))}
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

                        <div className="flex flex-1 flex-col gap-2">
                            <div>
                                <label className="mb-1 block text-[11px] font-semibold text-foreground">Project name <span className="text-destructive">*</span></label>
                                <Input
                                    value={draft.name}
                                    onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
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
                                    onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                                    placeholder="Optional context"
                                    inputSize="md"
                                    className="bg-card w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <TooltipProvider delayDuration={150}>
                            <div className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-foreground">
                                <span>Starter environment <span className="text-destructive">*</span></span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground"
                                            aria-label="Starter environment help"
                                        >
                                            <CircleHelp size={12} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-[11px] flex flex-col gap-1">
                                        <span>Select an environment to bind its profile/database.</span>
                                        <span> You can bind multiple environments before saving.</span>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {ENVIRONMENT_KEYS.map((envKey) => {
                                    const meta = getEnvironmentMeta(envKey);
                                    const active = draft.starterEnv === envKey;
                                    const isProduction = envKey === ENVIRONMENT_KEY.PRODUCTION;
                                    const persistedBinding = environmentBindings.get(envKey);
                                    const previewProfile = persistedBinding?.profileName || '';
                                    const previewDatabase = persistedBinding?.database || '';
                                    const bindingSummary = [previewProfile, previewDatabase].filter(Boolean).join(' / ') || 'No binding';
                                    return (
                                        <button
                                            key={envKey}
                                            type="button"
                                            onClick={() => setDraft((current) => ({ ...current, starterEnv: envKey }))}
                                            onDoubleClick={() => {
                                                handleUnbindEnvironment(envKey);
                                            }}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-sm border px-3 py-2 transition-colors',
                                                isProduction && 'col-span-2',
                                                active ? 'border-accent/40 bg-accent/8' : 'border-border/25 bg-background/20 hover:bg-background/40',
                                            )}
                                        >
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', meta.colorClass)}>
                                                        {envKey}
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-40 text-center">
                                                    <span className="font-semibold">{meta.label}</span>
                                                    <p className="mt-0.5 text-[11px] font-normal opacity-80">{meta.description}</p>
                                                    <p className="mt-1 text-[10px] font-medium opacity-90">{bindingSummary}</p>
                                                    {!isEditMode && <p className="mt-1 text-[10px] font-normal opacity-70">Double click to unbind</p>}
                                                </TooltipContent>
                                            </Tooltip>
                                            <span
                                                className={cn(
                                                    'min-w-0 flex-1 truncate text-left text-[10px]',
                                                    previewDatabase ? 'text-muted-foreground' : 'text-muted-foreground/70',
                                                )}
                                                title={bindingSummary}
                                            >
                                                {bindingSummary}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </TooltipProvider>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={() => setShowConnection((value) => !value)}
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
                            <div className="mt-2 flex min-h-40 flex-col rounded-sm bg-background">
                                {connectionMode === 'existing' ? (
                                    <div className="flex-1 overflow-hidden">
                                        <DatabaseTreePicker
                                            key={treeRefreshKey}
                                            onSelect={handleSelectFromTree}
                                            selectedProfile={selectedProfileName}
                                            selectedDatabase={selectedDatabase}
                                            connectionsOverride={!isEditMode ? connections : undefined}
                                            disableAutoLoad={!isEditMode}
                                            onImport={handleImportConnection}
                                            importing={importingConnection}
                                            onAddNew={() => {
                                                form.resetForm();
                                                setEditingProfile(null);
                                                setConnectionMode('new');
                                                setIsSelectingProvider(true);
                                                setProviderFilter('');
                                            }}
                                            onEditConnection={handleEditConnection}
                                            onDeleteConnection={isEditMode ? handleRequestDeleteConnection : undefined}
                                            deletingConnectionName={isEditMode ? deletingConnectionName : null}
                                        />
                                    </div>
                                ) : (
                                    <div className="relative grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] p-1.5">
                                        <ProviderPickerToolbar
                                            isSelectingProvider={isSelectingProvider}
                                            providerFilter={providerFilter}
                                            selectedProvider={selectedProvider}
                                            onBack={() => {
                                                setConnectionMode('existing');
                                                setIsSelectingProvider(false);
                                                setProviderFilter('');
                                                setEditingProfile(null);
                                            }}
                                            onShowProviderPicker={() => setIsSelectingProvider(true)}
                                            onProviderFilterChange={setProviderFilter}
                                            onClearProviderFilter={() => setProviderFilter('')}
                                            onImportConnection={handleImportConnectionToForm}
                                            importingConnection={importingFormConnection}
                                        />
                                        {isSelectingProvider ? (
                                            <div className="h-full min-h-0 rounded-sm p-2">
                                                <ProviderGrid
                                                    selected={form.selectedProvider}
                                                    locked={form.isEditing}
                                                    filterText={providerFilter}
                                                    onSelect={handleProviderSelect}
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-full overflow-hidden">
                                                <div className="mx-auto flex min-h-full w-full max-w-155 items-start justify-center">
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
                                                                setEditingProfile(null);
                                                            }}
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

                    <div>
                        <button
                            type="button"
                            onClick={() => setShowStorage((value) => !value)}
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
                                        value={isEditMode ? storagePath : storageParentPath}
                                        onChange={(event) => {
                                            if (isEditMode) {
                                                setStoragePath(event.target.value);
                                                return;
                                            }
                                            setStorageParentPath(event.target.value);
                                        }}
                                        placeholder={loadingStorageRoot ? 'Loading default storage root...' : (isEditMode ? 'Set project folder path' : 'Choose parent folder...')}
                                        inputSize="xl"
                                        className="bg-card"
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="h-10 rounded-sm px-3"
                                        onClick={() => {
                                            void handlePickStorageFolder();
                                        }}
                                        disabled={loadingStorageRoot}
                                        title="Browse folder"
                                    >
                                        <FolderOpen size={14} />
                                    </Button>
                                </div>
                                <div className="mt-1 truncate text-[11px] text-muted-foreground" title={storagePathPreview || undefined}>
                                    {storagePathPreview || 'Project folder will use the app default location.'}
                                </div>
                                {pathConflictProject && (
                                    <div
                                        className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-500"
                                        title={`Folder is already used by project "${pathConflictProject.name}"`}
                                    >
                                        <AlertTriangle size={12} className="mt-[1px] shrink-0" />
                                        <span>
                                            Folder already exists in launcher: <span className="font-semibold">{pathConflictProject.name}</span>.
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </PanelFrame>
        </>
    );
};
