import React from 'react';
import { Layers3, Plus, Sparkles } from 'lucide-react';
import { useConnectionStore } from '../../../stores/connectionStore';
import { useEnvironmentStore } from '../../../stores/environmentStore';
import { useProjectStore } from '../../../stores/projectStore';
import { DOM_EVENT } from '../../../lib/constants';
import { emitCommand } from '../../../lib/commandBus';
import { getEnvironmentLabel } from '../../../lib/projects';
import { Button } from '../../ui';
import { ConnectionTree } from '../ConnectionTree';

export const PrimaryExplorerPanel: React.FC = () => {
    const isConnected = useConnectionStore((state) => state.isConnected);
    const activeProject = useProjectStore((state) => state.activeProject);
    const activeEnvironmentKey = useEnvironmentStore((state) => state.activeEnvironmentKey);

    if (isConnected) {
        return <ConnectionTree />;
    }

    return (
        <div className="flex h-full flex-col gap-4 bg-background p-4">
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                    <Layers3 size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Explorer</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                    {activeProject
                        ? `${activeProject.name} / ${getEnvironmentLabel(activeEnvironmentKey || activeProject.default_environment_key)}`
                        : 'Open a project to browse schema objects.'}
                </p>
                <Button
                    type="button"
                    variant="default"
                    className="mt-4 h-8 w-full justify-center gap-1.5 text-xs"
                    onClick={() => emitCommand(DOM_EVENT.OPEN_ENVIRONMENT_SWITCHER)}
                >
                    <Plus size={13} />
                    New Connection
                </Button>
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4">
                <div className="mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Workflow
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Bind environments once, then switch quickly between dev/staging/prod from the toolbar.
                </p>
            </div>
        </div>
    );
};
