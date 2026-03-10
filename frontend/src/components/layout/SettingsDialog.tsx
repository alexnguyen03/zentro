import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { utils } from '../../../wailsjs/go/models';
import { Modal } from './Modal';
import { cn } from '../../lib/cn';

export const SettingsDialog: React.FC = () => {
    const { isOpen, closeModal, theme, fontSize, defaultLimit, toastPlacement, save } = useSettingsStore();

    const [formTheme, setFormTheme] = useState(theme);
    const [formFontSize, setFormFontSize] = useState(fontSize);
    const [formLimit, setFormLimit] = useState(defaultLimit);
    const [formToastPlacement, setFormToastPlacement] = useState(toastPlacement);

    useEffect(() => {
        if (isOpen) {
            setFormTheme(theme);
            setFormFontSize(fontSize);
            setFormLimit(defaultLimit);
            setFormToastPlacement(toastPlacement);
        }
    }, [isOpen, theme, fontSize, defaultLimit, toastPlacement]);

    const handleSave = () => {
        save(new utils.Preferences({
            theme: formTheme,
            font_size: formFontSize,
            default_limit: formLimit,
            toast_placement: formToastPlacement
        }));
    };

    const labelClass = "block text-xs font-semibold text-text-secondary mb-1";
    const inputClass = "w-full bg-bg-primary border border-border text-text-primary text-[13px] px-3 py-1.5 rounded outline-none transition-colors focus:border-success disabled:opacity-50 disabled:cursor-not-allowed";
    const hintClass = "block text-xs text-text-muted mt-1 italic";

    const footer = (
        <>
            <button
                className="bg-transparent border border-border text-text-primary px-4 py-1.5 rounded cursor-pointer text-[13px] transition-colors hover:bg-bg-tertiary"
                onClick={closeModal}
            >
                Cancel
            </button>
            <button
                className="bg-success text-white border-none px-4 py-1.5 rounded cursor-pointer text-[13px] font-medium transition-colors flex items-center gap-1.5 hover:brightness-110 active:translate-y-px"
                onClick={handleSave}
            >
                <Save size={14} /> Save
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={closeModal}
            title="Zentro Settings"
            width={500}
            footer={footer}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                    <label className={labelClass}>Theme</label>
                    <select className={inputClass} value={formTheme} onChange={(e) => setFormTheme(e.target.value)}>
                        <option value="system">System Default</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                    <span className={hintClass}>Requires app restart to fully apply editor theme.</span>
                </div>

                <div className="flex flex-col">
                    <label className={labelClass}>Editor Font Size (px)</label>
                    <input
                        className={inputClass}
                        type="number"
                        min={10}
                        max={24}
                        value={formFontSize}
                        onChange={(e) => setFormFontSize(parseInt(e.target.value) || 14)}
                    />
                </div>

                <div className="flex flex-col">
                    <label className={labelClass}>Toast Message Position</label>
                    <select className={inputClass} value={formToastPlacement} onChange={(e) => setFormToastPlacement(e.target.value as any)}>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-right">Top Right</option>
                    </select>
                    <span className={hintClass}>Choose where notification toasts will appear on screen.</span>
                </div>

                <div className="flex flex-col">
                    <label className={labelClass}>Default Query Limit</label>
                    <select className={inputClass} value={formLimit} onChange={(e) => setFormLimit(parseInt(e.target.value) || 1000)}>
                        <option value={100}>100 rows</option>
                        <option value={500}>500 rows</option>
                        <option value={1000}>1,000 rows</option>
                        <option value={5000}>5,000 rows</option>
                        <option value={10000}>10,000 rows</option>
                    </select>
                    <span className={hintClass}>Automatically applied to SELECT queries without a LIMIT clause.</span>
                </div>
            </div>
        </Modal>
    );
};
