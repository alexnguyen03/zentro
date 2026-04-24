import React from 'react';
import { FolderOpen, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { getEnvironmentMeta } from '../../../lib/projects';
import { ENVIRONMENT_KEY } from '../../../lib/constants';
import type { Project } from '../../../types/project';
import {
    isProjectPinned,
    PROJECT_ICON_MAP,
    PROJECT_ICON_OPTIONS,
    getProjectIconKey,
    type ProjectIconKey,
} from '../projectHubMeta';
import {
    Button,
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
    Input,
    Spinner,
} from '../../ui';
import { EnvironmentBadge } from '../../shared/EnvironmentBadge';

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
    onToggleProjectPin: (project: Project) => void;
    pinUpdatingProjectId: string | null;
    onRequestDelete: (project: Project) => void;
}

interface EnvironmentTag {
    code: string;
    label: string;
    toneClass: string;
}

type ProjectTabKey = 'all' | 'pinned' | 'production' | 'local-only';

const PROJECT_TABS: Array<{ key: ProjectTabKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'production', label: 'Production' },
    { key: 'local-only', label: 'Local-only' },
];

function buildEnvironmentTags(project: Project): EnvironmentTag[] {
    return (project.environments || []).map((environment) => {
        const key = environment.key.toLowerCase();
        const code = key.slice(0, 3).toUpperCase();
        const label = environment.label?.trim() || getEnvironmentMeta(environment.key).label;
        const toneClass = getEnvironmentMeta(environment.key).colorClass;

        return { code, label, toneClass };
    });
}

function hasProductionEnvironment(project: Project): boolean {
    return (project.environments || []).some((environment) => environment.key === ENVIRONMENT_KEY.PRODUCTION);
}

function isLocalOnlyProject(project: Project): boolean {
    const keys = Array.from(new Set((project.environments || []).map((environment) => environment.key)));
    return keys.length > 0 && keys.every((key) => key === ENVIRONMENT_KEY.LOCAL);
}

function formatRelativeDate(value?: string): string {
    if (!value) return 'unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays <= 7) return 'last week';
    const weeks = Math.ceil(diffDays / 7);
    return weeks <= 1 ? 'last week' : `${weeks} wks ago`;
}

function matchesTab(project: Project, tab: ProjectTabKey): boolean {
    if (tab === 'all') return true;
    if (tab === 'pinned') return isProjectPinned(project);
    if (tab === 'production') return hasProductionEnvironment(project);
    return isLocalOnlyProject(project);
}

