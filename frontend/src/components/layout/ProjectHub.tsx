import React from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { Disconnect } from '../../services/connectionService';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Button, ConfirmationModal, ModalBackdrop, ModalFrame, Spinner } from '../ui';
import { cn } from '../../lib/cn';
import { useToast } from './Toast';
import { sortProjects, getProjectIconKey, buildTagsWithProjectIcon, type ProjectIconKey } from './projectHubMeta';
import { ProjectWizard } from './project/ProjectWizard';
import { ProjectCard, ProjectCardEdit, type EditDraft } from './project/ProjectCard';
import { GetDefaultProjectStorageRoot, PickDirectory, openProjectFromDirectory } from '../../services/projectService';
import type { Project } from '../../types/project';
import appIcon from '../../assets/images/appicon.png';

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
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);
    const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);
    const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
    const [isSavingEdit, setIsSavingEdit] = React.useState(false);
    const [openingFolder, setOpeningFolder] = React.useState(false);
    const [editDraft, setEditDraft] = React.useState<EditDraft>({
        name: '',
        description: '',
        iconKey: 'general',
    });

    const sortedProjects = React.useMemo(() => sortProjects(projects), [projects]);
    const visibleProjects = sortedProjects;

    const handleOpenProject = async (projectId: string) => {
        setOpeningProjectId(projectId);
        try {
            try { await Disconnect(); } catch { /* ignore */ }
            const project = await openProject(projectId);
            if (!project) { resetRuntime(); return; }
            resetRuntime();
            onClose?.();
        } catch (error) {
            resetRuntime();
            toast.error(`Could not open project: ${error}`);
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
        } catch (error) {
            toast.error(`Could not open folder: ${error}`);
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
        });
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
            });
            if (!updated) {
                toast.error('Could not save project changes.');
                return;
            }
            setEditingProjectId(null);
            toast.success('Project updated.');
        } catch (error) {
            toast.error(`Could not save project: ${error}`);
        } finally {
            setIsSavingEdit(false);
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
        } catch (error) {
            toast.error(`Could not delete project: ${error}`);
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
            'overflow-hidden bg-bg-secondary text-text-primary transition-all duration-200',
            overlay
                ? 'h-[680px] w-[840px] max-w-[calc(100vw-24px)] rounded-md'
                : 'h-full w-full',
        )}>
            {surface === 'entry' ? (
                <div className="h-full min-h-0">
                    <ModalFrame
                        title="Projects"
                        onClose={overlay && onClose ? onClose : undefined}
                        className="h-full"
                        headerClassName="px-5 py-3.5"
                        bodyClassName="min-h-0 px-5 py-3"
                        titleClassName="text-[20px]"
                    >
                        <div className="grid h-full min-h-0 gap-4 grid-cols-[220px_minmax(0,1fr)]">
                            <aside className="">
                                <img src={appIcon} alt="Zentro app icon" className="h-full w-full object-contain" />
                            </aside>

                            <section className="h-full">
                                <div className="text-[11px] text-text-secondary">Recent Projects</div>
                                {visibleProjects.length === 0 && !isLoading ? (
                                    <div className="mt-3 flex items-center justify-center rounded-md border border-dashed border-border/45 bg-bg-secondary/35 px-4 text-center">
                                        <div className="max-w-70">
                                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-bg-secondary text-text-primary"><Plus size={16} /></div>
                                            <div className="mt-3 text-[14px] font-semibold text-text-primary">No project</div>
                                            <div className="mt-1 text-[11px] text-text-secondary">Create one to get started.</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-3 h-130 min-h-0 overflow-y-auto pr-1 space-y-1.5">
                                        {visibleProjects.map((project) => (
                                            editingProjectId === project.id ? (
                                                <ProjectCardEdit
                                                    key={project.id}
                                                    project={project}
                                                    editDraft={editDraft}
                                                    setEditDraft={setEditDraft}
                                                    isSaving={isSavingEdit}
                                                    onCancel={() => setEditingProjectId(null)}
                                                    onSave={(targetProject) => {
                                                        void handleSaveProjectEdit(targetProject);
                                                    }}
                                                />
                                            ) : (
                                                <div key={project.id} data-testid={`recent-project-${project.id}`}>
                                                    <ProjectCard
                                                        project={project}
                                                        activeProjectId={activeProject?.id}
                                                        isOpening={openingProjectId === project.id}
                                                        isDeleting={deletingProjectId === project.id}
                                                        onClick={() => {
                                                            void handleOpenProject(project.id);
                                                        }}
                                                        onEdit={(event) => {
                                                            event.stopPropagation();
                                                            startEditingProject(project);
                                                        }}
                                                        onDelete={(event) => {
                                                            event.stopPropagation();
                                                            setProjectToDelete(project);
                                                        }}
                                                    />
                                                </div>
                                            )
                                        ))}
                                        {error && (
                                            <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">{error}</div>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-between items-center ">
                                    <div className="text-[11px] text-text-secondary">{visibleProjects.length} projects</div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                void handleOpenProjectFolder();
                                            }}
                                            size="sm"
                                            className="rounded-md px-3"
                                            disabled={openingFolder || openingProjectId !== null}
                                            title="Open project folder"
                                        >
                                            {openingFolder ? <Spinner size={12} /> : <FolderOpen size={14} />}
                                        </Button>
                                        <Button
                                            variant="default"
                                            onClick={() => setSurface('wizard')}
                                            size="sm"
                                            className="rounded-md px-4"
                                        >
                                            Create
                                        </Button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </ModalFrame>
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
            <ModalBackdrop onClose={onClose} contentClassName="flex items-center justify-center">
                {content}
            </ModalBackdrop>
        );
    }
    return content;
};
