import React from 'react';
import { Globe } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

export const SettingsRegion: React.FC = () => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Globe size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Regional Settings</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Locality and language preferences.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="space-y-1.5">
                    <Label>Preferred Language</Label>
                    <Select value="en" disabled>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">English (United States)</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Zentro is currently optimized for English.</p>
                </div>
            </div>
        </div>
    );
};