function tabCount(projects: Project[], tab: ProjectTabKey): number {
    return tab === 'all' ? projects.length : projects.filter((project) => matchesTab(project, tab)).length;
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
    onToggleProjectPin,
    pinUpdatingProjectId,
    onRequestDelete,
}) => {
    const [activeTab, setActiveTab] = React.useState<ProjectTabKey>('all');
    const [contextSelectedProjectId, setContextSelectedProjectId] = React.useState<string | null>(null);
    const tabbedProjects = React.useMemo(
        () => projects.filter((project) => matchesTab(project, activeTab)),
        [activeTab, projects],
    );
    const hasAnyProject = projects.length > 0;
    const hasFilteredProject = tabbedProjects.length > 0;

    return (
        <section className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {PROJECT_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'relative h-9 border-b-[3px] px-2 text-section transition-colors',
                                activeTab === tab.key
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <span>{tab.label}</span>
                            <span className="ml-2 text-section font-normal opacity-90">{tabCount(projects, tab.key)}</span>
                        </button>
                    ))}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Input
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-20 lg:w-45"
                    />
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
                        size="sm"
                        className="px-2.5"
                    >
                        <Plus size={13} />
                        New
                    </Button>
                </div>
            </div>

            <div
                className={cn(
                    'min-h-0 flex-1',
                    contextSelectedProjectId ? 'overflow-hidden' : 'overflow-y-auto',
                )}
                onWheelCapture={(event) => {
                    if (contextSelectedProjectId) {
                        event.preventDefault();
                    }
                }}
            >
                <div className="py-2 lg:px-4">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Spinner size={20} />
                        </div>
                    ) : !hasAnyProject ? (
                        <div className="flex min-h-70 items-center justify-center text-center">
                            <div>
                                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Search size={14} /></div>
                                <div className="mt-2 text-small font-semibold text-foreground">
                                    No project
                                </div>
                                <div className="mt-1 text-label text-muted-foreground">
                                    Create or import one to get started.
                                </div>
                            </div>
                        </div>
                    ) : !hasFilteredProject ? (
                        <div className="flex min-h-[280px] items-center justify-center px-6 text-center">
                            <div>
                                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Search size={14} /></div>
                                <div className="mt-2 text-small font-semibold text-foreground">
                                    No matching project
                                </div>
                                <div className="mt-1 text-label text-muted-foreground">
                                    Try another keyword or switch filter tab.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-sm">
                            {tabbedProjects.map((project) => {
                                const iconKey = getProjectIconKey(project);
                                const isOpening = openingProjectId === project.id;
                                const isDeleting = deletingProjectId === project.id;
                                const environmentTags = buildEnvironmentTags(project);
                                const isDisabled = isOpening || isDeleting;
                                const isUpdatingIcon = iconUpdatingProjectId === project.id;
                                const isUpdatingPin = pinUpdatingProjectId === project.id;
                                const DisplayIcon = PROJECT_ICON_MAP[iconKey].icon;
                                const pinned = isProjectPinned(project);
                                const dateLabel = formatRelativeDate(project.updated_at);
                                const isContextSelected = contextSelectedProjectId === project.id;

                                return (
                                    <ContextMenu
                                        key={project.id}
                                        modal={false}
                                        onOpenChange={(open) => {
                                            setContextSelectedProjectId((current) => {
                                                if (open) return project.id;
                                                return current === project.id ? null : current;
                                            });
                                        }}
                                    >
                                        <ContextMenuTrigger asChild disabled={isDisabled}>
                                            <div
                                                role="button"
                                                tabIndex={isDisabled ? -1 : 0}
                                                data-testid={`recent-project-${project.id}`}
                                                className={cn(
                                                    'group relative flex min-h-16 items-start gap-3 py-2 text-left transition-colors bg-primary/2 mb-2 p-3 rounded-sm',
                                                    isContextSelected ? 'bg-primary/5' : 'hover:bg-primary/5',
                                                    isDisabled ? 'cursor-default opacity-60' : 'cursor-pointer',
                                                )}
                                                onContextMenu={() => setContextSelectedProjectId(project.id)}
                                                onClick={() => {
                                                    if (!isDisabled) onOpenProject(project.id);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        if (!isDisabled) onOpenProject(project.id);
                                                    }
                                                }}
                                                aria-disabled={isDisabled}
                                            >
                                                <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                                                    <DisplayIcon size={20} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 pr-8">
                                                        <div className="truncate font-semibold text-foreground">{project.name}</div>
                                                    </div>
                                                    <div className={cn(
                                                        'mt-0.5 truncate text-label!',
                                                        project.description?.trim() ? 'text-muted-foreground' : 'text-muted-foreground/55',
                                                    )}>
                                                        {project.description?.trim() || 'No description'}
                                                    </div>
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                                        {environmentTags.length > 0 ? environmentTags.map((tag, index) => (
                                                            <EnvironmentBadge
                                                                key={`${project.id}-env-${index}`}
                                                                title={tag.label}
                                                                label={tag.code}
                                                                toneClassName={tag.toneClass}
                                                            />
                                                        )) : (
                                                            <span className="rounded-full bg-muted/35 px-1.5 py-0.5 text-label text-muted-foreground">
                                                                No env
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    title={pinned ? 'Unpin project' : 'Pin project'}
                                                    aria-label={pinned ? 'Unpin project' : 'Pin project'}
                                                    data-testid={`project-pin-toggle-${project.id}`}
                                                    disabled={isDisabled || isUpdatingPin}
                                                    className={cn(
                                                        'absolute right-3 top-2 h-5 w-5 p-0',
                                                        (pinned || isUpdatingPin)
                                                            ? 'opacity-100 text-primary hover:text-primary'
                                                            : 'opacity-0 text-muted-foreground/65 hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100',
                                                    )}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onToggleProjectPin(project);
                                                    }}
                                                    onKeyDown={(event) => event.stopPropagation()}
                                                >
                                                    {isUpdatingPin ? <Spinner size={10} /> : <Pin size={12} />}
                                                </Button>
                                                <div className="absolute right-3 bottom-3 text-label text-muted-foreground">
                                                    {isOpening ? (
                                                        <span className="inline-flex items-center gap-1 text-primary">
                                                            <Spinner size={10} /> Opening...
                                                        </span>
                                                    ) : (
                                                        dateLabel
                                                    )}
                                                </div>
                                            </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="min-w-50">
                                            <ContextMenuItem disabled={isDisabled} onSelect={() => onOpenProject(project.id)}>
                                                Open project
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                disabled={isDisabled || isUpdatingPin}
                                                onSelect={() => onToggleProjectPin(project)}
                                            >
                                                {pinned ? <PinOff size={13} className="mr-1.5" /> : <Pin size={13} className="mr-1.5" />}
                                                {pinned ? 'Unpin project' : 'Pin project'}
                                            </ContextMenuItem>
                                            <ContextMenuSub>
                                                <ContextMenuSubTrigger disabled={isDisabled || isUpdatingIcon}>
                                                    Change icon
                                                </ContextMenuSubTrigger>
                                                <ContextMenuSubContent className="min-w-[180px]">
                                                    {PROJECT_ICON_OPTIONS.map((option) => {
                                                        const OptionIcon = option.icon;
                                                        const selected = option.key === iconKey;
                                                        return (
                                                            <ContextMenuItem
                                                                key={option.key}
                                                                onSelect={() => onSelectProjectIcon(project, option.key)}
                                                                className={cn(selected ? 'bg-muted' : '', 'flex gap-2')}
                                                            >
                                                                <OptionIcon size={13} />
                                                                {option.label}
                                                            </ContextMenuItem>
                                                        );
                                                    })}
                                                </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <ContextMenuSeparator />
                                            <ContextMenuItem disabled={isDisabled} onSelect={() => onStartEdit(project)}>
                                                <Pencil size={13} className="mr-1.5" />
                                                Edit project
                                            </ContextMenuItem>
                                            <ContextMenuItem disabled={isDisabled} onSelect={() => onOpenProjectInExplorer(project)}>
                                                <FolderOpen size={13} className="mr-1.5" />
                                                Open in file explorer
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                disabled={isDeleting || isOpening}
                                                onSelect={() => onRequestDelete(project)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 size={13} className="mr-1.5" />
                                                Delete project
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </ContextMenu>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="m-3 rounded-sm bg-error/10 px-3 py-2 text-small text-error">
                    {error}
                </div>
            )}
        </section>
    );
};
