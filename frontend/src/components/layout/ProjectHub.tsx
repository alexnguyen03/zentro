import React from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import { Disconnect } from '../../services/connectionService';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { getEnvironmentMeta } from '../../lib/projects';
import { Button, ModalBackdrop, ModalFrame, Spinner } from '../ui';
import { cn } from '../../lib/cn';
import type { Project } from '../../types/project';
import { useToast } from './Toast';
import { sortProjects, getProjectIconKey } from './projectHubMeta';
import { ProjectWizard } from './project/ProjectWizard';
import { ProjectCard, ProjectCardEdit, type EditDraft } from './project/ProjectCard';
import { buildTagsWithProjectIcon } from './projectHubMeta';
import type { ProjectIconKey } from './projectHubMeta';

type Surface = 'entry' | 'wizard';

interface ProjectHubProps {
    overlay?: boolean;
    onClose?: () => void;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, onClose }) => {
    const { projects, activeProject, isLoading, error, openProject, deleteProject, saveProject } = useProjectStore();
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const { toast } = useToast();

    const [surface, setSurface] = React.useState<Surface>('entry');
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = React.useState<string | null>(null);
    const [savingProjectId, setSavingProjectId] = React.useState<string | null>(null);
    const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
    const [editDraft, setEditDraft] = React.useState<EditDraft>({ name: '', description: '', iconKey: 'general' });

    const sortedProjects = React.useMemo(() => sortProjects(projects), [projects]);
    const recentProject = sortedProjects[0] || null;

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

    const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setDeletingProjectId(projectId);
        try {
            const success = await deleteProject(projectId);
            if (success) toast.success('Project deleted');
            else toast.error('Failed to delete project');
        } catch (error) {
            toast.error(`Could not delete project: ${error}`);
        } finally {
            setDeletingProjectId(null);
        }
    };

    const handleEditProject = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setEditingProjectId(project.id);
        setEditDraft({ name: project.name, description: project.description || '', iconKey: getProjectIconKey(project) as ProjectIconKey });
    };

    const handleSaveProjectDetails = async (project: Project) => {
        const nextName = editDraft.name.trim();
        if (!nextName) { toast.error('Project name is required.'); return; }

        setSavingProjectId(project.id);
        try {
            const saved = await saveProject({
                ...project,
                name: nextName,
                description: editDraft.description.trim(),
                tags: buildTagsWithProjectIcon(project.tags, editDraft.iconKey),
            });
            if (!saved) { toast.error('Could not update project.'); return; }
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
            'overflow-hidden bg-bg-secondary text-text-primary transition-all duration-200',
            overlay
                ? surface === 'wizard'
                    ? 'h-[680px] w-[840px] max-w-[calc(100vw-24px)] rounded-md'
                    : 'h-[560px] w-[460px] max-w-[calc(100vw-24px)] rounded-md'
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
                                    <Button variant="primary" onClick={() => setSurface('wizard')} size="sm" className="rounded-md px-4">Create</Button>
                                </div>
                            </div>
                        )}
                    >
                        {sortedProjects.length === 0 && !isLoading ? (
                            <div className="flex h-full min-h-[220px] items-center justify-center rounded-md border border-dashed border-border/50 bg-bg-primary/30 px-6 text-center">
                                <div className="max-w-[340px]">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-bg-secondary text-text-primary"><Plus size={18} /></div>
                                    <div className="mt-4 text-[15px] font-semibold text-text-primary">No projects yet</div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedProjects.map((project) => {
                                    const isEditing = editingProjectId === project.id;
                                    const isDeleting = deletingProjectId === project.id;
                                    const isOpening = openingProjectId === project.id;
                                    const isSaving = savingProjectId === project.id;

                                    if (isEditing) {
                                        return (
                                            <ProjectCardEdit
                                                key={project.id}
                                                project={project}
                                                editDraft={editDraft}
                                                setEditDraft={setEditDraft}
                                                isSaving={isSaving}
                                                onCancel={() => setEditingProjectId(null)}
                                                onSave={(p) => void handleSaveProjectDetails(p)}
                                            />
                                        );
                                    }

                                    return (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            activeProjectId={activeProject?.id}
                                            isOpening={isOpening}
                                            isDeleting={isDeleting}
                                            onClick={() => void handleOpenProject(project.id)}
                                            onEdit={(e) => handleEditProject(e, project)}
                                            onDelete={(e) => void handleDeleteProject(e, project.id)}
                                        />
                                    );
                                })}
                                {error && (
                                    <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-[12px] text-error">{error}</div>
                                )}
                            </div>
                        )}
                    </ModalFrame>
                </div>
            ) : (
                <ProjectWizard
                    overlay={overlay}
                    onClose={overlay ? () => setSurface('entry') : undefined}
                    onDone={() => onClose?.()}
                />
            )}
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
