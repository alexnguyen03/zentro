import React from 'react';
import { ArrowRight, FolderPlus, Layers3, Sparkles } from 'lucide-react';
import { Disconnect } from '../../../wailsjs/go/app/App';
import { Button, Input, ModalBackdrop } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { getEnvironmentMeta } from '../../lib/projects';
import { cn } from '../../lib/cn';

interface ProjectHubProps {
    overlay?: boolean;
    onClose?: () => void;
}

function formatDateLabel(value?: string) {
    if (!value) return 'Just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently updated';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, onClose }) => {
    const { projects, isLoading, error, openProject, createProject } = useProjectStore();
    const { setActiveProfile, setConnectionStatus, setDatabases, setIsConnected } = useConnectionStore();
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);

    const sortedProjects = React.useMemo(
        () => [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
        [projects]
    );

    const handleOpenProject = async (projectId: string) => {
        try {
            await Disconnect();
        } catch {
            // ignore and continue opening the project
        }
        setActiveProfile(null);
        setConnectionStatus('disconnected');
        setDatabases([]);
        setIsConnected(false);

        const project = await openProject(projectId);
        if (project && onClose) onClose();
    };

    const handleCreateProject = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const nextName = name.trim();
        const nextDescription = description.trim();
        if (!nextName) return;

        setIsCreating(true);
        const project = await createProject({
            name: nextName,
            description: nextDescription,
            tags: [],
        });
        setIsCreating(false);
        if (project) {
            setName('');
            setDescription('');
            onClose?.();
        }
    };

    const content = (
        <div className={cn(
            'bg-bg-secondary text-text-primary overflow-hidden',
            overlay
                ? 'border border-border/40 rounded-3xl w-[1040px] max-w-[calc(100vw-48px)] h-[680px] shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
                : 'w-full h-full'
        )}>
            <div className="grid h-full md:grid-cols-[1.15fr_0.85fr]">
                <section className="relative overflow-hidden border-r border-border/20 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_28%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(17,24,39,0.88))]">
                    <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                    <div className="relative h-full flex flex-col justify-between p-10">
                        <div className="space-y-6 text-left">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-text-secondary">
                                <Layers3 size={12} />
                                Project Hub
                            </div>
                            <div className="space-y-4 max-w-[480px]">
                                <h1 className="m-0 text-[40px] leading-[1.05] font-black tracking-[-0.04em] text-white">
                                    Open a project and drop straight into focused SQL work.
                                </h1>
                                <p className="m-0 text-[14px] leading-6 text-white/70">
                                    Zentro v2 starts from project context, not loose connections. Keep environments explicit, recover work faster, and leave room for enterprise-grade guardrails without slowing down the daily flow.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3 text-left">
                            {[
                                ['Project-first', 'Workspaces, assets, and environment context stay tied to the project from the start.'],
                                ['Lean execution', 'Open project, run query, inspect result. Secondary actions stay out of the way.'],
                                ['Enterprise-ready', 'Fixed environment semantics and safety posture scale later without changing the core flow.'],
                            ].map(([title, body]) => (
                                <div key={title} className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                                    <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-white/80">{title}</div>
                                    <p className="m-0 text-[12px] leading-5 text-white/60">{body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="flex h-full flex-col bg-bg-secondary">
                    <div className="flex items-center justify-between border-b border-border/20 px-8 py-6">
                        <div>
                            <h2 className="m-0 text-[20px] font-bold tracking-tight text-text-primary">Projects</h2>
                            <p className="m-0 mt-1 text-[12px] text-text-secondary">
                                {sortedProjects.length > 0
                                    ? 'Choose a project to resume its last workspace.'
                                    : 'Create your first project to bootstrap the new v2 flow.'}
                            </p>
                        </div>
                        {overlay && onClose && (
                            <Button variant="ghost" size="sm" onClick={onClose}>
                                Close
                            </Button>
                        )}
                    </div>

                    <div className="grid min-h-0 flex-1 gap-0 md:grid-rows-[1fr_auto]">
                        <div className="min-h-0 overflow-y-auto px-6 py-5">
                            <div className="space-y-3">
                                {sortedProjects.length === 0 && !isLoading ? (
                                    <div className="rounded-2xl border border-dashed border-border/60 bg-bg-tertiary/20 px-6 py-10 text-center">
                                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                                            <Sparkles size={20} />
                                        </div>
                                        <h3 className="m-0 text-[15px] font-semibold text-text-primary">No projects yet</h3>
                                        <p className="m-0 mt-2 text-[12px] leading-5 text-text-secondary">
                                            Start with a project so environments, workspaces, and future visualizations stay organized around the work instead of raw connection entries.
                                        </p>
                                    </div>
                                ) : (
                                    sortedProjects.map((project) => {
                                        const envKey = project.default_environment_key || 'loc';
                                        const envMeta = getEnvironmentMeta(envKey);
                                        const envCount = project.environments?.length ?? 0;
                                        const workspaceCount = project.workspaces?.length ?? 0;

                                        return (
                                            <button
                                                key={project.id}
                                                onClick={() => void handleOpenProject(project.id)}
                                                className="group w-full rounded-2xl border border-border/30 bg-bg-primary/40 p-4 text-left transition-all hover:border-accent/40 hover:bg-bg-tertiary/40"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                                                        <Layers3 size={18} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="m-0 truncate text-[15px] font-bold tracking-tight text-text-primary">{project.name}</h3>
                                                            <span className={cn(
                                                                'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                                                                envMeta.colorClass
                                                            )}>
                                                                {envKey}
                                                            </span>
                                                        </div>
                                                        <p className="m-0 mt-1 line-clamp-2 text-[12px] leading-5 text-text-secondary">
                                                            {project.description || 'No description yet. This project is ready to be used as the execution root for environments and workspaces.'}
                                                        </p>
                                                        <div className="mt-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                                            <span>{envCount} env</span>
                                                            <span>{workspaceCount} workspace</span>
                                                            <span>Updated {formatDateLabel(project.updated_at)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 self-center text-text-secondary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text-primary">
                                                        <ArrowRight size={16} />
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}

                                {error && (
                                    <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-[12px] text-error">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-border/20 bg-bg-primary/20 px-6 py-5">
                            <form className="space-y-3" onSubmit={handleCreateProject}>
                                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                                    <FolderPlus size={13} />
                                    Create Project
                                </div>
                                <Input
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Payments Platform"
                                    autoFocus={!overlay}
                                />
                                <Input
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Project description"
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <p className="m-0 text-[11px] leading-5 text-text-muted">
                                        A new project starts with a default local environment and a ready workspace.
                                    </p>
                                    <Button
                                        variant="primary"
                                        type="submit"
                                        disabled={isCreating || isLoading || !name.trim()}
                                        className="shrink-0"
                                    >
                                        {isCreating ? 'Creating...' : 'Create'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );

    if (overlay) {
        return (
            <ModalBackdrop onClose={onClose}>
                <div onClick={(event) => event.stopPropagation()}>
                    {content}
                </div>
            </ModalBackdrop>
        );
    }

    return content;
};
