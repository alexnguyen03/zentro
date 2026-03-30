import React from 'react';
import { Globe } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { FormField, SelectField } from '../../ui';

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
                <FormField label="Preferred Language" hint="Zentro is currently optimized for English.">
                    <SelectField disabled>
                        <option value="en">English (United States)</option>
                    </SelectField>
                </FormField>
            </div>
        </div>
    );
};
