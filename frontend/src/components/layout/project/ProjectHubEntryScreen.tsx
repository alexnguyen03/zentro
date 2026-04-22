import React from 'react';
import { FolderOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { getEnvironmentMeta } from '../../../lib/projects';
import type { Project } from '../../../types/project';
import appIcon from '../../../assets/images/appicon.png';
import {
    PROJECT_ICON_MAP,
    PROJECT_ICON_OPTIONS,
    formatDateLabel,
    getProjectIconKey,
    type ProjectIconKey,
} from '../projectHubMeta';
import {
    Button,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Spinner,
} from '../../ui';

interface ProjectHubEntryScreenProps {
    projects: Project[];
    allProjectCount: number;
    isLoading: boolean;
    error: string | null;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    openingProjectId: string | null;
    deletingProjectId: string | null;
    openingFolder: boolean;
    onOpenProject: (projectId: string) => void;
    onStartCreate: () => void;
    onOpenProjectFolder: () => void;
    onStartEdit: (project: Project) => void;
    onOpenProjectInExplorer: (project: Project) => void;
    onSelectProjectIcon: (project: Project, iconKey: ProjectIconKey) => void;
    iconUpdatingProjectId: string | null;
    onRequestDelete: (project: Project) => void;
}

function formatCount(value: number, singular: string, plural: string): string {
    return `${value} ${value === 1 ? singular : plural}`;
}

interface EnvironmentTag {
    code: string;
    label: string;
    toneClass: string;
}

function buildEnvironmentTags(project: Project): EnvironmentTag[] {
    return (project.environments || []).map((environment) => {
        const key = environment.key.toLowerCase();
        const code = key.slice(0, 3).toUpperCase();
        const label = environment.label?.trim() || getEnvironmentMeta(environment.key).label;
        const toneClass = getEnvironmentMeta(environment.key).colorClass;

        return { code, label, toneClass };
    });
}

export const ProjectHubEntryScreen: React.FC<ProjectHubEntryScreenProps> = ({
    projects,
    allProjectCount,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    openingProjectId,
    deletingProjectId,
    openingFolder,
    onOpenProject,
    onStartCreate,
    onOpenProjectFolder,
    onStartEdit,
    onOpenProjectInExplorer,
    onSelectProjectIcon,
    iconUpdatingProjectId,
    onRequestDelete,
}) => {
    const newLocal = 'flex h-full min-h-[280px] items-center justify-center px-6 text-center';
    const [iconPickerOpenByProject, setIconPickerOpenByProject] = React.useState<Record<string, boolean>>({});

    return (
        <section className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
            <aside className="flex h-24 items-center justify-center rounded-lg bg-card text-foreground lg:h-auto lg:w-[50%]">
                <div className="text-center">
                    <img src={appIcon} alt="Zentro app icon" className="mx-auto h-72 w-72 object-contain lg:h-72 lg:w-72" />
                </div>
            </aside>

            <div className="flex min-h-0 flex-1 flex-col rounded-sm bg-card">
                <div className="px-3 py-3 lg:px-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                        <div className="text-[12px] font-semibold text-foreground">
                            {formatCount(projects.length, 'project', 'projects')}
                            {searchQuery.trim() && (
                                <span className="ml-2 text-[11px] font-medium text-muted-foreground">/ {allProjectCount} total</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <Input
                                placeholder="Find project by name, description, or tag"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={onOpenProjectFolder}
                                size="icon"
                                disabled={openingFolder || openingProjectId !== null}
                                title="Import project from folder"
                            >
                                {openingFolder ? <Spinner size={11} className="mr-1" /> : <FolderOpen size={13} />}
                            </Button>
                            <Button
                                variant="default"
                                onClick={onStartCreate}
                                size="icon"
                            >
                                <Plus size={13} />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Spinner size={20} />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className={newLocal}>
                            <div>
                                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Search size={14} /></div>
                                <div className="mt-2 text-[13px] font-semibold text-foreground">
                                    {searchQuery.trim() ? 'No matching project' : 'No project'}
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                    {searchQuery.trim() ? 'Try another keyword or clear search.' : 'Create or import one to get started.'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 px-3 pb-3 lg:px-4">
                            {projects.map((project) => {
                                const iconKey = getProjectIconKey(project);
                                const isOpening = openingProjectId === project.id;
                                const isDeleting = deletingProjectId === project.id;
                                const environmentTags = buildEnvironmentTags(project);
                                const isDisabled = isOpening || isDeleting;
                                const canOpenProject = !isDisabled;
                                const isUpdatingIcon = iconUpdatingProjectId === project.id;
                                const DisplayIcon = PROJECT_ICON_MAP[iconKey].icon;

                                return (
                                    <div key={project.id} className="rounded-sm bg-card">
                                        <div
                                            role={canOpenProject ? 'button' : undefined}
                                            tabIndex={canOpenProject ? 0 : -1}
                                            data-testid={`recent-project-${project.id}`}
                                            className={cn(
                                                'bg-primary/3',
                                                'hover:bg-primary/8',
                                                ' group relative flex items-start gap-3 rounded-sm px-3 py-3 text-left transition-all',
                                                // isActive ? 'border border-primary/35' : 'bg-muted/10',
                                                canOpenProject ? 'cursor-pointer' : 'cursor-default',
                                                isDisabled ? 'pointer-events-none opacity-70' : '',
                                            )}
                                            onClick={() => {
                                                if (!canOpenProject) return;
                                                onOpenProject(project.id);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    if (canOpenProject) onOpenProject(project.id);
                                                }
                                            }}
                                            aria-disabled={!canOpenProject}
                                        >
                                            <div className="flex w-full flex-col">
                                                <div className="flex w-full flex-1 items-start gap-2 pr-2">
                                                    <Popover
                                                        open={Boolean(iconPickerOpenByProject[project.id])}
                                                        onOpenChange={(isOpen) => setIconPickerOpenByProject((current) => ({ ...current, [project.id]: isOpen }))}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-md"
                                                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-muted text-primary outline-none transition hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                                                                title="Change project icon"
                                                                onClick={(event) => event.stopPropagation()}
                                                                onKeyDown={(event) => event.stopPropagation()}
                                                                disabled={isDisabled || isUpdatingIcon}
                                                            >
                                                                {isUpdatingIcon ? <Spinner size={16} /> : <DisplayIcon size={24} />}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent
                                                            className="z-topmost w-[560px] max-w-[calc(100vw-28px)] p-2"
                                                            align="start"
                                                            sideOffset={8}
                                                            onClick={(event) => event.stopPropagation()}
                                                        >
                                                            <div className="grid grid-cols-3 gap-1">
                                                                {PROJECT_ICON_OPTIONS.map((option) => {
                                                                    const OptionIcon = option.icon;
                                                                    const isSelected = iconKey === option.key;

                                                                    return (
                                                                        <Button
                                                                            key={option.key}
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                onSelectProjectIcon(project, option.key);
                                                                                setIconPickerOpenByProject((current) => ({ ...current, [project.id]: false }));
                                                                            }}
                                                                            className={cn(
                                                                                'flex items-center gap-2 rounded-sm border px-2.5 py-2 text-left text-[11px] transition-colors',
                                                                                isSelected
                                                                                    ? 'border-primary/60 bg-primary/10 text-foreground'
                                                                                    : 'border-border hover:bg-muted/60',
                                                                            )}
                                                                        >
                                                                            <OptionIcon size={14} />
                                                                            <span className="truncate">{option.label}</span>
                                                                        </Button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <div className="w-full mb-5">
                                                        <div className="truncate text-[13px] font-semibold text-foreground">{project.name}</div>
                                                        <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                                            {project.description?.trim() || 'No description yet.'}
                                                        </div>
                                                    </div>

                                                    <div className="flex min-h-18 shrink-0 flex-col items-end justify-between">
                                                        <div className="pt-0.5 text-[11px] text-muted-foreground">{formatDateLabel(project.updated_at)}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex items-center justify-between gap-2">
                                                    <div className="ml-3 flex flex-wrap items-center gap-1">
                                                        {environmentTags.length > 0 ? environmentTags.map((tag, index) => (
                                                            <span
                                                                key={`${project.id}-env-${index}`}
                                                                title={tag.label}
                                                                className={cn(
                                                                    'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
                                                                    tag.toneClass,
                                                                )}
                                                            >
                                                                {tag.code}
                                                            </span>
                                                        )) : (
                                                            <span className="rounded-full bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                                No env
                                                            </span>
                                                        )}
                                                    </div>

                                                    {isOpening && (
                                                        <div className="mt-1.5 flex items-center text-[11px] text-primary">
                                                            <Spinner size={11} className="mr-1" /> Opening...
                                                        </div>
                                                    )}

                                                    <div
                                                        className={cn(
                                                            'flex items-center gap-1 opacity-0 transition-opacity',
                                                            'group-hover:opacity-100 group-focus-within:opacity-100',
                                                            isDeleting ? 'opacity-100' : '',
                                                        )}
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className=" text-[11px]"
                                                            title="Edit project"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onStartEdit(project);
                                                            }}
                                                        >
                                                            <Pencil size={12} />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className=" text-[11px]"
                                                            title="Open in file explorer"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onOpenProjectInExplorer(project);
                                                            }}
                                                        >
                                                            <FolderOpen size={12} />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className=" text-[11px] text-destructive hover:text-destructive"
                                                            title="Delete project"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onRequestDelete(project);
                                                            }}
                                                            disabled={isDeleting}
                                                        >
                                                            {isDeleting ? <Spinner size={11} /> : <Trash2 size={12} />}
                                                        </Button>
                                                    </div>
                                                </div>


                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="m-3 rounded-sm bg-error/10 px-3 py-2 text-[12px] text-error">
                        {error}
                    </div>
                )}
            </div>
        </section>
    );
};
