import React from 'react';
import { Laptop } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { FormField, Input, SelectField } from '../../ui';

interface Props {
    theme: string;
    onThemeChange: (val: string) => void;
    fontSize: number;
    onFontSizeChange: (val: number) => void;
}

export const SettingsAppearance: React.FC<Props> = ({ theme, onThemeChange, fontSize, onFontSizeChange }) => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Laptop size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Appearance</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Customize the visual personality of your project context.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <FormField label="Interface Theme" hint="Follows your operating system's color scheme.">
                    <SelectField value={theme} onValueChange={(value) => onThemeChange(value)}>
                        <option value="system">System Preference</option>
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                    </SelectField>
                </FormField>

                <FormField label="Editor Text Size" hint="Adjust for optimal code readability.">
                    <div className="flex items-center gap-4">
                        <Input
                            className="max-w-[120px]"
                            type="number"
                            min={8}
                            max={48}
                            value={fontSize}
                            onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 14)}
                        />
                        <span className="text-[13px] font-mono text-text-muted">Pixels</span>
                    </div>
                </FormField>
            </div>
        </div>
    );
};
