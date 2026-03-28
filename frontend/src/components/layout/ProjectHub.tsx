import React from 'react';
import { Plus } from 'lucide-react';
import { Disconnect } from '../../services/connectionService';
import { useProjectStore } from '../../stores/projectStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Button, ModalBackdrop, ModalFrame, Spinner } from '../ui';
import { cn } from '../../lib/cn';
import { useToast } from './Toast';
import { sortProjects } from './projectHubMeta';
import { ProjectWizard } from './project/ProjectWizard';
import appIcon from '../../assets/images/appicon.png';

type Surface = 'entry' | 'wizard';

interface ProjectHubProps {
    overlay?: boolean;
    startupMode?: boolean;
    onClose?: () => void;
}

export const ProjectHub: React.FC<ProjectHubProps> = ({ overlay = false, startupMode = false, onClose }) => {
    const { projects, isLoading, error, openProject } = useProjectStore();
    const resetRuntime = useConnectionStore((s) => s.resetRuntime);
    const { toast } = useToast();

    const [surface, setSurface] = React.useState<Surface>('entry');
    const [openingProjectId, setOpeningProjectId] = React.useState<string | null>(null);

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

    const content = (
        <div className={cn(
            'overflow-hidden bg-bg-secondary text-text-primary transition-all duration-200',
            overlay
                ? surface === 'wizard'
                    ? 'h-[680px] w-[840px] max-w-[calc(100vw-24px)] rounded-md'
                    : 'h-[470px] w-[760px] max-w-[calc(100vw-24px)] rounded-md'
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
                                    <div className="mt-3 flex h-57.5 items-center justify-center rounded-md border border-dashed border-border/45 bg-bg-secondary/35 px-4 text-center">
                                        <div className="max-w-70">
                                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-bg-secondary text-text-primary"><Plus size={16} /></div>
                                            <div className="mt-3 text-[14px] font-semibold text-text-primary">No project</div>
                                            <div className="mt-1 text-[11px] text-text-secondary">Create one to get started.</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mb-3 h-80 min-h-0 overflow-y-auto pr-1 space-y-1.5">
                                        {visibleProjects.map((project) => (
                                            <button
                                                key={project.id}
                                                data-testid={`recent-project-${project.id}`}
                                                type="button"
                                                onClick={() => void handleOpenProject(project.id)}
                                                disabled={openingProjectId !== null}
                                                className="flex cursor-pointer hover:opacity-80 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors disabled:opacity-60"
                                            >
                                                <span className="truncate text-[16px] font-medium text-accent">{project.name}</span>
                                                {openingProjectId === project.id && <Spinner size={12} className="ml-3 shrink-0 text-accent" />}
                                            </button>
                                        ))}
                                        {error && (
                                            <div className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[12px] text-error">{error}</div>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-between items-center ">
                                    <div className="text-[11px] text-text-secondary">{visibleProjects.length} projects</div>
                                    <Button
                                        variant="primary"
                                        onClick={() => setSurface('wizard')}
                                        size="sm"
                                        className="rounded-md px-4"
                                    >
                                        Create
                                    </Button>
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
