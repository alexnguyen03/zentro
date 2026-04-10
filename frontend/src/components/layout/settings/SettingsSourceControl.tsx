import React from 'react';
import { GitBranch } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { Switch } from '../../ui';

interface Props {
    enabled: boolean;
    checked: boolean;
    saving?: boolean;
    repoPath?: string;
    onToggle: (checked: boolean) => void;
}

export const SettingsSourceControl: React.FC<Props> = ({
    enabled,
    checked,
    saving = false,
    repoPath,
    onToggle,
}) => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="mb-1 flex items-center gap-2.5 text-accent">
                    <GitBranch size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Source Control</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Configure project-level Git behavior on app shutdown.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex items-center justify-between rounded-md bg-muted/35 px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[12px] font-semibold text-foreground">Auto commit on app exit</span>
                        <span className="text-[11px] text-muted-foreground">
                            Stage all + commit pending changes in this project repository before closing.
                        </span>
                    </div>
                    <Switch
                        checked={checked}
                        onCheckedChange={onToggle}
                        disabled={!enabled || saving}
                        aria-label="Auto commit on app exit"
                    />
                </div>
                {!enabled ? (
                    <span className="text-[11px] text-muted-foreground">
                        Requires an active project with a configured Git repo path.
                    </span>
                ) : (
                    <span className="truncate text-[11px] text-muted-foreground" title={repoPath || ''}>
                        Repo: {repoPath}
                    </span>
                )}
            </div>
        </div>
    );
};

