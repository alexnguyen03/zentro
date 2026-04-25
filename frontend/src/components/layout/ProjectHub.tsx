import React from 'react';
import { Disconnect } from '../../services/connectionService';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConfirmationModal, OverlayDialog } from '../ui';
import { cn } from '../../lib/cn';
import { useToast } from './Toast';
import {
    buildTagsWithProjectIcon,
    buildTagsWithProjectPinned,
    getProjectIconKey,
    isProjectPinned,
    sortProjects,
    type ProjectIconKey,
} from './projectHubMeta';
import { ProjectWizard } from './project/ProjectWizard';
import { GetDefaultProjectStorageRoot, OpenDirectoryInExplorer, PickDirectory, openProjectFromDirectory, saveProject as persistProject } from '../../services/projectService';
import type { Project, EnvironmentKey } from '../../types/project';
import { PanelFrame } from './PanelFrame';
import { ProjectHubEntryScreen } from './project/ProjectHubEntryScreen';
import { Spinner } from '../ui';
import { ENVIRONMENT_KEY, type ProjectHubLaunchContext, type ProjectHubLaunchIntent, type ProjectWizardMode } from '../../lib/constants';

type Surface = 'entry' | 'wizard';

interface ProjectHubProps {
    overlay?: boolean;
    startupMode?: boolean;
    onClose?: () => void;
    launchIntent?: ProjectHubLaunchIntent;
}

interface WizardState {
    mode: ProjectWizardMode;
    projectId: string | null;
    initialEnvironmentKey: EnvironmentKey;
    launchContext: ProjectHubLaunchContext;
}

function resolveDefaultEnvironment(project?: Project | null): EnvironmentKey {
    return (project?.last_active_environment_key || project?.default_environment_key || ENVIRONMENT_KEY.LOCAL) as EnvironmentKey;
}

function resolveLaunchState(
    launchIntent: ProjectHubLaunchIntent | undefined,
    activeProject: Project | null | undefined,
): { surface: Surface; wizardState: WizardState } {
    const defaultWizardState: WizardState = {
        mode: 'create',
        projectId: null,
        initialEnvironmentKey: resolveDefaultEnvironment(activeProject),
        launchContext: 'default',
    };

    if (!launchIntent) {
        return { surface: 'entry', wizardState: defaultWizardState };
    }

    const requestedSurface = launchIntent.surface || (launchIntent.wizardMode ? 'wizard' : 'entry');
    if (requestedSurface === 'entry') {
        return { surface: 'entry', wizardState: defaultWizardState };
    }

    const mode = launchIntent.wizardMode || 'create';
    const targetProjectId = mode === 'edit'
        ? (launchIntent.projectId || activeProject?.id || null)
        : null;

    return {
        surface: 'wizard',
        wizardState: {
            mode,
            projectId: targetProjectId,
            launchContext: launchIntent.launchContext || 'default',
            initialEnvironmentKey: (launchIntent.initialEnvironmentKey || resolveDefaultEnvironment(activeProject)) as EnvironmentKey,
        },
    };
}

