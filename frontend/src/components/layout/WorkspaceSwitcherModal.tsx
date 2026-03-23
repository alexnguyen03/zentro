import React from 'react';
import { ChevronRight, LayoutTemplate, Plus } from 'lucide-react';
import { ModalBackdrop, Button, Input } from '../ui';
import { useProjectStore } from '../../stores/projectStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { getEnvironmentMeta } from '../../lib/projects';
import { cn } from '../../lib/cn';
import type { Workspace, WorkspaceType } from '../../types/project';
import { useToast } from './Toast';

interface WorkspaceSwitcherModalProps {
    onClose: () => void;
}

const workspaceTypeOptions: { value: WorkspaceType; label: string; description: string }[] = [
    { value: 'scratch', label: 'Scratch', description: 'Fast ad-hoc querying and quick checks.' },
    { value: 'analysis', label: 'Analysis', description: 'Longer-running investigation and saved context.' },
    { value: 'inspection', label: 'Inspection', description: 'Safer read-heavy review and validation work.' },
];

function formatUpdatedLabel(value?: string) {
    if (!value) return 'Recently used';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently used';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({ onClose }) => {
    const activeProject = useProjectStore((state) => state.activeProject);
    const saveProject = useProjectStore((state) => state.saveProject);
    const setLastWorkspace = useProjectStore((state) => state.setLastWorkspace);
    const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
    const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);
    const { toast } = useToast();

    const [name, setName] = React.useState('');
    const [workspaceType, setWorkspaceType] = React.useState<WorkspaceType>('scratch');
    const [isSaving, setIsSaving] = React.useState(false);

    const workspaces = React.useMemo(
        () => [...(activeProject?.workspaces || [])].sort((a, b) => (b.last_opened_at || '').localeCompare(a.last_opened_at || '')),
        [activeProject]
    );

    const handleSwitch = async (workspace: Workspace) => {
        setActiveWorkspace(workspace.id);
        const saved = await setLastWorkspace(workspace.id);
        if (!saved) {
            toast.error('Failed to switch workspace cleanly.');
            return;
        }
        onClose();
    };

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!activeProject) return;

        const trimmedName = name.trim();
        if (!trimmedName) return;

        const environmentKey = activeEnvironmentKey || activeProject.default_environment_key;
        const now = new Date().toISOString();
        const newWorkspace: Workspace = {
            id: crypto.randomUUID(),
            project_id: activeProject.id,
            environment_key: environmentKey,
            name: trimmedName,
            type: workspaceType,
            last_opened_at: now,
        };

        setIsSaving(true);
        const saved = await saveProject({
            ...activeProject,
            last_workspace_id: newWorkspace.id,
            workspaces: [...(activeProject.workspaces || []), newWorkspace],
        });
        setIsSaving(false);

        if (!saved) {
            toast.error('Could not create workspace.');
            return;
        }

        setActiveWorkspace(newWorkspace.id);
        setName('');
        toast.success(`Workspace "${trimmedName}" created.`);
        onClose();
    };

    if (!activeProject) return null;

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="w-[880px] max-w-[calc(100vw-40px)] h-[560px] overflow-hidden rounded-3xl border border-border/30 bg-bg-secondary text-text-primary shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="grid h-full md:grid-cols-[1.1fr_0.9fr]">
                    <section className="flex min-h-0 flex-col border-r border-border/20 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))]">
                        <div className="border-b border-white/8 px-7 py-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                                <LayoutTemplate size={12} />
                                Workspaces
                            </div>
                            <h2 className="mt-4 text-[26px] font-black tracking-[-0.03em] text-white">
                                Switch the task context, not the whole project.
                            </h2>
                            <p className="mt-2 max-w-[460px] text-[13px] leading-6 text-white/65">
                                Keep different query threads isolated by workspace so the editor, results, and environment context stay easier to reason about.
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                            <div className="space-y-3">
                                {workspaces.map((workspace) => {
                                    const isActive = workspace.id === activeWorkspaceId;
                                    const envMeta = getEnvironmentMeta(workspace.environment_key);
                                    return (
                                        <button
                                            key={workspace.id}
                                            onClick={() => void handleSwitch(workspace)}
                                            className={cn(
                                                'group w-full rounded-2xl border px-4 py-4 text-left transition-all',
                                                isActive
                                                    ? 'border-accent/40 bg-white/8'
                                                    : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                                            )}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-white">
                                                    <LayoutTemplate size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="truncate text-[15px] font-bold tracking-tight text-white">{workspace.name}</h3>
                                                        <span className={cn(
                                                            'rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                                                            envMeta.colorClass
                                                        )}>
                                                            {workspace.environment_key}
                                                        </span>
                                                        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/60">
                                                            {workspace.type}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-[12px] text-white/55">
                                                        Last opened {formatUpdatedLabel(workspace.last_opened_at)}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 self-center text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70">
                                                    <ChevronRight size={16} />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}

                                {workspaces.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center text-[12px] text-white/55">
                                        No workspaces yet. Create one on the right and Zentro will start restoring its own editor and result context.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-col bg-bg-secondary">
                        <div className="border-b border-border/20 px-7 py-6">
                            <h3 className="text-[18px] font-bold tracking-tight text-text-primary">Create Workspace</h3>
                            <p className="mt-1 text-[12px] leading-5 text-text-secondary">
                                Add a focused workspace inside <span className="font-semibold text-text-primary">{activeProject.name}</span> without leaving the current project flow.
                            </p>
                        </div>

                        <form className="flex min-h-0 flex-1 flex-col px-7 py-6" onSubmit={handleCreate}>
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                                        Workspace Name
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        placeholder="Release validation"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                                        Workspace Type
                                    </label>
                                    <div className="grid gap-2">
                                        {workspaceTypeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setWorkspaceType(option.value)}
                                                className={cn(
                                                    'rounded-2xl border px-4 py-3 text-left transition-all',
                                                    workspaceType === option.value
                                                        ? 'border-accent/40 bg-accent/10'
                                                        : 'border-border/40 bg-bg-primary/40 hover:border-border'
                                                )}
                                            >
                                                <div className="text-[13px] font-semibold text-text-primary">{option.label}</div>
                                                <div className="mt-1 text-[11px] leading-5 text-text-secondary">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/20 pt-5">
                                <p className="m-0 text-[11px] leading-5 text-text-muted">
                                    New workspaces inherit the current project and start on the currently active environment.
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" type="button" onClick={onClose}>
                                        Close
                                    </Button>
                                    <Button
                                        variant="primary"
                                        type="submit"
                                        disabled={isSaving || !name.trim()}
                                        className="gap-2"
                                    >
                                        <Plus size={14} />
                                        {isSaving ? 'Creating...' : 'Create Workspace'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </ModalBackdrop>
    );
};
