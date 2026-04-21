import React from 'react';
import { Laptop } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

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
                <div className="space-y-1.5">
                    <Label>Interface Theme</Label>
                    <Select value={theme}
                        onValueChange={(value) => onThemeChange(value)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="system">System Preference</SelectItem>
                            <SelectItem value="light">Light Mode</SelectItem>
                            <SelectItem value="dark">Dark Mode</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Follows your operating system's color scheme.</p>
                </div>

                <div className="space-y-1.5">
                    <Label>Editor Text Size</Label>
                    <div className="flex items-center gap-4">
                        <Input
                            className="max-w-[120px]"
                            type="number"
                            min={8}
                            size="sm"
                            max={48}
                            value={fontSize}
                            onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 14)}
                        />
                        <span className="text-[13px] font-mono text-muted-foreground">Pixels</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Adjust for optimal code readability.</p>
                </div>
            </div>
        </div>
    );
};
