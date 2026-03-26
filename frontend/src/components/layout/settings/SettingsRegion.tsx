import React from 'react';
import { Globe } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';

export const SettingsRegion: React.FC = () => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Globe size={18} strokeWidth={2.5} />
                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Regional Settings</h2>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                    Locality and language preferences.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex flex-col">
                    <label className={SettingsClasses.label}>Preferred Language</label>
                    <select className={SettingsClasses.input} disabled>
                        <option value="en">English (United States)</option>
                    </select>
                    <span className={SettingsClasses.hint}>Zentro is currently optimized for English.</span>
                </div>
            </div>
        </div>
    );
};
