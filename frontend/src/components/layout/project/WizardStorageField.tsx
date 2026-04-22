import React from 'react';
import { AlertTriangle, FolderOpen } from 'lucide-react';
import { Button, Input } from '../../ui';
import type { Project } from '../../../types/project';

interface WizardStorageFieldProps {
    mode: 'create' | 'edit';
    storageParentPath?: string;
    storagePath?: string;
    storagePathPreview: string;
    loadingRoot: boolean;
    pathConflictProject: Project | null;
    onChange: (value: string) => void;
    onPickFolder: () => void | Promise<void>;
}

export const WizardStorageField: React.FC<WizardStorageFieldProps> = ({
    mode,
    storageParentPath = '',
    storagePath = '',
    storagePathPreview,
    loadingRoot,
    pathConflictProject,
    onChange,
    onPickFolder,
}) => {
    const isEditMode = mode === 'edit';
    const inputValue = isEditMode ? storagePath : storageParentPath;
    const placeholder = loadingRoot
        ? 'Loading default storage root...'
        : isEditMode
          ? 'Set project folder path'
          : 'Choose parent folder...';

    return (
        <div>
            <div className="flex items-center gap-1.5">
                <Input
                    value={inputValue}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    size="sm"
                    className="bg-card"
                />
                <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => void onPickFolder()}
                    disabled={loadingRoot}
                    title="Browse folder"
                >
                    <FolderOpen size={13} />
                </Button>
            </div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground/70" title={storagePathPreview || undefined}>
                {storagePathPreview || 'Uses the app default location.'}
            </div>
            {pathConflictProject && (
                <div
                    className="mt-1 flex items-center gap-1 text-[11px] text-amber-500"
                    title={`Folder is already used by project "${pathConflictProject.name}"`}
                >
                    <AlertTriangle size={11} className="shrink-0" />
                    <span>Already used by <span className="font-semibold">{pathConflictProject.name}</span>.</span>
                </div>
            )}
        </div>
    );
};
