import React from 'react';
import { Gift } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { Switch } from '../../ui';

interface Props {
    autoCheckUpdates: boolean;
    onAutoCheckUpdatesChange: (val: boolean) => void;
}

export const SettingsUpdates: React.FC<Props> = ({ autoCheckUpdates, onAutoCheckUpdatesChange }) => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Gift size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Updates</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Keep Zentro up to date with the latest features.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex items-center justify-between rounded-sm bg-muted/35 px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-small font-semibold text-foreground">Auto-Check For Updates</span>
                        <span className="text-label text-muted-foreground">Automatically notify when a new version is available.</span>
                    </div>
                    <Switch
                        checked={autoCheckUpdates}
                        onCheckedChange={onAutoCheckUpdatesChange}
                        aria-label="Auto-Check For Updates"
                    />
                </div>
                {autoCheckUpdates && (
                    <span className="text-label text-muted-foreground">We will check securely when the app is launched.</span>
                )}
            </div>
        </div>
    );
};
