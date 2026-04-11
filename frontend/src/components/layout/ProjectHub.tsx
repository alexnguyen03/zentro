import React from 'react';
import { Disconnect } from '../../services/connectionService';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConfirmationModal, OverlayDialog } from '../ui';
import { cn } from '../../lib/cn';
import { useToast } from './Toast';
import { buildTagsWithProjectIcon, getProjectIconKey, sortProjects, type ProjectIconKey } from './projectHubMeta';
import { ProjectWizard } from './project/ProjectWizard';
import { GetDefaultProjectStorageRoot, OpenDirectoryInExplorer, PickDirectory, openProjectFromDirectory } from '../../services/projectService';
import type { Project } from '../../types/project';
import { PanelFrame } from './PanelFrame';
import { ProjectHubEntryScreen, type EditDraft } from './project/ProjectHubEntryScreen';

type Surface = 'entry' | 'wizard';

interface ProjectHubProps {
    overlay?: boolean;
    startupMode?: boolean;
    onClose?: () => void;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, startupMode = false, onClose }) => {
    const { projects, isLoading, error, openProject, saveProject, deleteProject, activeProject } = useProjectStore();
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const { toast } = useToast();

    const [surface, setSurface] = React.useState<Surface>('entry');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);
    const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);
    const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
    const [isSavingEdit, setIsSavingEdit] = React.useState(false);
    const [iconUpdatingProjectId, setIconUpdatingProjectId] = React.useState<string | null>(null);
    const [openingFolder, setOpeningFolder] = React.useState(false);
    const [editDraft, setEditDraft] = React.useState<EditDraft>({
        name: '',
        description: '',
        iconKey: 'general',
        gitRepoPath: '',
    });

    const sortedProjects = React.useMemo(() => sortProjects(projects), [projects]);
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

    const startEditingProject = (project: Project) => {
        setEditingProjectId(project.id);
        setEditDraft({
            name: project.name || '',
            description: project.description || '',
            iconKey: getProjectIconKey(project) as ProjectIconKey,
            gitRepoPath: project.git_repo_path || '',
        });
    };

    const handleBrowseRepoPath = async () => {
        try {
            const selected = await PickDirectory('');
            if (selected) {
                setEditDraft((current) => ({ ...current, gitRepoPath: selected }));
            }
        } catch {
            // ignore picker error
        }
    };

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

    const handleSaveProjectEdit = async (project: Project) => {
        const nextName = editDraft.name.trim();
        if (!nextName) return;

        setIsSavingEdit(true);
        try {
            const updated = await saveProject({
                ...project,
                name: nextName,
                description: editDraft.description.trim(),
                tags: buildTagsWithProjectIcon(project.tags, editDraft.iconKey),
                git_repo_path: editDraft.gitRepoPath.trim() || undefined,
            });
            if (!updated) {
                toast.error('Could not save project changes.');
                return;
            }
            setEditingProjectId(null);
            toast.success('Project updated.');
        } catch (saveError) {
            toast.error(`Could not save project: ${saveError}`);
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleSelectProjectIcon = async (project: Project, nextIconKey: ProjectIconKey) => {
        if (getProjectIconKey(project) === nextIconKey) return;
        setIconUpdatingProjectId(project.id);
        try {
            const updated = await saveProject({
                ...project,
                tags: buildTagsWithProjectIcon(project.tags, nextIconKey),
            });
            if (!updated) {
                toast.error('Could not update project icon.');
            }
        } catch (saveError) {
            toast.error(`Could not update project icon: ${saveError}`);
        } finally {
            setIconUpdatingProjectId(null);
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
            if (editingProjectId === projectToDelete.id) {
                setEditingProjectId(null);
            }
        }
    };

    const content = (
        <div className={cn(
            'overflow-hidden bg-card text-foreground transition-all duration-200',
            overlay
                ? 'h-[700px] w-[1080px] max-w-[calc(100vw-24px)] rounded-sm'
                : 'h-full w-full',
        )}>
            {surface === 'entry' ? (
                <div className="h-full min-h-0">
                    <PanelFrame
                        title="Projects"
                        onClose={overlay && onClose ? onClose : undefined}
                        className="h-full"
                        headerClassName="px-6 py-4"
                        bodyClassName="min-h-0 px-6 pb-5 pt-4"
                        titleClassName="text-[30px]"
                    >
                        <ProjectHubEntryScreen
                            projects={visibleProjects}
                            allProjectCount={sortedProjects.length}
                            isLoading={isLoading}
                            error={error}
                            activeProjectId={activeProject?.id}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            openingProjectId={openingProjectId}
                            deletingProjectId={deletingProjectId}
                            editingProjectId={editingProjectId}
                            isSavingEdit={isSavingEdit}
                            openingFolder={openingFolder}
                            editDraft={editDraft}
                            setEditDraft={setEditDraft}
                            onOpenProject={(projectId) => {
                                void handleOpenProject(projectId);
                            }}
                            onStartCreate={() => setSurface('wizard')}
                            onOpenProjectFolder={() => {
                                void handleOpenProjectFolder();
                            }}
                            onStartEdit={startEditingProject}
                            onCancelEdit={() => setEditingProjectId(null)}
                            onSaveEdit={(project) => {
                                void handleSaveProjectEdit(project);
                            }}
                            onBrowseRepoPath={() => {
                                void handleBrowseRepoPath();
                            }}
                            onOpenProjectInExplorer={(project) => {
                                void handleOpenProjectInExplorer(project);
                            }}
                            onSelectProjectIcon={(project, iconKey) => {
                                void handleSelectProjectIcon(project, iconKey);
                            }}
                            iconUpdatingProjectId={iconUpdatingProjectId}
                            onRequestDelete={(project) => setProjectToDelete(project)}
                        />
                    </PanelFrame>
                </div>
            ) : (
                <ProjectWizard
                    overlay={overlay}
                    onClose={overlay ? () => setSurface('entry') : undefined}
                    onDone={() => onClose?.()}
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
