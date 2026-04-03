import React from 'react';
import { Bell } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import type { ToastPlacement } from '../Toast';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

interface Props {
    toastPlacement: ToastPlacement;
    onToastPlacementChange: (val: ToastPlacement) => void;
}

export const SettingsNotifications: React.FC<Props> = ({ toastPlacement, onToastPlacementChange }) => {
    return (
        <div className={SettingsClasses.section}>
            <div className={SettingsClasses.sectionInfo}>
                <div className="flex items-center gap-2.5 text-accent mb-1">
                    <Bell size={18} strokeWidth={2.5} />
                    <h2 className={SettingsClasses.sectionTitle}>Notifications</h2>
                </div>
                <p className={SettingsClasses.sectionDescription}>
                    Configure how and where system alerts appear.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="space-y-1.5">
                    <Label>Alert Placement</Label>
                    <Select
                        value={toastPlacement}
                        onValueChange={(value) => onToastPlacementChange(value as ToastPlacement)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            <SelectItem value="bottom-center">Bottom Center</SelectItem>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                            <SelectItem value="top-left">Top Left</SelectItem>
                            <SelectItem value="top-center">Top Center</SelectItem>
                            <SelectItem value="top-right">Top Right</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Where success and error messages will emerge.</p>
                </div>
            </div>
        </div>
    );
};
