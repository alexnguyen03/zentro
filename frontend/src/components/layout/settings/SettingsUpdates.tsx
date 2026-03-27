import React from 'react';
import { Gift } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { useSettingsStore } from '../../../stores/settingsStore';

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
                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Updates</h2>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                    Keep Zentro up to date with the latest features.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex items-center justify-between p-4 rounded-md bg-bg-tertiary/20 border border-border/5">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-bold text-text-primary">Auto-Check For Updates</span>
                        <span className="text-[11px] text-text-muted">Automatically notify when a new version is available.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={autoCheckUpdates}
                            onChange={(e) => onAutoCheckUpdatesChange(e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-border/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                </div>
                {autoCheckUpdates && (
                    <span className={SettingsClasses.hint}>We will check securely when the app is launched.</span>
                )}
            </div>
        </div>
    );
};