export const ProjectHub: React.FC<ProjectHubProps> = ({
    overlay = false,
    startupMode = false,
    onClose,
    launchIntent,
}) => {
    const { projects, isLoading, error, openProject, deleteProject, activeProject } = useProjectStore();
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const { toast } = useToast();

    const [surface, setSurface] = React.useState<Surface>(() => resolveLaunchState(launchIntent, activeProject).surface);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);
    const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);
    const [iconUpdatingProjectId, setIconUpdatingProjectId] = React.useState<string | null>(null);
    const [pinUpdatingProjectId, setPinUpdatingProjectId] = React.useState<string | null>(null);
    const [openingFolder, setOpeningFolder] = React.useState(false);
    const [wizardState, setWizardState] = React.useState<WizardState>(() => resolveLaunchState(launchIntent, activeProject).wizardState);
    const [optimisticProjectsById, setOptimisticProjectsById] = React.useState<Record<string, Project>>({});

    const mergedProjects = React.useMemo(
        () => projects.map((project) => optimisticProjectsById[project.id] || project),
        [optimisticProjectsById, projects],
    );
    const sortedProjects = React.useMemo(() => sortProjects(mergedProjects), [mergedProjects]);
    const projectsById = React.useMemo(() => new Map(sortedProjects.map((project) => [project.id, project])), [sortedProjects]);
    const visibleProjects = React.useMemo(() => {
        const keyword = searchQuery.trim().toLowerCase();
        if (!keyword) return sortedProjects;
        return sortedProjects.filter((project) => {
            const haystack = [project.name, project.description || '', ...(project.tags || [])]
                .join(' ')
                .toLowerCase();
            return haystack.includes(keyword);
        });
    }, [searchQuery, sortedProjects]);

    React.useLayoutEffect(() => {
        const next = resolveLaunchState(launchIntent, activeProject);
        setWizardState(next.wizardState);
        setSurface(next.surface);
    }, [activeProject, launchIntent]);

    React.useEffect(() => {
        setOptimisticProjectsById((current) => {
            const validIds = new Set(projects.map((project) => project.id));
            const next: Record<string, Project> = {};
            let changed = false;
            Object.entries(current).forEach(([id, project]) => {
                if (validIds.has(id)) {
                    next[id] = project;
                } else {
                    changed = true;
                }
            });
            return changed ? next : current;
        });
    }, [projects]);

    const setOptimisticProject = React.useCallback((project: Project) => {
        setOptimisticProjectsById((current) => ({ ...current, [project.id]: project }));
    }, []);

    const handleOpenProject = async (projectId: string) => {
        setOpeningProjectId(projectId);
        try {
            try { await Disconnect(); } catch { /* ignore */ }
            const project = await openProject(projectId);
            if (!project) {
                resetRuntime();
                return;
            }
            resetRuntime();
            onClose?.();
        } catch (openError) {
            resetRuntime();
            toast.error(`Could not open project: ${openError}`);
        } finally {
            setOpeningProjectId(null);
        }
    };

    const handleOpenProjectFolder = async () => {
        setOpeningFolder(true);
        try {
            const defaultRoot = await GetDefaultProjectStorageRoot();
            const selectedDirectory = await PickDirectory(defaultRoot || '');
            if (!selectedDirectory) return;

            try { await Disconnect(); } catch { /* ignore */ }
            const project = await openProjectFromDirectory(selectedDirectory);
            if (!project) {
                toast.error('Could not open project from selected folder.');
                return;
            }
            resetRuntime();
            onClose?.();
        } catch (openError) {
            toast.error(`Could not open folder: ${openError}`);
        } finally {
            setOpeningFolder(false);
        }
    };

    const startCreateProject = React.useCallback(() => {
        setWizardState({
            mode: 'create',
            projectId: null,
            launchContext: 'default',
            initialEnvironmentKey: resolveDefaultEnvironment(activeProject),
        });
        setSurface('wizard');
    }, [activeProject]);

    const startEditingProject = React.useCallback((project: Project, context: ProjectHubLaunchContext = 'default') => {
        setWizardState({
            mode: 'edit',
            projectId: project.id,
            launchContext: context,
            initialEnvironmentKey: resolveDefaultEnvironment(project),
        });
        setSurface('wizard');
    }, []);

    const handleOpenProjectInExplorer = async (project: Project) => {
        const targetPath = (project.git_repo_path || project.storage_path || '').trim();
        if (!targetPath) {
            toast.error('Project does not have a folder path yet.');
            return;
        }
        try {
            await OpenDirectoryInExplorer(targetPath);
        } catch (openError) {
            toast.error(`Could not open project folder: ${openError}`);
        }
    };

    const handleSelectProjectIcon = async (project: Project, nextIconKey: ProjectIconKey) => {
        if (getProjectIconKey(project) === nextIconKey) return;
        const previousProject = projectsById.get(project.id) || project;
        const optimisticProject: Project = {
            ...previousProject,
            tags: buildTagsWithProjectIcon(previousProject.tags, nextIconKey),
        };
        setOptimisticProject(optimisticProject);
        setIconUpdatingProjectId(project.id);
        try {
            const updated = await persistProject(optimisticProject);
            if (!updated) {
                setOptimisticProject(previousProject);
                toast.error('Could not update project icon.');
                return;
            }
            setOptimisticProject(updated);
        } catch (saveError) {
            setOptimisticProject(previousProject);
            toast.error(`Could not update project icon: ${saveError}`);
        } finally {
            setIconUpdatingProjectId(null);
        }
    };

    const handleToggleProjectPin = async (project: Project) => {
        const previousProject = projectsById.get(project.id) || project;
        const currentlyPinned = isProjectPinned(previousProject);
        const optimisticProject: Project = {
            ...previousProject,
            tags: buildTagsWithProjectPinned(previousProject.tags, !currentlyPinned),
        };
        setOptimisticProject(optimisticProject);
        setPinUpdatingProjectId(project.id);
        try {
            const updated = await persistProject(optimisticProject);
            if (!updated) {
                setOptimisticProject(previousProject);
                toast.error(`Could not ${currentlyPinned ? 'unpin' : 'pin'} project.`);
                return;
            }
            setOptimisticProject(updated);
        } catch (saveError) {
            setOptimisticProject(previousProject);
            toast.error(`Could not ${currentlyPinned ? 'unpin' : 'pin'} project: ${saveError}`);
        } finally {
            setPinUpdatingProjectId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!projectToDelete) return;
        setDeletingProjectId(projectToDelete.id);
        try {
            const deleted = await deleteProject(projectToDelete.id);
            if (!deleted) {
                toast.error('Could not delete project.');
                return;
            }
            toast.success('Project removed from launcher. Data folder is kept on disk.');
        } catch (deleteError) {
            toast.error(`Could not delete project: ${deleteError}`);
        } finally {
            setDeletingProjectId(null);
            setProjectToDelete(null);
        }
    };

    const wizardProject = wizardState.projectId
        ? (projectsById.get(wizardState.projectId) || (activeProject?.id === wizardState.projectId ? activeProject : null))
        : null;

    // Don't render the wizard surface until the edit project is resolved — avoids
    // a flash of the entry screen or create-mode wizard while the store hydrates.
    const waitingForWizardProject = (
        surface === 'wizard'
        && wizardState.mode === 'edit'
        && Boolean(wizardState.projectId)
        && !wizardProject
        && isLoading
    );
    const wizardProjectMissing = (
        surface === 'wizard'
        && wizardState.mode === 'edit'
        && Boolean(wizardState.projectId)
        && !wizardProject
        && !isLoading
    );

    const handleWizardClose = React.useCallback(() => {
        if (wizardState.launchContext === 'env-config') {
            onClose?.();
            if (!onClose) setSurface('entry');
            return;
        }
        setSurface('entry');
    }, [onClose, wizardState.launchContext]);

    const handleWizardDone = React.useCallback(() => {
        if (onClose) {
            onClose();
            return;
        }
        setSurface('entry');
    }, [onClose]);

    const content = (
        <div className={cn(
            'overflow-hidden bg-card text-foreground transition-all duration-200',
            overlay
                ? 'h-145 w-215 max-w-[calc(100vw-24px)] rounded-sm'
                : 'h-full w-full',
        )}>
            {waitingForWizardProject ? (
                <div className="flex h-full items-center justify-center gap-2 text-small text-muted-foreground">
                    <Spinner size={14} />
                    Loading...
                </div>
            ) : wizardProjectMissing ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-small text-muted-foreground">
                    Project not found. It may have been removed.
                </div>
            ) : surface === 'entry' ? (
                <div className="h-full min-h-0">
                    <PanelFrame
                        title="Projects"
                        onClose={overlay && onClose ? onClose : undefined}
                        className="h-full"
                        headerClassName="px-6 py-4"
                        bodyClassName="min-h-0 px-6 pb-5 pt-4"
                        titleClassName="text-h1"
                    >
                        <ProjectHubEntryScreen
                            projects={visibleProjects}
                            allProjectCount={sortedProjects.length}
                            isLoading={isLoading}
                            error={error}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            openingProjectId={openingProjectId}
                            deletingProjectId={deletingProjectId}
                            openingFolder={openingFolder}
                            onOpenProject={(projectId) => {
                                void handleOpenProject(projectId);
                            }}
                            onStartCreate={startCreateProject}
                            onOpenProjectFolder={() => {
                                void handleOpenProjectFolder();
                            }}
                            onStartEdit={(project) => startEditingProject(project, 'default')}
                            onOpenProjectInExplorer={(project) => {
                                void handleOpenProjectInExplorer(project);
                            }}
                            onSelectProjectIcon={(project, iconKey) => {
                                void handleSelectProjectIcon(project, iconKey);
                            }}
                            iconUpdatingProjectId={iconUpdatingProjectId}
                            onToggleProjectPin={(project) => {
                                void handleToggleProjectPin(project);
                            }}
                            pinUpdatingProjectId={pinUpdatingProjectId}
                            onRequestDelete={(project) => setProjectToDelete(project)}
                        />
                    </PanelFrame>
                </div>
            ) : (
                <ProjectWizard
                    mode={wizardState.mode}
                    launchContext={wizardState.launchContext}
                    project={wizardProject || undefined}
                    initialEnvironmentKey={wizardState.initialEnvironmentKey}
                    overlay={overlay}
                    onClose={handleWizardClose}
                    onDone={handleWizardDone}
                />
            )}
            <ConfirmationModal
                isOpen={Boolean(projectToDelete)}
                onClose={() => setProjectToDelete(null)}
                onConfirm={() => {
                    void handleConfirmDelete();
                }}
                title="Remove Project"
                message={`Remove "${projectToDelete?.name || 'this project'}" from launcher?`}
                description="Project data on disk will be kept."
                confirmLabel="Remove"
                variant="destructive"
            />
        </div>
    );

    if (overlay) {
        return (
            <OverlayDialog onClose={onClose} contentClassName="flex items-center justify-center">
                {content}
            </OverlayDialog>
        );
    }

    return content;
};
