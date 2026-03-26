import React from 'react';
import { Laptop } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { SettingsClasses } from './SettingsStyles';

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
                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Appearance</h2>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                    Customize the visual personality of your workspace.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex flex-col">
                    <label className={SettingsClasses.label}>Interface Theme</label>
                    <select className={SettingsClasses.input} value={theme} onChange={(e) => onThemeChange(e.target.value)}>
                        <option value="system">System Preference</option>
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                    </select>
                    <span className={SettingsClasses.hint}>Follows your operating system's color scheme.</span>
                </div>

                <div className="flex flex-col">
                    <label className={SettingsClasses.label}>Editor Text Size</label>
                    <div className="flex items-center gap-4">
                        <input
                            className={cn(SettingsClasses.input, "max-w-[120px]")}
                            type="number"
                            min={8}
                            max={48}
                            value={fontSize}
                            onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 14)}
                        />
                        <span className="text-[13px] font-mono text-text-muted">Pixels</span>
                    </div>
                    <span className={SettingsClasses.hint}>Adjust for optimal code readability.</span>
                </div>
            </div>
        </div>
    );
};
