import React from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { getEnvironmentMeta } from '../../../lib/projects';
import { Button, Input, Spinner } from '../../ui';
import type { Project } from '../../../types/project';
import {
    PROJECT_ICON_MAP,
    PROJECT_ICON_OPTIONS,
    buildTagsWithProjectIcon,
    formatDateLabel,
    getProjectIconKey,
    isProjectUsable,
    type ProjectIconKey,
} from '../projectHubMeta';

// ── Edit-in-place form ────────────────────────────────────────────────────────

interface EditDraft {
    name: string;
    description: string;
    iconKey: ProjectIconKey;
}

interface ProjectCardEditProps {
    project: Project;
    editDraft: EditDraft;
    setEditDraft: React.Dispatch<React.SetStateAction<EditDraft>>;
    isSaving: boolean;
    onCancel: () => void;
    onSave: (project: Project) => void;
}

export const ProjectCardEdit: React.FC<ProjectCardEditProps> = ({
    project, editDraft, setEditDraft, isSaving, onCancel, onSave,
}) => {
    const envKey = project.last_active_environment_key || project.default_environment_key || 'loc';
    const envMeta = getEnvironmentMeta(envKey);

    return (
        <div className="rounded-lg bg-bg-primary/50 px-5 py-5">
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
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>{envKey}</span>
            </div>

            <div className="mt-4 grid gap-3">
                <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-text-primary">Project name</label>
                    <Input value={editDraft.name} onChange={(e) => setEditDraft((c) => ({ ...c, name: e.target.value }))} className="h-10 rounded-lg bg-bg-secondary" placeholder="Project name" autoFocus />
                </div>
                <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-text-primary">Description</label>
                    <Input value={editDraft.description} onChange={(e) => setEditDraft((c) => ({ ...c, description: e.target.value }))} className="h-10 rounded-lg bg-bg-secondary" placeholder="Short context about this project" />
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
                                key={option.key} type="button"
                                onClick={() => setEditDraft((c) => ({ ...c, iconKey: option.key }))}
                                className={cn('cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors', active ? 'border-accent/50 bg-accent/10 text-text-primary' : 'border-border/30 bg-bg-secondary text-text-secondary hover:text-text-primary')}
                            >
                                <OptionIcon size={14} /><span>{option.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving} className="rounded-lg"><X size={14} /> Cancel</Button>
                <Button variant="primary" size="sm" onClick={() => onSave(project)} disabled={isSaving || !editDraft.name.trim()} className="rounded-lg">
                    {isSaving ? <><Spinner size={12} className="mr-1 text-white" /> Saving...</> : <><Check size={14} /> Save changes</>}
                </Button>
            </div>
        </div>
    );
};

// ── Read-only card ────────────────────────────────────────────────────────────

interface ProjectCardProps {
    project: Project;
    activeProjectId?: string;
    isOpening: boolean;
    isDeleting: boolean;
    onClick: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project, activeProjectId, isOpening, isDeleting, onClick, onEdit, onDelete,
}) => {
    const envKey = project.last_active_environment_key || project.default_environment_key || 'loc';
    const envMeta = getEnvironmentMeta(envKey);
    const ready = isProjectUsable(project);
    const isCurrentProject = activeProjectId === project.id;
    const iconOption = PROJECT_ICON_MAP[getProjectIconKey(project)];
    const ProjectIcon = iconOption.icon;

    return (
        <button
            type="button"
            onClick={() => !isDeleting && onClick()}
            disabled={isOpening || isDeleting}
            className={cn(
                'group relative w-full cursor-pointer rounded-lg bg-bg-primary/35 px-4 py-3.5 pr-24 text-left transition-colors hover:bg-bg-primary/60',
                isCurrentProject && 'border border-accent/45',
            )}
        >
            <div className="absolute top-3 right-3">
                <div className="gap-1 flex">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', ready ? 'border-success/30 bg-success/10 text-success' : 'border-amber-400/30 bg-amber-400/10 text-amber-300')}>
                        {ready ? 'Ready' : 'Needs setup'}
                    </span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>{envKey}</span>
                </div>
            </div>

            <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-text-primary">
                    <ProjectIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-text-primary">{project.name}</div>
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
                        type="button" onClick={onEdit}
                        disabled={isDeleting || isOpening}
                        className="cursor-pointer rounded-lg p-1.5 text-text-secondary opacity-0 transition-all hover:bg-accent/10 hover:text-accent group-hover:opacity-100 disabled:opacity-50"
                        title="Edit project"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        type="button" onClick={onDelete}
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
};

export { buildTagsWithProjectIcon, getProjectIconKey };
export type { EditDraft };
