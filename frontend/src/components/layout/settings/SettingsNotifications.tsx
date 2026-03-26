import React from 'react';
import { Bell } from 'lucide-react';
import { SettingsClasses } from './SettingsStyles';
import type { ToastPlacement } from '../Toast';

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
                    <h2 className="text-[17px] font-bold tracking-tight text-text-primary">Notifications</h2>
                </div>
                <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                    Configure how and where system alerts appear.
                </p>
            </div>
            <div className={SettingsClasses.sectionContent}>
                <div className="flex flex-col">
                    <label className={SettingsClasses.label}>Alert Placement</label>
                    <select className={SettingsClasses.input} value={toastPlacement} onChange={(e) => onToastPlacementChange(e.target.value as ToastPlacement)}>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-right">Top Right</option>
                    </select>
                    <span className={SettingsClasses.hint}>Where success and error messages will emerge.</span>
                </div>
            </div>
        </div>
    );
};
