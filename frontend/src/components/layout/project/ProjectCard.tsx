import React from 'react';
import { Check, FolderOpen, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { getEnvironmentMeta } from '../../../lib/projects';
import { ENVIRONMENT_KEY } from '../../../lib/constants';
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
    gitRepoPath: string;
}

interface ProjectCardEditProps {
    project: Project;
    editDraft: EditDraft;
    setEditDraft: React.Dispatch<React.SetStateAction<EditDraft>>;
    isSaving: boolean;
    onCancel: () => void;
    onSave: (project: Project) => void;
    onBrowseRepoPath?: () => void;
}

export const ProjectCardEdit: React.FC<ProjectCardEditProps> = ({
    project, editDraft, setEditDraft, isSaving, onCancel, onSave, onBrowseRepoPath,
}) => {
    const envKey = project.last_active_environment_key || project.default_environment_key || ENVIRONMENT_KEY.LOCAL;
    const envMeta = getEnvironmentMeta(envKey);

    return (
        <div className="rounded-md bg-background/50 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-card text-foreground">
                        {React.createElement(PROJECT_ICON_MAP[editDraft.iconKey].icon, { size: 16 })}
                    </div>
                    <div>
                        <div className="text-[14px] font-semibold text-foreground">Edit project details</div>
                        <div className="text-[11px] text-muted-foreground">Update name, description, and icon</div>
                    </div>
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>{envKey}</span>
            </div>

            <div className="mt-4 grid gap-3">
                <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-foreground">Project name</label>
                    <Input value={editDraft.name} onChange={(e) => setEditDraft((c) => ({ ...c, name: e.target.value }))} inputSize="xl" className="bg-card" placeholder="Project name" autoFocus />
                </div>
                <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-foreground">Description</label>
                    <Input value={editDraft.description} onChange={(e) => setEditDraft((c) => ({ ...c, description: e.target.value }))} inputSize="xl" className="bg-card" placeholder="Short context about this project" />
                </div>
                <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-foreground">Git repo path <span className="font-normal text-muted-foreground">(Source Control)</span></label>
                    <div className="flex gap-2">
                        <Input
                            value={editDraft.gitRepoPath}
                            onChange={(e) => setEditDraft((c) => ({ ...c, gitRepoPath: e.target.value }))}
                            inputSize="xl"
                            className="flex-1 bg-card font-mono"
                            placeholder="/path/to/your/repo"
                        />
                        {onBrowseRepoPath && (
                            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-md" title="Browse folder" onClick={onBrowseRepoPath}>
                                <FolderOpen size={14} />
                            </Button>
                        )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Point to a local git repository to enable the Source Control panel.</p>
                </div>
            </div>

            <div className="mt-4">
                <div className="text-[12px] font-semibold text-foreground">Project icon by domain</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {PROJECT_ICON_OPTIONS.map((option) => {
                        const OptionIcon = option.icon;
                        const active = editDraft.iconKey === option.key;
                        return (
                            <Button
                                key={option.key} type="button"
                                variant="outline"
                                onClick={() => setEditDraft((c) => ({ ...c, iconKey: option.key }))}
                                className={cn('h-auto w-full justify-start gap-2 rounded-md px-3 py-2 text-left text-[12px] transition-colors', active ? 'border-accent/50 bg-accent/10 text-foreground' : 'border-border/30 bg-card text-muted-foreground hover:text-foreground')}
                            >
                                <OptionIcon size={14} /><span>{option.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving} className="rounded-md"><X size={14} /> Cancel</Button>
                <Button variant="default" size="sm" onClick={() => onSave(project)} disabled={isSaving || !editDraft.name.trim()} className="rounded-md">
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
    const envKey = project.last_active_environment_key || project.default_environment_key || ENVIRONMENT_KEY.LOCAL;
    const envMeta = getEnvironmentMeta(envKey);
    const ready = isProjectUsable(project);
    const isCurrentProject = activeProjectId === project.id;
    const iconOption = PROJECT_ICON_MAP[getProjectIconKey(project)];
    const ProjectIcon = iconOption.icon;
    const disabled = isOpening || isDeleting;

    return (
        <div
            className={cn(
                'group relative w-full',
                disabled && 'opacity-70'
            )}
        >
            <Button
                type="button"
                variant="ghost"
                className={cn(
                    'relative h-auto w-full justify-start rounded-md bg-background/35 px-4 py-3.5 pr-24 text-left transition-colors hover:bg-background/60',
                    isCurrentProject && 'border border-accent/45',
                    disabled && 'cursor-not-allowed',
                )}
                onClick={onClick}
                disabled={disabled}
                title={`Open project ${project.name}`}
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card text-foreground">
                    <ProjectIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-foreground">{project.name}</div>
                    {project.description && (
                        <p className="m-0 mt-1 line-clamp-1 text-[12px] text-muted-foreground">{project.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{project.environments?.length ?? 0} environments</span>
                        <span>{project.connections?.length ?? 0} bindings</span>
                        <span>{formatDateLabel(project.updated_at)}</span>
                    </div>
                </div>
                <div className="absolute top-3 right-3">
                    <div className="gap-1 flex">
                        {!ready && (
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', ready ? 'border-success/30 bg-success/10 text-success' : 'border-amber-400/30 bg-amber-400/10 text-amber-300')}>
                                Needs setup
                            </span>
                        )}
                        <span title='Last used' className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]', envMeta.colorClass)}>{envKey}</span>
                    </div>
                </div>
            </Button>

            <div className="absolute right-3 bottom-3 z-[2] flex shrink-0 items-center gap-2">
                <Button
                    type="button"
                    onClick={onEdit}
                    variant="ghost"
                    size="icon"
                    disabled={isDeleting || isOpening}
                    className="h-7 w-7 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-accent/10 hover:text-accent group-hover:opacity-100 disabled:opacity-50"
                    title="Edit project"
                >
                    <Pencil size={14} />
                </Button>
                <Button
                    type="button"
                    onClick={onDelete}
                    variant="ghost"
                    size="icon"
                    disabled={isDeleting || isOpening}
                    className="h-7 w-7 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                    title="Delete project"
                >
                    {isDeleting ? <Spinner size={14} /> : <Trash2 size={14} />}
                </Button>
                {isOpening && <Spinner size={14} className="text-muted-foreground" />}
            </div>
        </div>
    );
};

export { buildTagsWithProjectIcon, getProjectIconKey };
export type { EditDraft };
