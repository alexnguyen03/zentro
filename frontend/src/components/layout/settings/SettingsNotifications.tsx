import React from 'react';
import { Bell } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import type { ToastPlacement } from '../Toast';
import { FormField, SelectField } from '../../ui';

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
                <FormField label="Alert Placement" hint="Where success and error messages will emerge.">
                    <SelectField
                        value={toastPlacement}
                        onValueChange={(value) => onToastPlacementChange(value as ToastPlacement)}
                    >
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-right">Top Right</option>
                    </SelectField>
                </FormField>
            </div>
        </div>
    );
};
